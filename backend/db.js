const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'mysql',
    user: process.env.MYSQL_USER || process.env.DB_USER || 'matcha_user',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || 'matcha_pass',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'matcha_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);
console.log('✅ Đã tạo MySQL Connection Pool.');

async function ensureColumnExists(conn, table, column, definition) {
    try {
        const [rows] = await conn.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
        if (rows.length === 0) {
            console.log(`🛠️ Migration: Adding column '${column}' to '${table}'...`);
            await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
    } catch (err) {
        console.error(`❌ Error migrating ${table}.${column}:`, err.message);
    }
}

async function initDb() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('🚀 Đang khởi tạo bảng dữ liệu MySQL (Chế độ tự động)...');
        
        // 1. monthly_finance
        await conn.query(`CREATE TABLE IF NOT EXISTS monthly_finance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month VARCHAR(7) UNIQUE,
            income DOUBLE DEFAULT 0,
            expenses DOUBLE DEFAULT 0,
            saving DOUBLE DEFAULT 0,
            remaining DOUBLE DEFAULT 0,
            score INT DEFAULT 0
        )`);
        await ensureColumnExists(conn, 'monthly_finance', 'score', 'INT DEFAULT 0');

        // 2. saving_goals
        await conn.query(`CREATE TABLE IF NOT EXISTS saving_goals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            goal_name VARCHAR(255),
            target_amount DOUBLE DEFAULT 0,
            deadline_months INT DEFAULT 0,
            current_saved DOUBLE DEFAULT 0,
            progress DOUBLE DEFAULT 0,
            category VARCHAR(50) DEFAULT 'general'
        )`);
        await ensureColumnExists(conn, 'saving_goals', 'category', "VARCHAR(50) DEFAULT 'general'");

        // 3. tasks
        await conn.query(`CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_name VARCHAR(255),
            weekday VARCHAR(50),
            start_time VARCHAR(10),
            end_time VARCHAR(10),
            status VARCHAR(50) DEFAULT 'pending',
            photo_start_path VARCHAR(500),
            photo_path VARCHAR(500),
            reason TEXT,
            notified_start TINYINT(1) DEFAULT 0,
            notified_15m TINYINT(1) DEFAULT 0,
            notified_45m TINYINT(1) DEFAULT 0,
            started_at DATETIME,
            points_rewarded TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await ensureColumnExists(conn, 'tasks', 'points_rewarded', 'TINYINT(1) DEFAULT 0');

        // 4. purchases (Legacy compatibility)
        await conn.query(`CREATE TABLE IF NOT EXISTS purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_name VARCHAR(255),
            amount DOUBLE DEFAULT 0,
            photo_path VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 5. activity_log
        await conn.query(`CREATE TABLE IF NOT EXISTS activity_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('income', 'expense', 'saving', 'task_started', 'task_done', 'task_missed', 'task_postponed', 'reward', 'penalty', 'ai_roast') NOT NULL,
            title VARCHAR(255),
            amount DOUBLE DEFAULT 0,
            photo_path VARCHAR(500),
            is_roasted TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await ensureColumnExists(conn, 'activity_log', 'is_roasted', 'TINYINT(1) DEFAULT 0');

        // 6. user_stats
        await conn.query(`CREATE TABLE IF NOT EXISTS user_stats (
            id INT PRIMARY KEY DEFAULT 1,
            current_points INT DEFAULT 0,
            total_exp INT DEFAULT 0,
            level INT DEFAULT 1,
            pet_state VARCHAR(50) DEFAULT 'neutral',
            last_roast_date DATE,
            last_watchdog_date DATE,
            CHECK (id = 1)
        )`);
        await conn.query("INSERT IGNORE INTO user_stats (id) VALUES (1)");

        // 7. points_history
        await conn.query(`CREATE TABLE IF NOT EXISTS points_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            amount INT,
            reason VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✨ Khởi tạo và đồng bộ bảng MySQL hoàn tất.');
    } catch (err) {
        console.error('❌ Lỗi khởi tạo MySQL:', err.message);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
    } catch (err) {
        console.error('❌ Lỗi khởi tạo MySQL:', err.message);
        throw err; // Ném lỗi để index.js bắt được
    } finally {
        if (conn) conn.release();
    }
}

async function updateUserStats(pointsChange, expChange, reason) {
    let conn;
    try {
        conn = await pool.getConnection();
        const [stats] = await conn.query("SELECT * FROM user_stats WHERE id = 1");
        if (!stats[0]) return;

        const currentPoints = (stats[0].current_points || 0) + pointsChange;
        const totalExp = (stats[0].total_exp || 0) + expChange;

        // Level = floor(sqrt(EXP / 100)) + 1
        const newLevel = Math.floor(Math.sqrt(totalExp / 100)) + 1;

        await conn.query(
            "UPDATE user_stats SET current_points = ?, total_exp = ?, level = ? WHERE id = 1",
            [currentPoints, totalExp, newLevel]
        );

        await conn.query(
            "INSERT INTO points_history (amount, reason) VALUES (?, ?)",
            [pointsChange, reason]
        );

        // Optional: Update Pet State here
        let state = 'neutral';
        if (currentPoints > 500) state = 'happy';
        if (currentPoints < 0) state = 'sad';
        await conn.query("UPDATE user_stats SET pet_state = ? WHERE id = 1", [state]);

        return { points: currentPoints, level: newLevel, leveledUp: newLevel > stats[0].level };
    } catch (err) {
        console.error('❌ Error updating user stats:', err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    pool,
    initDb,
    updateUserStats,
    query: (sql, params) => pool.query(sql, params),
    execute: (sql, params) => pool.execute(sql, params)
};
