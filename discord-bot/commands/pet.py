import discord
from discord import app_commands
from discord.ext import commands
import database as db
import logging

logger = logging.getLogger('MatchaBot.Pet')

def vnd(amount):
    try:
        return f"{float(amount):,.0f}".replace(",", ".") + " VNĐ"
    except:
        return "0 VNĐ"

class PetCog(commands.Cog, name="🌿 Thú ảo Matcha"):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="pet", description="Xem trạng thái thú ảo Matcha")
    async def pet_status(self, interaction: discord.Interaction):
        await interaction.response.defer()
        stats = db.get_user_stats()
        if not stats:
            return await interaction.followup.send("❌ Không tìm thấy dữ liệu thú ảo.")

        level = stats.get('level', 1)
        exp = stats.get('total_exp', 0)
        points = stats.get('current_points', 0)
        state = stats.get('pet_state', 'neutral').capitalize()

        moods = {
            "Happy": "😊 Hạnh phúc (Đang rất vui vì bạn chăm chỉ!)",
            "Neutral": "😐 Bình thường (Cần thêm tương tác nhé)",
            "Sad": "😔 Buồn bã (Bạn bỏ bê Matcha quá...)",
            "Sick": "🤢 Đang ốm (Tài chính hoặc task đang báo động!)"
        }
        mood_str = moods.get(state, f"😶 {state}")

        embed = discord.Embed(
            title="🌿 Trạng thái Matcha Pet",
            description=f"Matcha đang cảm thấy: **{mood_str}**",
            color=discord.Color.green()
        )
        embed.add_field(name="🧬 Cấp độ", value=f"`Level {level}`", inline=True)
        embed.add_field(name="✨ Matcha Points", value=f"`{points} PTS`", inline=True)
        
        # Progress bar
        next_exp = (level ** 2) * 100
        progress = min(100, round((exp / next_exp) * 100))
        bar_len = 10
        filled = int(progress / 10)
        bar = "🟩" * filled + "⬜" * (bar_len - filled)
        
        embed.add_field(name=f"📈 Kinh nghiệm ({progress}%)", value=f"{bar} `{exp}/{next_exp}`", inline=False)
        embed.set_footer(text="Matcha Bot v5.0 | Chúc bạn một ngày năng suất! ✨")
        
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="timeline", description="Xem 10 hoạt động gần nhất")
    async def timeline(self, interaction: discord.Interaction):
        await interaction.response.defer()
        logs = db.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10", fetch='all')
        if not logs:
            return await interaction.followup.send("📭 Chưa có hoạt động nào trong nhật ký.")

        embed = discord.Embed(title="📜 Nhật ký hoạt động Matcha", color=discord.Color.blue())
        icons = {
            'income': '💵', 'expense': '💸', 'saving': '🏦', 
            'task_done': '✅', 'task_missed': '❌', 'reward': '✨', 'penalty': '⚠️',
            'task_started': '🚀'
        }

        for l in logs:
            icon = icons.get(l['type'], '📝')
            time_str = l['created_at'].strftime("%H:%M %d/%m")
            amt = l['amount']
            amt_str = f" | `{vnd(amt)}`" if amt != 0 else ""
            
            embed.add_field(
                name=f"{icon} {l['title']}",
                value=f"⏱️ {time_str}{amt_str}",
                inline=False
            )
        await interaction.followup.send(embed=embed)

async def setup(bot):
    cog = PetCog(bot)
    await bot.add_cog(cog)
    cmds = [c.name for c in cog.get_app_commands()]
    logging.getLogger('MatchaBot').info(f"[LOADED] cogs.pet ✅ Lệnh: {', '.join(cmds)}")
