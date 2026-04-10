const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve Frontend (Robust path for Local & Docker)
const frontendPath = fs.existsSync(path.join(__dirname, 'frontend')) 
    ? path.join(__dirname, 'frontend') 
    : path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Serve Uploads (from sub folder)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer storage setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ================= API ROUTES =================

// ----- Finance API -----
app.post('/api/finance', async (req, res) => {
    const { month, income, expenses, saving } = req.body;
    const remaining = (income || 0) - (expenses || 0) - (saving || 0);
    try {
        const sql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            income = VALUES(income), 
            expenses = VALUES(expenses), 
            saving = VALUES(saving), 
            remaining = VALUES(remaining)
        `;
        const [result] = await db.query(sql, [month, income, expenses, saving, remaining]);
        res.json({ success: true, id: result.insertId || month });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/finance/income', async (req, res) => {
    const { amount, title } = req.body;
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
        const sql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, ?, 0, 0, ?) 
            ON DUPLICATE KEY UPDATE 
            income = income + ?, 
            remaining = remaining + ?
        `;
        await db.query(sql, [currentMonth, amount, amount, amount, amount]);
        
        // ✨ Log Activity
        await db.query(
            "INSERT INTO activity_log (type, title, amount) VALUES ('income', ?, ?)",
            [title || 'Thu nhập mới', amount]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/finance/saving', async (req, res) => {
    const { amount, title } = req.body;
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
        const sql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, 0, 0, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            saving = saving + ?, 
            remaining = remaining - ?
        `;
        await db.query(sql, [currentMonth, amount, -amount, amount, amount]);
        
        // ✨ Log Activity
        await db.query(
            "INSERT INTO activity_log (type, title, amount) VALUES ('saving', ?, ?)",
            [title || 'Tiết kiệm mới', amount]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/finance', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM monthly_finance ORDER BY month DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- Goals API -----
app.post('/api/goals', async (req, res) => {
    const { goal_name, target_amount, deadline_months, current_saved } = req.body;
    const progress = (current_saved / target_amount) * 100;
    try {
        const [result] = await db.query(
            `INSERT INTO saving_goals (goal_name, target_amount, deadline_months, current_saved, progress) VALUES (?, ?, ?, ?, ?)`,
            [goal_name, target_amount, deadline_months, current_saved, progress]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/goals', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM saving_goals");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- Purchases API -----
app.post('/api/purchases', upload.single('photo'), async (req, res) => {
    const { item_name, amount } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        const [result] = await db.query(
            `INSERT INTO purchases (item_name, amount, photo_path) VALUES (?, ?, ?)`,
            [item_name, amount, photo_path]
        );
        
        // ✨ Log Activity
        await db.query(
            "INSERT INTO activity_log (type, title, amount, photo_path) VALUES ('expense', ?, ?, ?)",
            [item_name, amount, photo_path]
        );

        res.json({ success: true, id: result.insertId, photo_path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/purchases', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM purchases ORDER BY created_at DESC LIMIT 20");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- Tasks API -----
app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM tasks ORDER BY start_time ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    const { task_name, weekday, start_time, end_time } = req.body;
    try {
        // Handle both single string and array of weekdays
        const weekdays = Array.isArray(weekday) ? weekday : [weekday];
        const results = [];
        
        for (const day of weekdays) {
            const [result] = await db.query(
                `INSERT INTO tasks (task_name, weekday, start_time, end_time) VALUES (?, ?, ?, ?)`,
                [task_name, day, start_time, end_time]
            );
            results.push({ day, id: result.insertId });
        }
        res.json({ success: true, count: results.length, tasks: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { task_name, start_time, end_time } = req.body;
    try {
        await db.query(
            `UPDATE tasks SET task_name = ?, start_time = ?, end_time = ? WHERE id = ?`,
            [task_name, start_time, end_time, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`DELETE FROM tasks WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks/start', upload.single('photo'), async (req, res) => {
    const { id } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        const [rows] = await db.query("SELECT task_name FROM tasks WHERE id = ?", [id]);
        const taskName = rows[0] ? rows[0].task_name : 'Công việc';

        await db.query(`UPDATE tasks SET status = 'ongoing', photo_start_path = ?, started_at = NOW() WHERE id = ?`, [photo_path, id]);
        
        // ✨ Log Activity Immediately
        await db.query(
            "INSERT INTO activity_log (type, title, photo_path) VALUES ('task_started', ?, ?)",
            [`Đã bắt đầu: ${taskName}`, photo_path]
        );

        res.json({ success: true, photo_path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks/complete', upload.single('photo'), async (req, res) => {
    const { id } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        const [rows] = await db.query("SELECT task_name FROM tasks WHERE id = ?", [id]);
        const taskName = rows[0] ? rows[0].task_name : 'Công việc';

        await db.query(`UPDATE tasks SET status = 'done', photo_path = ? WHERE id = ?`, [photo_path, id]);
        
        // ✨ Log Completion
        await db.query(
            "INSERT INTO activity_log (type, title, photo_path) VALUES ('task_done', ?, ?)",
            [`Đã hoàn thành: ${taskName}`, photo_path]
        );

        res.json({ success: true, photo_path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks/skip', async (req, res) => {
    const { id, reason, status } = req.body;
    const finalStatus = status || 'skipped';
    try {
        const [rows] = await db.query("SELECT task_name FROM tasks WHERE id = ?", [id]);
        const taskName = rows[0] ? rows[0].task_name : 'Công việc';

        await db.query(`UPDATE tasks SET status = ?, reason = ? WHERE id = ?`, [finalStatus, reason, id]);
        
        // ✨ Log Activity
        await db.query(
            "INSERT INTO activity_log (type, title) VALUES ('task_missed', ?)",
            [taskName]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- Unified Activity Log API -----
app.get('/api/activities', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----- Backup/Export API -----
app.get('/api/export', async (req, res) => {
    try {
        const [activities] = await db.query("SELECT * FROM activity_log");
        const [tasks] = await db.query("SELECT * FROM tasks");
        const [finance] = await db.query("SELECT * FROM monthly_finance");
        const [purchases] = await db.query("SELECT * FROM purchases");
        
        const backupData = {
            export_date: new Date().toISOString(),
            activities,
            tasks,
            finance,
            purchases
        };
        
        res.setHeader('Content-disposition', 'attachment; filename=matcha_backup.json');
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Summary Stats for Bot/Charts
app.get('/api/stats', async (req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
        const [financeRows] = await db.query(`SELECT * FROM monthly_finance WHERE month = ?`, [currentMonth]);
        const [purRows] = await db.query(`SELECT SUM(amount) as spent FROM purchases WHERE DATE_FORMAT(created_at, '%Y-%m') = ?`, [currentMonth]);
        const [taskRows] = await db.query(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`);
        
        res.json({
            finance: financeRows[0] || { income: 0, expenses: 0, saving: 0, remaining: 0 },
            spent: purRows[0]?.spent || 0,
            tasks: taskRows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// START
async function startServer() {
    try {
        await db.initDb();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`API Server is running on http://0.0.0.0:${PORT}`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
}

startServer();
