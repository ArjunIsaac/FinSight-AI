from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai
import PyPDF2
import os
import io
import re
import logging
import hashlib
import requests
import yfinance as yf
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

# Local Sentiment Analysis
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

from database import SessionLocal, ChatMessage, PDFDocument, init_db, get_db

# Initialize NLTK VADER
nltk.download('vader_lexicon', quiet=True)
sia = SentimentIntensityAnalyzer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from dotenv import load_dotenv
load_dotenv()
print(f"DEBUG: API Key exists: {bool(os.getenv('GEMINI_API_KEY'))}")
app = FastAPI(title="Finsight AI")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in your .env file.")

genai.configure(api_key=GEMINI_API_KEY)
gemini = genai.GenerativeModel("gemini-2.5-flash")

@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("Database connected and tables initialized.")


# ── Pydantic Models ───────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str
    language: str = "en"

class ChatResponse(BaseModel):
    response: str
    sentiment: Optional[str] = None
    out_of_scope: bool = False
    language: str

class QuestionRequest(BaseModel):
    question: str
    pdf_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    voice_type: str = "female"


# ── Helpers ───────────────────────────────────────────────────────────────────

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali",
    "kn": "Kannada", "ta": "Tamil", "te": "Telugu",
    "mr": "Marathi", "gu": "Gujarati", "ml": "Malayalam",
    "pa": "Punjabi", "or": "Odia", "as": "Assamese",
    "ur": "Urdu", "sa": "Sanskrit", "ne": "Nepali",
}

VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",   "hi": "hi-IN-SwaraNeural",
    "bn": "bn-IN-TanishaaNeural", "kn": "kn-IN-SapnaNeural",
    "ta": "ta-IN-PallaviNeural",  "te": "te-IN-ShrutiNeural",
    "mr": "mr-IN-AarohiNeural",   "gu": "gu-IN-DhwaniNeural",
    "ml": "ml-IN-SobhanaNeural",  "pa": "pa-IN-GurleenNeural",
    "or": "or-IN-SubhasiniNeural","as": "as-IN-YashicaNeural",
    "ur": "ur-IN-GulNeural",      "sa": "sa-IN-BhavanaNeural",
    "ne": "ne-IN-SamriddhiNeural",
}

VOICE_MAP_MALE = {
    "en": "en-IN-PrabhatNeural",  "hi": "hi-IN-MadhurNeural",
    "bn": "bn-IN-BashkarNeural",  "kn": "kn-IN-GaganNeural",
    "ta": "ta-IN-ValluvarNeural", "te": "te-IN-MohanNeural",
    "mr": "mr-IN-ManoharNeural",  "gu": "gu-IN-NiranjanNeural",
    "ml": "ml-IN-MidhunNeural",
}

OUT_OF_SCOPE_RESPONSES = {
    "en": "I'm a finance-specific assistant. Please ask about stocks, markets, companies, or financial documents.",
    "hi": "मैं एक वित्त-विशिष्ट सहायक हूं। कृपया शेयर बाजार, कंपनियों या वित्तीय दस्तावेजों के बारे में पूछें।",
    "ta": "நான் நிதி சார் உதவியாளர். பங்குச் சந்தை அல்லது நிதி ஆவணங்கள் பற்றி கேளுங்கள்.",
    "te": "నేను ఫైనాన్స్ అసిస్టెంట్. స్టాక్స్, మార్కెట్లు లేదా ఆర్థిక పత్రాల గురించి అడగండి.",
    "bn": "আমি একটি অর্থ-সহায়ক। শেয়ার বাজার বা আর্থিক নথি সম্পর্কে প্রশ্ন করুন।",
    "kn": "ನಾನು ಹಣಕಾಸು ಸಹಾಯಕ. ಷೇರು ಮಾರುಕಟ್ಟೆ ಅಥವಾ ಆರ್ಥಿಕ ದಾಖಲೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ.",
    "mr": "मी वित्त सहाय्यक आहे. शेअर बाजार किंवा आर्थिक कागदपत्रांबद्दल विचारा.",
}


def get_local_sentiment(text: str) -> str:
    """Fast local sentiment analysis using VADER."""
    scores = sia.polarity_scores(text)
    compound = scores['compound']
    if compound >= 0.05: return "POSITIVE"
    elif compound <= -0.05: return "NEGATIVE"
    return "NEUTRAL"


