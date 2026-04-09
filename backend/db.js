const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'mysql',
    user: process.env.DB_USER || 'matcha_user',
    password: process.env.DB_PASSWORD || 'matcha_pass',
    database: process.env.DB_NAME || 'matcha_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);
console.log('✅ Đã tạo MySQL Connection Pool.');

async function initDb() {
    let conn;
    try {
        console.log('🚀 Đang khởi tạo bảng dữ liệu MySQL...');
        
        // 1. monthly_finance
        await conn.query(`CREATE TABLE IF NOT EXISTS monthly_finance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month VARCHAR(7) UNIQUE,
            income DOUBLE DEFAULT 0,
            expenses DOUBLE DEFAULT 0,
            saving DOUBLE DEFAULT 0,
            remaining DOUBLE DEFAULT 0
        )`);

        // 2. saving_goals
        await conn.query(`CREATE TABLE IF NOT EXISTS saving_goals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            goal_name VARCHAR(255),
            target_amount DOUBLE DEFAULT 0,
            deadline_months INT DEFAULT 0,
            current_saved DOUBLE DEFAULT 0,
            progress DOUBLE DEFAULT 0
        )`);

        // 3. tasks
        await conn.query(`CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_name VARCHAR(255),
            weekday VARCHAR(50),
            start_time VARCHAR(10),
            end_time VARCHAR(10),
            status VARCHAR(50) DEFAULT 'pending',
            photo_path VARCHAR(500),
            reason TEXT,
            notified_start TINYINT(1) DEFAULT 0,
            notified_15m TINYINT(1) DEFAULT 0,
            notified_45m TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 4. purchases
        await conn.query(`CREATE TABLE IF NOT EXISTS purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_name VARCHAR(255),
            amount DOUBLE DEFAULT 0,
            photo_path VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✨ Khởi tạo bảng MySQL hoàn tất.');
    } catch (err) {
        console.error('❌ Lỗi khởi tạo MySQL:', err.message);
    } finally {
        conn.release();
    }
}

module.exports = {
    pool,
    initDb,
    query: (sql, params) => pool.query(sql, params),
    execute: (sql, params) => pool.execute(sql, params)
};
