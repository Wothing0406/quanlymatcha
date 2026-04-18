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

    @app_commands.command(name="help", description="Xem toàn bộ danh sách lệnh cá nhân")
    async def help_cmd(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="🌿 Matcha Bot - Personal Assistant",
            description="Chào mừng bạn! Đây là danh sách các lệnh dành riêng cho bạn:",
            color=discord.Color.green()
        )

        embed.add_field(
            name="💰 Tài chính (Nhanh)",
            value=(
                "`/income [số] [mô tả]` - Thêm thu nhập\n"
                "`/expense [số] [mô tả]` - Thêm chi tiêu\n"
                "`/saving [số] [mô tả]` - Thêm tiết kiệm\n"
                "`/wallet` - Xem nhanh số dư & điểm\n"
                "`/note [nội dung]` - Ghi chú thông minh (VD: `cafe 30k`)"
            ),
            inline=False
        )
        embed.add_field(
            name="🎮 Cá nhân & Phát triển",
            value=(
                "`/pet` - Xem trạng thái thú ảo Matcha\n"
                "`/timeline` - Xem 10 hoạt động gần nhất\n"
                "`/goals` - Xem mục tiêu tiết kiệm\n"
                "`/summary` - Tổng kết tài chính 6 tháng"
            ),
            inline=False
        )
        embed.add_field(
            name="📋 Công việc",
            value=(
                "`/task list` - Xem việc hôm nay\n"
                "`/task add [tên] [thứ] [giờ]` - Lên lịch mới\n"
                "`/task finish [id] [ảnh]` - Xong việc kèm ảnh kỷ niệm\n"
                "`/weekly_report` - Báo cáo hiệu suất"
            ),
            inline=False
        )
        embed.add_field(
            name="🔧 Hệ thống",
            value=(
                "`/web` - Lấy link truy cập Web Dashboard\n"
                "`/status` - Kiểm tra Bot & Database"
            ),
            inline=False
        )
        embed.set_footer(text="Matcha Bot v5.0 | Dành riêng cho chủ nhân ✨")
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


    @app_commands.command(name="sync", description="Cưỡng ép đồng bộ lại tất cả lệnh (Chỉ Admin)")
    async def sync_commands(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            # Sync to the current guild immediately
            self.bot.tree.copy_global_to(guild=interaction.guild)
            synced = await self.bot.tree.sync(guild=interaction.guild)
            
            # Global sync (takes longer)
            await self.bot.tree.sync()
            
            await interaction.followup.send(f"✅ Đã đồng bộ thành công {len(synced)} lệnh cho Server này!", ephemeral=True)
            logger.info(f"🔄 Manual Sync triggered by {interaction.user.name}")
        except Exception as e:
            await interaction.followup.send(f"❌ Lỗi đồng bộ: {e}", ephemeral=True)

async def setup(bot):
    cog = ManagementCog(bot)
    await bot.add_cog(cog)
    cmds = [c.name for c in cog.get_app_commands()]
    logging.getLogger('MatchaBot').info(f"[LOADED] cogs.management ✅ Lệnh: {', '.join(cmds)}")
