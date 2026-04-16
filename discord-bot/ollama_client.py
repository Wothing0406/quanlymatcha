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
        # Nếu đang để URL mặc định của docker (ollama), hãy thử thêm localhost phòng khi chạy ngoài Docker
        if "ollama" in self.base_url and "localhost" not in self.base_url:
            urls_to_try.append("http://localhost:11434")

        last_error = None
        for url_base in urls_to_try:
            url = f"{url_base}/api/chat"
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": stream
            }
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=payload, timeout=10) as resp:
                        if resp.status != 200:
                            error_text = await resp.text()
                            logger.error(f"Ollama API Error ({resp.status}) at {url_base}: {error_text}")
                            continue # Thử URL tiếp theo
                        
                        if stream:
                            return resp
                        else:
                            result = await resp.json()
                            return result.get('message', {}).get('content', '')
            except Exception as e:
                last_error = e
                logger.debug(f"Failed to connect to Ollama at {url_base}: {e}")

        logger.error(f"All Ollama connection attempts failed. Last error: {last_error}")
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
