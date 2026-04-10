const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Get User Stats (Level, Points, Pet State)
 */
router.get('/stats', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM user_stats WHERE id = 1');
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Stats not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Lỗi lấy stats:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
