
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
  const [selectedP, setSelectedP] = useState<Owner>('P2');

  if (!isOpen) return null;

  const generateQuickLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?freq=${frequency}&role=${selectedP}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generateQuickLink());
    alert("QUICK-JOIN LINK COPIED!\nSend this to your friend and they'll be linked instantly.");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[3rem] border-cyan-500/20 p-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-1 italic tracking-tight">RECRUIT ALLIES</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Universal Deep-Link Interface</p>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-2xl border border-white/5 text-center mb-8">
           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Subspace Frequency</p>
           <h3 className="text-5xl font-black text-cyan-400 tracking-tighter mb-4 animate-pulse-cyan">{frequency}</h3>
           
           <div className="flex flex-col gap-2">
              <label className="text-[8px] font-black text-slate-600 uppercase">Target Empire for Invite:</label>
              <div className="flex justify-center gap-1">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    if (pId === 'P1') return null; // Host
                    const isAi = gameState.aiPlayers.includes(pId);
                    return (
                       <button 
                          key={pId}
                          disabled={isAi}
                          onClick={() => setSelectedP(pId)}
                          className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center font-black text-xs ${isAi ? 'opacity-20 grayscale' : selectedP === pId ? 'bg-white border-white text-black' : 'bg-slate-900 border-white/5'}`}
                          style={{ borderColor: isAi ? '#334155' : PLAYER_COLORS[pId] }}
                       >
                          {pId}
                       </button>
                    );
                 })}
              </div>
           </div>
        </div>

        <div className="space-y-3">
          <button onClick={handleCopyLink} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-cyan-800">
             COPY QUICK-JOIN LINK 🔗
          </button>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard.writeText(frequency); alert("Code Copied!"); }} className="flex-1 py-4 bg-white/5 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5">
               Copy Code Only
            </button>
            <button onClick={onClose} className="flex-1 py-4 bg-white/5 text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10">
               Return to Bridge
            </button>
          </div>
        </div>
        
        <p className="text-[8px] text-slate-500 italic mt-6 text-center leading-relaxed">
           Quick links automatically tune guest devices and select their empire role. <br/>Best for messaging apps!
        </p>
      </div>
    </div>
  );
};

export default InviteModal;
