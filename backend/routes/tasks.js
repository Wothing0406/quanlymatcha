const express = require('express');
const router = express.Router();
const db = require('../db.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use the same uploads directory defined in index.js
const uploadsDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM tasks ORDER BY start_time ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    const { task_name, weekday, start_time, end_time } = req.body;
    try {
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

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { task_name, start_time, end_time } = req.body;
    try {
        await db.query(`UPDATE tasks SET task_name = ?, start_time = ?, end_time = ? WHERE id = ?`, [task_name, start_time, end_time, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`DELETE FROM tasks WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/start', upload.single('photo'), async (req, res) => {
    const { id } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        const [rows] = await db.query("SELECT task_name FROM tasks WHERE id = ?", [id]);
        const taskName = rows[0] ? rows[0].task_name : 'Công việc';
        await db.query(`UPDATE tasks SET status = 'ongoing', photo_start_path = ?, started_at = NOW() WHERE id = ?`, [photo_path, id]);
        await db.query("INSERT INTO activity_log (type, title, photo_path) VALUES ('task_started', ?, ?)", [`Đã bắt đầu: ${taskName}`, photo_path]);
        res.json({ success: true, photo_path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/complete', upload.single('photo'), async (req, res) => {
    const { id } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    try {
        const [rows] = await db.query("SELECT task_name FROM tasks WHERE id = ?", [id]);
        const taskName = rows[0] ? rows[0].task_name : 'Công việc';
        await db.query(`UPDATE tasks SET status = 'done', photo_path = ? WHERE id = ?`, [photo_path, id]);
        await db.query("INSERT INTO activity_log (type, title, photo_path) VALUES ('task_done', ?, ?)", [`Đã hoàn thành: ${taskName}`, photo_path]);
        res.json({ success: true, photo_path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/skip', async (req, res) => {
    const { id, reason, status } = req.body;
    const finalStatus = status || 'skipped';
    try {
        const [rows] = await db.query("SELECT task_name FROM tasks WHERE id = ?", [id]);
        const taskName = rows[0] ? rows[0].task_name : 'Công việc';
        await db.query(`UPDATE tasks SET status = ?, reason = ? WHERE id = ?`, [finalStatus, reason, id]);
        await db.query("INSERT INTO activity_log (type, title) VALUES ('task_missed', ?)", [taskName]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
