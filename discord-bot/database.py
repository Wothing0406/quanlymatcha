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
        logger.info("✅ Database pool đã được khởi tạo thành công.")
    return _pool

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
