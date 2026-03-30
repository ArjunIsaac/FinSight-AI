import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Google Fonts injection (done once, outside component tree) ────────────────
if (!document.getElementById('finsight-fonts')) {
  const link = document.createElement('link');
  link.id = 'finsight-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
}

// ── Global CSS (injected once) ────────────────────────────────────────────────
if (!document.getElementById('finsight-styles')) {
  const style = document.createElement('style');
  style.id = 'finsight-styles';
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --ink:        #0f1117;
      --ink-2:      #374151;
      --ink-3:      #6b7280;
      --ink-4:      #9ca3af;
      --paper:      #fafaf8;
      --paper-2:    #f3f2ef;
      --paper-3:    #e8e6e1;
      --gold:       #c9a84c;
      --gold-light: #f0e4b8;
      --teal:       #0f766e;
      --teal-light: #ccfbf1;
      --red:        #dc2626;
      --red-light:  #fee2e2;
      --green:      #16a34a;
      --green-light:#dcfce7;
      --radius-sm:  6px;
      --radius:     12px;
      --radius-lg:  20px;
      --shadow-sm:  0 1px 3px rgba(0,0,0,.08);
      --shadow:     0 4px 16px rgba(0,0,0,.10);
      --shadow-lg:  0 12px 40px rgba(0,0,0,.14);
      --font-serif: 'DM Serif Display', Georgia, serif;
      --font-sans:  'DM Sans', system-ui, sans-serif;
      --font-mono:  'JetBrains Mono', monospace;
    }

    body { margin: 0; font-family: var(--font-sans); background: var(--paper); color: var(--ink); }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--paper-3); border-radius: 99px; }

    /* ── Markdown inside chat bubbles ── */
    .md-body { font-size: 0.875rem; line-height: 1.65; }
    .md-body p { margin: 0 0 .6rem; }
    .md-body p:last-child { margin-bottom: 0; }
    .md-body ul, .md-body ol { margin: 0 0 .6rem 1.25rem; padding: 0; }
    .md-body li { margin-bottom: .2rem; }
    .md-body strong { font-weight: 600; }
    .md-body em { font-style: italic; }
    .md-body code {
      font-family: var(--font-mono);
      font-size: .8em;
      background: var(--paper-2);
      padding: .15em .4em;
      border-radius: var(--radius-sm);
    }
    .md-body pre {
      background: var(--ink);
      color: #e5e7eb;
      padding: .75rem 1rem;
      border-radius: var(--radius);
      overflow-x: auto;
      margin: .6rem 0;
    }
    .md-body pre code { background: none; padding: 0; font-size: .8rem; }
    .md-body table { border-collapse: collapse; width: 100%; font-size: .8rem; margin: .6rem 0; }
    .md-body th, .md-body td { border: 1px solid var(--paper-3); padding: .4rem .6rem; text-align: left; }
    .md-body th { background: var(--paper-2); font-weight: 600; }

    /* ── Animations ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(201,168,76,.5); }
      70%  { box-shadow: 0 0 0 8px rgba(201,168,76,0); }
      100% { box-shadow: 0 0 0 0 rgba(201,168,76,0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes blink {
      0%, 100% { opacity: .3; }
      50%       { opacity: 1; }
    }

    .fade-up    { animation: fadeUp .25s ease-out both; }
    .pulse-gold { animation: pulse-ring 1.8s infinite; }
    .spin       { animation: spin .8s linear infinite; }

    /* ── Input focus ring ── */
    .fs-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px var(--gold);
    }

    /* ── Sentiment badge ── */
    .badge-pos { background: var(--green-light); color: var(--green); }
    .badge-neg { background: var(--red-light);   color: var(--red); }
    .badge-neu { background: var(--paper-2);      color: var(--ink-3); }

    /* ── Tab indicator ── */
    .tab-active::after {
      content: '';
      display: block;
      height: 2px;
      background: var(--gold);
      border-radius: 99px;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:8000';

const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English'    },
  { code: 'hi', name: 'Hindi',      native: 'हिन्दी'      },
  { code: 'bn', name: 'Bengali',    native: 'বাংলা'       },
  { code: 'te', name: 'Telugu',     native: 'తెలుగు'      },
  { code: 'ta', name: 'Tamil',      native: 'தமிழ்'       },
  { code: 'mr', name: 'Marathi',    native: 'मराठी'       },
  { code: 'gu', name: 'Gujarati',   native: 'ગુજરાતી'     },
  { code: 'kn', name: 'Kannada',    native: 'ಕನ್ನಡ'       },
  { code: 'ml', name: 'Malayalam',  native: 'മലയാളം'      },
  { code: 'pa', name: 'Punjabi',    native: 'ਪੰਜਾਬੀ'      },
  { code: 'or', name: 'Odia',       native: 'ଓଡ଼ିଆ'       },
  { code: 'as', name: 'Assamese',   native: 'অসমীয়া'     },
  { code: 'ur', name: 'Urdu',       native: 'اردو'        },
  { code: 'ne', name: 'Nepali',     native: 'नेपाली'      },
  { code: 'sa', name: 'Sanskrit',   native: 'संस्कृतम्'   },
];

