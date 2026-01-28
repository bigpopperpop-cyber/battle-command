
import React from 'react';

interface OrderQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  playerName: string;
}

const OrderQrModal: React.FC<OrderQrModalProps> = ({ isOpen, onClose, orderCode, playerName }) => {
  if (!isOpen) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&color=000000&bgcolor=ffffff&margin=20&ecc=L&data=${encodeURIComponent(orderCode)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(orderCode);
    alert("Tactical Code Copied!");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[4rem] border-emerald-500/20 p-10 shadow-[0_0_120px_rgba(16,185,129,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-2 italic">TACTICAL LINK</h2>
          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.4em]">Visual Order Transmission</p>
        </div>

        <div className="flex flex-col items-center gap-8 mb-10">
          <div className="p-5 bg-white rounded-[3rem] border-[6px] border-white shadow-2xl">
            <img src={qrUrl} alt="Order QR" className="w-56 h-56" style={{ imageRendering: 'pixelated' }} />
          </div>
          <div className="text-center px-6">
            <p className="text-xs text-white font-black uppercase tracking-widest mb-2">SOURCE: {playerName}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed italic">
              Show this screen to the Host's camera. 
              They must select <span className="text-emerald-400 font-bold">"SCAN ALLY SCREEN"</span> in their Command Hub.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={handleCopy} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all active:scale-95">
            Copy Manual Code
          </button>
          <button onClick={onClose} className="w-full py-4 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest">
            Back to Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderQrModal;
