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
    const { amount } = req.body;
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
        const [result] = await db.query(
            `INSERT INTO tasks (task_name, weekday, start_time, end_time) VALUES (?, ?, ?, ?)`,
            [task_name, weekday, start_time, end_time]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks/complete', upload.single('photo'), async (req, res) => {
    const { id } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        await db.query(`UPDATE tasks SET status = 'done', photo_path = ? WHERE id = ?`, [photo_path, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks/skip', async (req, res) => {
    const { id, reason, status } = req.body;
    const finalStatus = status || 'skipped';
    try {
        await db.query(`UPDATE tasks SET status = ?, reason = ? WHERE id = ?`, [finalStatus, reason, id]);
        res.json({ success: true });
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Server is running on http://0.0.0.0:${PORT}`);
});
