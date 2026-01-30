
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

  const quickJoinUrl = `${window.location.origin}${window.location.pathname}?gameId=${frequency}&role=${selectedP}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=000000&bgcolor=ffffff&margin=15&ecc=L&data=${encodeURIComponent(quickJoinUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(quickJoinUrl);
    alert("LINK COPIED TO CLOAKED CHANNEL");
  };

  const handleSystemShare = async () => {
    const shareData = {
      title: 'Stellar Commander Recruitment',
      text: `Admiral, join our fleet in Sector ${frequency} as ${selectedP}!`,
      url: quickJoinUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Sharing failed", err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-md glass-card rounded-[3.5rem] border-cyan-500/20 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-1 italic tracking-tight uppercase">Recruitment Portal</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Sector Signature: {frequency}</p>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-3xl border border-white/5 mb-6 text-center">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Select Empire Slot</p>
           <div className="flex justify-center gap-1.5 flex-wrap">
              {Array.from({length: gameState.playerCount}).map((_, i) => {
                 const pId = `P${i+1}` as Owner;
                 if (pId === 'P1') return null;
                 return (
                    <button 
                       key={pId}
                       onClick={() => setSelectedP(pId)}
                       className={`w-12 h-12 rounded-2xl border-2 transition-all flex items-center justify-center font-black text-xs ${selectedP === pId ? 'bg-white border-white text-black' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                       style={{ borderColor: selectedP === pId ? '#fff' : PLAYER_COLORS[pId] }}
                    >
                       {pId}
                    </button>
                 );
              })}
           </div>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-white rounded-[2.5rem] border-[4px] border-cyan-500/30 shadow-2xl">
            <img src={qrUrl} alt="Join QR" className="w-48 h-48" />
          </div>
          <p className="mt-4 text-[10px] font-black text-white uppercase tracking-widest">Point ally sensors here (P2-P8)</p>
        </div>

        <div className="space-y-2">
          <button onClick={handleSystemShare} className="w-full py-5 bg-cyan-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest border-b-4 border-cyan-800 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-cyan-900/40">
             <span>📲</span> Share via Text / Apps
          </button>
          <button onClick={handleCopyLink} className="w-full py-4 bg-slate-900 text-slate-300 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] border border-white/5 transition-all active:scale-95">
             Copy Digital Link 🔗
          </button>
          <button onClick={onClose} className="w-full py-4 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest">
             Return to Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
