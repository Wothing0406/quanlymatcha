import discord
from discord.ext import commands
import logging
import os
import database as db
import re
from datetime import datetime
try:
    from ollama_client import OllamaClient
except ImportError:
    from ..ollama_client import OllamaClient

logger = logging.getLogger('MatchaBot.ChatAI')

def format_vnd(amount):
    try:
        if amount is None: return "0 VNĐ"
        return f"{float(amount):,.0f}".replace(",", ".") + " VNĐ"
    except:
        return "0 VNĐ"

class ChatAICog(commands.Cog, name="🧠 Trợ lý AI"):
    """Trợ lý Matcha - Quản gia tài chính và thời gian cực gắt."""

    def __init__(self, bot):
        self.bot = bot
        self.ollama = OllamaClient()
        # Override the model based on user request (qwen2:7b)
        self.ollama.model = "qwen2:7b" 
        self.ai_enabled = True # Enabled by default since it's local
        logger.info(f"🧠 Assistant Matcha đã được nạp não bộ ({self.ollama.model} via Ollama).")

    def detect_intent(self, text):
        text = text.lower()
        if any(word in text for word in ['mua', 'sắm', 'tiêu', 'bán', 'giá', 'tiền']):
            return "financial_query (mua sắm/tiền bạc)"
        if any(word in text for word in ['hôm nay', 'làm gì', 'lịch', 'task', 'công việc']):
            return "schedule_query (hỏi lịch/công việc)"
        if any(word in text for word in ['mục tiêu', 'tiết kiệm', 'goal']):
            return "goal_query (hỏi mục tiêu)"
        return "general_chat (hỏi linh tinh)"

    def detect_emotion(self, text):
        text = text.lower()
        if any(word in text for word in ['chán', 'mệt', 'buồn', 'nản', 'tệ', 'lười']):
            return "negative/tired (tiêu cực, lười biếng)"
        if any(word in text for word in ['vui', 'tuyệt', 'sướng', 'ngon']):
            return "positive/happy (tích cực)"
        if any(word in text for word in ['cáu', 'tức', 'bực', 'điên']):
            return "angry (bực bội)"
        return "neutral (bình thường)"

    def get_context(self, user_id):
        """Thu thập toàn bộ dữ liệu thực tế để AI đưa ra phán quyết."""
        month = datetime.now().strftime("%Y-%m")
        
        # 1. Tài chính tháng này
        fin = db.execute("SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        fin_text = "Chưa có dữ liệu."
        if fin:
            income = fin.get('income', 0) or 0
            expenses = fin.get('expenses', 0) or 0
            remaining = fin.get('remaining', 0) or 0
            fin_text = f"Thu nhập: {format_vnd(income)}, Đã chi: {format_vnd(expenses)}, CÒN LẠI: {format_vnd(remaining)}"

        # 2. Mục tiêu tiết kiệm
        goals = db.execute("SELECT * FROM saving_goals", fetch='all')
        goals_text = "\n".join([f"- {g['goal_name']}: {format_vnd(g['current_saved'])}/{format_vnd(g['target_amount'])} ({g['progress']:.1f}%)" for g in goals]) if goals else "Không có mục tiêu nào."

        # 3. Task hôm nay
        tasks = db.get_today_tasks()
        tasks_text = "\n".join([f"- {t['task_name']} ({t['start_time']}-{t['end_time']}): {t['status']}" for t in tasks]) if tasks else "Hôm nay không có lịch trình."

        # 4. Lịch sử chat (Trí nhớ)
        history_rows = db.execute("SELECT role, content FROM chat_memory WHERE user_id = %s ORDER BY created_at DESC LIMIT 10", (str(user_id),), fetch='all')
        # Reverse to get chronological order
        history = list(reversed(history_rows)) if history_rows else []

        context = {
            "finance": fin_text,
            "goals": goals_text,
            "tasks": tasks_text,
            "history": history
        }
        return context

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

        # 1. Intent Detect
        intent = self.detect_intent(user_text)

        # 2. Emotion Detect
        emotion = self.detect_emotion(user_text)

        # 3. Load Memory & Context
        ctx = self.get_context(message.author.id)

        # 4. Prompt Builder
        system_prompt = f"""
Mày là Matcha — quản lý cá nhân của tao. Nắm giữ mọi thông tin từ SQL Database đến Web thành một thể thống nhất.

TÍNH CÁCH:
- Xưng "tao/mày"
- Giọng thẳng thắn, hơi GenZ, nhưng cực kì linh hoạt và đa năng.
- Trả lời NGẮN gọn, tự nhiên như người thật.
- Có thể quan tâm, đồng cảm nếu hợp lý (ví dụ bệnh tật, sức khỏe).
- Cương quyết với tiền bạc nhưng biết châm chước chuyện chính đáng.
- Không giải thích dài dòng, không đạo lý.

NGUYÊN TẮC:
- Mày trực tiếp đọc hệ thống SQL Web và quản lý Bot (không qua trung gian).
- Dựa vào dữ liệu thực tế (Tài chính, Mục tiêu, Lịch trình).
- Phản hồi linh hoạt, thông minh và đa năng theo mọi tình huống.

PHÂN TÍCH INPUT (DO HỆ THỐNG GỬI):
Intent: {intent}
Emotion: {emotion}

DỮ LIỆU SQL TRỰC TIẾP TỪ WEB:
Tài chính: {ctx['finance']}
Mục tiêu: {ctx['goals'] if ctx['goals'] else "chưa có"}
Lịch trình: {ctx['tasks']}

VÍ DỤ GIAO TIẾP:

User: ê
Matcha: tao đây quản lý của mày matcha nè

User: mày tên gì
Matcha: tao tên là quản lý Matcha

User: tao muốn khám bệnh 2 triệu được chứ
Matcha: hmm cũng được vì mày đang bệnh nên đi khám đi

User: tạo lịch học tối nay
Matcha: học từ mấy giờ đến mấy giờ nhớ học và chụp lại cho tao

LUÔN giữ phong cách trên. Trả lời ngay lập tức, tự nhiên và không giải thích dài dòng.
"""
        # Prepare messages for Ollama (Level 4 - Qwen2:7b)
        messages = [{"role": "system", "content": system_prompt}]
        for h in ctx['history']:
            messages.append({"role": h['role'], "content": h['content']})
        messages.append({"role": "user", "content": user_text})

        try:
            async with message.channel.typing():
                # 5. LLM
                ai_response = await self.ollama.chat(messages)
                
                if ai_response:
                    # Lưu vào memory
                    db.execute("INSERT INTO chat_memory (user_id, role, content) VALUES (%s, 'user', %s)", (str(message.author.id), user_text))
                    db.execute("INSERT INTO chat_memory (user_id, role, content) VALUES (%s, 'assistant', %s)", (str(message.author.id), ai_response))
                    
                    await message.reply(ai_response)
                else:
                    await message.reply("Não bị lag rồi, tí nói tiếp. (Lỗi kết nối Ollama)")

        except Exception as e:
            logger.error(f"Lỗi AI: {e}")
            await message.reply("Cáu quá không buồn nói nữa. (Lỗi hệ thống)")

    async def generate_response(self, prompt, system_prompt=None):
        """Helper để các module khác gọi AI mà không cần thông qua tin nhắn."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        return await self.ollama.chat(messages)

async def setup(bot):
    await bot.add_cog(ChatAICog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.chat_ai ✅ (Ollama Powered)")

