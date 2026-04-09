import mysql.connector
from mysql.connector import pooling
import os
import logging

logger = logging.getLogger('MatchaBot.Database')

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="matcha_pool",
            pool_size=5,
            host=os.getenv('MYSQL_HOST', 'mysql'),
            user=os.getenv('MYSQL_USER', 'matcha_user'),
            password=os.getenv('MYSQL_PASSWORD', 'matcha_pass'),
            database=os.getenv('MYSQL_DATABASE', 'matcha_db'),
        )
        logger.info("✅ Database pool đã được khởi tạo.")
        init_db()
    return _pool

def init_db():
    """Đảm bảo các bảng dữ liệu tồn tại ngay khi bot khởi động."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        logger.info("🚀 Kiểm tra và khởi tạo các bảng MySQL...")
        
        # 1. monthly_finance
        cursor.execute("""CREATE TABLE IF NOT EXISTS monthly_finance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month VARCHAR(7) UNIQUE,
            income DOUBLE DEFAULT 0,
            expenses DOUBLE DEFAULT 0,
            saving DOUBLE DEFAULT 0,
            remaining DOUBLE DEFAULT 0
        )""")

        # 2. saving_goals
        cursor.execute("""CREATE TABLE IF NOT EXISTS saving_goals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            goal_name VARCHAR(255),
            target_amount DOUBLE DEFAULT 0,
            deadline_months INT DEFAULT 0,
            current_saved DOUBLE DEFAULT 0,
            progress DOUBLE DEFAULT 0
        )""")

        # 3. tasks
        cursor.execute("""CREATE TABLE IF NOT EXISTS tasks (
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
        )""")

        # 4. purchases
        cursor.execute("""CREATE TABLE IF NOT EXISTS purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_name VARCHAR(255),
            amount DOUBLE DEFAULT 0,
            photo_path VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        
        conn.commit()
        logger.info("✨ Khởi tạo bảng MySQL thành công.")
    except Exception as e:
        logger.error(f"❌ Lỗi khởi tạo MySQL từ Bot: {e}")
    finally:
        cursor.close()
        conn.close()

def get_connection():
    return get_pool().get_connection()

def execute(sql, params=None, fetch=None):
    """
    Helper thống nhất cho mọi truy vấn SQL.
    fetch='one' | 'all' | None (cho INSERT/UPDATE/DELETE)
    """
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params or ())
        if fetch == 'one':
            return cursor.fetchone()
        elif fetch == 'all':
            return cursor.fetchall()
        else:
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"❌ Lỗi database: {e} | SQL: {sql}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
