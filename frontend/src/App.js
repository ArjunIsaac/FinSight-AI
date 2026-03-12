import React, { useState, useEffect } from 'react';

// Language data with native names
const INDIAN_LANGUAGES = [
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'brx', name: 'Bodo', native: 'बर' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ks', name: 'Kashmiri', native: 'कॉशुर' },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mni', name: 'Manipuri', native: 'মৈতৈলোন্' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्' },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ur', name: 'Urdu', native: 'اردو' }
];

// API Service
const API = {
  async chat(query, language) {
    const res = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, language })
    });
    return res.json();
  },

  async textToSpeech(text, language, voiceType = 'female') {
    const res = await fetch('http://localhost:8000/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, voice_type: voiceType })
    });
    return res.blob();
  },

  async uploadPDF(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('http://localhost:8000/upload-pdf', {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  async askPDF(question, pdfId) {
    const res = await fetch('http://localhost:8000/ask-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, pdf_id: pdfId })
    });
    return res.json();
  },

  async getNews(company) {
    const res = await fetch(`http://localhost:8000/news/${company}`);
    return res.json();
  },

  async getStock(symbol) {
    const res = await fetch(`http://localhost:8000/stock/${symbol}`);
    return res.json();
  },

  async getLanguages() {
    const res = await fetch('http://localhost:8000/languages');
    return res.json();
  }
};

// Voice Input Component
function VoiceInput({ onText, language }) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSupported(false);
    }
  }, []);

  const startListening = () => {
    if (!supported) {
      alert('Voice recognition not supported in this browser. Try Chrome.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = language === 'en' ? 'en-IN' : language + '-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      onText(text);
    };

    recognition.start();
  };

  return (
    <button
      onClick={startListening}
      disabled={!supported}
      className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
        isListening 
          ? 'bg-red-500 text-white animate-pulse' 
          : supported 
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-400 text-white cursor-not-allowed'
      }`}
      title={supported ? `Speak in ${language}` : 'Not supported'}
    >
      <span>{isListening ? '🎤 Listening...' : '🎤 Voice'}</span>
    </button>
  );
}

// Voice Output Component
function VoiceOutput({ text, language, onPlay }) {
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const playAudio = async () => {
    try {
      setPlaying(true);
      
      // Get audio from backend
      const audioBlob = await API.textToSpeech(text, language, 'female');
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      const audio = new Audio(url);
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.play();
      
      if (onPlay) onPlay();
    } catch (error) {
      console.error('TTS error:', error);
      setPlaying(false);
    }
  };

  return (
    <button
      onClick={playAudio}
      disabled={playing}
      className={`ml-2 p-2 rounded-full ${
        playing 
          ? 'bg-blue-100 text-blue-600' 
          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
      }`}
      title="Listen"
    >
      {playing ? '🔊 Playing...' : '🔊'}
    </button>
  );
}

// Language Selector
function LanguageSelector({ selected, onChange }) {
  return (
    <div className="relative group">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {INDIAN_LANGUAGES.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.native} - {lang.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        ▼
      </div>
    </div>
  );
}

// Chat Component
function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { text: input, sender: 'user', language };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await API.chat(input, language);
      const botMsg = { 
        text: data.response, 
        sender: 'bot', 
        language,
        sentiment: data.sentiment 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = (text) => {
    setInput(text);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-120px)]">
      <div className="bg-white p-4 border-b flex items-center gap-4">
        <LanguageSelector selected={language} onChange={setLanguage} />
        <VoiceInput onText={handleVoiceInput} language={language} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] group relative ${
              msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg' 
                : 'bg-gray-200 text-gray-800 rounded-r-lg rounded-tl-lg'
            } p-3`}>
              <div className="flex items-start gap-2">
                <span>{msg.text}</span>
                {msg.sender === 'bot' && (
                  <VoiceOutput text={msg.text} language={msg.language} />
                )}
              </div>
              {msg.sentiment && (
                <span className="absolute -top-2 -right-2 text-sm bg-white rounded-full px-2 shadow">
                  {msg.sentiment === 'POSITIVE' ? '📈' : 
                   msg.sentiment === 'NEGATIVE' ? '📉' : '📊'}
                </span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 p-3 rounded-lg">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={`Type your message in ${INDIAN_LANGUAGES.find(l => l.code === language)?.native}...`}
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// PDF Component
function PDF() {
  const [file, setFile] = useState(null);
  const [pdfId, setPdfId] = useState(null);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState([]);
  const [summary, setSummary] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const data = await API.uploadPDF(file);
      setPdfId(data.pdf_id);
      setSummary(data.summary);
      setSuggestedQuestions(data.suggested_questions || []);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async () => {
    if (!question || !pdfId) return;
    try {
      const data = await API.askPDF(question, pdfId);
      setAnswers(prev => [...prev, { q: question, a: data.answer }]);
      setQuestion('');
    } catch (error) {
      console.error('Ask error:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">📄 Upload Financial Document</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            📤 Choose PDF
          </label>
          {file && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Selected: {file.name}</p>
              <button
                onClick={uploadFile}
                disabled={uploading}
                className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-bold mb-2">📝 Summary</h3>
          <p className="text-gray-700 whitespace-pre-line">{summary}</p>
        </div>
      )}

      {suggestedQuestions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-bold mb-2">💡 Suggested Questions</h3>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => setQuestion(q)}
                className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm hover:bg-gray-300"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold mb-4">❓ Ask about your document</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
            placeholder="Ask a question about the PDF..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!pdfId}
          />
          <button
            onClick={askQuestion}
            disabled={!pdfId}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            Ask
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {answers.map((ans, i) => (
            <div key={i} className="border-b pb-2">
              <p className="font-semibold text-blue-600">Q: {ans.q}</p>
              <p className="text-gray-700 mt-1">A: {ans.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stock Component
function Stock() {
  const [symbol, setSymbol] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const getStock = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const data = await API.getStock(symbol);
      setData(data);
    } catch (error) {
      console.error('Stock error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">📈 Stock Information</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && getStock()}
            placeholder="Enter symbol (e.g., RELIANCE, TCS, AAPL)"
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={getStock}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Get'}
          </button>
        </div>
      </div>

      {data && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">{data.symbol}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">Price</p>
              <p className="text-2xl font-bold">₹{data.price}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">Change</p>
              <p className={`text-2xl font-bold ${data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.change > 0 ? '+' : ''}{data.change} ({data.change_percent}%)
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">Volume</p>
              <p className="text-xl">{data.volume.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-gray-700">{data.insight}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// News Component
function News() {
  const [company, setCompany] = useState('');
  const [news, setNews] = useState([]);
  const [overallSentiment, setOverallSentiment] = useState('');
  const [loading, setLoading] = useState(false);

  const getNews = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const data = await API.getNews(company);
      setNews(data.news || []);
      setOverallSentiment(data.overall_sentiment);
    } catch (error) {
      console.error('News error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">📰 Company News</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && getNews()}
            placeholder="Enter company name (e.g., Tata, Reliance)"
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={getNews}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {overallSentiment && (
        <div className={`mb-4 p-3 rounded-lg ${
          overallSentiment === 'POSITIVE' ? 'bg-green-100 text-green-800' :
          overallSentiment === 'NEGATIVE' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          Overall Sentiment: {overallSentiment} {
            overallSentiment === 'POSITIVE' ? '📈' :
            overallSentiment === 'NEGATIVE' ? '📉' : '📊'
          }
        </div>
      )}

      <div className="space-y-4">
        {news.map((item, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">{item.title}</h3>
              <span className={`px-2 py-1 rounded text-sm ${
                item.sentiment === 'POSITIVE' ? 'bg-green-100 text-green-800' :
                item.sentiment === 'NEGATIVE' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {item.sentiment}
              </span>
            </div>
            <p className="text-gray-600 mb-2">{item.summary}</p>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{item.source}</span>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Read more →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App
function App() {
  const [activeTab, setActiveTab] = useState('chat');

  const tabs = [
    { id: 'chat', name: '💬 Chat', icon: '💬' },
    { id: 'pdf', name: '📄 PDF', icon: '📄' },
    { id: 'stock', name: '📈 Stocks', icon: '📈' },
    { id: 'news', name: '📰 News', icon: '📰' }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🇮🇳 Finsight AI - भारत के लिए वित्त चैटबॉट</h1>
          <div className="text-sm bg-blue-700 px-3 py-1 rounded-full">
            22 भारतीय भाषाएँ | 22 Indian Languages
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto">
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'pdf' && <PDF />}
        {activeTab === 'stock' && <Stock />}
        {activeTab === 'news' && <News />}
      </main>
    </div>
  );
}

export default App;