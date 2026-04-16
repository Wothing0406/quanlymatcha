import aiohttp
import json
import os
import logging

logger = logging.getLogger('MatchaBot.Ollama')

class OllamaClient:
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        self.model = os.getenv("OLLAMA_MODEL", "gemma2:2b")

    async def chat(self, messages, stream=False):
        url = f"{self.base_url}/api/chat"
        logger.debug(f"Connecting to Ollama at: {url}")
        
        try:
            timeout = aiohttp.ClientTimeout(total=0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_ctx": 2048,
                        "temperature": 0.8,
                        "num_predict": 300
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
            logger.error(f"Cannot reach Ollama at {self.base_url}: {type(e).__name__} - {e}")
            return None

    async def generate(self, prompt, system=None):
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return result.get('response', '')
        except Exception as e:
            logger.error(f"Error in Ollama generate: {e}")
            return None
