import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

def reset_database():
    print("🧨 ĐANG TIẾN HÀNH RESET DATABASE SANG V5.0...")
    
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST', 'matcha-db'),
        user=os.getenv('DB_USER', 'matcha_user'),
        password=os.getenv('DB_PASSWORD', 'matcha_pass'),
        database=os.getenv('DB_NAME', 'matcha_db')
    )
    cursor = conn.cursor()
    
    try:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        tables = ['monthly_finance', 'saving_goals', 'tasks', 'activity_log', 'purchases', 'user_stats', 'points_history']
        for t in tables:
            print(f"🗑️ Đang xóa bảng: {t}")
            cursor.execute(f"DROP TABLE IF EXISTS {t}")
        
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        print("✅ Đã dọn dẹp sạch sẽ! Bây giờ bạn hãy khởi động lại Bot để nó tạo lại bảng mới.")
    except Exception as e:
        print(f"❌ Lỗi: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    confirm = input("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ DỮ LIỆU CŨ KHÔNG? (y/n): ")
    if confirm.lower() == 'y':
        reset_database()
    else:
        print("❌ Đã hủy lệnh Reset.")
