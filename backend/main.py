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
import asyncio
from tts_service import EdgeTTSService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="Finsight AI", description="Finance Chatbot with Indian Language Support")

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
    logger.error("GEMINI_API_KEY not found")
    raise ValueError("GEMINI_API_KEY is required")

genai.configure(api_key=GEMINI_API_KEY)
gemini = genai.GenerativeModel('gemini-1.5-flash')

# Initialize TTS Service
tts_service = EdgeTTSService()

# Storage
pdf_storage = {}
chat_history = []

# Models
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

# Routes
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
            "Stock data"
        ],
        "languages": tts_service.get_language_list()
    }

@app.get("/languages")
async def get_languages():
    """Get list of supported Indian languages"""
    return {
        "languages": tts_service.get_language_list(),
        "total": len(tts_service.languages)
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle chat with multilingual support"""
    try:
        logger.info(f"Chat request in {request.language}: {request.query[:50]}...")
        
        # Check if finance-related (in English for consistency)
        check_prompt = f"Question: {request.query}\n\nIs this question about finance, stocks, companies, markets, or financial documents? Answer only YES or NO."
        check_response = gemini.generate_content(check_prompt)
        is_finance = "YES" in check_response.text.upper()
        
        if not is_finance:
            responses = {
                "en": "I'm a finance-specific assistant. Please ask finance-related questions.",
                "hi": "मैं वित्त-विशिष्ट सहायक हूं। कृपया वित्त से संबंधित प्रश्न पूछें।",
                "ta": "நான் நிதி சார் உதவியாளர். நிதி தொடர்பான கேள்விகளைக் கேளுங்கள்.",
                "te": "నేను ఫైనాన్స్-స్పెసిఫిక్ అసిస్టెంట్. దయచేసి ఫైనాన్స్ సంబంధిత ప్రశ్నలు అడగండి.",
                "bn": "আমি একটি অর্থ-নির্দিষ্ট সহায়ক। অনুগ্রহ করে অর্থ সংক্রান্ত প্রশ্ন জিজ্ঞাসা করুন।"
            }
            return ChatResponse(
                response=responses.get(request.language, responses["en"]),
                out_of_scope=True,
                language=request.language
            )
        
        # Get response from Gemini
        response = gemini.generate_content(request.query)
        
        # Analyze sentiment
        sentiment_prompt = f"Analyze sentiment of this finance text. Return POSITIVE, NEGATIVE, or NEUTRAL:\n\n{request.query}"
        sentiment_response = gemini.generate_content(sentiment_prompt)
        sentiment = sentiment_response.text.strip().upper()
        
        # Store in history
        chat_history.append({
            "query": request.query,
            "response": response.text,
            "sentiment": sentiment,
            "language": request.language,
            "timestamp": datetime.now().isoformat()
        })
        
        return ChatResponse(
            response=response.text,
            sentiment=sentiment,
            language=request.language
        )
    
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech in Indian languages"""
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Generate speech
        result = await tts_service.text_to_speech(
            text=request.text,
            language=request.language,
            voice_type=request.voice_type
        )
        
        if result["success"]:
            return FileResponse(
                result["file"],
                media_type="audio/mpeg",
                filename=f"finsight_{request.language}.mp3"
            )
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "TTS failed"))
    
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload and process PDF"""
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files allowed")
        
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        pdf = PyPDF2.PdfReader(io.BytesIO(contents))
        
        text = ""
        for page in pdf.pages:
            text += page.extract_text()
        
        # Generate PDF ID
        import hashlib
        pdf_id = hashlib.md5(f"{file.filename}{datetime.now()}".encode()).hexdigest()[:10]
        
        pdf_storage[pdf_id] = {
            "filename": file.filename,
            "text": text,
            "pages": len(pdf.pages),
            "uploaded": datetime.now().isoformat()
        }
        
        # Generate summary
        summary = gemini.generate_content(f"Summarize this financial document in 3 bullet points:\n\n{text[:1000]}")
        
        # Generate suggested questions
        questions = gemini.generate_content(f"Suggest 3 questions about this document:\n\n{text[:500]}")
        
        return {
            "message": "PDF uploaded",
            "pdf_id": pdf_id,
            "filename": file.filename,
            "pages": len(pdf.pages),
            "summary": summary.text,
            "suggested_questions": questions.text.split('\n')[:3]
        }
    
    except Exception as e:
        logger.error(f"PDF upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask-pdf")
async def ask_pdf(request: QuestionRequest):
    """Ask questions about PDF"""
    try:
        if not pdf_storage:
            raise HTTPException(status_code=404, detail="No PDF uploaded")
        
        # Get PDF
        if request.pdf_id and request.pdf_id in pdf_storage:
            pdf_data = pdf_storage[request.pdf_id]
        else:
            pdf_data = list(pdf_storage.values())[-1]
        
        prompt = f"Based on this financial document, answer the question:\n\nDocument: {pdf_data['text'][:2000]}\n\nQuestion: {request.question}"
        response = gemini.generate_content(prompt)
        
        return {
            "answer": response.text,
            "pdf_used": pdf_data['filename']
        }
    
    except Exception as e:
        logger.error(f"PDF Q&A error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/news/{company}")
async def get_news(company: str):
    """Get news with sentiment"""
    try:
        NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")
        if not NEWSAPI_KEY:
            raise HTTPException(status_code=500, detail="NewsAPI key not configured")
        
        url = f"https://newsapi.org/v2/everything?q={company}&apiKey={NEWSAPI_KEY}&pageSize=5"
        response = requests.get(url)
        articles = response.json().get("articles", [])
        
        news_list = []
        sentiments = []
        
        for article in articles[:5]:
            # Summarize
            summary = gemini.generate_content(f"Summarize in 1 line: {article['title']}")
            
            # Sentiment
            sentiment = gemini.generate_content(f"Sentiment of this news (POSITIVE/NEGATIVE/NEUTRAL): {article['title']}")
            sentiment = sentiment.text.strip().upper()
            sentiments.append(sentiment)
            
            news_list.append({
                "title": article['title'],
                "summary": summary.text,
                "sentiment": sentiment,
                "source": article['source']['name'],
                "url": article['url']
            })
        
        # Overall sentiment
        if sentiments:
            overall = max(set(sentiments), key=sentiments.count)
        else:
            overall = "NEUTRAL"
        
        return {
            "company": company,
            "news": news_list,
            "overall_sentiment": overall
        }
    
    except Exception as e:
        logger.error(f"News error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stock/{symbol}")
async def get_stock(symbol: str):
    """Get stock data"""
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        
        current = info.get('regularMarketPrice', info.get('currentPrice', 0))
        previous = info.get('regularMarketPreviousClose', info.get('previousClose', 0))
        
        if current and previous:
            change = current - previous
            change_percent = (change / previous) * 100
        else:
            change = 0
            change_percent = 0
        
        # Insight
        insight = gemini.generate_content(f"Brief insight about {symbol} stock in 2 sentences")
        
        return {
            "symbol": symbol.upper(),
            "price": round(current, 2),
            "change": round(change, 2),
            "change_percent": round(change_percent, 2),
            "volume": info.get('volume', 0),
            "insight": insight.text
        }
    
    except Exception as e:
        logger.error(f"Stock error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
async def get_history():
    """Get chat history"""
    return {"history": chat_history[-10:]}

@app.post("/cleanup-audio")
async def cleanup_audio(hours: int = 24):
    """Clean up old audio files"""
    tts_service.cleanup_old_files(hours)
    return {"message": f"Cleaned up audio files older than {hours} hours"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Finsight AI starting...")
    print(f"📊 Supported languages: {len(tts_service.languages)}")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)