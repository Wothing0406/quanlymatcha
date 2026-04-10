import discord
from discord.ext import commands, tasks
import logging
import os
import asyncio
from dotenv import load_dotenv
import scheduler

# Load .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

# ─── Cấu hình Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('MatchaBot')

DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
USER_ID = int(os.getenv('DISCORD_USER_ID', 0))

# ─── Command Files (Cogs) tự động load ───────────────────────────────────────
COGS = [
    "commands.finance",
    "commands.tasks",
    "commands.management",
    "commands.chat_ai",
]

class MatchaBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix="!", intents=intents)
        self.dm_channel = None
        self.synced = False

    async def setup_hook(self):
        logger.info("=" * 50)
        logger.info("🌿 Matcha Bot v4.0 - Đang khởi động...")
        logger.info("=" * 50)

        # Load tất cả Cogs (file lệnh)
        for cog in COGS:
            try:
                await self.load_extension(cog)
            except Exception as e:
                logger.error(f"[FAILED] load {cog}: {e}")

        logger.info("=" * 50)
        logger.info("✅ Đã load xong tất cả command files.")
        logger.info("=" * 50)

        # Khởi động scheduler
        self.task_check_loop.start()

    async def on_ready(self):
        logger.info(f"🤖 Bot đã kết nối Gateway: {self.user} (ID: {self.user.id})")

        # Global interaction check: Only allow the authorized user
        @self.tree.error
        async def on_app_command_error(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
            if isinstance(error, discord.app_commands.CheckFailure):
                await interaction.response.send_message("❌ Xin lỗi, bot này chỉ dành cho chủ sở hữu Matcha.", ephemeral=True)
            else:
                logger.error(f"AppCommand error: {error}")

        async def owner_only_check(interaction: discord.Interaction) -> bool:
            if interaction.user.id != USER_ID:
                return False
            return True
        
        # Apply the check to the tree
        self.tree.interaction_check = owner_only_check

        if not self.synced:
            logger.info("⏳ Đang đồng bộ Slash Commands toàn cầu (có thể mất 1-5 phút)...")
            await self.tree.sync()
            self.synced = True
            logger.info("✅ Slash Commands đã được đồng bộ thành công!")

        # Thiết lập kênh DM
        try:
            user = await self.fetch_user(USER_ID)
            self.dm_channel = await user.create_dm()
            logger.info(f"📬 Kênh DM sẵn sàng: {user.name}")
        except Exception as e:
            logger.warning(f"⚠️ Không thiết lập được DM: {e}")

        logger.info("=" * 50)
        logger.info("🌿 Matcha Bot đã hoạt động")
        logger.info("=" * 50)

    @tasks.loop(seconds=60)
    async def task_check_loop(self):
        await scheduler.check_tasks(self, self.dm_channel)

    @task_check_loop.before_loop
    async def before_check(self):
        await self.wait_until_ready()
        logger.info("⏰ Scheduler nhắc nhở đã kích hoạt (mỗi 60 giây)")


bot = MatchaBot()

if __name__ == "__main__":
    if not DISCORD_TOKEN:
        logger.critical("❌ DISCORD_TOKEN chưa được cấu hình trong .env!")
        exit(1)
    bot.run(DISCORD_TOKEN, log_handler=None)
