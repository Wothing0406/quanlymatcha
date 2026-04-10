import discord
from discord import app_commands
from discord.ext import commands
import logging
import os
import aiohttp
from datetime import datetime
import database as db

logger = logging.getLogger('MatchaBot.Tasks')

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')

def get_today():
    days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
    return days[int(datetime.now().strftime("%w"))]

WEEKDAY_MAP = {
    'monday': 'Thứ 2', 'tuesday': 'Thứ 3', 'wednesday': 'Thứ 4',
    'thursday': 'Thứ 5', 'friday': 'Thứ 6', 'saturday': 'Thứ 7', 'sunday': 'Chủ Nhật',
    'thu2': 'Thứ 2', 'thu3': 'Thứ 3', 'thu4': 'Thứ 4', 'thu5': 'Thứ 5',
    'thu6': 'Thứ 6', 'thu7': 'Thứ 7', 'chunhat': 'Chủ Nhật',
}

class TasksCog(commands.Cog, name="📋 Công việc"):
    """Quản lý lịch trình và công việc hàng ngày."""

    def __init__(self, bot):
        self.bot = bot

    # ─── /task ────────────────────────────────────────────────────────────
    task_group = app_commands.Group(name="task", description="Quản lý công việc")

    @task_group.command(name="add", description="Thêm công việc mới (Có thể thêm nhiều thứ cùng lúc)")
    @app_commands.describe(
        name="Tên công việc",
        weekdays="Thứ trong tuần (VD: thu2,thu4,thu6 hoặc monday,wednesday...)",
        time="Giờ bắt đầu (HH:MM)",
        end_time="Giờ kết thúc (HH:MM, mặc định +1h)"
    )
    async def task_add(self, interaction: discord.Interaction, name: str, weekdays: str, time: str, end_time: str = None):
        # Normalize and split weekdays
        input_days = [d.strip().lower().replace(' ', '') for d in weekdays.split(',')]
        processed_days = []
        for d in input_days:
            wd = WEEKDAY_MAP.get(d, d)
            processed_days.append(wd)

        # Validate time format
        try:
            datetime.strptime(time, "%H:%M")
        except ValueError:
            return await interaction.response.send_message(
                "❌ Định dạng giờ không hợp lệ! Vui lòng dùng `HH:MM` (ví dụ: `19:00`).", ephemeral=True
            )

        if not end_time:
            h, m = map(int, time.split(':'))
            end_time = f"{(h+1)%24:02d}:{m:02d}"

        task_ids = []
        for wd in processed_days:
            tid = db.execute(
                "INSERT INTO tasks (task_name, weekday, start_time, end_time, status) VALUES (%s, %s, %s, %s, 'pending')",
                (name, wd, time, end_time)
            )
            task_ids.append(tid)
        
        logger.info(f"➕ Tasks mới: {name} | {processed_days} {time}-{end_time}")

        embed = discord.Embed(
            title="✅ Đã thêm lịch trình mới",
            description=f"Đã tạo **{len(processed_days)}** lịch trình cho: {', '.join(processed_days)}",
            color=discord.Color.green()
        )
        embed.add_field(name="📝 Tên", value=name, inline=True)
        embed.add_field(name="⏱️ Giờ", value=f"`{time} - {end_time}`", inline=True)
        embed.set_footer(text=f"IDs: {', '.join(map(str, task_ids))} | Cố lên nhé! 💪")
        await interaction.response.send_message(embed=embed)

    @task_group.command(name="edit", description="Chỉnh sửa thông tin công việc")
    @app_commands.describe(id="ID của công việc", name="Tên mới", time="Giờ bắt đầu mới", end_time="Giờ kết thúc mới")
    async def task_edit(self, interaction: discord.Interaction, id: int, name: str = None, time: str = None, end_time: str = None):
        task = db.execute("SELECT * FROM tasks WHERE id = %s", (id,), fetch='one')
        if not task:
            return await interaction.response.send_message(f"❌ Không tìm thấy task ID `{id}`.", ephemeral=True)
        
        new_name = name or task['task_name']
        new_time = time or task['start_time']
        new_end = end_time or task['end_time']

        db.execute(
            "UPDATE tasks SET task_name = %s, start_time = %s, end_time = %s WHERE id = %s",
            (new_name, new_time, new_end, id)
        )
        await interaction.response.send_message(f"✅ Đã cập nhật task `{id}` thành công!")

    @task_group.command(name="delete", description="Xóa một lịch trình")
    @app_commands.describe(id="ID của công việc cần xóa")
    async def task_delete(self, interaction: discord.Interaction, id: int):
        task = db.execute("SELECT * FROM tasks WHERE id = %s", (id,), fetch='one')
        if not task:
            return await interaction.response.send_message(f"❌ Không tìm thấy task ID `{id}`.", ephemeral=True)
        
        db.execute("DELETE FROM tasks WHERE id = %s", (id,))
        await interaction.response.send_message(f"🗑️ Đã xóa lịch trình `{task['task_name']}` (ID: {id}).")

    @task_group.command(name="done", description="Hoàn thành công việc (Nên dùng /task finish kèm ảnh)")
    @app_commands.describe(task_id="ID của công việc cần đánh dấu hoàn thành")
    async def task_done_simple(self, interaction: discord.Interaction, task_id: int):
        task = db.execute("SELECT * FROM tasks WHERE id = %s", (task_id,), fetch='one')
        if not task:
            return await interaction.response.send_message(f"❌ Không tìm thấy task ID `{task_id}`.", ephemeral=True)

        db.execute("UPDATE tasks SET status = 'done' WHERE id = %s", (task_id,))
        db.log_activity('task_done', f"Đã hoàn thành: {task['task_name']}")
        
        await interaction.response.send_message(f"✅ Đã đánh dấu `{task['task_name']}` là xong! Năng suất quá! 🚀")

    @task_group.command(name="missed", description="Đánh dấu công việc bị bỏ lỡ")
    @app_commands.describe(task_id="ID của công việc bị bỏ lỡ")
    async def task_missed(self, interaction: discord.Interaction, task_id: int):
        task = db.execute("SELECT * FROM tasks WHERE id = %s", (task_id,), fetch='one')
        if not task:
            return await interaction.response.send_message(f"❌ Không tìm thấy task ID `{task_id}`.", ephemeral=True)

        db.execute("UPDATE tasks SET status = 'missed' WHERE id = %s", (task_id,))

        # ✨ ĐỒNG BỘ: Ghi log hoạt động
        db.log_activity('task_missed', task['task_name'])

        logger.info(f"❌ Task missed: [{task_id}] {task['task_name']}")

        embed = discord.Embed(
            title="😔 Đã ghi nhận bỏ lỡ",
            description=f"**{task['task_name']}** được đánh dấu là **missed**.\n\nKhông sao, hãy cố gắng hơn vào lần sau nhé! 🍃",
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=embed)

    @task_group.command(name="list", description="Xem danh sách công việc hôm nay")
    async def task_list(self, interaction: discord.Interaction):
        await interaction.response.defer()
        today = get_today()
        tasks = db.execute(
            "SELECT * FROM tasks WHERE weekday = %s ORDER BY start_time ASC",
            (today,), fetch='all'
        )

        if not tasks:
            return await interaction.followup.send(
                f"📭 Hôm nay ({today}) chưa có công việc nào được lên lịch."
            )

        embed = discord.Embed(
            title=f"📋 Công việc hôm nay - {today}",
            description=f"Tổng cộng **{len(tasks)}** công việc. Cố lên! 💪",
            color=discord.Color.blue()
        )

        STATUS_ICON = {
            'pending': '⏳ Chờ', 'done': '✅ Xong', 'missed': '❌ Bỏ lỡ',
            'postponed': '🔄 Dời', 'reminded': '🔔 Nhắc rồi'
        }

        for t in tasks:
            status_str = STATUS_ICON.get(t.get('status', 'pending'), '❓')
            embed.add_field(
                name=f"[ID:{t['id']}] {t['task_name']}",
                value=f"⏱️ `{t['start_time']} - {t['end_time']}` | {status_str}",
                inline=False
            )

        current_time_vn = datetime.now().strftime("%H:%M:%S")
        embed.set_footer(text=f"Cập nhật lúc: {current_time_vn} | Dùng /task done <id> để hoàn thành!")
        await interaction.followup.send(embed=embed)

    # ─── /weekly_report ────────────────────────────────────────────────────
    @app_commands.command(name="weekly_report", description="Báo cáo hiệu năng tuần này")
    async def weekly_report(self, interaction: discord.Interaction):
        await interaction.response.defer()

        rows = db.execute(
            "SELECT status, COUNT(*) as count FROM tasks GROUP BY status",
            fetch='all'
        )
        if not rows:
            return await interaction.followup.send("📭 Chưa có dữ liệu task nào.")

        stat = {r['status']: r['count'] for r in rows}
        done = stat.get('done', 0)
        missed = stat.get('missed', 0)
        pending = stat.get('pending', 0)
        total = done + missed + pending + stat.get('postponed', 0)
        percentage = round((done / total) * 100) if total > 0 else 0

        color = discord.Color.green() if percentage >= 70 else (discord.Color.orange() if percentage >= 40 else discord.Color.red())

        embed = discord.Embed(
            title="📊 Báo cáo Hiệu năng",
            description=f"**Tỷ lệ hoàn thành: {percentage}%**",
            color=color
        )
        embed.add_field(name="✅ Hoàn thành", value=str(done), inline=True)
        embed.add_field(name="❌ Bỏ lỡ", value=str(missed), inline=True)
        embed.add_field(name="⏳ Đang chờ", value=str(pending), inline=True)
        embed.add_field(name="📈 Tổng", value=str(total), inline=True)

        if percentage >= 70:
            embed.set_footer(text="🔥 Xuất sắc! Bạn đang làm rất tốt!")
        elif percentage >= 40:
            embed.set_footer(text="💪 Cố gắng lên! Bạn làm được!")
        else:
            embed.set_footer(text="😔 Hãy xem lại lịch trình, cần điều chỉnh không?")

        await interaction.followup.send(embed=embed)

    # ─── /upload ────────────────────────────────────────────────────────────
    # ─── /task start & finish ──────────────────────────────────────────────
    @task_group.command(name="start", description="Bắt đầu công việc kèm ảnh kỷ niệm 'Before'")
    @app_commands.describe(task_id="ID công việc", attachment="Ảnh bắt đầu làm việc")
    async def task_start(self, interaction: discord.Interaction, task_id: int, attachment: discord.Attachment):
        task = db.execute("SELECT * FROM tasks WHERE id = %s", (task_id,), fetch='one')
        if not task:
            return await interaction.response.send_message(f"❌ Không tìm thấy task ID `{task_id}`.", ephemeral=True)
        
        await interaction.response.defer()
        
        # Download and save file
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(attachment.filename)[1]
        filename = f"start_{task_id}_{int(datetime.now().timestamp())}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        async with aiohttp.ClientSession() as session:
            async with session.get(attachment.url) as resp:
                with open(filepath, 'wb') as f:
                    f.write(await resp.read())

        db_path = f"/uploads/{filename}"
        db.execute(
            "UPDATE tasks SET photo_start_path = %s, status = 'ongoing', started_at = NOW() WHERE id = %s",
            (db_path, task_id)
        )

        db.log_activity('task_started', f"Đã bắt đầu: {task['task_name']}", photo_path=db_path)
        logger.info(f"📸 Started task [{task_id}] with photo")

        embed = discord.Embed(
            title="✨ Kỷ niệm đã được đăng!",
            description=f"Bạn đã bắt đầu: **{task['task_name']}**\nHãy tập trung làm việc thật tốt nhé! 💪",
            color=discord.Color.blue()
        )
        embed.set_image(url=attachment.url)
        await interaction.followup.send(embed=embed)

    @task_group.command(name="finish", description="Hoàn thành công việc kèm ảnh kết quả 'After'")
    @app_commands.describe(task_id="ID công việc", attachment="Ảnh kết quả hoàn thành")
    async def task_finish(self, interaction: discord.Interaction, task_id: int, attachment: discord.Attachment):
        task = db.execute("SELECT * FROM tasks WHERE id = %s", (task_id,), fetch='one')
        if not task:
            return await interaction.response.send_message(f"❌ Không tìm thấy task ID `{task_id}`.", ephemeral=True)
        
        await interaction.response.defer()
        
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(attachment.filename)[1]
        filename = f"finish_{task_id}_{int(datetime.now().timestamp())}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        async with aiohttp.ClientSession() as session:
            async with session.get(attachment.url) as resp:
                with open(filepath, 'wb') as f:
                    f.write(await resp.read())

        db_path = f"/uploads/{filename}"
        db.execute(
            "UPDATE tasks SET photo_path = %s, status = 'done' WHERE id = %s",
            (db_path, task_id)
        )

        db.log_activity('task_done', f"Đã hoàn thành: {task['task_name']}", photo_path=db_path)
        logger.info(f"📸 Finished task [{task_id}] with photo")

        embed = discord.Embed(
            title="🎉 Chúc mừng bạn đã xong việc!",
            description=f"**{task['task_name']}** - Kỷ niệm hoàn thành đã được lưu! ✨",
            color=discord.Color.green()
        )
        embed.set_image(url=attachment.url)
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="upload", description="[Cũ] Upload ảnh hoàn thành (Khuyên dùng /task finish)")
    @app_commands.describe(task_id="ID công việc muốn upload ảnh")
    async def upload(self, interaction: discord.Interaction, task_id: int, attachment: discord.Attachment):
        await self.task_finish.callback(self, interaction, task_id, attachment)


async def setup(bot):
    await bot.add_cog(TasksCog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.tasks ✅")
