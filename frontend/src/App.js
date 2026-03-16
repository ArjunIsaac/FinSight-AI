import React, { useState, useEffect } from 'react';

// ==================== STYLED COMPONENTS ====================

const styles = {
  // Modern color palette
  colors: {
    primary: '#3B82F6',      // Bright blue
    secondary: '#10B981',    // Emerald green
    accent: '#8B5CF6',       // Purple
    danger: '#EF4444',       // Red
    warning: '#F59E0B',      // Amber
    dark: '#1F2937',         // Dark gray
    light: '#F9FAFB',        // Light gray
    white: '#FFFFFF',
  },
  
  // Gradients
  gradients: {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600',
    secondary: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    gold: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  
  // Animations
  animations: {
    pulse: 'animate-pulse',
    bounce: 'animate-bounce',
    spin: 'animate-spin',
    fadeIn: 'animate-fade-in',
  }
};

// ==================== ANIMATION KEYFRAMES ====================

// Add this to your index.html or create a CSS file
const animationStyles = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes slideIn {
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.animate-slide-in {
  animation: slideIn 0.3s ease-out;
}
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}
.animate-float {
  animation: float 3s ease-in-out infinite;
}
`;

// Add to your index.html head
const style = document.createElement('style');
style.textContent = animationStyles;
document.head.appendChild(style);

// ==================== API SERVICE ====================

const API = {
  async chat(query, language) {
    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('API Error:', error);
      return { response: '⚠️ Cannot connect to server. Is backend running?' };
    }
  },

  async textToSpeech(text, language) {
    try {
      const res = await fetch('http://localhost:8000/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, voice_type: 'female' })
      });
      if (!res.ok) throw new Error('TTS failed');
      return await res.blob();
    } catch (error) {
      console.error('TTS Error:', error);
      return null;
    }
  }
};

// ==================== LANGUAGE DATA ====================

const INDIAN_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', flag: '🇮🇳' },
];

// ==================== CONNECTION STATUS ====================

function ConnectionStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await fetch('http://localhost:8000/health', { timeout: 2000 });
        setStatus('connected');
      } catch {
        setStatus('disconnected');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg ${
      status === 'connected' ? 'bg-green-500 text-white' : 
      status === 'checking' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        status === 'connected' ? 'bg-white animate-pulse' : 
        status === 'checking' ? 'bg-white' : 'bg-white'
      }`}></span>
      {status === 'connected' ? 'Backend Online' : 
       status === 'checking' ? 'Connecting...' : 'Backend Offline'}
    </div>
  );
}

// ==================== LANGUAGE SELECTOR ====================

