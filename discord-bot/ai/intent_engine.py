def detect_intent(text: str) -> str:
    """A specialized engine to process raw text and detect core user intent."""
    text = text.lower()
    if any(word in text for word in ['học', 'bài', 'study', 'ôn']):
        return "study planning"
    if any(word in text for word in ['lịch', 'hôm nay', 'schedule', 'task', 'làm gì', 'thời gian']):
        return "schedule request"
    if any(word in text for word in ['mua', 'sắm', 'tiêu', 'bán', 'giá', 'tiền']):
        return "spending decision"
    if any(word in text for word in ['mục tiêu', 'tiết kiệm', 'goal']):
        return "goal tracking"
    if any(word in text for word in ['chán', 'mệt', 'buồn', 'nản', 'tệ', 'lười', 'cáu', 'stress']):
        return "emotion support"
    return "general chat"
