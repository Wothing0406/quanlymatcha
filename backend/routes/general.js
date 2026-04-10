const express = require('express');
const router = express.Router();
const db = require('../db.js');
const multer = require('multer');
const path = require('path');

const uploadsDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Unified Activity Log with Pagination & Filtering
router.get('/activities', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const filterType = req.query.type; // 'all', 'task', 'purchase'
    
    try {
        let sql = "SELECT * FROM activity_log WHERE 1=1";
        const params = [];

        if (filterType && filterType !== 'all') {
            if (filterType === 'task') {
                sql += " AND type LIKE 'task_%'";
            } else if (filterType === 'purchase') {
                sql += " AND type IN ('expense', 'income', 'saving')";
            }
        }

        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi /activities:", err);
        res.status(500).json({ error: err.message });
    }
});



// Purchases
router.post('/purchases', upload.single('photo'), async (req, res) => {
    const { item_name, amount } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        const [result] = await db.query(
            `INSERT INTO purchases (item_name, amount, photo_path) VALUES (?, ?, ?)`,
            [item_name, amount, photo_path]
        );
        
        // --- V5.0 Persistence: Update monthly_finance ---
        const currentMonth = new Date().toISOString().slice(0, 7);
        const amountNum = Number(amount);
        const updateFinanceSql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, 0, ?, 0, ?) 
            ON DUPLICATE KEY UPDATE 
            expenses = expenses + ?, 
            remaining = remaining - ?
        `;
        await db.query(updateFinanceSql, [currentMonth, amountNum, -amountNum, amountNum, amountNum]);


        await db.query(
            "INSERT INTO activity_log (type, title, amount, photo_path) VALUES ('expense', ?, ?, ?)",
            [item_name, amount, photo_path]
        );
        res.json({ success: true, id: result.insertId, photo_path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }

});

router.get('/purchases', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM purchases ORDER BY created_at DESC LIMIT 20");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Goals
router.post('/goals', async (req, res) => {
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

router.get('/goals', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM saving_goals");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/goals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM saving_goals WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export
router.get('/export', async (req, res) => {
    try {
        const [activities] = await db.query("SELECT * FROM activity_log");
        const [tasks] = await db.query("SELECT * FROM tasks");
        const [finance] = await db.query("SELECT * FROM monthly_finance");
        const [purchases] = await db.query("SELECT * FROM purchases");
        
        const backupData = {
            export_date: new Date().toISOString(),
            activities, tasks, finance, purchases
        };
        
        res.setHeader('Content-disposition', 'attachment; filename=matcha_backup.json');
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
