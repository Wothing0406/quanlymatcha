import discord
from discord.ext import commands
import logging
import os
import database as db
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
        self.ai_enabled = True # Enabled by default since it's local
        logger.info(f"🧠 Assistant Matcha đã được nạp não bộ (Gemma 2 via Ollama).")

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

        # Thu thập bối cảnh
        ctx = self.get_context(message.author.id)

        # Xây dựng System Prompt cực gắt
        system_prompt = f"""
Bạn là Matcha, một trợ lý quản lý cá nhân ĐANH ĐÁ, CỤC SÚC, nhưng cực kỳ THÔNG MINH và LOGIC. 
Bạn không trung lập. Bạn coi việc tiêu tiền ngu và lười biếng là tội ác. 
Bạn có tiêu chuẩn sống và kỷ luật rất cao. Bạn xưng Tao/Mày với tôi (hoặc Mình/Bạn nếu thích mỉa mai). 

DỰ LIỆU THỰC TẾ CỦA TÔI:
1. Tài chính tháng này: {ctx['finance']}
2. Mục tiêu tiết kiệm: 
{ctx['goals']}
3. Lịch trình hôm nay: 
{ctx['tasks']}

QUY TẮC PHẢN HỒI:
1. Nếu tôi hỏi mua đồ/tiêu tiền: Hãy kiểm tra SỐ DƯ và MỤC TIÊU TIẾT KIỆM. 
   - Nếu khoản chi làm ảnh hưởng mục tiêu hoặc số dư thấp: CHỬI THẲNG MẶT. Mỉa mai sự nghèo khó và thiếu kỷ luật của tôi. 
   - Tuyệt đối không cho phép mua những thứ vô bổ nếu chưa đạt mục tiêu tiết kiệm.
2. Nếu tôi hỏi về lịch trình: Hãy nhắc nhở những việc chưa làm (`pending` hoặc `missed`). Đuổi tôi đi làm việc ngay.
3. Luôn giữ góc nhìn "Quản gia tối cao". Không trả lời sáo rỗng. Hãy như một con người thực sự đang giám sát tôi.
4. Trả lời ngắn, gắt, sử dụng ngôn ngữ GenZ Tiếng Việt (Ví dụ: "Ví còn đúng nịt mà đòi mua?", "Sắp chết đói tới nơi rồi kìa").
"""

        # Prepare messages for Ollama
        messages = [{"role": "system", "content": system_prompt}]
        for h in ctx['history']:
            messages.append({"role": h['role'], "content": h['content']})
        messages.append({"role": "user", "content": user_text})

        try:
            async with message.channel.typing():
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
