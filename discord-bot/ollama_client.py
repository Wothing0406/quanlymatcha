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
        urls_to_try = [self.base_url]
        # Thêm các địa chỉ dự phòng phổ biến
        if "localhost" not in self.base_url and "127.0.0.1" not in self.base_url:
            urls_to_try.append("http://127.0.0.1:11434")
            urls_to_try.append("http://localhost:11434")

        last_error = None
        for url_base in urls_to_try:
            url = f"{url_base}/api/chat"
            logger.debug(f"Attempting Ollama connection: {url}")
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json={
                        "model": self.model,
                        "messages": messages,
                        "stream": stream
                    }, timeout=15) as resp:
                        if resp.status == 200:
                            if stream: return resp
                            result = await resp.json()
                            return result.get('message', {}).get('content', '')
                        else:
                            err = await resp.text()
                            logger.error(f"Ollama Error at {url_base} (Status {resp.status}): {err}")
            except Exception as e:
                last_error = e
                logger.warning(f"Connection failed to {url_base}: {str(e)}")

        logger.error(f"❌ ALL OLLAMA ATTEMPTS FAILED. Last error: {last_error}")
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
