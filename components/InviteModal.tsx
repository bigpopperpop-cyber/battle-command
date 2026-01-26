import React, { useState } from 'react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  joinUrl: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, joinUrl }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use low error correction (ecc=L) to keep the QR pattern as "chunkier" and easier to scan for long URLs
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&color=000000&bgcolor=ffffff&margin=20&ecc=L&data=${encodeURIComponent(joinUrl)}`;

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-md glass-card rounded-[3rem] border-cyan-500/30 p-8 shadow-[0_0_100px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight italic">INVITE ALLIES</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Sector Recruitment Protocol</p>
        </div>

        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="p-4 bg-white rounded-3xl border-4 border-white shadow-2xl flex items-center justify-center">
            <img 
              src={qrUrl} 
              alt="Join QR Code" 
              className="w-64 h-64 rounded-lg"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center px-4 leading-relaxed">
            Scan this code with your camera or share the direct link to bring your allies into this sector.
          </p>
        </div>

        <div className="space-y-3">
          <button 
            onClick={handleShare}
            className={`w-full py-4 rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
              copied ? 'bg-emerald-600 shadow-emerald-900/40' : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/40'
            }`}
          >
            {copied ? (
              <><span>✅</span> Link Copied!</>
            ) : (
              <><span>🔗</span> {navigator.share ? 'Share Invite Link' : 'Copy Invite Link'}</>
            )}
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