// ── API layer ─────────────────────────────────────────────────────────────────

const api = {
  async chat(query, language) {
    const r = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, language }),
    });
    if (!r.ok) throw new Error(`Chat API ${r.status}`);
    return r.json();
  },

  async uploadPDF(file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${BASE}/upload-pdf`, { method: 'POST', body: fd });
    if (!r.ok) throw new Error(`Upload API ${r.status}`);
    return r.json();
  },

  async askPDF(question, pdf_id) {
    const r = await fetch(`${BASE}/ask-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, pdf_id }),
    });
    if (!r.ok) throw new Error(`Ask-PDF API ${r.status}`);
    return r.json();
  },

  async getNews(company) {
    const r = await fetch(`${BASE}/news/${encodeURIComponent(company)}`);
    if (!r.ok) throw new Error(`News API ${r.status}`);
    return r.json();
  },

  async getStock(symbol) {
    const r = await fetch(`${BASE}/stock/${encodeURIComponent(symbol.toUpperCase())}`);
    if (!r.ok) throw new Error(`Stock API ${r.status}`);
    return r.json();
  },

  async tts(text, language) {
    const r = await fetch(`${BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, voice_type: 'female' }),
    });
    if (!r.ok) throw new Error(`TTS API ${r.status}`);
    return r.blob();
  },
};

// ── Tiny reusable primitives ──────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function SentimentBadge({ value }) {
  if (!value) return null;
  const cls = value === 'POSITIVE' ? 'badge-pos' : value === 'NEGATIVE' ? 'badge-neg' : 'badge-neu';
  const icon = value === 'POSITIVE' ? '↑' : value === 'NEGATIVE' ? '↓' : '→';
  return (
    <span className={cls} style={{ fontSize: '.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: 99, letterSpacing: '.03em' }}>
      {icon} {value}
    </span>
  );
}

function Btn({ children, onClick, disabled, variant = 'primary', style: s, small }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)', fontWeight: 500,
    fontSize: small ? '.8rem' : '.875rem', padding: small ? '6px 12px' : '10px 20px',
    transition: 'all .15s', opacity: disabled ? .5 : 1,
  };
  const variants = {
    primary:  { background: 'var(--ink)',  color: '#fff' },
    gold:     { background: 'var(--gold)', color: '#fff' },
    ghost:    { background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--paper-3)' },
    danger:   { background: 'var(--red-light)', color: 'var(--red)' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...s }}>
      {children}
    </button>
  );
}

// ── Connection Status ─────────────────────────────────────────────────────────

function ConnectionStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const check = async () => {
      // BUG FIX: fetch doesn't accept a timeout option — use AbortController
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        await fetch(`${BASE}/health`, { signal: controller.signal });
        setStatus('online');
      } catch {
        setStatus('offline');
      } finally {
        clearTimeout(timer);
      }
    };
    check();
    const id = setInterval(check, 6000);
    return () => clearInterval(id);
  }, []);

  const color = status === 'online' ? 'var(--green)' : status === 'checking' ? 'var(--gold)' : 'var(--red)';
  const label = status === 'online' ? 'Backend online' : status === 'checking' ? 'Connecting…' : 'Backend offline';

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 999,
      display: 'flex', alignItems: 'center', gap: 6,
      background: '#fff', border: '1px solid var(--paper-3)',
      borderRadius: 99, padding: '5px 12px', fontSize: '.75rem',
      fontWeight: 500, color: 'var(--ink-2)', boxShadow: 'var(--shadow-sm)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

// ── Language Selector ─────────────────────────────────────────────────────────

function LanguageSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const selected = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          background: 'var(--paper-2)', border: '1px solid var(--paper-3)',
          borderRadius: 'var(--radius)', padding: '7px 12px',
          fontFamily: 'var(--font-sans)', fontSize: '.8rem', fontWeight: 500, color: 'var(--ink-2)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-sans)' }}>{selected.native}</span>
        <span style={{ color: 'var(--ink-4)', fontSize: '.7rem' }}>({selected.name})</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: '#fff', border: '1px solid var(--paper-3)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
          width: 220, maxHeight: 320, overflowY: 'auto',
        }}>
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => { onChange(lang.code); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: value === lang.code ? 'var(--paper-2)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-sans)', fontSize: '.8rem', color: 'var(--ink-2)',
              }}>
              <span style={{ fontSize: '1rem' }}>{lang.native}</span>
              <span style={{ color: 'var(--ink-4)', fontSize: '.7rem' }}>{lang.name}</span>
              {value === lang.code && (
                <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Voice Input ───────────────────────────────────────────────────────────────

function VoiceInput({ onText, language, disabled }) {
  const [listening, setListening] = useState(false);
  const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const toggle = () => {
    if (!supported || disabled) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend   = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.start();
  };

  return (
    <button
      onClick={toggle}
      disabled={!supported || disabled}
      title={supported ? 'Voice input' : 'Not supported in this browser'}
      style={{
        width: 38, height: 38, borderRadius: 'var(--radius)',
        border: 'none', cursor: supported ? 'pointer' : 'not-allowed',
        background: listening ? 'var(--red)' : 'var(--paper-2)',
        color: listening ? '#fff' : 'var(--ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s', flexShrink: 0,
        ...(listening ? { animation: 'pulse-ring 1.4s infinite' } : {}),
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M19 10a7 7 0 0 1-14 0M12 19v3M9 22h6" />
      </svg>
    </button>
  );
}

// ── Voice Output ──────────────────────────────────────────────────────────────

function VoiceOutput({ text, language }) {
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    if (playing || !text) return;
    setPlaying(true);
    try {
      const blob = await api.tts(text, language);
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <button onClick={play} disabled={playing} title="Listen"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 99, border: '1px solid var(--paper-3)',
        background: playing ? 'var(--paper-2)' : '#fff', cursor: 'pointer',
        fontSize: '.72rem', fontWeight: 500, color: 'var(--ink-3)',
        fontFamily: 'var(--font-sans)',
      }}>
      {playing ? <Spinner size={12} /> : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
      {playing ? 'Playing…' : 'Listen'}
    </button>
  );
}

// ── Chat Message ──────────────────────────────────────────────────────────────

function ChatMsg({ msg, language }) {
  const isUser = msg.role === 'user';

  return (
    <div className="fade-up" style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '1.25rem',
    }}>
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 10 }}>

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: isUser ? 'var(--ink)' : 'var(--gold)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '.65rem', fontWeight: 700, letterSpacing: '.05em', flexShrink: 0,
          fontFamily: 'var(--font-mono)',
        }}>
          {isUser ? 'YOU' : 'AI'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          {/* Bubble */}
          <div style={{
            padding: '10px 14px',
            background: isUser ? 'var(--ink)' : '#fff',
            color: isUser ? '#fff' : 'var(--ink)',
            borderRadius: isUser
              ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)'
              : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
            border: isUser ? 'none' : '1px solid var(--paper-3)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {isUser
              ? <p style={{ margin: 0, fontSize: '.875rem', lineHeight: 1.5 }}>{msg.text}</p>
              : <div className="md-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>
            }
          </div>

          {/* Footer row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg.timestamp && (
              <span style={{ fontSize: '.65rem', color: 'var(--ink-4)' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {msg.sentiment && <SentimentBadge value={msg.sentiment} />}
            {!isUser && <VoiceOutput text={msg.text} language={language} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
        background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '.65rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)',
      }}>AI</div>
      <div style={{
        background: '#fff', border: '1px solid var(--paper-3)', borderRadius: 'var(--radius-lg)',
        padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 150, 300].map(delay => (
          <span key={delay} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-3)',
            animation: `blink 1.2s ${delay}ms infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────

function ChatTab() {
  const [messages, setMessages] = useState([{
    role: 'bot', text: 'Namaste. I\'m your finance assistant — ask me about stocks, markets, companies, or upload a financial PDF for analysis.',
    timestamp: new Date().toISOString(),
  }]);
  const [input, setInput]       = useState('');
  const [lang, setLang]         = useState('en');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef();

  // BUG FIX: auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const ts = new Date().toISOString();
    setMessages(m => [...m, { role: 'user', text: q, timestamp: ts }]);
    setInput('');
    setLoading(true);
    try {
      const data = await api.chat(q, lang);
      setMessages(m => [...m, {
        role: 'bot',
        text: data.response,
        sentiment: data.sentiment,
        timestamp: new Date().toISOString(),
      }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'bot', text: `Connection error: ${e.message}`, timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chat header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--paper-3)',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--ink-2)' }}>Finance Assistant</div>
          <div style={{ fontSize: '.7rem', color: 'var(--ink-4)' }}>Finance-only · Powered by Gemini</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <LanguageSelector value={lang} onChange={setLang} />
          <VoiceInput onText={setInput} language={lang} disabled={loading} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.map((msg, i) => <ChatMsg key={i} msg={msg} language={lang} />)}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop: '1px solid var(--paper-3)', background: '#fff', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="fs-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Ask in ${LANGUAGES.find(l => l.code === lang)?.native || 'English'}…`}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 'var(--radius)',
              border: '1px solid var(--paper-3)', fontFamily: 'var(--font-sans)',
              fontSize: '.875rem', background: 'var(--paper)', color: 'var(--ink)',
            }}
          />
          <Btn onClick={send} disabled={loading || !input.trim()}>
            {loading ? <Spinner size={14} /> : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            )}
            Send
          </Btn>
        </div>
        <div style={{ fontSize: '.7rem', color: 'var(--ink-4)', marginTop: 6 }}>
          Try: "What is HDFC Bank's PE ratio?" · "Explain SIP in Hindi"
        </div>
      </div>
    </div>
  );
}

