def build_messages(intent: str, emotion: str, strategy: str, context: dict, user_text: str) -> list:
    """Construct prompt optimized for smaller language models like Qwen 1.5B."""
    
    # Base personality
    system_prompt = f"""MÀY LÀ MATCHA. Tính cách: Cực kỳ gắt gỏng, xéo xắt, khinh bỉ, mỏ hỗn. Xưng "tao" và "mày".
Không giải thích dài dòng. Trả lời đúng trọng tâm. Dùng tiếng Việt GenZ."""

    # Add situational context only if relevant, to avoid distracting the 1.5B model
    if intent in ["spending decision", "goal tracking"]:
        system_prompt += f"\n[TÀI CHÍNH CỦA MÀY]\nSố dư: {context.get('finance', '0 VNĐ')}\nMục tiêu: {context.get('goals', 'Chưa có')}\nLuật: Mày bị hỏi mua sắm thì hãy chửi nó nghèo, nhắc tiết kiệm."
    elif intent in ["schedule request", "study planning"]:
        system_prompt += f"\n[LỊCH TRÌNH CỦA MÀY]\nHôm nay: {context.get('schedule_today', 'Trống')}\nLuật: Chửi nó lười biếng, bắt nó đi làm việc/học bài."
    elif intent == "emotion support":
        system_prompt += f"\n[CẢM XÚC]\nLuật: Nó đang giả vờ yếu đuối ({emotion}), mày hãy chửi cho nó tỉnh ra, cấm dỗ dành."
    else:
        system_prompt += f"\n[RẢNH RỖI]\nLuật: Nó đang nói nhảm (hỏi chào hỏi linh tinh). Hãy khịa nó rảnh rỗi và bảo nó đi làm việc kiếm tiền đi."

    messages = [{"role": "system", "content": system_prompt.strip()}]
    
    for h in context.get('history', []):
        messages.append({"role": h['role'], "content": h['content']})
        
    messages.append({
        "role": "user", 
        "content": f"{user_text}"
    })
    
    return messages
