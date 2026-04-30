import aiohttp
import json
import os
import logging
from openai import AsyncOpenAI

logger = logging.getLogger('MatchaBot.AI')

class AIClient:
    def __init__(self):
        # OpenAI Config
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        # Ollama Config (Fallback)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

        self.openai_client = AsyncOpenAI(api_key=self.openai_key) if self.openai_key else None
        
        self.model = self.openai_model if self.openai_key else self.ollama_model

    async def chat(self, messages, stream=False):
        if self.openai_client:
            try:
                logger.debug(f"Connecting to OpenAI API using model: {self.openai_model}")
                response = await self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=messages,
                    temperature=0.8,
                    max_tokens=250
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"OpenAI API Error: {type(e).__name__} - {e}. Falling back to Ollama.")
                return await self._ollama_chat_fallback(messages)
        else:
            return await self._ollama_chat_fallback(messages)

    async def _ollama_chat_fallback(self, messages):
        url = f"{self.ollama_base_url}/api/chat"
        logger.debug(f"Connecting to Ollama fallback at: {url} using model: {self.ollama_model}")
        
        try:
            timeout = aiohttp.ClientTimeout(total=0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, json={
                    "model": self.ollama_model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_ctx": 2048,
                        "temperature": 0.8,
                        "num_predict": 150,
                        "num_thread": 6
                    }
                }) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return result.get('message', {}).get('content', '')
                    else:
                        err = await resp.text()
                        logger.error(f"Ollama Error (Status {resp.status}): {err[:200]}")
                        return None
        except Exception as e:
            logger.error(f"Cannot reach Ollama fallback at {self.ollama_base_url}: {type(e).__name__} - {e}")
            return None
