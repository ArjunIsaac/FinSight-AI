from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import google.generativeai as genai
import PyPDF2
import os
from dotenv import load_dotenv
import requests
import io
import yfinance as yf
from datetime import datetime
import logging
from typing import Optional
import re
from tts_service import EdgeTTSService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="Finsight AI",
    description="Finance Chatbot with Indian Language Support"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment")
    raise ValueError("GEMINI_API_KEY is required. Add it to your .env file.")

genai.configure(api_key=GEMINI_API_KEY)
gemini = genai.GenerativeModel('gemini-2.5-flash')

# Initialize TTS Service
tts_service = EdgeTTSService()

# In-memory storage (resets on restart — use a DB for persistence)
pdf_storage = {}
chat_history = []

# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str
    language: str = "en"

class ChatResponse(BaseModel):
    response: str
    sentiment: Optional[str] = None
    out_of_scope: bool = False
    language: str = "en"

class QuestionRequest(BaseModel):
    question: str
    pdf_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    language: str = "hi"
    voice_type: str = "female"

# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_sentiment(text: str) -> str:
    """
    Robustly extract POSITIVE / NEGATIVE / NEUTRAL from a Gemini response
    that may include extra words or punctuation.
    """
    upper = text.upper()
    for label in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
        if label in upper:
            return label
    return "NEUTRAL"

OUT_OF_SCOPE_RESPONSES = {
    "en": "I'm a finance-specific assistant. Please ask finance-related questions.",
    "hi": "मैं वित्त-विशिष्ट सहायक हूं। कृपया वित्त से संबंधित प्रश्न पूछें।",
    "ta": "நான் நிதி சார் உதவியாளர். நிதி தொடர்பான கேள்விகளைக் கேளுங்கள்.",
    "te": "నేను ఫైనాన్స్-స్పెసిఫిక్ అసిస్టెంట్. దయచేసి ఫైనాన్స్ సంబంధిత ప్రశ్నలు అడగండి.",
    "bn": "আমি একটি অর্থ-নির্দিষ্ট সহায়ক। অনুগ্রহ করে অর্থ সংক্রান্ত প্রশ্ন জিজ্ঞাসা করুন।",
    "kn": "ನಾನು ಹಣಕಾಸು-ನಿರ್ದಿಷ್ಟ ಸಹಾಯಕ. ದಯವಿಟ್ಟು ಹಣಕಾಸು ಸಂಬಂಧಿತ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.",
    "mr": "मी वित्त-विशिष्ट सहाय्यक आहे. कृपया वित्त-संबंधित प्रश्न विचारा.",
}

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu",
    "bn": "Bengali", "kn": "Kannada", "mr": "Marathi", "gu": "Gujarati",
    "pa": "Punjabi", "ml": "Malayalam", "or": "Odia", "as": "Assamese",
    "ur": "Urdu", "sa": "Sanskrit", "ne": "Nepali", "sd": "Sindhi",
    "ks": "Kashmiri", "kok": "Konkani", "mai": "Maithili", "mni": "Manipuri",
    "brx": "Bodo", "doi": "Dogri", "sat": "Santali",
}

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "Finsight AI API",
        "version": "1.0.0",
        "features": [
            "Finance chat in 22 Indian languages",
            "Voice input/output support",
            "PDF analysis",
            "News with sentiment",
            "Stock data",
        ],
        "languages": tts_service.get_language_list(),
    }


