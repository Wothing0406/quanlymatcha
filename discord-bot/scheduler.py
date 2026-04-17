import asyncio
import logging
from datetime import datetime
import database as db

logger = logging.getLogger('MatchaBot.Scheduler')

async def check_tasks(bot, dm_channel):
    """
    Vòng lặp nền - mỗi 60 giây kiểm tra task:
    - Gửi nhắc nhở khi đến giờ bắt đầu (start_time)
    - Nhắc lần 2 sau 15 phút nếu vẫn pending
    - Tự động đánh dấu missed sau 45 phút pending
    """
    if not dm_channel:
        logger.warning("⚠️ Scheduler: Chưa có kênh DM, bỏ qua lần kiểm tra này.")
        return

    now = datetime.now()
    current_time = now.strftime("%H:%M")
    days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
    today = days[int(now.strftime("%w"))]

    try:
        all_tasks = db.execute(
            "SELECT * FROM tasks WHERE weekday = %s AND status IN ('pending', 'reminded', 'ongoing')",
            (today,), fetch='all'
        )
    except Exception as e:
        logger.error(f"Scheduler DB error: {e}")
        return

    for task in all_tasks:
        start_h, start_m = map(int, task['start_time'].split(':'))
        task_start_minutes = start_h * 60 + start_m
        now_minutes = now.hour * 60 + now.minute
        diff = now_minutes - task_start_minutes

        # --- Nhắc nhở ngay khi đến giờ (diff = 0) ---
        if diff == 0 and task.get('notified_start') == 0:
            logger.info(f"⏰ [REMIND START] Task: {task['task_name']}")
            import discord
            embed = discord.Embed(
                title=f"🔔 Đến giờ rồi! {task['task_name']}",
                description=f"🌿 Heey! Đã đến giờ làm việc rồi nè. Tập trung thôi nào!\n\n⏱️ **Thời gian:** `{task['start_time']} - {task['end_time']}`",
                color=discord.Color.blue()
            )
            embed.set_footer(text="Hoàn thành xong dùng /task done <id> hoặc upload ảnh minh chứng!")
            await dm_channel.send(embed=embed)
            db.execute("UPDATE tasks SET notified_start = 1 WHERE id = %s", (task['id'],))

        # --- Nhắc lần 2 sau 15 phút ---
        elif diff == 15 and task['status'] == 'pending' and task.get('notified_15m') == 0:
            logger.info(f"⏰ [REMIND 15m] Task: {task['task_name']}")
            import discord
            embed = discord.Embed(
                title=f"⏳ Nhắc lại lần 2: {task['task_name']}",
                description=f"Đã 15 phút rồi nè! Bạn đã bắt đầu chưa? 🤔\n\n⏱️ **Thời gian:** `{task['start_time']} - {task['end_time']}`",
                color=discord.Color.orange()
            )
            await dm_channel.send(embed=embed)
            db.execute("UPDATE tasks SET notified_15m = 1 WHERE id = %s", (task['id'],))

        # --- Auto-Penalty & Log Missed after 45m ---
        elif diff >= 45 and task['status'] == 'pending' and task.get('notified_45m') == 0:
            db.execute("UPDATE tasks SET status = 'missed', notified_45m = 1 WHERE id = %s", (task['id'],))
            db.log_activity('task_missed', task['task_name'])
            # --- V5.0 Penalty ---
            db.add_points(-30, f"Bỏ lỡ công việc: {task['task_name']}")
            
            import discord
            embed = discord.Embed(
                title=f"❌ Thất bại: {task['task_name']}",
                description=f"Bạn đã bỏ lỡ công việc này. Matcha đã trừ bạn **30 điểm** kỷ luật. 😔",
                color=discord.Color.red()
            )
            await dm_channel.send(embed=embed)

    # Trigger Proactive features
    await check_weekly_roast(bot, dm_channel)
    await spending_watchdog(bot, dm_channel)
    await auto_roast_watchdog(bot, dm_channel)

async def check_weekly_roast(bot, dm_channel):
    """Monday Morning Roast: 08:00 AM"""
    now = datetime.now()
    if now.weekday() != 0 or now.hour != 8 or now.minute != 0:
        return

    # Check if already roasted today
    stats = db.get_user_stats()
    if stats.get('last_roast_date') == now.date():
        return

    logger.info("🔥 [WEEKLY ROAST] Đã đến giờ 'sấy' tài chính tuần qua!")
    try:
        activities = db.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20", fetch='all')
        
        summary = "\n".join([f"- {a['type']}: {a['title']} ({a['amount']:,}đ)" for a in activities])
        
        prompt = f"""
        Bạn là Matcha, trợ lý tài chính ĐANH ĐÁ. Đây là dữ liệu hoạt động tuần qua của tôi:
        {summary}
        
        Hãy viết một bài 'ROAST' (sấy) thật gắt. Tiếng Việt GenZ, ngắn gọn.
        """
        
        chat_cog = bot.get_cog("🧠 Trợ lý AI")
        if chat_cog:
            roast_text = await chat_cog.generate_response(prompt)
            
            if roast_text:
                import discord
                embed = discord.Embed(title="🔥 BẢN TIN SẤY TUẦN MỚI", description=roast_text, color=discord.Color.red())
                if dm_channel: await dm_channel.send(embed=embed)
                db.execute("UPDATE user_stats SET last_roast_date = %s WHERE id = 1", (now.date(),))
                db.log_activity('ai_roast', "Matcha đã sấy bạn")
    except Exception as e:
        logger.error(f"Lỗi Weekly Roast: {e}")

