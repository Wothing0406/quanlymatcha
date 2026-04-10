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
            "SELECT * FROM tasks WHERE weekday = %s AND status IN ('pending', 'reminded')",
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
        if diff == 0 and task['notified_start'] == 0:
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
        elif diff == 15 and task['status'] == 'pending' and task['notified_15m'] == 0:
            logger.info(f"⏰ [REMIND 15m] Task: {task['task_name']}")
            import discord
            embed = discord.Embed(
                title=f"⏳ Nhắc lại lần 2: {task['task_name']}",
                description=f"Đã 15 phút rồi nè! Bạn đã bắt đầu chưa? 🤔\n\n⏱️ **Thời gian:** `{task['start_time']} - {task['end_time']}`",
                color=discord.Color.orange()
            )
            await dm_channel.send(embed=embed)
            db.execute("UPDATE tasks SET notified_15m = 1 WHERE id = %s", (task['id'],))

        # --- Tự động nhắc nhở sau 45 phút, không auto-fail nữa ---
        elif diff >= 45 and task['status'] == 'pending' and task['notified_45m'] == 0:
            db.execute("UPDATE tasks SET notified_45m = 1 WHERE id = %s", (task['id'],))
            import discord
            embed = discord.Embed(
                title=f"⚠️ Chú ý: {task['task_name']}",
                description=f"Đã 45 phút trôi qua kể từ lịch hẹn mà bạn vẫn chưa bắt đầu công việc. Hay là bạn quên đánh dấu trên hệ thống rồi? 🧐",
                color=discord.Color.orange()
            )
            await dm_channel.send(embed=embed)
