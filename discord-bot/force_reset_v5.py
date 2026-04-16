import mysql.connector
import os
from dotenv import load_dotenv

# Force use of environment variables or common defaults
def reset_database():
    print("🧨 [FORCE RESET] ĐANG TIẾN HÀNH DỌN DẸP DATABASE V5.0...")
    
    # Manually prioritize MYSQL_HOST from environment
    db_host = os.getenv('MYSQL_HOST', 'mysql')
    db_user = os.getenv('MYSQL_USER', 'matcha_user')
    db_pass = os.getenv('MYSQL_PASSWORD', 'matcha_pass')
    db_name = os.getenv('MYSQL_DATABASE', 'matcha_db')
    
    print(f"🔗 Đang kết nối tới: {db_host}...")

    try:
        conn = mysql.connector.connect(
            host=db_host,
            user=db_user,
            password=db_pass,
            database=db_name
        )
        cursor = conn.cursor()
        
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        tables = ['monthly_finance', 'saving_goals', 'tasks', 'activity_log', 'purchases', 'user_stats', 'points_history', 'chat_memory']
        for t in tables:
            print(f"🗑️ Xóa: {t}")
            cursor.execute(f"DROP TABLE IF EXISTS {t}")
        
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        print("✨ THÀNH CÔNG! Đã dọn sạch Database cũ. Hãy restart container để Bot khởi tạo lại V5.0.")
        
    except Exception as e:
        print(f"❌ Lỗi kết nối hoặc thực thi: {e}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

if __name__ == "__main__":
    confirm = input("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ DỮ LIỆU CŨ KHÔNG? (y/n): ")
    if confirm.lower() == 'y':
        reset_database()
    else:
        print("❌ Đã hủy.")