// ── PDF Tab ───────────────────────────────────────────────────────────────────

function PDFTab() {
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);   // { pdf_id, filename, summary, suggested_questions }
  const [question, setQuestion] = useState('');
  const [answer, setAnswer]     = useState('');
  const [asking, setAsking]     = useState(false);
  const [error, setError]       = useState('');

  const upload = async () => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const data = await api.uploadPDF(file);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const ask = async () => {
    if (!question.trim() || !result) return;
    setAsking(true); setAnswer('');
    try {
      const data = await api.askPDF(question, result.pdf_id);
      setAnswer(data.answer);
    } catch (e) {
      setAnswer(`Error: ${e.message}`);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px', overflowY: 'auto', height: '100%' }}>

      {/* Upload card */}
      <div style={{ background: '#fff', border: '1px solid var(--paper-3)', borderRadius: 'var(--radius-lg)', padding: '28px', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: '0 0 4px' }}>Upload Financial Document</h2>
        <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', margin: '0 0 20px' }}>
          Annual reports, balance sheets, 10-Ks — max 10 MB
        </p>

        <label htmlFor="pdf-input" style={{
          display: 'block', border: '2px dashed var(--paper-3)', borderRadius: 'var(--radius)',
          padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
          background: file ? 'var(--paper-2)' : 'var(--paper)',
          transition: 'border-color .15s',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: '.875rem', fontWeight: 500, color: 'var(--ink-2)', marginBottom: 4 }}>
            {file ? file.name : 'Click or drag a PDF here'}
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--ink-4)' }}>
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF files only'}
          </div>
          <input id="pdf-input" type="file" accept=".pdf"
            onChange={e => { setFile(e.target.files[0]); setResult(null); setAnswer(''); }}
            style={{ display: 'none' }} />
        </label>

        {file && !result && (
          <Btn onClick={upload} disabled={uploading} style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
            {uploading ? <><Spinner size={14} /> Analysing…</> : 'Upload & Summarise'}
          </Btn>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: '.8rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* Summary card */}
      {result && (
        <div className="fade-up" style={{ background: '#fff', border: '1px solid var(--paper-3)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '1rem' }}>✓</span>
            <span style={{ fontSize: '.875rem', fontWeight: 600, color: 'var(--green)' }}>{result.filename}</span>
            {result.pages && <span style={{ fontSize: '.72rem', color: 'var(--ink-4)' }}>{result.pages} pages</span>}
          </div>

          <div style={{ fontSize: '.8rem', color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 16 }}>
            <div className="md-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown></div>
          </div>

          {result.suggested_questions?.length > 0 && (
            <>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Suggested questions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.suggested_questions.map((q, i) => (
                  <button key={i} onClick={() => setQuestion(q)}
                    style={{
                      background: 'var(--paper)', border: '1px solid var(--paper-3)',
                      borderRadius: 'var(--radius)', padding: '8px 12px',
                      textAlign: 'left', cursor: 'pointer', fontSize: '.8rem',
                      color: 'var(--ink-2)', fontFamily: 'var(--font-sans)',
                    }}>
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Ask card */}
      {result && (
        <div className="fade-up" style={{ background: '#fff', border: '1px solid var(--paper-3)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10 }}>Ask about this document</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="fs-input" value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="e.g. What is the revenue for FY2024?"
              style={{
                flex: 1, padding: '9px 13px', border: '1px solid var(--paper-3)',
                borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)',
                fontSize: '.8rem', background: 'var(--paper)',
              }} />
            <Btn onClick={ask} disabled={asking || !question.trim()} small>
              {asking ? <Spinner size={12} /> : 'Ask'}
            </Btn>
          </div>
          {answer && (
            <div className="fade-up" style={{ marginTop: 14, padding: '14px', background: 'var(--paper-2)', borderRadius: 'var(--radius)', fontSize: '.8rem' }}>
              <div className="md-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stock Tab ─────────────────────────────────────────────────────────────────

function StockTab() {
  const [symbol, setSymbol]   = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const POPULAR = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'TSLA', 'AAPL', 'GOOGL'];

  const fetch_ = async (sym) => {
    const s = (sym || symbol).trim().toUpperCase();
    if (!s) return;
    setLoading(true); setError(''); setData(null);
    try {
      const d = await api.getStock(s);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const up = data && data.change >= 0;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: '0 0 4px' }}>Stock Lookup</h2>
      <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', margin: '0 0 20px' }}>Use Yahoo Finance tickers (e.g. RELIANCE.NS for NSE)</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="fs-input" value={symbol} onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetch_()}
          placeholder="AAPL / RELIANCE.NS / TCS.NS"
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid var(--paper-3)',
            borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '.875rem',
            letterSpacing: '.05em', background: 'var(--paper)',
          }} />
        <Btn onClick={() => fetch_()} disabled={loading || !symbol.trim()}>
          {loading ? <Spinner size={14} /> : 'Look up'}
        </Btn>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {POPULAR.map(s => (
          <button key={s} onClick={() => { setSymbol(s); fetch_(s); }}
            style={{
              padding: '4px 10px', border: '1px solid var(--paper-3)',
              borderRadius: 99, background: '#fff', cursor: 'pointer',
              fontSize: '.72rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)',
            }}>{s}</button>
        ))}
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: '.8rem', marginBottom: 16 }}>{error}</div>}

      {data && (
        <div className="fade-up" style={{ background: '#fff', border: '1px solid var(--paper-3)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '.75rem', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>{data.symbol}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', lineHeight: 1.2, marginBottom: 4 }}>{data.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 500 }}>${data.price?.toLocaleString()}</span>
              <span style={{ fontSize: '.875rem', fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '▲' : '▼'} {Math.abs(data.change)} ({Math.abs(data.change_percent)}%)
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Volume', data.volume?.toLocaleString()],
              ['Market Cap', data.market_cap ? `$${(data.market_cap / 1e9).toFixed(2)}B` : '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--paper-2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: '.65rem', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.875rem', fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          {data.insight && (
            <div style={{ background: 'var(--gold-light)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '.8rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gold)', marginBottom: 4 }}>AI Insight</div>
              {data.insight}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── News Tab ──────────────────────────────────────────────────────────────────

function NewsTab() {
  const [company, setCompany]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const QUICK = ['Infosys', 'Reliance', 'Tesla', 'Apple', 'HDFC Bank', 'Wipro'];

  const fetch_ = async (c) => {
    const q = (c || company).trim();
    if (!q) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const d = await api.getNews(q);
      setResult(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: '0 0 4px' }}>Financial News</h2>
      <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', margin: '0 0 20px' }}>Latest headlines with AI sentiment analysis</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="fs-input" value={company} onChange={e => setCompany(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetch_()}
          placeholder="Search company e.g. Infosys"
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid var(--paper-3)',
            borderRadius: 'var(--radius)', fontFamily: 'var(--font-sans)',
            fontSize: '.875rem', background: 'var(--paper)',
          }} />
        <Btn onClick={() => fetch_()} disabled={loading || !company.trim()}>
          {loading ? <Spinner size={14} /> : 'Search'}
        </Btn>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {QUICK.map(c => (
          <button key={c} onClick={() => { setCompany(c); fetch_(c); }}
            style={{ padding: '4px 12px', border: '1px solid var(--paper-3)', borderRadius: 99, background: '#fff', cursor: 'pointer', fontSize: '.75rem', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
            {c}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: '12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: '.8rem', marginBottom: 16 }}>{error}</div>}

      {result && (
        <div className="fade-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem' }}>{result.company}</span>
            <SentimentBadge value={result.overall_sentiment} />
          </div>

          {result.news.length === 0
            ? <p style={{ color: 'var(--ink-3)', fontSize: '.8rem' }}>No recent articles found.</p>
            : result.news.map((a, i) => (
                <div key={i} className="fade-up" style={{
                  background: '#fff', border: '1px solid var(--paper-3)',
                  borderRadius: 'var(--radius)', padding: '16px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--ink)', lineHeight: 1.4 }}>{a.title}</div>
                    <SentimentBadge value={a.sentiment} />
                  </div>
                  <p style={{ fontSize: '.78rem', color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.6 }}>{a.summary}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '.7rem', color: 'var(--ink-4)' }}>
                    <span>{a.source}</span>
                    {a.published_at && <span>{new Date(a.published_at).toLocaleDateString()}</span>}
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', fontWeight: 500 }}>Read →</a>}
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── Sidebar Nav ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'chat',  label: 'Chat',    icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )},
  { id: 'pdf',   label: 'PDF',     icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  )},
  { id: 'stock', label: 'Stocks',  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )},
  { id: 'news',  label: 'News',    icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>
  )},
];

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('chat');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--paper)' }}>
      <ConnectionStatus />

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0, background: 'var(--ink)', color: '#fff',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', lineHeight: 1.1, color: 'var(--gold)' }}>
            Fin<em>Sight</em>
          </div>
          <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.4)', marginTop: 3, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            AI · Finance · India
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--radius)', border: 'none',
                  background: active ? 'rgba(201,168,76,.15)' : 'transparent',
                  color: active ? 'var(--gold)' : 'rgba(255,255,255,.55)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  fontSize: '.825rem', fontWeight: active ? 600 : 400,
                  marginBottom: 2, textAlign: 'left', transition: 'all .12s',
                  borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                }}>
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: '.65rem', color: 'rgba(255,255,255,.25)', lineHeight: 1.6 }}>
          Finance-only queries<br />
          22 Indian languages<br />
          MySQL · Gemini 2.5
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          padding: '0 24px', height: 52, flexShrink: 0,
          borderBottom: '1px solid var(--paper-3)', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--ink-2)' }}>
            {TABS.find(t => t.id === tab)?.label}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'chat'  && <ChatTab />}
          {tab === 'pdf'   && <PDFTab />}
          {tab === 'stock' && <StockTab />}
          {tab === 'news'  && <NewsTab />}
        </div>
      </main>
    </div>
  );
}