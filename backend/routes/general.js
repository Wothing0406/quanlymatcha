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

// Unified Activity Log with Pagination
router.get('/activities', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const [rows] = await db.query(
            "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
        res.json(rows);
    } catch (err) {
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
