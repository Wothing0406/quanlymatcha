import discord
from discord import app_commands
from discord.ext import commands
import logging
import database as db
import os

logger = logging.getLogger('MatchaBot.Management')

class ManagementCog(commands.Cog, name="🔧 Quản lý"):
    """Lệnh quản trị hệ thống và trợ giúp."""

    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="web", description="Lấy đường link truy cập trang quản lý Web Dashboard")
    async def get_web(self, interaction: discord.Interaction):
        # Dynamically read the tunnel log to get the trycloudflare URL
        url = "Đang khởi tạo đường truyền..."
        log_path = "/app/uploads/cloudflared.log"
        if os.path.exists(log_path):
            import re
            with open(log_path, "r", encoding="utf-8") as f:
                content = f.read()
                # Find all URLs and pick the LAST one (the newest session)
                matches = re.findall(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)', content)
                if matches:
                    url = matches[-1]


        pin = os.getenv("WEB_PIN", "1234")
        
        embed = discord.Embed(
            title="✨ Matcha Web Portal",
            description=f"Truy cập vào trung tâm điều khiển của bạn tại đây:\n\n👉 {url}",
            color=discord.Color.teal()
        )

        embed.add_field(name="🔒 Mã PIN Bảo Mật:", value=f"`{pin}`", inline=False)
        embed.set_footer(text="Nếu link lỗi, đợi 1-2 phút để Server tạo URL mới nhé!")
        
        # Tin nhắn dạng ephemeral tức là chỉ bạn nhìn thấy, người khác trong channel không thấy PIN
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="help", description="Xem toàn bộ danh sách lệnh")
    async def help_cmd(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="🌿 Matcha Bot - Trung tâm Lệnh",
            description="Hệ thống quản lý cá nhân thông minh. Dưới đây là tất cả lệnh có sẵn:",
            color=discord.Color.blue()
        )

        embed.add_field(
            name="💰 Tài chính",
            value=(
                "`/finance` - Xem tóm tắt tháng này\n"
                "`/expense add [tiền] [mô tả]` - Thêm chi tiêu\n"
                "`/income add [tiền]` - Thêm thu nhập\n"
                "`/saving add [tiền]` - Thêm tiết kiệm\n"
                "`/goals` - Xem mục tiêu tiết kiệm\n"
                "`/summary` - Tổng kết tất cả các tháng"
            ),
            inline=False
        )
        embed.add_field(
            name="📋 Công việc",
            value=(
                "`/task add [tên] [thứ] [giờ]` - Thêm công việc\n"
                "`/task done [id]` - Đánh dấu hoàn thành\n"
                "`/task missed [id]` - Đánh dấu bỏ lỡ\n"
                "`/task list` - Xem danh sách hôm nay\n"
                "`/upload [id] [ảnh]` - Upload ảnh minh chứng\n"
                "`/weekly_report` - Báo cáo hiệu năng"
            ),
            inline=False
        )
        embed.add_field(
            name="🔧 Hệ thống",
            value=(
                "`/help` - Xem danh sách lệnh\n"
                "`/status` - Trạng thái bot và database\n"
                "`/web` - Lấy link trang bảng điều khiển Web"
            ),
            inline=False
        )
        embed.set_footer(text=" ✨")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="status", description="Kiểm tra trạng thái bot và database")
    async def status(self, interaction: discord.Interaction):
        await interaction.response.defer()
        # Test database
        try:
            row = db.execute("SELECT COUNT(*) as cnt FROM tasks", fetch='one')
            task_count = row.get('cnt', 0) if row else 0
            row2 = db.execute("SELECT COUNT(*) as cnt FROM monthly_finance", fetch='one')
            finance_count = row2.get('cnt', 0) if row2 else 0
            db_status = f"✅ Kết nối OK | Tasks: `{task_count}` | Finance: `{finance_count}`"
        except Exception as e:
            db_status = f"❌ Lỗi: {str(e)[:50]}"

        embed = discord.Embed(
            title="🌿 Matcha Bot - System Status",
            color=discord.Color.green()
        )
        embed.add_field(name="🤖 Bot", value=f"✅ Online | `{self.bot.user}`", inline=False)
        embed.add_field(name="💾 MySQL Database", value=db_status, inline=False)
        embed.add_field(name="📡 Ping", value=f"`{round(self.bot.latency * 1000)}ms`", inline=True)

        from datetime import datetime
        embed.set_footer(text=f"Kiểm tra lúc: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        await interaction.followup.send(embed=embed)


async def setup(bot):
    await bot.add_cog(ManagementCog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.management ✅")
