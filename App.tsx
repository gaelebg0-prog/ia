
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, Role, Attachment, ThemeType } from './types';
import { generateGeminiResponse } from './services/geminiService';
import { MessageBubble } from './components/MessageBubble';

const STORAGE_KEY = 'gemini_assistant_history';
const THEME_KEY = 'gemini_assistant_theme';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse chat history", e);
    }
    return [{
      id: 'welcome',
      role: Role.MODEL,
      text: "Bonjour ! Je suis votre assistant Gemini Pro. Comment puis-je vous aider aujourd'hui ?",
      timestamp: Date.now(),
    }];
  });
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [ocrMode, setOcrMode] = useState(false);
  const [detectionMode, setDetectionMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem(THEME_KEY) as ThemeType) || 'light';
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (isSearchActive) searchInputRef.current?.focus();
    else setSearchTerm('');
  }, [isSearchActive]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Fix: Define filteredMessages to resolve the 'Cannot find name filteredMessages' error
  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const term = searchTerm.toLowerCase();
    return messages.filter(msg => 
      msg.text.toLowerCase().includes(term)
    );
  }, [messages, searchTerm]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInputText(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn("SpeechRecognition failed", err);
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else recognitionRef.current?.start();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          mimeType: file.type,
          data: base64,
          previewUrl: URL.createObjectURL(file)
        });
      } catch (err) { console.error(err); }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading || (!inputText.trim() && attachments.length === 0)) return;

    let displayPrefix = "";
    if (detectionMode) displayPrefix = "[DÉTECTION] ";
    else if (ocrMode) displayPrefix = "[OCR] ";

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: `${displayPrefix}${inputText || "Analyse de fichier"}`,
      attachments: [...attachments],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    const currentAttachments = [...attachments];
    const currentOcr = ocrMode;
    const currentDetect = detectionMode;
    
    setInputText('');
    setAttachments([]);
    setIsLoading(true);
    if (isListening) recognitionRef.current?.stop();

    try {
      const responseText = await generateGeminiResponse(
        currentInput,
        messages,
        currentAttachments,
        currentOcr,
        currentDetect
      );
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: "Une erreur est survenue lors de la communication avec l'IA.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const themes: {id: ThemeType, label: string, color: string}[] = [
    { id: 'light', label: 'Clair', color: '#2563eb' },
    { id: 'dark', label: 'Sombre', color: '#0f172a' },
    { id: 'ocean', label: 'Océan', color: '#0891b2' },
    { id: 'sunset', label: 'Crépuscule', color: '#ea580c' },
    { id: 'forest', label: 'Forêt', color: '#16a34a' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden theme-transition" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Header */}
      <header className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 z-10 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        {!isSearchActive ? (
          <>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl text-white shadow-lg" style={{ backgroundColor: 'var(--primary)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-base font-bold truncate" style={{ color: 'var(--text-main)' }}>Gemini Pro Assistant</h1>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => setIsSearchActive(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-all" style={{ color: 'var(--text-main)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-all" style={{ color: 'var(--text-main)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full animate-in slide-in-from-top-2">
            <button onClick={() => setIsSearchActive(false)} className="p-2" style={{ color: 'var(--text-main)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <input ref={searchInputRef} type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-100 border-none rounded-xl py-2 px-3 text-sm outline-none" />
          </div>
        )}
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-6 glass shadow-2xl theme-transition" style={{ borderColor: 'var(--border-color)', border: '1px solid var(--border-color)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Paramètres</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full hover:bg-black/5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3 opacity-70">Thème</label>
                <div className="grid grid-cols-5 gap-3">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`h-12 rounded-xl border-4 transition-all ${theme === t.id ? 'scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: t.color, borderColor: theme === t.id ? 'white' : 'transparent' }}
                      title={t.label}
                    />
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Clé API Configuration</span>
                  <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">ACTIF</span>
                </div>
                <button 
                  onClick={() => {
                    if(confirm("Effacer l'historique ?")) {
                      localStorage.removeItem(STORAGE_KEY);
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2 bg-red-500/10 text-red-600 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white transition-all"
                >
                  Effacer l'historique
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {filteredMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          {isLoading && <div className="animate-pulse flex gap-3"><div className="w-8 h-8 rounded-full bg-slate-200" /><div className="bg-white p-3 rounded-2xl w-24 h-10 border" /></div>}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-3 md:p-4 shrink-0 theme-transition" style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-3">
              {attachments.map((att, idx) => (
                <div key={idx} className="h-14 w-14 bg-slate-50 rounded-lg border overflow-hidden relative">
                  <img src={att.previewUrl} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
            <div className="flex-1 rounded-2xl border p-1.5 flex items-end transition-all focus-within:shadow-md theme-transition" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 opacity-50 hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                <button type="button" onClick={toggleListening} className={`p-2 transition-all ${isListening ? 'text-red-500 animate-pulse' : 'opacity-50 hover:opacity-100'}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
              </div>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*,application/pdf,text/*" />
              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={isListening ? "Je vous écoute..." : "Écrivez un message..."} className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-2 text-sm max-h-32 min-h-[38px] outline-none" rows={1} />
              <div className="flex gap-1">
                <button type="button" onClick={() => {setDetectionMode(!detectionMode); setOcrMode(false);}} className={`p-2 rounded-xl ${detectionMode ? 'bg-purple-600 text-white' : 'opacity-40'}`} title="Détection"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
                <button type="button" onClick={() => {setOcrMode(!ocrMode); setDetectionMode(false);}} className={`p-2 rounded-xl ${ocrMode ? 'bg-orange-500 text-white' : 'opacity-40'}`} title="OCR"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg></button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="text-white p-3 rounded-2xl shadow-lg active:scale-95 h-[48px] w-[48px] flex items-center justify-center shrink-0 transition-all" style={{ backgroundColor: 'var(--primary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
};

export default App;
