import sys
import os
from datetime import datetime
import logging

try:
    import database as db
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import database as db

def format_vnd(amount):
    try:
        if amount is None: return "0 VNĐ"
        return f"{float(amount):,.0f}".replace(",", ".") + " VNĐ"
    except:
        return "0 VNĐ"

def fetch_context(user_id) -> dict:
    month = datetime.now().strftime("%Y-%m")
    
    # 1. Tài chính tháng này
    fin = db.execute("SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one')
    fin_text = "Không có biên lai."
    if fin:
        income = fin.get('income', 0) or 0
        expenses = fin.get('expenses', 0) or 0
        remaining = fin.get('remaining', 0) or 0
        fin_text = f"Thu nhập: {format_vnd(income)}, Đã chi: {format_vnd(expenses)}, Còn lại: {format_vnd(remaining)}"

    # 2. Mục tiêu tiết kiệm
    goals = db.execute("SELECT * FROM saving_goals", fetch='all')
    goals_text = "\n".join([f"- {g['goal_name']}: {format_vnd(g['current_saved'])}/{format_vnd(g['target_amount'])} ({g['progress']:.1f}%)" for g in goals]) if goals else "chưa có"

    # 3. Lịch trình hôm nay
    tasks = db.get_today_tasks()
    tasks_text = "\n".join([f"- {t['task_name']} ({t['start_time']}-{t['end_time']}): {t['status']}" for t in tasks]) if tasks else "chưa có"

    # 4. Lịch sử chat
    history_rows = db.execute("SELECT role, content FROM chat_memory WHERE user_id = %s ORDER BY created_at DESC LIMIT 10", (str(user_id),), fetch='all')
    history = list(reversed(history_rows)) if history_rows else []
    
    # 5. Recent behavior
    recent_logs = db.execute("SELECT type, title FROM activity_log ORDER BY created_at DESC LIMIT 5", fetch='all')
    recent_behavior = "\n".join([f"- {l['type']}: {l['title']}" for l in recent_logs]) if recent_logs else "không có dữ liệu"

    context = {
        "finance": fin_text,
        "goals": goals_text,
        "schedule_today": tasks_text,
        "history": history,
        "recent_behavior": recent_behavior
    }
    return context
