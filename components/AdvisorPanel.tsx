
import React, { useState, useEffect, useRef } from 'react';
import { GameState, AdvisorMessage } from '../types';
import { getAdvisorFeedback } from '../services/geminiService';

interface AdvisorPanelProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
}

const AdvisorPanel: React.FC<AdvisorPanelProps> = ({ gameState, isOpen, onClose }) => {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    { role: 'assistant', content: "Hello Commander! I'm Admiral Jarvis. Don't worry about the technical details—I'll help you rule the galaxy. You can ask me things like 'What should I build?' or 'How do I win?'" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
    setIsTyping(true);
    const feedback = await getAdvisorFeedback(gameState, userMsg);
    setIsTyping(false);
    
    setMessages(prev => [...prev, { role: 'assistant', content: feedback }]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg glass-card rounded-[2.5rem] flex flex-col h-[70vh] shadow-[0_0_100px_rgba(34,211,238,0.2)] border-white/10 overflow-hidden">
        {/* Advisor Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-cyan-500 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-cyan-400 shadow-lg shadow-cyan-500/20">
              <img src="https://picsum.photos/seed/jarvis/150/150" alt="Jarvis" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Admiral Jarvis</h3>
              <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-black">AI Strategic Concierge</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">✕</button>
        </div>

        {/* Chat Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-cyan-600 text-white rounded-tr-none shadow-xl shadow-cyan-900/20' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-800 p-4 rounded-3xl rounded-tl-none animate-pulse text-xs text-slate-400 flex items-center gap-2">
                <span className="flex gap-1"><span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" /><span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" /><span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" /></span>
                Analyzing sector sensors...
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-6 bg-slate-900/60 border-t border-white/5 flex gap-3 items-center">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything, Commander..."
            className="flex-1 bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-cyan-500 text-white outline-none placeholder:text-slate-500 shadow-inner"
          />
          <button 
            onClick={handleSend}
            className="bg-cyan-500 hover:bg-cyan-400 text-white w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-cyan-500/30 active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvisorPanel;
