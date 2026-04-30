import discord
from discord.ext import commands
import logging
import os
import database as db

# AI Engine Imports
from ai.intent_engine import detect_intent
from ai.emotion_engine import detect_emotion
from ai.memory_engine import fetch_context
from ai.planner import decide_strategy
from ai.prompt_builder import build_messages

try:
    from ai_client import AIClient
except ImportError:
    from ..ai_client import AIClient

logger = logging.getLogger('MatchaBot.ChatAI')

class ChatAICog(commands.Cog, name="🧠 Trợ lý AI"):
    """Trợ lý Matcha - Quản gia tài chính và thời gian cực gắt."""

    def __init__(self, bot):
        self.bot = bot
        self.ai = AIClient()
        self.ai_enabled = True # Enabled by default since it's local
        logger.info(f"🧠 Assistant Matcha đã được nạp não bộ ({self.ai.model}).")

    @commands.Cog.listener("on_message")
    async def on_message(self, message: discord.Message):
        if message.author.bot or not self.ai_enabled:
            return

        # Trigger logic
        is_dm = isinstance(message.channel, discord.DMChannel)
        is_mentioned = self.bot.user in message.mentions
        is_reply_to_bot = (message.reference and message.reference.resolved and message.reference.resolved.author == self.bot.user)

        if not (is_dm or is_mentioned or is_reply_to_bot):
            return

        user_text = message.content.replace(f"<@{self.bot.user.id}>", "").strip()
        if not user_text: return

        # === AI ORCHESTRATOR PIPELINE ===
        
        # 1. Intent Engine
        intent = detect_intent(user_text)

        # 2. Emotion Engine
        emotion = detect_emotion(user_text)

        # 3. Memory Engine
        ctx = fetch_context(message.author.id)

        # 4. Planner
        strategy = decide_strategy(intent, emotion)

        # 5. Prompt Builder
        messages = build_messages(intent, emotion, strategy, ctx, user_text)

        try:
            async with message.channel.typing():
                # 6. LLM Client
                ai_response = await self.ai.chat(messages)
                
                if ai_response:
                    # 7. Update Memory
                    db.execute("INSERT INTO chat_memory (user_id, role, content) VALUES (%s, 'user', %s)", (str(message.author.id), user_text))
                    db.execute("INSERT INTO chat_memory (user_id, role, content) VALUES (%s, 'assistant', %s)", (str(message.author.id), ai_response))
                    
                    await message.reply(ai_response)
                else:
                    await message.reply("Não bị lag rồi, tí nói tiếp. (Lỗi kết nối API)")

        except Exception as e:
            logger.error(f"Lỗi AI Pipeline: {e}")
            await message.reply("Cáu quá không buồn nói nữa. (Lỗi hệ thống)")

    async def generate_response(self, prompt, system_prompt=None):
        """Helper để các module khác gọi AI mà không cần thông qua tin nhắn."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        return await self.ai.chat(messages)

async def setup(bot):
    await bot.add_cog(ChatAICog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.chat_ai ✅ (Modular AI Pipeline)")

