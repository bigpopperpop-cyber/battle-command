
import React, { useState } from 'react';
import { GameState, Owner } from '../types';
import { PLAYER_COLORS } from '../gameLogic';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  frequency: string;
  gameState: GameState;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, frequency, gameState }) => {
  const [selectedP, setSelectedP] = useState<Owner>('P1');

  if (!isOpen) return null;

  const handleCopyFreq = () => {
    navigator.clipboard.writeText(frequency);
    alert("Frequency Copied!");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[4rem] border-cyan-500/20 p-10 shadow-[0_0_120px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-2 italic">EMPIRE RELAY</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em]">Subspace Frequency Configuration</p>
        </div>

        <div className="bg-slate-900/80 p-8 rounded-[3rem] border border-white/5 text-center mb-8">
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Frequency</p>
           <h3 className="text-6xl font-black text-cyan-400 tracking-tighter mb-4 animate-pulse-cyan">{frequency} <span className="text-xl text-slate-600">MHz</span></h3>
           <p className="text-xs text-slate-400 max-w-[200px] mx-auto leading-relaxed">
             Ask your allies to enter this code on their bridge to link their systems.
           </p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-8">
           {Array.from({length: gameState.playerCount}).map((_, i) => {
             const pId = `P${i+1}` as Owner;
             const isAi = gameState.aiPlayers.includes(pId);
             const isActive = selectedP === pId;
             return (
               <button 
                 key={pId}
                 disabled={isAi}
                 onClick={() => setSelectedP(pId)}
                 className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${isAi ? 'opacity-20 grayscale' : isActive ? 'bg-white/5 border-white scale-105' : 'bg-white/5 border-white/5'}`}
                 style={{ color: isAi ? '#475569' : PLAYER_COLORS[pId] }}
               >
                 <span className="text-lg font-black">{pId}</span>
                 <span className="text-[6px] font-bold text-white/40 uppercase">{isAi ? 'AI' : 'LINK'}</span>
               </button>
             );
           })}
        </div>

        <div className="space-y-3">
          <button onClick={handleCopyFreq} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-cyan-900/40 transition-all active:scale-95">
            Copy Frequency Code
          </button>
          <button onClick={onClose} className="w-full py-4 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest">
            Back to Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
