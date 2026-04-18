import discord
from discord.ext import commands, tasks
import logging
import os
import asyncio
from dotenv import load_dotenv
import scheduler
import database as db

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
    "commands.pet",
    "commands.tasks",
    "commands.management",
    "commands.chat_ai",
    "commands.ocr",
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
        logger.info("🌿 Matcha Bot v5.0 - Đang khởi động...")
        logger.info("=" * 50)

        # 1. Khởi động Database trước (đã có retry logic)
        try:
            await asyncio.to_thread(db.init_db)
            logger.info("✅ Database đã sẵn sàng.")
        except Exception as e:
            logger.error(f"❌ Không thể khởi tạo Database: {e}")
            # Vẫn cho bot chạy tiếp nhưng các lệnh DB sẽ lỗi

        # 2. Load tất cả Cogs (file lệnh) với Log chi tiết
        logger.info("📂 Đang nạp các module lệnh...")
        loaded_count = 0
        for cog in COGS:
            try:
                await self.load_extension(cog)
                loaded_count += 1
                logger.info(f"   [✅] {cog} - Sẵn sàng")
            except Exception as e:
                logger.error(f"   [❌] Lỗi nạp {cog}: {e}")
                import traceback
                logger.error(traceback.format_exc())

        logger.info(f"✨ Tổng cộng đã nạp {loaded_count}/{len(COGS)} module.")
        logger.info("=" * 50)

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
            logger.info("⏳ Đang đồng bộ Slash Commands...")
            # Đồng bộ toàn cầu (mất thời gian)
            await self.tree.sync()
            
            # Đồng bộ vào Guild hiện tại để hiện lệnh ngay lập tức
            for guild in self.guilds:
                try:
                    self.tree.copy_global_to(guild=guild)
                    await self.tree.sync(guild=guild)
                    logger.info(f"✅ Đã đồng bộ lệnh vào Guild: {guild.name}")
                except Exception as e:
                    logger.warning(f"⚠️ Không thể đồng bộ vào Guild {guild.id}: {e}")

            self.synced = True
            logger.info("✨ Slash Commands đã sẵn sàng trên toàn hệ thống!")

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
