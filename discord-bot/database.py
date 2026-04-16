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
    """V5.0 - Safe Initialization (No destructive drops)"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        logger.info("🚀 Khởi động Database V5.0 (Chế độ an toàn)...")
        
        # 1. monthly_finance
        cursor.execute("""CREATE TABLE IF NOT EXISTS monthly_finance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month VARCHAR(7) UNIQUE,
            income DOUBLE DEFAULT 0,
            expenses DOUBLE DEFAULT 0,
            saving DOUBLE DEFAULT 0,
            remaining DOUBLE DEFAULT 0,
            score INT DEFAULT 0
        )""")

        # 2. saving_goals
        cursor.execute("""CREATE TABLE IF NOT EXISTS saving_goals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            goal_name VARCHAR(255),
            target_amount DOUBLE DEFAULT 0,
            deadline_months INT DEFAULT 0,
            current_saved DOUBLE DEFAULT 0,
            progress DOUBLE DEFAULT 0,
            category VARCHAR(50) DEFAULT 'general'
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
            points_rewarded TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        # 4. activity_log
        cursor.execute("""CREATE TABLE IF NOT EXISTS activity_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('income', 'expense', 'saving', 'task_started', 'task_done', 'task_missed', 'task_postponed', 'reward', 'penalty', 'ai_roast') NOT NULL,
            title VARCHAR(255),
            amount DOUBLE DEFAULT 0,
            photo_path VARCHAR(500),
            is_roasted TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        # 4b. chat_memory
        cursor.execute("""CREATE TABLE IF NOT EXISTS chat_memory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50),
            role ENUM('user', 'assistant', 'system') NOT NULL,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        # 5. user_stats
        cursor.execute("""CREATE TABLE IF NOT EXISTS user_stats (
            id INT PRIMARY KEY DEFAULT 1,
            current_points INT DEFAULT 0,
            total_exp INT DEFAULT 0,
            level INT DEFAULT 1,
            pet_state VARCHAR(50) DEFAULT 'neutral',
            last_roast_date DATE,
            last_watchdog_date DATE,
            CHECK (id = 1)
        )""")
        cursor.execute("INSERT IGNORE INTO user_stats (id) VALUES (1)")

        # 6. points_history
        cursor.execute("""CREATE TABLE IF NOT EXISTS points_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            amount INT,
            reason VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        
        conn.commit()
        
        # 7. Migration: Add is_roasted if it doesn't exist
        try:
            cursor.execute("ALTER TABLE activity_log ADD COLUMN is_roasted TINYINT(1) DEFAULT 0")
            conn.commit()
            logger.info("✅ Migration: Added 'is_roasted' to activity_log.")
        except:
            pass # Already exists
            
        logger.info("✨ Database V5.0 Butler Edition đã sẵn sàng.")
    except Exception as e:
        logger.error(f"❌ Lỗi khởi tạo MySQL V5.0: {e}")
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
    """Ghi log hoạt động và đồng bộ bảng monthly_finance nếu cần."""
    execute(
        "INSERT INTO activity_log (type, title, amount, photo_path) VALUES (%s, %s, %s, %s)",
        (activity_type, title, amount, photo_path)
    )
    
    # --- V5.0 Persistence: Update monthly_finance for income/expense ---
    if activity_type in ['income', 'expense']:
        from datetime import datetime
        current_month = datetime.now().strftime("%Y-%m")
        income_val = amount if activity_type == 'income' else 0
        expense_val = amount if activity_type == 'expense' else 0
        remaining_change = income_val - expense_val
        
        sql = """
            INSERT INTO monthly_finance (month, income, expenses, saving, remaining) 
            VALUES (%s, %s, %s, 0, %s) 
            ON DUPLICATE KEY UPDATE 
            income = income + VALUES(income),
            expenses = expenses + VALUES(expenses), 
            remaining = remaining + %s
        """
        execute(sql, (current_month, income_val, expense_val, remaining_change, remaining_change))




# --- V5.0 GAMIFICATION HELPERS ---

def add_points(amount, reason):
    """Cộng điểm cho user, tăng EXP và kiểm tra Level up."""
    try:
        stats = execute("SELECT * FROM user_stats WHERE id = 1", fetch='one')
        if not stats: return
        
        new_points = stats['current_points'] + amount
        new_exp = stats['total_exp'] + abs(amount)
        # Level up logic: Level = 1 + floor(EXP / 1000)
        new_level = 1 + (new_exp // 1000)
        
        execute(
            "UPDATE user_stats SET current_points = %s, total_exp = %s, level = %s WHERE id = 1",
            (new_points, new_exp, new_level)
        )
        execute(
            "INSERT INTO points_history (amount, reason) VALUES (%s, %s)",
            (amount, reason)
        )
        
        # Log to activity feed
        log_type = 'reward' if amount > 0 else 'penalty'
        log_activity(log_type, f"{'Cộng' if amount > 0 else 'Trừ'} {abs(amount)} điểm: {reason}", amount=amount)
        
        # Automatically update pet state
        update_pet_state()
        
        return {"points": new_points, "level": new_level, "leveled_up": new_level > stats['level']}
    except Exception as e:
        logger.error(f"❌ Lỗi add_points: {e}")

def update_pet_state():
    """Cập nhật trạng thái thú ảo dựa trên số điểm và tài chính."""
    try:
        stats = execute("SELECT * FROM user_stats WHERE id = 1", fetch='one')
        # Simple logic: If points < 0 or remaining % < 10% -> Sad/Sick
        # If level high -> Evolved?
        state = 'neutral'
        if stats['current_points'] > 500: state = 'happy'
        if stats['current_points'] < 0: state = 'sad'
        
        execute("UPDATE user_stats SET pet_state = %s WHERE id = 1", (state,))
    except: pass

def get_user_stats():
    return execute("SELECT * FROM user_stats WHERE id = 1", fetch='one')

def get_today_tasks():
    """Lấy danh sách task của ngày hôm nay."""
    from datetime import datetime
    now = datetime.now()
    days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
    today = days[int(now.strftime("%w"))]
    return execute("SELECT * FROM tasks WHERE weekday = %s", (today,), fetch='all')
