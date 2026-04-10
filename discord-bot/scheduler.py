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
        if chat_cog and chat_cog.ai_enabled:
            response = chat_cog.model.generate_content(prompt)
            roast_text = response.text
            
            import discord
            embed = discord.Embed(title="🔥 BẢN TIN SẤY TUẦN MỚI", description=roast_text, color=discord.Color.red())
            if dm_channel: await dm_channel.send(embed=embed)
            db.execute("UPDATE user_stats SET last_roast_date = %s WHERE id = 1", (now.date(),))
            db.log_activity('ai_roast', "Matcha đã sấy bạn")
    except Exception as e:
        logger.error(f"Lỗi Weekly Roast: {e}")

async def spending_watchdog(bot, dm_channel):
    """Cảnh báo khi tiêu quá 80% thu nhập (Tối đa 1 lần/ngày)"""
    try:
        now = datetime.now()
        month = now.strftime("%Y-%m")
        
        # 1. Kiểm tra ngày gửi cảnh báo gần nhất
        stats = db.get_user_stats()
        if stats.get('last_watchdog_date') == now.date():
            return

        # 2. Lấy dữ liệu tài chính tháng này
        finance = db.execute("SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        if not finance or finance['income'] == 0:
            return
            
        remaining_ratio = finance['remaining'] / finance['income']
        
        # 3. Nếu còn dưới 20%
        if remaining_ratio < 0.2:
            import discord
            embed = discord.Embed(
                title="⚠️ CẢNH BÁO: CHÁY TÚI TỚI NƠI!",
                description=f"Này! Bạn vừa tiêu lạm vào quỹ an toàn rồi! \n\nVí chỉ còn **{finance['remaining']:,}đ** ({remaining_ratio*100:.1f}%).\n\nLâu lâu Matcha mới nhắc, liệu hồn nhé! 🔥",
                color=discord.Color.red()
            )
            if dm_channel:
                await dm_channel.send(embed=embed)
                # Cập nhật ngày để không spam nữa
                db.execute("UPDATE user_stats SET last_watchdog_date = %s WHERE id = 1", (now.date(),))
                logger.info(f"🚨 Sent spending alert once for today")
    except Exception as e:
        logger.error(f"Lỗi Spending Watchdog: {e}")
