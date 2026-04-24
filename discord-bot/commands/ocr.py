import discord
from discord import app_commands
from discord.ext import commands
import google.generativeai as genai
import logging
import os
import aiohttp
import json
import database as db
from datetime import datetime

logger = logging.getLogger('MatchaBot.OCR')

class OCRCog(commands.Cog, name="🧾 Quét Hóa Đơn"):
    """Sử dụng Gemini Vision để tự động nhập chi tiêu từ ảnh."""

    def __init__(self, bot):
        self.bot = bot
        # Gemini disabled for self-hosted setup
        self.model = None

    @app_commands.command(name="receipt", description="Quét hóa đơn (Hiện tại tính năng này đang bảo trì sau khi chuyển sang Gemma)")
    @app_commands.describe(attachment="Ảnh chụp hóa đơn")
    async def scan_receipt(self, interaction: discord.Interaction, attachment: discord.Attachment):
        return await interaction.response.send_message("🚧 Tính năng quét hóa đơn đang được bảo trì để chuyển sang model Local. Hãy dùng `/expense add` tạm nhé!", ephemeral=True)

        if not attachment.content_type or not attachment.content_type.startswith('image/'):
            return await interaction.response.send_message("❌ Vui lòng gửi một tệp hình ảnh!", ephemeral=True)

        await interaction.response.defer()

        try:
            # Download image data
            async with aiohttp.ClientSession() as session:
                async with session.get(attachment.url) as resp:
                    image_data = await resp.read()

            # Prepare prompt for Gemini Vision
            prompt = """
            Bạn là một chuyên gia kế toán trích xuất dữ liệu. 
            Hãy nhìn vào ảnh hóa đơn/bill chuyển khoản này và trích xuất:
            1. Tên mặt hàng/dịch vụ (Nên tóm gọn, ví dụ: 'Cơm tấm', 'Tiền điện').
            2. Tổng số tiền (Chỉ lấy con số, ví dụ: 35000).
            3. Phân loại (Chọn 1 trong: Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Khác).

            Trả về kết quả dưới dạng JSON duy nhất như sau:
            {"item": "tên", "amount": 123000, "category": "Loại"}
            Nếu không đọc được, hãy trả về {"error": "Không đọc được dữ liệu"}.
            """

            # Call Gemini
            response = self.model.generate_content([
                prompt,
                {'mime_type': attachment.content_type, 'data': image_data}
            ])

            # Parse JSON from response
            text = response.text.strip()
            # Clean possible markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(text)

            if "error" in data:
                return await interaction.followup.send(f"❌ Gemini không đọc được hóa đơn này: {data['error']}")

            # Create confirmation UI
            item_name = data.get('item', 'Không rõ')
            amount = data.get('amount', 0)
            category = data.get('category', 'Khác')

            embed = discord.Embed(
                title="🧾 Kết quả quét hóa đơn",
                description="Tôi đã check xong cái bill này rồi. Xem có đúng không nhé!",
                color=discord.Color.blue()
            )
            embed.add_field(name="📦 Mặt hàng", value=item_name, inline=True)
            embed.add_field(name="💰 Số tiền", value=f"{amount:,} VNĐ", inline=True)
            embed.add_field(name="🏷️ Loại", value=category, inline=True)
            embed.set_image(url=attachment.url)

            view = ReceiptConfirmView(item_name, amount, category, attachment.url)
            await interaction.followup.send(embed=embed, view=view)

        except Exception as e:
            logger.error(f"Lỗi OCR: {e}")
            await interaction.followup.send(f"❌ Có lỗi xảy ra khi xử lý ảnh: {str(e)}")

class ReceiptConfirmView(discord.ui.View):
    def __init__(self, item, amount, category, photo_url):
        super().__init__(timeout=60)
        self.item = item
        self.amount = amount
        self.category = category
        self.photo_url = photo_url

    @discord.ui.button(label="Xác nhận & Ghi sổ", style=discord.ButtonStyle.green, emoji="✅")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            # 1. Download and save image to local server (Consistent with tasks)
            from commands.tasks import UPLOAD_DIR
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            
            # Generate local filename
            ext = ".jpg" # Default or extract from URL
            filename = f"ocr_{int(datetime.now().timestamp())}{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.photo_url) as resp:
                    if resp.status == 200:
                        with open(filepath, 'wb') as f:
                            f.write(await resp.read())
                        local_path = f"/uploads/{filename}"
                    else:
                        local_path = self.photo_url # Fallback

            # 2. Save to activity_log and finance
            db.log_activity('expense', f"Quét bill: {self.item}", amount=self.amount, photo_path=local_path)
            
            # 3. Add Gamification Points
            res = db.add_points(10, 30, f"Nhập chi tiêu từ hóa đơn: {self.item}")
            
            msg = f"✅ Đã ghi sổ chi tiêu: **{self.item} - {self.amount:,} VNĐ**. Bạn được cộng **10 điểm** Matcha! 🍵"
            if res and res.get('leveled_up'):
                msg += f"\n🎊 **LEVEL UP!** Bạn đã thăng cấp lên **Level {res['level']}**!"

            await interaction.response.edit_message(content=msg, embed=None, view=None)
        except Exception as e:
            logger.error(f"Lỗi lưu OCR: {e}")
            await interaction.response.send_message(f"❌ Lỗi khi lưu: {e}", ephemeral=True)


    @discord.ui.button(label="Hủy", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.edit_message(content="🗑️ Đã hủy yêu cầu quét hóa đơn.", embed=None, view=None)

async def setup(bot):
    await bot.add_cog(OCRCog(bot))
