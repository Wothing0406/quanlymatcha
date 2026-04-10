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
            photo_start_path VARCHAR(500),
            photo_path VARCHAR(500),
            reason TEXT,
            notified_start TINYINT(1) DEFAULT 0,
            notified_15m TINYINT(1) DEFAULT 0,
            notified_45m TINYINT(1) DEFAULT 0,
            started_at DATETIME,
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
        
        # 5. activity_log (Unified Feed V5.0)
        cursor.execute("""CREATE TABLE IF NOT EXISTS activity_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('income', 'expense', 'saving', 'task_started', 'task_done', 'task_missed') NOT NULL,
            title VARCHAR(255),
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
def parse_amount(text):
    """
    Biến các chuỗi như '30k', '1.5tr', '2m' thành con số thực.
    """
    if not text: return 0
    import re
    text = str(text).lower().replace(' ', '').replace(',', '').replace('.', '')
    
    # regex matches number and suffix
    match = re.match(r"(\d+\.?\d*)(k|tr|m|b|t)?", text)
    if not match:
        try: return float(text)
        except: return 0
        
    val, unit = match.groups()
    val = float(val)
    
    multipliers = {
        'k': 1_000,
        'tr': 1_000_000,
        'm': 1_000_000,
        'b': 1_000_000_000,
        't': 1_000_000_000_000
    }
    
    return val * multipliers.get(unit, 1)

def log_activity(activity_type, title, amount=0, photo_path=None):
    """Ghi log hoạt động tập trung vào bảng activity_log."""
    execute(
        "INSERT INTO activity_log (type, title, amount, photo_path) VALUES (%s, %s, %s, %s)",
        (activity_type, title, amount, photo_path)
    )
