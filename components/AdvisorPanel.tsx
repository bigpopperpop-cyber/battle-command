
import React, { useState, useRef, useEffect } from 'react';
import { GameState } from '../types';
import { getAdvisorFeedback } from '../services/geminiService';

interface AdvisorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
}

const AdvisorPanel: React.FC<AdvisorPanelProps> = ({ isOpen, onClose, gameState }) => {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Command center is live. How can I assist you, Admiral?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    const reply = await getAdvisorFeedback(gameState, msg);
    setLoading(false);
    setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm safe-pt safe-pb">
      <div className="w-full max-w-lg glass-card rounded-[2.5rem] h-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center text-xl border border-cyan-400">🤖</div>
            <div>
              <h3 className="text-sm font-bold text-white italic leading-tight">Admiral Jarvis</h3>
              <p className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Sector Intel</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-[9px] text-cyan-500 animate-pulse uppercase font-black">Accessing mainframe...</div>}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-slate-900/60 border-t border-white/5 flex gap-2 shrink-0">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Query Jarvis..."
            className="flex-1 bg-slate-800 border-none rounded-xl px-4 text-xs focus:ring-1 focus:ring-cyan-500 text-white outline-none"
          />
          <button onClick={handleSend} className="bg-cyan-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-bold">🚀</button>
        </div>
      </div>
    </div>
  );
};

export default AdvisorPanel;
