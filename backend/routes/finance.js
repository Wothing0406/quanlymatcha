const express = require('express');
const router = express.Router();
const db = require('../db.js');

// Helper to get current month
const getMonth = () => new Date().toISOString().slice(0, 7);

// Summary Stats for Bot/Charts
router.get('/stats', async (req, res) => {
    const currentMonth = getMonth();
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

// Full Finance Summary
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM monthly_finance ORDER BY month DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update/Initialize Month
router.post('/', async (req, res) => {
    const { month, income, expenses, saving } = req.body;
    const remaining = (income || 0) - (expenses || 0) - (saving || 0);
    try {
        const sql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            income = VALUES(income), expenses = VALUES(expenses), 
            saving = VALUES(saving), remaining = VALUES(remaining)
        `;
        const [result] = await db.query(sql, [month, income, expenses, saving, remaining]);
        res.json({ success: true, id: result.insertId || month });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Quick Income
router.post('/income', async (req, res) => {
    const { amount, title } = req.body;
    const currentMonth = getMonth();
    try {
        const sql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, ?, 0, 0, ?) 
            ON DUPLICATE KEY UPDATE income = income + ?, remaining = remaining + ?
        `;
        await db.query(sql, [currentMonth, amount, amount, amount, amount]);
        await db.logActivity('income', title || 'Thu nhập mới (từ Web)', amount);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Quick Saving
router.post('/saving', async (req, res) => {
    const { amount, title } = req.body;
    const currentMonth = getMonth();
    try {
        const sql = `
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (?, 0, 0, ?, ?) 
            ON DUPLICATE KEY UPDATE saving = saving + ?, remaining = remaining - ?
        `;
        await db.query(sql, [currentMonth, amount, -amount, amount, amount]);
        await db.logActivity('saving', title || 'Tiết kiệm mới (từ Web)', amount);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
