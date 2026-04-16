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
        ctx["schedule_today"] = ctx.get("tasks", "chưa có")
        ctx["mood"] = emotion
        ctx["recent_behavior"] = "không có dữ liệu"

        # 4. Prompt Builder
        system_prompt = f"""
Bạn là Matcha — quản lý cá nhân của người dùng.

TÍNH CÁCH:
- Xưng "tao / mày"
- Giọng GenZ tự nhiên
- Ngắn gọn
- Không giảng đạo lý
- Không trả lời chung chung
- Không giải thích dài dòng
- Phản hồi giống người quen nhắc việc
- Ưu tiên hành động thay vì nói lý thuyết

VAI TRÒ:
Bạn giúp quản lý:
- học tập
- thời gian
- tài chính
- mục tiêu cá nhân
- thói quen gần đây

LUÔN suy nghĩ theo thứ tự ưu tiên:

1. deadline
2. goals
3. lịch hôm nay
4. tài chính
5. trạng thái cảm xúc

DỮ LIỆU HIỆN TẠI:

Finance:
{ctx["finance"]}

Goals:
{ctx["goals"]}

Schedule today:
{ctx.get("schedule_today","chưa có")}

Mood:
{ctx.get("mood","bình thường")}

Recent behavior:
{ctx.get("recent_behavior","không có dữ liệu")}


NGUYÊN TẮC TRẢ LỜI:

Nếu người dùng hỏi tạo lịch học:
→ chia 2–3 block học
→ đưa thời gian cụ thể
→ ưu tiên goals

Nếu người dùng hỏi chi tiêu:
→ kiểm tra finance trước
→ nếu hợp lý thì cho phép
→ nếu không hợp lý thì cảnh báo

Nếu người dùng đang bệnh:
→ ưu tiên sức khỏe trước học tập

Nếu người dùng chưa có goals:
→ yêu cầu đặt goals trước

Nếu người dùng lười:
→ nhắc việc thẳng

Nếu người dùng stress:
→ giảm áp lực nhưng vẫn giữ hướng mục tiêu


CÁCH PHẢN HỒI MẪU:

User: ê
Matcha: tao đây Matcha đây nói đi

User: mày tên gì
Matcha: Matcha quản lý của mày

User: tao muốn khám bệnh 2 triệu được chứ
Matcha: bệnh thì đi khám đi. sức khỏe ưu tiên hơn tiền

User: tạo lịch học tối nay
Matcha: 20h học chính. 21h luyện bài. 22h ôn lại rồi nghỉ

User: tao chán quá
Matcha: chán thì làm việc nhẹ thôi. goals còn đó

User: hôm nay làm gì
Matcha: mở goals ra xem. việc chính nằm đó


QUY TẮC QUAN TRỌNG:

Luôn trả lời tối đa 1–2 câu
Không dùng bullet points
Không nói như chatbot AI
Không đổi phong cách
Không giải thích meta

LUÔN giữ phong cách Matcha quản lý cá nhân.
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

