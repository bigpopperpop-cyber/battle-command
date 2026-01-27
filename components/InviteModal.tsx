
import React, { useState } from 'react';
import { GameState, Owner } from '../types';
import { PLAYER_COLORS } from '../gameLogic';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  joinUrl: string;
  gameState: GameState;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, joinUrl, gameState }) => {
  const [selectedP, setSelectedP] = useState<Owner>('P1');

  if (!isOpen) return null;

  // Include the role and the base state hash in the join link
  const stateHash = btoa(JSON.stringify({
    sd: gameState.seed, 
    rd: gameState.round, 
    pc: gameState.playerCount, 
    ai: gameState.aiPlayers, 
    cr: gameState.playerCredits, 
    nm: gameState.playerNames, 
    ps: gameState.planets.map(p => [p.owner, p.mines, p.factories]), 
    ss: gameState.ships.map(s => ({id: s.id, n: s.name, t: s.type, o: s.owner, x: Math.round(s.x), y: Math.round(s.y), st: s.status, tp: s.targetPlanetId, cp: s.currentPlanetId}))
  }));
  
  const empireJoinUrl = `${joinUrl}?role=${selectedP}#join=${stateHash}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&color=000000&bgcolor=ffffff&margin=20&ecc=L&data=${encodeURIComponent(empireJoinUrl)}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Command ${gameState.playerNames[selectedP]}`,
          text: `Join the War Room! Take control of the ${gameState.playerNames[selectedP]} from your phone.`,
          url: empireJoinUrl
        });
      } catch (err) { console.log(err); }
    } else {
      navigator.clipboard.writeText(empireJoinUrl);
      alert("Empire Data Link Copied!");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[4rem] border-cyan-500/20 p-10 shadow-[0_0_120px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-2 italic">EMPIRE RELAY</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em]">Subspace Communication Hub</p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-10">
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

        <div className="flex flex-col items-center gap-8 mb-10">
          <div className="p-5 bg-white rounded-[3rem] border-[6px] border-white shadow-2xl">
            <img src={qrUrl} alt="Join QR" className="w-56 h-56" style={{ imageRendering: 'pixelated' }} />
          </div>
          <div className="text-center px-6">
            <p className="text-xs text-white font-black uppercase tracking-widest mb-2">TARGET: {gameState.playerNames[selectedP]}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed italic">Scan this code to link a tactical device to this specific empire. This link contains the current galactic snapshot.</p>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={handleShare} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-cyan-900/40 transition-all active:scale-95">
            Share Link with Ally
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
