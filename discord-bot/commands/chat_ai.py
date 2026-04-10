import discord
from discord.ext import commands
import logging
import os
import google.generativeai as genai
import database as db
from datetime import datetime

logger = logging.getLogger('MatchaBot.ChatAI')

def format_vnd(amount):
    try:
        return f"{float(amount):,.0f}".replace(",", ".") + " VNĐ"
    except:
        return "0 VNĐ"

class ChatAICog(commands.Cog, name="🧠 Trợ lý AI"):
    """Chatbot AI sử dụng Gemini, cực gắt trong việc giữ tiền."""

    def __init__(self, bot):
        self.bot = bot
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.ai_enabled = False
        
        if self.api_key and self.api_key.strip() != "":
            try:
                genai.configure(api_key=self.api_key)
                # Using the canonical model name
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                self.ai_enabled = True
                logger.info("🧠 Generative AI đã được kích hoạt (Gemini 1.5 Flash).")
            except Exception as e:
                logger.error(f"❌ Lỗi khi khởi tạo Gemini Model: {e}")
                self.ai_enabled = False
        else:
            logger.warning("⚠️ Không tìm thấy GEMINI_API_KEY. Tính năng Chat AI bị tắt.")

    def get_financial_context(self):
        """Lấy dữ liệu tài chính của tháng hiện tại để mớm cho AI."""
        month = datetime.now().strftime("%Y-%m")
        row = db.execute("SELECT * FROM monthly_finance WHERE month = %s", (month,), fetch='one')
        
        if not row:
            return "Tháng này chưa có thu nhập hay chi tiêu nào."
            
        income = row.get('income', 0) or 0
        expenses = row.get('expenses', 0) or 0
        remaining = row.get('remaining', 0) or 0
        
        context = (
            f"Tình hình tài chính tháng {month}:\n"
            f"- Thu nhập: {format_vnd(income)}\n"
            f"- Đã chi tiêu: {format_vnd(expenses)}\n"
            f"- SỐ DƯ CÒN LẠI: {format_vnd(remaining)}\n"
        )
        return context

    @commands.Cog.listener("on_message")
    async def on_message(self, message: discord.Message):
        # Ignore messages from bots
        if message.author.bot:
            return

        # Check if the AI is enabled
        if not self.ai_enabled:
            return

        # Trigger conditions:
        # 1. Message is in DM (Direct Message)
        # 2. OR bot is mentioned in the message
        is_dm = isinstance(message.channel, discord.DMChannel)
        is_mentioned = self.bot.user in message.mentions
        
        # Also allow replying to the bot's direct messages as a trigger
        is_reply_to_bot = False
        if message.reference and message.reference.resolved:
            if message.reference.resolved.author == self.bot.user:
                is_reply_to_bot = True

        if not (is_dm or is_mentioned or is_reply_to_bot):
            return

        # Clean the message content (remove the bot mention from the text)
        user_text = message.content.replace(f"<@{self.bot.user.id}>", "").strip()
        if not user_text:
            return

        # Get financial context
        fin_context = self.get_financial_context()

        # Construct Prompt Engineering
        # Yêu cầu: Trợ lý thông minh, CHỬI/MẮNG khi tiêu xài, não bộ thông minh, không theo kịch bản cứng
        system_prompt = f"""
Bạn là Matcha, một trợ lý quản lý tài chính cá nhân dành riêng cho tôi. Bạn có tính cách cực kỳ ĐANH ĐÁ, GẮT GAO, CỤC SÚC, nhưng thâm tâm vẫn muốn tốt cho túi tiền của tôi. 
Tuyệt đối KHÔNG thân thiện sáo rỗng. Hãy nói chuyện như một người bạn thân nhưng rất hay "chửi" khi tôi xài tiền ngu.

Dưới đây là BÁO CÁO TÀI CHÍNH THỰC TẾ của tôi trong tháng này:
{fin_context}

Nội dung tin nhắn / câu hỏi của tôi là: "{user_text}"

Nhiệm vụ của bạn:
1. Nếu tôi hỏi mua đồ, đòi tiêu tiền: Hãy kiểm tra SỐ DƯ CÒN LẠI. 
   - Nếu số tiền tôi muốn mua làm âm quỹ hoặc số dư còn ít, hãy CHỬI THẲNG MẶT, mỉa mai thật đau (Ví dụ: "Mua cái gì mà mua, tiền để dành còn không có đòi đú đởn", "Nhìn lại ví đi cái đứa nghèo rớt mồng tơi này").
   - Nếu số dư còn dồi dào, hãy nhắc nhở kiểu "Miễn cưỡng cho mua đấy, nhưng coi chừng mạt vận".
2. Nếu tôi chỉ chat linh tinh: Hãy trả lời thông minh, xéo xắt, nhưng luôn lái về chuyện tiền bạc ("Rảnh rỗi thì đi kiếm tiền đi").
3. Nếu tôi bảo "đã mua", "vừa xài": Ngoài việc mắng, hãy khuyên tôi dùng lệnh `/expense add` để ghi sổ kẻo quên.
4. Trả lời ngắn gọn, súc tích (1-3 câu), bằng tiếng Việt phong cách GenZ, KHÔNG xưng "Tôi/Bạn" quá lịch sự, hãy xưng "Tao/Mày" hoặc "Mình/Bạn" tuỳ hứng nhưng ưu tiên sự cục súc dễ thương.
"""

        try:
            # Configure safety settings to OFF so the bot can be harsh without Google blocking it
            from google.generativeai.types import HarmCategory, HarmBlockThreshold
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }

            # Indicate typing while generating response
            async with message.channel.typing():
                response = self.model.generate_content(system_prompt, safety_settings=safety_settings)
                ai_text = response.text
                
                # Discord has a 2000 char message limit
                if len(ai_text) > 2000:
                    ai_text = ai_text[:1996] + "..."
                    
                await message.reply(ai_text)
                logger.info(f"🧠 AI Trả lời cho {message.author.name}: {ai_text[:50]}...")
                
        except Exception as e:
            logger.error(f"Lỗi khi gọi API Gemini: {e}")
            await message.reply("Cáu quá não bị đơ rồi, không nói nổi nữa. (Lỗi kết nối AI)")

async def setup(bot):
    await bot.add_cog(ChatAICog(bot))
    logging.getLogger('MatchaBot').info("[LOADED] cogs.chat_ai ✅")
