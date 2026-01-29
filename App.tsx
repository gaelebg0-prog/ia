
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, Role, Attachment } from './types';
import { generateGeminiResponse } from './services/geminiService';
import { MessageBubble } from './components/MessageBubble';

const STORAGE_KEY = 'gemini_assistant_history';

// Déclaration pour TypeScript car SpeechRecognition n'est pas dans les types standards
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [
      {
        id: 'welcome',
        role: Role.MODEL,
        text: "Bonjour ! Je suis votre assistant Gemini. Je peux analyser vos questions, vos images, vos vidéos et vos documents. Vous pouvez également me parler en utilisant le micro ! Comment puis-je vous aider aujourd'hui ?",
        timestamp: Date.now(),
      }
    ];
  });
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [ocrMode, setOcrMode] = useState(false);
  const [detectionMode, setDetectionMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    if (!isSearchActive || !searchTerm) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isSearchActive) {
      searchInputRef.current?.focus();
    } else {
      setSearchTerm('');
    }
  }, [isSearchActive]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Initialisation de la reconnaissance vocale
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      } else {
        alert("La reconnaissance vocale n'est pas supportée sur votre navigateur.");
      }
    }
  };

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const term = searchTerm.toLowerCase();
    return messages.filter(m => m.text.toLowerCase().includes(term));
  }, [messages, searchTerm]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await fileToBase64(file);
      newAttachments.push({
        name: file.name,
        mimeType: file.type,
        data: base64,
        previewUrl: URL.createObjectURL(file)
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearHistory = () => {
    if (window.confirm("Voulez-vous vraiment effacer tout l'historique de la conversation ?")) {
      const welcomeMsg = {
        id: 'welcome',
        role: Role.MODEL,
        text: "Historique effacé. Je suis prêt pour une nouvelle discussion !",
        timestamp: Date.now(),
      };
      setMessages([welcomeMsg]);
      localStorage.removeItem(STORAGE_KEY);
      setSearchTerm('');
      setIsSearchActive(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;

    let displayPrefix = "";
    if (detectionMode) displayPrefix = "[MODE DÉTECTION] ";
    else if (ocrMode) displayPrefix = "[MODE OCR] ";

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: `${displayPrefix}${inputText || (detectionMode ? "Détection d'objets" : ocrMode ? "Extraction de texte" : "")}`,
      attachments: [...attachments],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    const currentAttachments = [...attachments];
    const currentOcrMode = ocrMode;
    const currentDetectionMode = detectionMode;
    
    setInputText('');
    setAttachments([]);
    setIsLoading(true);
    setIsSearchActive(false);
    setOcrMode(false);
    setDetectionMode(false);
    if (isListening) recognitionRef.current?.stop();

    try {
      const responseText = await generateGeminiResponse(
        currentInput,
        messages,
        currentAttachments,
        currentOcrMode,
        currentDetectionMode
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: "Désolé, une erreur est survenue. Veuillez vérifier votre connexion ou réessayer plus tard.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center gap-4 shrink-0 overflow-hidden">
        {!isSearchActive ? (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="bg-blue-600 p-2 rounded-xl shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="truncate">
                <h1 className="text-lg font-bold text-slate-900 leading-none truncate">Gemini Assistant Pro</h1>
                <p className="text-xs text-green-500 font-medium mt-1">● En ligne</p>
              </div>
            </div>
            <div className="flex gap-1">
                <button 
                  onClick={() => setIsSearchActive(true)}
                  title="Rechercher"
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button 
                  onClick={clearHistory}
                  title="Effacer l'historique"
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full animate-in slide-in-from-right-4 duration-200">
            <button 
              onClick={() => setIsSearchActive(false)}
              className="p-2 text-slate-400 hover:text-slate-600 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher dans la discussion..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-xl py-2 pl-3 pr-10 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {searchTerm && filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>Aucun message ne correspond à votre recherche.</p>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          {isLoading && (
            <div className="flex justify-start mb-6 animate-pulse">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 mr-3"></div>
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 rounded-tl-none">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative group h-16 w-16 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  {att.mimeType.startsWith('image/') ? (
                    <img src={att.previewUrl} className="h-full w-full object-cover" />
                  ) : att.mimeType.startsWith('video/') ? (
                    <video src={att.previewUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <button 
                    onClick={() => removeAttachment(idx)}
                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
            <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 p-2 flex items-end shadow-sm">
              <div className="flex flex-col gap-1">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Joindre des fichiers"
                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button 
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? "Arrêter la dictée" : "Saisie vocale"}
                  className={`p-2 transition-all rounded-lg ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-red-500'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
              
              <input 
                type="file" 
                multiple
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*,application/pdf,text/*"
              />

              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                }}
                placeholder={isListening ? "Je vous écoute..." : "Posez votre question..."}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-1 text-sm max-h-32 min-h-[40px]"
                rows={1}
              />

              <div className="flex flex-col gap-1 px-1">
                <button 
                  type="button"
                  onClick={() => { setDetectionMode(!detectionMode); setOcrMode(false); }}
                  title="Détection d'objets"
                  className={`p-1.5 transition-all rounded-lg ${detectionMode ? 'bg-purple-100 text-purple-600' : 'text-slate-400 hover:text-purple-500'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button 
                  type="button"
                  onClick={() => { setOcrMode(!ocrMode); setDetectionMode(false); }}
                  title="Mode OCR"
                  className={`p-1.5 transition-all rounded-lg ${ocrMode ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
              className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 h-[48px] w-[48px] flex items-center justify-center shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
          
          <div className="flex items-center justify-between mt-3 px-1">
             <p className="text-[10px] text-slate-400">
              Gemini peut faire des erreurs.
            </p>
            <div className="flex gap-2">
              {isListening && (
                <span className="text-[10px] font-bold text-red-600 animate-pulse bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  Dictée en cours...
                </span>
              )}
              {ocrMode && (
                <span className="text-[10px] font-bold text-orange-600 animate-pulse bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                  OCR Actif
                </span>
              )}
              {detectionMode && (
                <span className="text-[10px] font-bold text-purple-600 animate-pulse bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                  Détection Active
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
