import google.generativeai as genai
import os
import sys

# Key provided by user
api_key = "AIzaSyBlJJ8yLyShfhNVorYXTB2xxDLw4Zf3xBo"

try:
    genai.configure(api_key=api_key)
    print("Listing models with the provided API key...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error: {e}")
