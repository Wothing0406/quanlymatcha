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
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": stream
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        logger.error(f"Ollama API Error ({resp.status}): {error_text}")
                        return None
                    
                    if stream:
                        return resp # Return the response object for streaming
                    else:
                        result = await resp.json()
                        return result.get('message', {}).get('content', '')
        except Exception as e:
            logger.error(f"Error connecting to Ollama: {e}")
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
