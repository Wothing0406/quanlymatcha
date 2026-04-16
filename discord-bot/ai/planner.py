def decide_strategy(intent: str, emotion: str) -> str:
    """A pre-generation reasoner determining AI's action stance."""
    if intent == "study planning" or intent == "schedule request":
        if emotion == "tired" or emotion == "stress":
            return "adjust workload"
        return "generate schedule"
        
    if intent == "spending decision":
        if emotion == "impulsive spending" or emotion == "bored" or emotion == "stress":
            return "warn spending"
        return "warn spending" # Default behavior for spending to ensure finance check
        
    if emotion == "bored" or emotion == "tired":
        return "suggest task"
        
    if intent == "emotion support":
        if emotion == "stress" or emotion == "tired":
            return "adjust workload"
            
    return "normal reply"