function LanguageSelector({ selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLang = INDIAN_LANGUAGES.find(l => l.code === selected) || INDIAN_LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
      >
        <span className="text-xl">{selectedLang.flag}</span>
        <span className="font-medium">{selectedLang.native}</span>
        <span className="text-xs text-gray-500">({selectedLang.name})</span>
        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-2 w-64 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-20 animate-fade-in">
            {INDIAN_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  onChange(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selected === lang.code ? 'bg-blue-50 text-blue-600' : ''
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <div className="text-left">
                  <div className="font-medium">{lang.native}</div>
                  <div className="text-xs text-gray-500">{lang.name}</div>
                </div>
                {selected === lang.code && (
                  <svg className="w-5 h-5 ml-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== VOICE INPUT ====================

function VoiceInput({ onText, language }) {
  const [isListening, setIsListening] = useState(false);
  const [supported] = useState(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  });

  const startListening = () => {
    if (!supported) {
      alert('Voice recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

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
      className={`relative p-3 rounded-xl transition-all duration-200 ${
        isListening 
          ? 'bg-red-500 text-white scale-110 shadow-lg' 
          : supported
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-md hover:scale-105'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
      }`}
      title={supported ? `Speak in ${language}` : 'Not supported'}
    >
      {isListening ? (
        <>
          <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-75"></span>
          <span className="relative">🎤</span>
        </>
      ) : '🎤'}
    </button>
  );
}

// ==================== VOICE OUTPUT ====================

function VoiceOutput({ text, language }) {
  const [playing, setPlaying] = useState(false);

  const playAudio = async () => {
    if (!text || playing) return;
    
    setPlaying(true);
    try {
      const audioBlob = await API.textToSpeech(text, language);
      if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.onended = () => {
          setPlaying(false);
          URL.revokeObjectURL(url);
        };
        audio.play();
      } else {
        setPlaying(false);
      }
    } catch (error) {
      console.error('Playback error:', error);
      setPlaying(false);
    }
  };

  return (
    <button
      onClick={playAudio}
      disabled={playing}
      className={`p-2 rounded-lg transition-all ${
        playing 
          ? 'bg-blue-100 text-blue-600 animate-pulse' 
          : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600'
      }`}
      title="Listen"
    >
      {playing ? '🔊' : '🔈'}
    </button>
  );
}

// ==================== CHAT MESSAGE ====================

function ChatMessage({ message, language }) {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`flex max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm shadow-md">
            AI
          </div>
        )}
        
        <div className={`group relative ${isUser ? 'order-1' : 'order-2'}`}>
          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
            isUser 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none' 
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
          }`}>
            <p className="text-sm leading-relaxed">{message.text}</p>
            
            {!isUser && (
              <div className="absolute -bottom-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <VoiceOutput text={message.text} language={language} />
              </div>
            )}
          </div>
          
          <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-600 to-gray-800 flex items-center justify-center text-white text-sm shadow-md">
            You
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TYPING INDICATOR ====================

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm shadow-md">
          AI
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CHAT INTERFACE ====================

function Chat() {
  const [messages, setMessages] = useState([
    { 
      sender: 'bot', 
      text: '👋 Namaste! I\'m your AI finance assistant. Ask me about stocks, companies, markets, or upload financial PDFs for analysis.' 
    }
  ]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const data = await API.chat(input, language);
    
    setMessages(prev => [...prev, { 
      sender: 'bot', 
      text: data.response || 'Sorry, I encountered an error.'
    }]);
    setLoading(false);
  };

  const handleVoiceInput = (text) => {
    setInput(text);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
            AI
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">FinSight Assistant</h2>
            <p className="text-xs text-gray-500">Powered by Gemini AI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector selected={language} onChange={setLanguage} />
          <VoiceInput onText={handleVoiceInput} language={language} />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} language={language} />
        ))}
        {loading && <TypingIndicator />}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={`Ask in ${INDIAN_LANGUAGES.find(l => l.code === language)?.native}...`}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-medium flex items-center gap-2"
          >
            <span>Send</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          💡 Try: "What's Tesla stock price?" or "Summarize this PDF"
        </p>
      </div>
    </div>
  );
}

// ==================== PDF UPLOAD COMPONENT ====================

function PDFUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('http://localhost:8000/upload-pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadResult(data);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Is backend running?');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-2xl shadow-md">
            📄
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Upload PDF</h2>
            <p className="text-gray-500">Upload financial documents for AI analysis</p>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
            id="pdf-input"
          />
          <label
            htmlFor="pdf-input"
            className="cursor-pointer flex flex-col items-center"
          >
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-1">
              {file ? file.name : 'Click to select a PDF'}
            </p>
            <p className="text-sm text-gray-500">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Max size: 10MB'}
            </p>
          </label>
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-md transition-all disabled:opacity-50 font-medium"
          >
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </button>
        )}

        {uploadResult && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
            <p className="text-green-700 font-medium mb-2">✓ Upload successful!</p>
            <p className="text-sm text-gray-600">{uploadResult.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================

function App() {
  const [activeTab, setActiveTab] = useState('chat');

  const tabs = [
    { id: 'chat', icon: '💬', label: 'Chat', gradient: 'from-blue-600 to-purple-600' },
    { id: 'pdf', icon: '📄', label: 'PDF', gradient: 'from-emerald-600 to-teal-600' },
    { id: 'stock', icon: '📈', label: 'Stocks', gradient: 'from-amber-600 to-orange-600' },
    { id: 'news', icon: '📰', label: 'News', gradient: 'from-pink-600 to-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <ConnectionStatus />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl shadow-xl animate-float">
                🇮🇳
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">FinSight AI</h1>
                <p className="text-blue-100 text-sm mt-1">
                  Multilingual Finance Assistant • 22 Indian Languages
                </p>
              </div>
            </div>
            <div className="hidden md:block px-4 py-2 bg-white/20 rounded-xl backdrop-blur">
              <span className="text-sm">🌟 Powered by Gemini AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 py-4 font-medium transition-all ${
                  activeTab === tab.id
                    ? `text-transparent bg-clip-text bg-gradient-to-r ${tab.gradient}`
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tab.gradient}`}></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'pdf' && <PDFUpload />}
        {activeTab === 'stock' && (
          <div className="p-6 text-center text-gray-500">
            Stock feature coming soon...
          </div>
        )}
        {activeTab === 'news' && (
          <div className="p-6 text-center text-gray-500">
            News feature coming soon...
          </div>
        )}
      </main>
    </div>
  );
}

export default App;