
import React, { useState, useEffect, useRef } from 'react';
import { GameState, AdvisorMessage } from '../types';
import { getAdvisorFeedback } from '../services/geminiService';

interface AdvisorPanelProps {
  gameState: GameState;
  isOpen: boolean;
}

const AdvisorPanel: React.FC<AdvisorPanelProps> = ({ gameState, isOpen }) => {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    { role: 'assistant', content: "Welcome back, Admiral. I've analyzed our sector. Rigel VII is secure, but our scouts should head out to find more resources. How can I help today?" }
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
    <div className="fixed bottom-24 right-4 left-4 md:left-auto md:w-96 glass-card rounded-2xl flex flex-col h-[500px] z-50 shadow-2xl border-cyan-500/30">
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center overflow-hidden border-2 border-cyan-400">
          <img src="https://picsum.photos/seed/admiral/100/100" alt="Admiral" />
        </div>
        <div>
          <h3 className="font-bold text-cyan-400">Admiral Jarvis</h3>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Tactical AI Advisor</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              m.role === 'user' 
                ? 'bg-cyan-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none animate-pulse text-xs text-slate-400">
              Analyzing sector data...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900/50 flex gap-2 rounded-b-2xl">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Jarvis anything..."
          className="flex-1 bg-slate-800 border-none rounded-full px-4 text-sm focus:ring-2 focus:ring-cyan-500 text-white outline-none"
        />
        <button 
          onClick={handleSend}
          className="bg-cyan-500 hover:bg-cyan-400 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg shadow-cyan-500/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        </button>
      </div>
    </div>
  );
};

export default AdvisorPanel;