@app.get("/languages")
async def get_languages():
    """Get list of supported Indian languages."""
    return {
        "languages": tts_service.get_language_list(),
        "total": len(tts_service.languages),
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle chat with multilingual support."""
    try:
        logger.info(f"Chat request in '{request.language}': {request.query[:60]}...")

        # ── 1. Finance scope check ────────────────────────────────────────────
        check_prompt = (
            f"Question: {request.query}\n\n"
            "Is this question about finance, stocks, companies, markets, "
            "investments, or financial documents? Answer only YES or NO."
        )
        check_response = gemini.generate_content(check_prompt)
        is_finance = "YES" in check_response.text.upper()

        if not is_finance:
            fallback = OUT_OF_SCOPE_RESPONSES.get(
                request.language, OUT_OF_SCOPE_RESPONSES["en"]
            )
            return ChatResponse(
                response=fallback,
                out_of_scope=True,
                language=request.language,
            )

        # ── 2. Generate answer (translated to requested language) ─────────────
        lang_name = LANGUAGE_NAMES.get(request.language, "English")
        answer_prompt = (
            f"You are a helpful finance assistant. Answer the following "
            f"finance question clearly and concisely. "
            f"Respond in {lang_name}.\n\n"
            f"Question: {request.query}"
        )
        answer_response = gemini.generate_content(answer_prompt)
        answer_text = answer_response.text

        # ── 3. Sentiment analysis ─────────────────────────────────────────────
        sentiment_prompt = (
            f"Analyze the financial sentiment of this text. "
            f"Reply with exactly one word — POSITIVE, NEGATIVE, or NEUTRAL:\n\n"
            f"{request.query}"
        )
        sentiment_response = gemini.generate_content(sentiment_prompt)
        sentiment = extract_sentiment(sentiment_response.text)

        # ── 4. Persist to history ─────────────────────────────────────────────
        chat_history.append({
            "query": request.query,
            "response": answer_text,
            "sentiment": sentiment,
            "language": request.language,
            "timestamp": datetime.now().isoformat(),
        })

        return ChatResponse(
            response=answer_text,
            sentiment=sentiment,
            language=request.language,
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech in Indian languages."""
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text must not be empty.")

        result = await tts_service.text_to_speech(
            text=request.text,
            language=request.language,
            voice_type=request.voice_type,
        )

        if result["success"]:
            return FileResponse(
                result["file"],
                media_type="audio/mpeg",
                filename=f"finsight_{request.language}.mp3",
            )
        raise HTTPException(status_code=500, detail=result.get("error", "TTS failed"))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload and process a PDF financial document."""
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

        pdf = PyPDF2.PdfReader(io.BytesIO(contents))
        text = "".join(page.extract_text() or "" for page in pdf.pages)

        if not text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from PDF. The file may be scanned/image-based.",
            )

        import hashlib
        pdf_id = hashlib.md5(f"{file.filename}{datetime.now().isoformat()}".encode()).hexdigest()[:10]

        pdf_storage[pdf_id] = {
            "filename": file.filename,
            "text": text,
            "pages": len(pdf.pages),
            "uploaded": datetime.now().isoformat(),
        }

        # Truncate for Gemini prompt safety
        preview = text[:3000]

        summary_response = gemini.generate_content(
            f"Summarize this financial document in 3 concise bullet points:\n\n{preview}"
        )
        questions_response = gemini.generate_content(
            f"Suggest 3 insightful questions a user might ask about this financial document:\n\n{preview}"
        )

        suggested = [
            q.strip()
            for q in re.split(r"\n+", questions_response.text)
            if q.strip()
        ][:3]

        return {
            "message": "PDF uploaded successfully.",
            "pdf_id": pdf_id,
            "filename": file.filename,
            "pages": len(pdf.pages),
            "summary": summary_response.text,
            "suggested_questions": suggested,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask-pdf")
async def ask_pdf(request: QuestionRequest):
    """Ask a question about an uploaded PDF."""
    try:
        if not pdf_storage:
            raise HTTPException(status_code=404, detail="No PDF has been uploaded yet.")

        if request.pdf_id and request.pdf_id in pdf_storage:
            pdf_data = pdf_storage[request.pdf_id]
        else:
            # Fall back to the most recently uploaded PDF
            pdf_data = list(pdf_storage.values())[-1]

        # Truncate to keep within safe token limits
        context = pdf_data["text"][:4000]
        prompt = (
            f"You are a financial analyst. Based ONLY on the document excerpt below, "
            f"answer the question accurately. If the answer is not in the document, say so.\n\n"
            f"Document ({pdf_data['filename']}):\n{context}\n\n"
            f"Question: {request.question}"
        )
        response = gemini.generate_content(prompt)

        return {
            "answer": response.text,
            "pdf_used": pdf_data["filename"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF Q&A error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/news/{company}")
async def get_news(company: str):
    """Fetch latest news with sentiment analysis for a company."""
    try:
        NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")
        if not NEWSAPI_KEY:
            raise HTTPException(status_code=500, detail="NEWSAPI_KEY is not configured.")

        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={company}&apiKey={NEWSAPI_KEY}&pageSize=5&sortBy=publishedAt"
        )
        resp = requests.get(url, timeout=10)

        # BUG FIX: check HTTP status before using response body
        if resp.status_code != 200:
            logger.error(f"NewsAPI error {resp.status_code}: {resp.text}")
            raise HTTPException(
                status_code=502,
                detail=f"NewsAPI returned status {resp.status_code}.",
            )

        articles = resp.json().get("articles", [])
        if not articles:
            return {"company": company, "news": [], "overall_sentiment": "NEUTRAL"}

        news_list = []
        sentiments = []

        for article in articles[:5]:
            title = article.get("title") or ""
            description = article.get("description") or ""
            combined = f"{title}. {description}".strip()

            summary_resp = gemini.generate_content(
                f"Summarize this financial news headline in one sentence:\n{combined}"
            )
            sentiment_resp = gemini.generate_content(
                f"What is the financial sentiment of this news? "
                f"Reply with exactly one word — POSITIVE, NEGATIVE, or NEUTRAL:\n{combined}"
            )
            sentiment = extract_sentiment(sentiment_resp.text)
            sentiments.append(sentiment)

            news_list.append({
                "title": title,
                "summary": summary_resp.text.strip(),
                "sentiment": sentiment,
                "source": article.get("source", {}).get("name", "Unknown"),
                "url": article.get("url", ""),
                "published_at": article.get("publishedAt", ""),
            })

        overall = max(set(sentiments), key=sentiments.count)

        return {
            "company": company,
            "news": news_list,
            "overall_sentiment": overall,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"News error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stock/{symbol}")
async def get_stock(symbol: str):
    """Get real-time stock data and an AI-generated insight."""
    try:
        stock = yf.Ticker(symbol.upper())
        info = stock.info

        current = info.get("regularMarketPrice") or info.get("currentPrice", 0)
        previous = info.get("regularMarketPreviousClose") or info.get("previousClose", 0)

        if current and previous:
            change = round(current - previous, 2)
            change_percent = round((change / previous) * 100, 2)
        else:
            change = 0
            change_percent = 0

        insight_resp = gemini.generate_content(
            f"Give a brief 2-sentence financial insight about the stock ticker '{symbol.upper()}'. "
            f"Current price: {current}, Change: {change} ({change_percent}%)."
        )

        return {
            "symbol": symbol.upper(),
            "name": info.get("longName", symbol.upper()),
            "price": round(current, 2),
            "change": change,
            "change_percent": change_percent,
            "volume": info.get("volume", 0),
            "market_cap": info.get("marketCap", 0),
            "insight": insight_resp.text,
        }

    except Exception as e:
        logger.error(f"Stock error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
async def get_history():
    """Return the last 10 chat messages."""
    return {"history": chat_history[-10:]}


@app.post("/cleanup-audio")
async def cleanup_audio(hours: int = 24):
    """Delete audio files older than the specified number of hours."""
    tts_service.cleanup_old_files(hours)
    return {"message": f"Cleaned up audio files older than {hours} hours."}


# ── Entry point ───────────────────────────────────────────────────────────────
#BUG FIX: removed reload=True — reload uses a subprocess watcher that
# conflicts with running `python main.py` directly inside a venv.
# Use `uvicorn main:app --reload` from the terminal instead for dev mode.
# For production / direct-run: just call uvicorn.run() without reload.
if __name__ == "__main__":
    import uvicorn

    print("🚀 Finsight AI starting on http://0.0.0.0:8000")
    print(f"📊 Supported languages: {len(tts_service.languages)}")
    print("📖 API docs available at http://localhost:8000/docs")

    uvicorn.run(
        "main:app",          # pass as import string so uvicorn manages the app
        host="0.0.0.0",
        port=8000,
        reload=False,        # set True only when running via `uvicorn` CLI
        log_level="info",
    )