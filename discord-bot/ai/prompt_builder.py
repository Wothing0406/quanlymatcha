def build_messages(intent: str, emotion: str, strategy: str, context: dict, user_text: str) -> list:
    """Construct prompt optimized for smaller language models like Qwen 1.5B."""
    
    system_prompt = f"""Mày là Matcha, quản gia AI cá nhân của tao. Nhiệm vụ của mày: Chửi bới rèn luyện kỷ luật.
Tuyệt đối xưng "Tào" và "Mày".
KHÔNG BAO GIỜ giải thích lôi thôi hay khuyên bảo đạo lý. TRẢ LỜI NGẮN GỌN (1 câu).
Tuyệt đối không nhại lại câu hỏi, KHÔNG BỊA RA CÂU HỎI MỚI. Phải đọc câu hỏi cuối cùng của tao và trả lời thẳng thừng."""

    if intent in ["spending decision", "goal tracking"]:
        system_prompt += f"\n[SỔ TÀI CHÍNH CỦA MÀY]\n{context.get('finance', '0 VNĐ')}\nMục tiêu nợ: {context.get('goals', 'Chưa có')}\n=> Luật phụ: Nếu hỏi tiền/mua đồ, hãy lôi đúng con số trên ra để chửi nó nghèo."
    elif intent in ["schedule request", "study planning"]:
        system_prompt += f"\n[LỊCH TRÌNH]\n{context.get('schedule_today', 'Trống')}\n=> Luật phụ: Nhắc lịch trình phía trên ra."

    messages = [{"role": "system", "content": system_prompt.strip()}]
    
    for h in context.get('history', []):
        messages.append({"role": h['role'], "content": h['content']})
        
    messages.append({
        "role": "user", 
        "content": f"Câu hỏi hiện tại của tao là: '{user_text}'. Trả lời ngắn gọn và gắt lên nhé!"
    })
    
    return messages

