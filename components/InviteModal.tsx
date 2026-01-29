
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

  const quickJoinUrl = `${window.location.origin}${window.location.pathname}?freq=${frequency}&role=${selectedP}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=000000&bgcolor=ffffff&margin=15&ecc=L&data=${encodeURIComponent(quickJoinUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(quickJoinUrl);
    alert("QUICK-JOIN LINK COPIED!\nSend this to your friend and they'll be linked instantly.");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-md glass-card rounded-[3.5rem] border-cyan-500/20 p-8 shadow-[0_0_120px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-1 italic tracking-tight">RECRUIT ALLIES</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Neural Link Sync</p>
        </div>

        {/* Selection Area */}
        <div className="bg-slate-900/50 p-4 rounded-3xl border border-white/5 mb-6">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Assign Empire Slot</p>
           <div className="flex justify-center gap-1.5 flex-wrap">
              {Array.from({length: gameState.playerCount}).map((_, i) => {
                 const pId = `P${i+1}` as Owner;
                 if (pId === 'P1') return null; // Host
                 const isAi = gameState.aiPlayers.includes(pId);
                 const isReady = gameState.readyPlayers.includes(pId);
                 
                 return (
                    <button 
                       key={pId}
                       disabled={isAi}
                       onClick={() => setSelectedP(pId)}
                       className={`w-12 h-12 rounded-2xl border-2 transition-all flex flex-col items-center justify-center ${isAi ? 'opacity-20 grayscale cursor-not-allowed' : selectedP === pId ? 'bg-white border-white text-black' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                       style={{ borderColor: isAi ? '#334155' : (selectedP === pId ? '#fff' : PLAYER_COLORS[pId]) }}
                    >
                       <span className="text-xs font-black">{pId}</span>
                       {isReady && <div className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />}
                    </button>
                 );
              })}
           </div>
        </div>

        {/* QR Code Display */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-white rounded-[2.5rem] border-[4px] border-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.1)] animate-pulse-cyan">
            <img 
              src={qrUrl} 
              alt="Join QR" 
              className="w-48 h-48 sm:w-56 sm:h-56" 
              style={{ imageRendering: 'pixelated' }} 
            />
          </div>
          <div className="mt-4 text-center">
            <p className="text-[10px] font-black text-white uppercase tracking-widest">SCAN TO JOIN AS {selectedP}</p>
            <p className="text-[9px] text-slate-500 italic mt-1 leading-tight">No code entry required via camera link.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button 
            onClick={handleCopyLink} 
            className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-cyan-800 flex items-center justify-center gap-2"
          >
             <span>COPY QUICK-JOIN LINK</span>
             <span className="text-lg">🔗</span>
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={() => { navigator.clipboard.writeText(frequency); alert("Subspace Frequency Copied!"); }} 
              className="flex-1 py-4 bg-slate-900 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 active:bg-slate-800"
            >
               Code: {frequency}
            </button>
            <button 
              onClick={onClose} 
              className="flex-1 py-4 bg-white/5 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/10 active:bg-white/10"
            >
               Back to Bridge
            </button>
          </div>
        </div>
        
        <p className="text-[8px] text-slate-600 italic mt-6 text-center leading-relaxed px-4">
           Quick-Join links automatically bypass the tuning station and configure the neural interface for the target player.
        </p>
      </div>
    </div>
  );
};

export default InviteModal;
