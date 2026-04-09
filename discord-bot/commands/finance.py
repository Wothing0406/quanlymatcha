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

    @expense_group.command(name="add", description="Thêm chi tiêu mới (VNĐ)")
    @app_commands.describe(amount="Số tiền (VNĐ)", description="Mô tả khoản chi")
    async def expense_add(self, interaction: discord.Interaction, amount: int, description: str):
        month = get_current_month()
        db.execute(
            """INSERT INTO monthly_finance (month, income, expenses, saving, remaining)
               VALUES (%s, 0, %s, 0, -%s)
               ON DUPLICATE KEY UPDATE
               expenses = expenses + %s,
               remaining = income - (expenses + %s) - saving""",
            (month, amount, amount, amount, amount)
        )
        row = db.execute("SELECT remaining FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        remaining = row.get('remaining', 0) if row else 0

        logger.info(f"💸 Chi tiêu: -{vnd(amount)} | {description}")
        embed = discord.Embed(
            title="💸 Đã ghi nhận chi tiêu",
            description=f"**{description}**: `-{vnd(amount)}`\n\n💎 **Còn lại tháng này:** `{vnd(remaining)}`",
            color=discord.Color.orange()
        )
        await interaction.response.send_message(embed=embed)

    # ─── /income ────────────────────────────────────────────────────────────
    income_group = app_commands.Group(name="income", description="Quản lý thu nhập")

    @income_group.command(name="add", description="Thêm thu nhập mới (VNĐ)")
    @app_commands.describe(amount="Số tiền thu nhập (VNĐ)")
    async def income_add(self, interaction: discord.Interaction, amount: int):
        month = get_current_month()
        db.execute(
            """INSERT INTO monthly_finance (month, income, expenses, saving, remaining)
               VALUES (%s, %s, 0, 0, %s)
               ON DUPLICATE KEY UPDATE
               income = income + %s,
               remaining = (income + %s) - expenses - saving""",
            (month, amount, amount, amount, amount)
        )
        row = db.execute("SELECT income, remaining FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        logger.info(f"💵 Thu nhập mới: +{vnd(amount)}")
        embed = discord.Embed(
            title="💵 Đã cộng thu nhập",
            description=f"**+{vnd(amount)}** đã được ghi nhận!\n\n💎 **Còn lại tháng này:** `{vnd(row.get('remaining', 0))}`",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    # ─── /saving ────────────────────────────────────────────────────────────
    saving_group = app_commands.Group(name="saving", description="Quản lý tiết kiệm")

    @saving_group.command(name="add", description="Thêm tiết kiệm tháng này (VNĐ)")
    @app_commands.describe(amount="Số tiền tiết kiệm (VNĐ)")
    async def saving_add(self, interaction: discord.Interaction, amount: int):
        month = get_current_month()
        db.execute(
            """INSERT INTO monthly_finance (month, income, expenses, saving, remaining)
               VALUES (%s, 0, 0, %s, -%s)
               ON DUPLICATE KEY UPDATE
               saving = saving + %s,
               remaining = income - expenses - (saving + %s)""",
            (month, amount, amount, amount, amount)
        )
        row = db.execute("SELECT remaining FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        logger.info(f"🏦 Tiết kiệm mới: +{vnd(amount)}")
        embed = discord.Embed(
            title="🏦 Đã cộng tiết kiệm",
            description=f"**+{vnd(amount)}** đã được thêm vào tiết kiệm!\n\n💎 **Còn lại tháng này:** `{vnd(row.get('remaining', 0))}`",
            color=discord.Color.teal()
        )
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


async def setup(bot):
    await bot.add_cog(FinanceCog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.finance ✅")
