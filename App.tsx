import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Mic, Square } from 'lucide-react';
import { Message, MessageRole, ContentType } from './types';
import MessageBubble from './components/MessageBubble';
import TypingIndicator from './components/TypingIndicator';
import { sendMessage, initializeChat, GeminiLive } from './services/gemini';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveClientRef = useRef<GeminiLive | null>(null);

  // Initialize chat on mount
  useEffect(() => {
    initializeChat();
    setMessages([
      {
        id: 'init',
        role: MessageRole.MODEL,
        type: ContentType.TEXT,
        content: "Hello! I am your Universal AI Assistant. I can create images, generate code, and summarize text. How can I help you today?",
        timestamp: Date.now()
      }
    ]);

    // Cleanup live client on unmount
    return () => {
      liveClientRef.current?.disconnect();
    };
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isVoiceActive]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      type: ContentType.TEXT,
      content: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const handleImageGenerated = (imageData: string) => {
        const imageMsg: Message = {
          id: Date.now().toString() + '-img',
          role: MessageRole.MODEL,
          type: ContentType.IMAGE,
          content: imageData,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, imageMsg]);
      };

      const responseText = await sendMessage(userText, handleImageGenerated);

      if (responseText && responseText.trim()) {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: MessageRole.MODEL,
          type: ContentType.TEXT,
          content: responseText,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (error) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        type: ContentType.TEXT,
        content: "I apologize, but I encountered an error processing your request.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceMode = async () => {
    if (isVoiceActive) {
      // Stop Voice
      liveClientRef.current?.disconnect();
      setIsVoiceActive(false);
    } else {
      // Start Voice
      try {
        setIsVoiceActive(true); // Optimistic update
        
        if (!liveClientRef.current) {
          liveClientRef.current = new GeminiLive(
            (userText, modelText, isFinal) => {
              // Update UI with streaming transcripts
              setMessages(prev => {
                const last = prev[prev.length - 1];
                const now = Date.now();
                const newMessages = [...prev];
                
                // Handle User Text
                if (userText) {
                  const lastMsg = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;
                  if (lastMsg && lastMsg.role === MessageRole.USER && lastMsg.id === 'live-user') {
                    lastMsg.content = userText;
                  } else if (!lastMsg || lastMsg.role !== MessageRole.USER || lastMsg.id !== 'live-user') {
                     if (lastMsg?.id === 'live-model') {
                        newMessages.push({
                          id: 'live-user',
                          role: MessageRole.USER,
                          type: ContentType.TEXT,
                          content: userText,
                          timestamp: now
                        });
                     } else if (lastMsg?.id === 'live-user') {
                       lastMsg.content = userText;
                     } else {
                       newMessages.push({
                          id: 'live-user',
                          role: MessageRole.USER,
                          type: ContentType.TEXT,
                          content: userText,
                          timestamp: now
                        });
                     }
                  }
                }
                
                // Handle Model Text
                if (modelText) {
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg && lastMsg.role === MessageRole.MODEL && lastMsg.id === 'live-model') {
                    lastMsg.content = modelText;
                  } else {
                    newMessages.push({
                      id: 'live-model',
                      role: MessageRole.MODEL,
                      type: ContentType.TEXT,
                      content: modelText,
                      timestamp: now
                    });
                  }
                }
                
                // If final, finalize IDs so next turn creates new bubbles
                if (isFinal) {
                   return newMessages.map(m => {
                     if (m.id === 'live-user') return { ...m, id: `final-${now}-user` };
                     if (m.id === 'live-model') return { ...m, id: `final-${now}-model` };
                     return m;
                   });
                }
                
                return newMessages;
              });
            },
            (imageData) => {
              const imageMsg: Message = {
                id: Date.now().toString() + '-img',
                role: MessageRole.MODEL,
                type: ContentType.IMAGE,
                content: imageData,
                timestamp: Date.now(),
              };
              setMessages(prev => [...prev, imageMsg]);
            },
            (active) => setIsVoiceActive(active)
          );
        }
        
        await liveClientRef.current.connect(selectedVoice);
        
      } catch (error) {
        console.error("Failed to start voice:", error);
        setIsVoiceActive(false);
        alert("Could not access microphone. Please ensure permissions are granted.");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="flex items-center px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-sm sticky top-0 z-10 justify-between">
        <div className="flex items-center">
          <div className="p-2 bg-indigo-600 rounded-lg mr-3 shadow-lg shadow-indigo-500/20">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">Universal AI Assistant</h1>
            <p className="text-xs text-slate-400">Powered by Gemini 2.5 & Imagen</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Voice Selector */}
          <div className="flex items-center gap-2">
             <span className="text-xs text-slate-500 font-medium uppercase hidden md:block">Voice Model</span>
             <select 
              value={selectedVoice} 
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-slate-800 text-slate-300 text-xs border border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer hover:bg-slate-700"
              disabled={isVoiceActive}
              title="Select Voice Model"
            >
              {VOICES.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {isVoiceActive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full animate-fadeIn">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-medium text-red-400 whitespace-nowrap">Live Active</span>
            </div>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 container mx-auto max-w-4xl">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 md:p-6 bg-slate-900 border-t border-slate-800">
        <div className="container mx-auto max-w-4xl relative">
          <div className={`relative flex items-end gap-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-2 transition-all duration-200 shadow-sm ${isVoiceActive ? 'ring-1 ring-red-500/50 border-red-500/30' : 'focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500'}`}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isVoiceActive ? "Listening... (Voice Mode Active)" : "Type a message, ask for code, or describe an image..."}
              disabled={isVoiceActive}
              className={`w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm md:text-base p-3 max-h-32 min-h-[52px] resize-none focus:outline-none custom-scrollbar ${isVoiceActive ? 'opacity-50 cursor-not-allowed' : ''}`}
              rows={1}
              style={{ height: 'auto', minHeight: '52px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
            />
            
            {/* Voice Toggle Button */}
            <button
              onClick={toggleVoiceMode}
              className={`flex-shrink-0 p-3 rounded-xl transition-all mb-0.5 shadow-lg ${
                isVoiceActive 
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20 animate-pulse' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
              title={isVoiceActive ? "Stop Voice Mode" : "Start Voice Mode"}
            >
              {isVoiceActive ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
            </button>

            {/* Send Button */}
            {!isVoiceActive && (
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="flex-shrink-0 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-0.5 shadow-lg shadow-indigo-900/20"
              >
                <Send size={20} />
              </button>
            )}
          </div>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
              Image • Code • Summary • Voice
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;