def clean_markdown_for_tts(text: str) -> str:
    text = re.sub(r'\*+', '', text)
    text = re.sub(r'#+\s+', '', text)
    text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
    text = re.sub(r'`+', '', text)
    text = re.sub(r'\n+', ' ', text)
    return text.strip()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "online"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        scope_check = gemini.generate_content(
            f"Is this question about finance, stocks, companies, markets, investments, "
            f"or financial documents? Answer only YES or NO.\n\nQuestion: {request.query}"
        )
        if "YES" not in scope_check.text.upper():
            fallback = OUT_OF_SCOPE_RESPONSES.get(request.language, OUT_OF_SCOPE_RESPONSES["en"])
            return ChatResponse(response=fallback, out_of_scope=True, language=request.language)

        db_history = db.query(ChatMessage).order_by(ChatMessage.timestamp.desc()).limit(10).all()
        gemini_history = [{"role": m.role, "parts": [m.content]} for m in reversed(db_history)]

        lang_name = LANGUAGE_NAMES.get(request.language, "English")
        system_turn = {
            "role": "user",
            "parts": [f"You are a professional finance assistant. Respond ONLY in {lang_name} using Markdown. Be concise. Acknowledge with 'Understood.'"]
        }
        ack_turn = {"role": "model", "parts": ["Understood."]}

        chat_session = gemini.start_chat(history=[system_turn, ack_turn] + gemini_history)
        response = chat_session.send_message(request.query)
        answer_text = response.text

        sentiment = get_local_sentiment(request.query)

        db.add(ChatMessage(role="user", content=request.query, language=request.language))
        db.add(ChatMessage(role="model", content=answer_text, language=request.language))
        db.commit()

        return ChatResponse(response=answer_text, sentiment=sentiment, language=request.language)
    except Exception as e:
        db.rollback()
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

        pdf = PyPDF2.PdfReader(io.BytesIO(contents))
        text = "".join(page.extract_text() or "" for page in pdf.pages)
        if not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text.")

        pdf_id = hashlib.md5(f"{file.filename}{datetime.now().isoformat()}".encode()).hexdigest()[:10]
        db.add(PDFDocument(pdf_id=pdf_id, filename=file.filename, content=text))
        db.commit()

        preview = text[:3000]
        summary = gemini.generate_content(f"Summarize this financial document in 3 concise bullets:\n\n{preview}")
        questions = gemini.generate_content(f"Suggest 3 insightful questions about this financial document:\n\n{preview}")
        suggested = [q.strip() for q in re.split(r"\n+", questions.text) if q.strip()][:3]

        return {"pdf_id": pdf_id, "filename": file.filename, "pages": len(pdf.pages), "summary": summary.text, "suggested_questions": suggested}
    except Exception as e:
        db.rollback()
        logger.error(f"PDF upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask-pdf")
async def ask_pdf(request: QuestionRequest, db: Session = Depends(get_db)):
    try:
        pdf_data = db.query(PDFDocument).filter(PDFDocument.pdf_id == request.pdf_id).first() if request.pdf_id else \
                   db.query(PDFDocument).order_by(PDFDocument.uploaded_at.desc()).first()
        if not pdf_data:
            raise HTTPException(status_code=404, detail="No PDF found.")

        prompt = f"Using ONLY the excerpt below, answer the question.\n\nDoc: {pdf_data.content[:4000]}\n\nQ: {request.question}"
        response = gemini.generate_content(prompt)
        return {"answer": response.text, "pdf_used": pdf_data.filename}
    except Exception as e:
        logger.error(f"PDF Q&A error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/news/{company}")
async def get_news(company: str):
    try:
        newsapi_key = os.getenv("NEWSAPI_KEY")
        if not newsapi_key:
            raise HTTPException(status_code=500, detail="NEWSAPI_KEY is missing.")

        # Enhanced query for relevance
        search_query = f'"{company}" AND (stock OR market OR earnings OR revenue OR finance)'
        
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": search_query,
                "apiKey": newsapi_key,
                "pageSize": 5,
                "sortBy": "relevancy",
                "language": "en",
            },
            timeout=10,
        )

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"NewsAPI error: {resp.status_code}")

        articles = resp.json().get("articles", [])
        news_list = []
        sentiments = []

        for article in articles:
            title = article.get("title") or ""
            description = article.get("description") or ""
            combined = f"{title}. {description}".strip()

            if len(combined) < 10: continue

            # Rapid Local Sentiment
            sentiment = get_local_sentiment(combined)
            sentiments.append(sentiment)

            news_list.append({
                "title": title,
                "summary": description if description else title,
                "sentiment": sentiment,
                "source": article.get("source", {}).get("name", "Unknown"),
                "url": article.get("url", ""),
                "published_at": article.get("publishedAt", ""),
            })

        overall = max(set(sentiments), key=sentiments.count) if sentiments else "NEUTRAL"
        return {"company": company, "news": news_list, "overall_sentiment": overall}

    except Exception as e:
        logger.error(f"News error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
async def get_history(db: Session = Depends(get_db)):
    history = db.query(ChatMessage).order_by(ChatMessage.timestamp.desc()).limit(20).all()
    return {"history": [{"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()} for m in reversed(history)]}


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text empty.")

    voice_lookup = VOICE_MAP_MALE if request.voice_type == "male" else VOICE_MAP
    voice = voice_lookup.get(request.language, VOICE_MAP["en"])
    spoken_text = clean_markdown_for_tts(request.text)

    try:
        import edge_tts
        communicate = edge_tts.Communicate(spoken_text, voice)
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])
        audio_stream.seek(0)
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail="TTS failed.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)