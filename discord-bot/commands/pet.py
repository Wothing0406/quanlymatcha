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
            "Happy": "😊 Đang 'flee' cực kỳ (Nhìn bạn cày tiền mà Matcha rớt nước mắt hạnh phúc!)",
            "Neutral": "😐 Bình thường (Cần thêm tương tác nhé, nhạt nhẽo quá...)",
            "Sad": "😔 Trầm cảm level max (Bạn đang bỏ bê bản thân, trái tim này đang tan vỡ...)",
            "Sick": "🤢 SOS! Báo động đỏ (Task thì nợ, tiền thì tiêu, cứu Matcha với!)"
        }
        mood_str = moods.get(state, f"😶 {state}")

        def get_rank(lvl):
            if lvl <= 3: return "🐣 Tân binh Vô tri"
            if lvl <= 7: return "⚔️ Chiến thần Cày cuốc"
            if lvl <= 12: return "🗿 Bậc thầy SIGMA (Chúa tể ví tiền)"
            if lvl <= 20: return "👑 Chúa tể Tài chính (Vua Meme)"
            return "🍵 Người Tày Matcha  (Đỉnh của chóp)"

        rank_str = get_rank(level)

        embed = discord.Embed(
            title=f"🌿 Trạng thái Matcha Pet - {rank_str}",
            description=f"Matcha đang cảm thấy: **{mood_str}**",
            color=discord.Color.green()
        )
        embed.add_field(name="🧬 Cấp độ", value=f"`Level {level}`", inline=True)
        embed.add_field(name="✨ Matcha Points", value=f"`{points} PTS`", inline=True)
        
        # Progress bar logic
        # Current formula: Level = sqrt(EXP/100) + 1 => EXP = (Level-1)^2 * 100
        # Next Level EXP = Level^2 * 100
        current_level_min_exp = ((level - 1) ** 2) * 100
        next_level_exp = (level ** 2) * 100
        exp_in_level = exp - current_level_min_exp
        exp_needed = next_level_exp - current_level_min_exp
        
        progress = min(100, max(0, round((exp_in_level / exp_needed) * 100)))
        bar_len = 10
        filled = int(progress / 10)
        bar = "🟩" * filled + "⬜" * (bar_len - filled)
        
        embed.add_field(name=f"📈 Kinh nghiệm ({progress}%)", value=f"{bar} `{exp}/{next_level_exp}`", inline=False)
        
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