async def spending_watchdog(bot, dm_channel):
    """
    Cảnh báo khi tiêu quá 80% thu nhập.
    CHƯA BÁO THÌ BÁO (Tối đa 1 lần/ngày).
    """
    try:
        now = datetime.now()
        month = now.strftime("%Y-%m")
        
        # 1. Kiểm tra ngày gửi cảnh báo gần nhất
        stats = db.get_user_stats()
        if stats.get('last_watchdog_date') == now.date():
            return

        # 2. Lấy dữ liệu tài chính tháng này
        finance = db.execute("SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        if not finance or not finance.get('income') or finance['income'] == 0:
            return
            
        remaining_ratio = finance['remaining'] / finance['income']
        
        # 3. Chỉ cảnh báo nếu còn dưới 20% THU NHẬP
        if remaining_ratio < 0.2:
            # KIỂM TRA: Có tiêu xài mới trong 1h qua không? 
            # (Để tránh spam khi không làm gì)
            recent_expense = db.execute(
                "SELECT id FROM activity_log WHERE type = 'expense' AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) LIMIT 1",
                fetch='one'
            )
            
            if not recent_expense:
                return # Không có chi tiêu mới trong 1h qua -> Đừng làm phiền

            import discord
            embed = discord.Embed(
                title="⚠️ CẢNH BÁO: CHÁY TÚI TỚI NƠI!",
                description=f"Này! Bạn vừa tiêu lạm vào quỹ an toàn rồi! \n\nVí chỉ còn **{finance['remaining']:,}đ** ({remaining_ratio*100:.1f}%).\n\nLâu lâu Matcha mới nhắc, liệu hồn nhé! 🔥",
                color=discord.Color.red()
            )
            if dm_channel:
                await dm_channel.send(embed=embed)
                # Cập nhật ngày ngay lập tức để không spam nữa
                db.execute("UPDATE user_stats SET last_watchdog_date = %s WHERE id = 1", (now.date(),))
                logger.info(f"🚨 Sent spending alert (Low: {remaining_ratio*100:.1f}%)")
    except Exception as e:
        logger.error(f"Lỗi Spending Watchdog: {e}")

async def auto_roast_watchdog(bot, dm_channel):
    """
    Theo dõi activity_log để 'nhảy vào' chửi hoặc khen ngay khi có hoạt động mới.
    """
    try:
        # Lấy các hoạt động chưa được AI sấy
        new_activities = db.execute(
            "SELECT * FROM activity_log WHERE is_roasted = 0 AND type IN ('income', 'expense', 'saving', 'task_done', 'task_missed') LIMIT 3",
            fetch='all'
        )
        
        if not new_activities:
            return

        chat_cog = bot.get_cog("🧠 Trợ lý AI")
        if not chat_cog:
            return

        for act in new_activities:
            logger.info(f"🔥 [AUTO ROAST] Phát hiện hoạt động mới: {act['title']}")
            
            # Get financial context and goals for better roasting
            month = datetime.now().strftime("%Y-%m")
            fin = db.execute("SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one')
            goals = db.execute("SELECT * FROM saving_goals", fetch='all')
            goals_text = "\n".join([f"- {g['goal_name']}: {g['current_saved']:,}/{g['target_amount']:,}đ" for g in goals]) if goals else "Không có"
            
            fin_info = f"Ví hiện tại: {fin['remaining']:,}đ" if fin and fin.get('remaining') else "Không rõ số dư"

            prompt = f"""Tôi vừa thực hiện hoạt động: [{act['type']}] "{act['title']}" số tiền {act['amount']:,}đ.

[THÔNG TIN TÀI CHÍNH CỦA TÔI]
- {fin_info}
- Mục tiêu đang tích luỹ: {goals_text}

[YÊU CẦU CHO MATCHA]
Đánh giá khoản tiền {act['amount']:,}đ cho "{act['title']}" này là HỢP LÝ hay HOANG PHÍ dựa trên số dư và mục tiêu.
- Nếu là HOANG PHÍ / VÔ BỔ: Chửi gắt, xéo xắt, khinh bỉ.
- Nếu là HỢP LÝ / THIẾT YẾU: Khen ngợi ngắn gọn.
- Nếu là Thu nhập/Lương: Vui vẻ, nhắc nhở giữ tiền.

Trả lời cực ngắn (1-2 câu), xưng "tao/mày" và đúng chuẩn phong cách Matcha."""
            
            # Sử dụng parameter system_prompt để tiêm tính cách
            system_p = "MÀY LÀ MATCHA, QUẢN GIA TÀI CHÍNH XÉO XẮT NHẤT HỆ MẶT TRỜI. CẤM XƯNG TÔI/BẠN."
            roast_text = await chat_cog.generate_response(prompt, system_prompt=system_p)
            
            if roast_text:
                import discord
                color = discord.Color.red() if act['type'] in ['expense', 'task_missed'] else discord.Color.green()
                embed = discord.Embed(
                    title="🍵 Matcha lên tiếng...",
                    description=roast_text,
                    color=color
                )
                if dm_channel:
                    await dm_channel.send(embed=embed)
                
            # Đánh dấu đã sấy
            db.execute("UPDATE activity_log SET is_roasted = 1 WHERE id = %s", (act['id'],))

    except Exception as e:
        logger.error(f"Lỗi Auto Roast Watchdog: {e}")

