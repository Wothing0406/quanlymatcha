def detect_emotion(text: str) -> str:
    """A specialized engine to extract emotional context."""
    text = text.lower()
    if any(word in text for word in ['mệt', 'đuối']):
        return "tired"
    if any(word in text for word in ['stress', 'áp lực', 'căng thẳng', 'điên', 'tức', 'cáu']):
        return "stress"
    if any(word in text for word in ['chán', 'nản', 'lười', 'buồn']):
        return "bored"
    if any(word in text for word in ['quyết tâm', 'cố gắng', 'thích', 'vui', 'tuyệt', 'sướng', 'ngon']):
        return "motivated"
    if any(word in text for word in ['mua luôn', 'chốt đơn', 'thèm', 'còn bao nhiêu']):
        return "impulsive spending"
    return "bình thường"
