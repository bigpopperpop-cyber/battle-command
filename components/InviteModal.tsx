
import React from 'react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  joinUrl: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, joinUrl }) => {
  if (!isOpen) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=22d3ee&bgcolor=0f172a&data=${encodeURIComponent(joinUrl)}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Galaxy in Stellar Commander',
          text: "I'm hosting a galaxy! Tap the link or scan the QR code to join the mission.",
          url: joinUrl
        });
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      navigator.clipboard.writeText(joinUrl);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-md glass-card rounded-[3rem] border-cyan-500/30 p-8 shadow-[0_0_100px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight italic">INVITE ALLIES</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Sector Recruitment Protocol</p>
        </div>

        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="p-4 bg-slate-900 rounded-[2rem] border border-cyan-500/20 shadow-inner">
            <img 
              src={qrUrl} 
              alt="Join QR Code" 
              className="w-48 h-48 rounded-xl"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center px-4 leading-relaxed">
            Friends can scan this QR code or use the link below to join your session on their devices.
          </p>
        </div>

        <div className="space-y-3">
          <button 
            onClick={handleShare}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>🔗</span> {navigator.share ? 'Share Invite Link' : 'Copy Invite Link'}
          </button>
          
          <button 
            onClick={onClose}
            className="w-full py-3 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            Back to Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
