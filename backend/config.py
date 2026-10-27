import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")

# Directories to search for knowledge documents
DATA_DIRS = [
    BASE_DIR / "data",
    BASE_DIR / "Pineapples_Health_Detection2",
    BASE_DIR / "diseases_of_pineapple1",
]

# ML model configuration (for user's friend's model integration)
ML_MODEL_PATH = os.getenv("ML_MODEL_PATH", str(BASE_DIR / "backend" / "ml" / "weights"))
ML_MODEL_ENDPOINT = os.getenv("ML_MODEL_ENDPOINT", "").strip()

# AI Chatbot Provider Settings
CHATBOT_PROVIDER = os.getenv("CHATBOT_PROVIDER", "gemini").strip().lower()
CHATBOT_API_KEY = os.getenv("CHATBOT_API_KEY", "").strip() or GEMINI_API_KEY
CHATBOT_MODEL = os.getenv("CHATBOT_MODEL", "").strip() or GEMINI_MODEL
