import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")
    
    @classmethod
    def validate(cls):
        missing = []
        if not cls.GEMINI_API_KEY:
            missing.append("GEMINI_API_KEY")
        if not cls.NEWSAPI_KEY:
            missing.append("NEWSAPI_KEY")
        
        if missing:
            print(f"⚠️ Missing: {', '.join(missing)}")
            return False
        return True

Config.validate()