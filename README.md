# Finsight AI - Multilingual Finance Chatbot 🇮🇳

A finance chatbot supporting all 22 official Indian languages with voice input/output.

## Features
- 💬 Chat about finance in 22 Indian languages
- 🎤 Voice input in all Indian languages
- 🔊 Voice output using neural TTS
- 📄 PDF upload and Q&A
- 📈 Real-time stock data
- 📰 Company news with sentiment analysis

## Supported Languages
- Assamese (অসমীয়া)
- Bengali (বাংলা)
- Bodo (बर)
- Dogri (डोगरी)
- English
- Gujarati (ગુજરાતી)
- Hindi (हिन्दी)
- Kannada (ಕನ್ನಡ)
- Kashmiri (कॉशुर)
- Konkani (कोंकणी)
- Maithili (मैथिली)
- Malayalam (മലയാളം)
- Manipuri (মৈতৈলোন্)
- Marathi (मराठी)
- Nepali (नेपाली)
- Odia (ଓଡ଼ିଆ)
- Punjabi (ਪੰਜਾਬੀ)
- Sanskrit (संस्कृतम्)
- Santali (ᱥᱟᱱᱛᱟᱲᱤ)
- Sindhi (سنڌي)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Urdu (اردو)

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
# Add your API keys to .env
python main.py
# Dev mode with hot-reload (recommended):
uvicorn main:app --reload --host 0.0.0.0 --port 8000