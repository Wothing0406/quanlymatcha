import discord
from discord import app_commands
from discord.ext import commands
import logging
import database as db

logger = logging.getLogger('MatchaBot.Finance')

def vnd(amount):
    """Format số tiền theo chuẩn VNĐ."""
    try:
        return f"{float(amount):,.0f}".replace(",", ".") + " VNĐ"
    except:
        return "0 VNĐ"

def get_current_month():
    from datetime import datetime
    return datetime.now().strftime("%Y-%m")

class FinanceCog(commands.Cog, name="💰 Tài chính"):
    """Quản lý tài chính cá nhân - Thu nhập, Chi tiêu, Tiết kiệm."""

    def __init__(self, bot):
        self.bot = bot

    # ─── /finance ────────────────────────────────────────────────────────────
    @app_commands.command(name="finance", description="Xem tóm tắt tài chính tháng này")
    async def finance(self, interaction: discord.Interaction):
        await interaction.response.defer()
        month = get_current_month()
        row = db.execute(
            "SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one'
        )
        if not row:
            return await interaction.followup.send(
                f"📭 Chưa có dữ liệu tài chính cho tháng `{month}`.\nDùng `/income add` để bắt đầu nhé!"
            )

        income = row.get('income', 0) or 0
        expenses = row.get('expenses', 0) or 0
        saving = row.get('saving', 0) or 0
        remaining = row.get('remaining', 0) or 0

        color = discord.Color.red() if remaining < 0 else discord.Color.gold()
        embed = discord.Embed(
            title=f"💰 Tài chính tháng {month}",
            color=color
        )
        embed.add_field(name="💵 Thu nhập", value=f"`{vnd(income)}`", inline=True)
        embed.add_field(name="💸 Chi tiêu", value=f"`{vnd(expenses)}`", inline=True)
        embed.add_field(name="🏦 Tiết kiệm", value=f"`{vnd(saving)}`", inline=True)
        embed.add_field(name="💎 Còn lại", value=f"**`{vnd(remaining)}`**", inline=False)

        status = "⚠️ Bạn đang chi vượt ngân sách!" if remaining < 0 else "✅ Tài chính đang trong tầm kiểm soát."
        embed.description = status
        embed.set_footer(text="Matcha Finance Manager ✨")
        await interaction.followup.send(embed=embed)

    # ─── /expense ────────────────────────────────────────────────────────────
    expense_group = app_commands.Group(name="expense", description="Quản lý chi tiêu")

    @expense_group.command(name="add", description="Thêm chi tiêu mới (Ví dụ: 30k, 1.5tr)")
    @app_commands.describe(amount="Số tiền (VND, hỗ trợ k, tr, m)", description="Mô tả khoản chi")
    async def expense_add(self, interaction: discord.Interaction, amount: str, description: str):
        parsed_amount = db.parse_amount(amount)
        if parsed_amount <= 0:
            return await interaction.response.send_message("❌ Số tiền không hợp lệ! Vui lòng nhập kiểu `30000`, `30k` hoặc `1.5tr`.", ephemeral=True)

        month = get_current_month()
        db.execute(
            """INSERT INTO monthly_finance (month, income, expenses, saving, remaining)
               VALUES (%s, 0, %s, 0, -%s)
               ON DUPLICATE KEY UPDATE
               expenses = expenses + %s,
               remaining = income - (expenses + %s) - saving""",
            (month, parsed_amount, parsed_amount, parsed_amount, parsed_amount)
        )

        # ✨ ĐỒNG BỘ: Thêm vào nhật ký hoạt động chung (activity_log)
        db.log_activity('expense', description, parsed_amount)

        # Legacy Sync (vẫn giữ bảng purchases cho tính tương thích nếu cần)
        db.execute("INSERT INTO purchases (item_name, amount) VALUES (%s, %s)", (description, parsed_amount))

        row = db.execute("SELECT remaining FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        remaining = row.get('remaining', 0) if row else 0

        logger.info(f"💸 Chi tiêu: -{vnd(parsed_amount)} | {description}")
        embed = discord.Embed(
            title="💸 Đã ghi nhận chi tiêu",
            description=f"**{description}**: `-{vnd(parsed_amount)}`\n\n💎 **Còn lại tháng này:** `{vnd(remaining)}`",
            color=discord.Color.orange()
        )
        await interaction.response.send_message(embed=embed)

    # ─── /income ────────────────────────────────────────────────────────────
    income_group = app_commands.Group(name="income", description="Quản lý thu nhập")

    @income_group.command(name="add", description="Thêm thu nhập mới (Ví dụ: 10tr)")
    @app_commands.describe(amount="Số tiền thu nhập (VND, hỗ trợ k, tr, m)", description="Nguồn thu nhập")
    async def income_add(self, interaction: discord.Interaction, amount: str, description: str = "Thu nhập mới"):
        parsed_amount = db.parse_amount(amount)
        if parsed_amount <= 0:
            return await interaction.response.send_message("❌ Số tiền không hợp lệ!", ephemeral=True)

        month = get_current_month()
        db.execute(
            """INSERT INTO monthly_finance (month, income, expenses, saving, remaining)
               VALUES (%s, %s, 0, 0, %s)
               ON DUPLICATE KEY UPDATE
               income = income + %s,
               remaining = (income + %s) - expenses - saving""",
            (month, parsed_amount, parsed_amount, parsed_amount, parsed_amount)
        )
        
        # ✨ ĐỒNG BỘ: Thêm vào nhật ký hoạt động
        db.log_activity('income', description, parsed_amount)

        row = db.execute("SELECT income, remaining FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        logger.info(f"💵 Thu nhập mới: +{vnd(parsed_amount)}")
        
        # --- V5.0 Gamification ---
        res = db.add_points(10, 20, f"Ghi nhận thu nhập: {description}")
        
        embed = discord.Embed(
            title="💵 Đã cộng thu nhập",
            description=f"**{description}**: `+{vnd(parsed_amount)}`\n\n💎 **Còn lại tháng này:** `{vnd(row.get('remaining', 0))}`\n\n✨ +10đ Matcha!",
            color=discord.Color.green()
        )
        if res and res.get('leveled_up'):
            embed.description += f"\n\n🎊 **LEVEL UP!** Bạn đã thăng cấp lên **Level {res['level']}**!"
            
        await interaction.response.send_message(embed=embed)

    # ─── /saving ────────────────────────────────────────────────────────────
    saving_group = app_commands.Group(name="saving", description="Quản lý tiết kiệm")

    @saving_group.command(name="add", description="Tiết kiệm tháng này (Ví dụ: 2tr)")
    @app_commands.describe(amount="Số tiền (VND, hỗ trợ k, tr, m)", description="Ghi chú tiết kiệm")
    async def saving_add(self, interaction: discord.Interaction, amount: str, description: str = "Tiết kiệm tháng"):
        parsed_amount = db.parse_amount(amount)
        if parsed_amount <= 0:
            return await interaction.response.send_message("❌ Số tiền không hợp lệ!", ephemeral=True)

        month = get_current_month()
        db.execute(
            """INSERT INTO monthly_finance (month, income, expenses, saving, remaining)
               VALUES (%s, 0, 0, %s, -%s)
               ON DUPLICATE KEY UPDATE
               saving = saving + %s,
               remaining = income - expenses - (saving + %s)""",
            (month, parsed_amount, parsed_amount, parsed_amount, parsed_amount)
        )
        
        # ✨ ĐỒNG BỘ: Thêm vào nhật ký hoạt động
        db.log_activity('saving', description, parsed_amount)

        row = db.execute("SELECT remaining FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        logger.info(f"🏦 Tiết kiệm mới: +{vnd(parsed_amount)}")
        
        # --- V5.0 Gamification ---
        res = db.add_points(30, 50, f"Tiết kiệm: {description}")
        
        embed = discord.Embed(
            title="🏦 Đã cộng tiết kiệm",
            description=f"**{description}**: `+{vnd(parsed_amount)}`\n\n💎 **Còn lại tháng này:** `{vnd(row.get('remaining', 0))}`\n\n🏆 +30đ Matcha (Chiến thần tích lũy!)",
            color=discord.Color.teal()
        )
        if res and res.get('leveled_up'):
            embed.description += f"\n\n🎊 **LEVEL UP!** Bạn đã thăng cấp lên **Level {res['level']}**!"

        await interaction.response.send_message(embed=embed)

    # ─── /goals ────────────────────────────────────────────────────────────
    @app_commands.command(name="goals", description="Xem tiến độ các mục tiêu tiết kiệm")
    async def goals(self, interaction: discord.Interaction):
        await interaction.response.defer()
        goals = db.execute("SELECT * FROM saving_goals", fetch='all')
        if not goals:
            return await interaction.followup.send("📭 Chưa có mục tiêu nào. Hãy thêm từ trang web nhé!")

        embed = discord.Embed(
            title="🎯 Mục tiêu tiết kiệm",
            description="Kiên trì từng chút một nhé! ✨",
            color=discord.Color.green()
        )
        for g in goals:
            target = g.get('target_amount', 0) or 1
            current = g.get('current_saved', 0) or 0
            progress = min(100, round((current / target) * 100))
            bar = "🟩" * (progress // 10) + "⬜" * (10 - (progress // 10))
            months_left = g.get('deadline_months', 0)
            embed.add_field(
                name=f"💎 {g['goal_name']}",
                value=f"Mục tiêu: `{vnd(target)}` | Đã có: `{vnd(current)}`\n{bar} **{progress}%** | Còn: `{months_left} tháng`",
                inline=False
            )
        await interaction.followup.send(embed=embed)

    # ─── /summary ────────────────────────────────────────────────────────────
    @app_commands.command(name="summary", description="Tổng kết tài chính tất cả các tháng")
    async def summary(self, interaction: discord.Interaction):
        await interaction.response.defer()
        rows = db.execute(
            "SELECT month, income, expenses, saving, remaining FROM monthly_finance ORDER BY month DESC LIMIT 6",
            fetch='all'
        )
        if not rows:
            return await interaction.followup.send("📭 Chưa có dữ liệu tài chính nào.")

        total_income = sum(r.get('income', 0) or 0 for r in rows)
        total_expenses = sum(r.get('expenses', 0) or 0 for r in rows)
        total_saving = sum(r.get('saving', 0) or 0 for r in rows)
        total_remaining = sum(r.get('remaining', 0) or 0 for r in rows)

        embed = discord.Embed(
            title="📊 Tổng kết tài chính (6 tháng gần nhất)",
            color=discord.Color.purple()
        )
        for r in rows:
            embed.add_field(
                name=f"📅 {r['month']}",
                value=f"Thu: `{vnd(r.get('income',0))}` | Chi: `{vnd(r.get('expenses',0))}` | Còn: `{vnd(r.get('remaining',0))}`",
                inline=False
            )
        embed.add_field(name="─────────────────", value="\u200b", inline=False)
        embed.add_field(name="💵 Tổng thu", value=f"`{vnd(total_income)}`", inline=True)
        embed.add_field(name="💸 Tổng chi", value=f"`{vnd(total_expenses)}`", inline=True)
        embed.add_field(name="🏦 Tổng tiết kiệm", value=f"`{vnd(total_saving)}`", inline=True)
        embed.add_field(name="💎 Tổng còn lại", value=f"**`{vnd(total_remaining)}`**", inline=False)
        embed.set_footer(text="Matcha Finance Summary ✨")
        await interaction.followup.send(embed=embed)


    # ─── /note ────────────────────────────────────────────────────────────
    @app_commands.command(name="note", description="Ghi chú thông minh (Ví dụ: cafe 30k, +100k bonus, save 2tr)")
    @app_commands.describe(content="Nội dung ghi chú thông minh")
    async def note(self, interaction: discord.Interaction, content: str):
        """
        Xử lý ghi chú thông minh:
        - 'cafe 30k' -> Chi tiêu
        - '+100k' hoặc 'plus 100k' -> Thu nhập
        - 'save 1tr' -> Tiết kiệm
        """
        import re
        content = content.lower().strip()
        
        # 1. Thu thập con số và hậu tố
        match = re.search(r"(\d+\.?\d*[ktr mbt]*)", content)
        if not match:
            return await interaction.response.send_message("❌ Không tìm thấy con số trong ghi chú. Ví dụ: `cafe 30k`", ephemeral=True)
            
        amount_str = match.group(1)
        parsed_amount = db.parse_amount(amount_str)
        
        # 2. Xác định loại (type)
        if content.startswith('+') or 'plus' in content or 'income' in content or 'lương' in content:
            # Thu nhập
            clean_title = content.replace(amount_str, '').replace('+', '').replace('plus', '').replace('income', '').strip()
            await self.income_add.callback(self, interaction, amount_str, clean_title or "Ghi chú Thu nhập")
        elif 'save' in content or 'gửi' in content or 'cất' in content:
            # Tiết kiệm
            clean_title = content.replace(amount_str, '').replace('save', '').replace('gửi', '').replace('cất', '').strip()
            await self.saving_add.callback(self, interaction, amount_str, clean_title or "Ghi chú Tiết kiệm")
        else:
            # Mặc định là Chi tiêu
            clean_title = content.replace(amount_str, '').strip()
            await self.expense_add.callback(self, interaction, amount_str, clean_title or "Ghi chú Chi tiêu")

            clean_title = content.replace(amount_str, '').strip()
            await self.expense_add.callback(self, interaction, amount_str, clean_title or "Ghi chú Chi tiêu")

    # ─── TOP LEVEL SHORTCUTS ────────────────────────────────────────────────
    @app_commands.command(name="income", description="Thêm nhanh thu nhập")
    @app_commands.describe(amount="Số tiền (VD: 10tr, 50k)", description="Mô tả")
    async def shortcut_income(self, interaction: discord.Interaction, amount: str, description: str = "Thu nhập"):
        await interaction.response.defer()
        await self.income_add.callback(self, interaction, amount, description)

    @app_commands.command(name="expense", description="Thêm nhanh chi tiêu")
    @app_commands.describe(amount="Số tiền (VD: 30k, 1.5tr)", description="Mô tả khoản chi")
    async def shortcut_expense(self, interaction: discord.Interaction, amount: str, description: str):
        await interaction.response.defer()
        await self.expense_add.callback(self, interaction, amount, description)

    @app_commands.command(name="saving", description="Thêm nhanh tiết kiệm")
    @app_commands.describe(amount="Số tiền (VD: 2tr)", description="Ghi chú")
    async def shortcut_saving(self, interaction: discord.Interaction, amount: str, description: str = "Tiết kiệm"):
        await interaction.response.defer()
        await self.saving_add.callback(self, interaction, amount, description)

    @app_commands.command(name="wallet", description="Xem ví tiền và điểm Matcha")
    async def wallet(self, interaction: discord.Interaction):
        await self.finance.callback(self, interaction)

    @app_commands.command(name="timeline", description="Xem 10 hoạt động gần nhất")
    async def timeline(self, interaction: discord.Interaction):
        await interaction.response.defer()
        logs = db.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10", fetch='all')
        if not logs:
            return await interaction.followup.send("📭 Chưa có hoạt động nào được ghi lại.")

        embed = discord.Embed(title="📜 Nhật ký hoạt động gần đây", color=discord.Color.green())
        
        icons = {
            'income': '💵', 'expense': '💸', 'saving': '🏦', 
            'task_done': '✅', 'task_missed': '❌', 'reward': '✨', 'penalty': '⚠️'
        }

        for l in logs:
            icon = icons.get(l['type'], '📝')
            time_str = l['created_at'].strftime("%H:%M %d/%m")
            amt_str = f" | `{vnd(l['amount'])}`" if l['amount'] != 0 else ""
            embed.add_field(
                name=f"{icon} {l['title']}",
                value=f"⏱️ {time_str}{amt_str}",
                inline=False
            )
        await interaction.followup.send(embed=embed)

    @app_commands.command(name="pet", description="Xem trạng thái Thú ảo Matcha")
    async def pet_status(self, interaction: discord.Interaction):
        stats = db.get_user_stats()
        if not stats:
            return await interaction.response.send_message("❌ Không tìm thấy dữ liệu user.")

        level = stats.get('level', 1)
        exp = stats.get('total_exp', 0)
        points = stats.get('current_points', 0)
        state = stats.get('pet_state', 'neutral').capitalize()

        # Simple mood mapping
        moods = {"Happy": "😊 Hạnh phúc", "Neutral": "😐 Bình thường", "Sad": "😔 Buồn bã", "Sick": "🤢 Đang ốm"}
        mood_str = moods.get(state, state)

        embed = discord.Embed(title="🌿 Matcha Pet Status", color=discord.Color.green())
        embed.add_field(name="🧬 Cấp độ", value=f"`Level {level}`", inline=True)
        embed.add_field(name="✨ Điểm Matcha", value=f"`{points} PTS`", inline=True)
        embed.add_field(name="🎭 Tâm trạng", value=mood_str, inline=True)
        
        # Progress bar for level
        next_level_exp = (level ** 2) * 100
        progress = min(100, round((exp / next_level_exp) * 100))
        bar = "🟩" * (progress // 10) + "⬜" * (10 - (progress // 10))
        embed.add_field(name="📈 Kinh nghiệm (EXP)", value=f"{bar} `{exp}/{next_level_exp}`", inline=False)

        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(FinanceCog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.finance ✅")
