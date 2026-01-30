
import React, { useState, useRef, useEffect } from 'react';
import { Owner } from '../types';
import jsQR from 'jsqr';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (data: string) => void;
  readyPlayers: Owner[];
  frequency: string;
}

const IngestModal: React.FC<IngestModalProps> = ({ isOpen, onClose, onIngest, readyPlayers, frequency }) => {
  const [input, setInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrame: number;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsScanning(true);
          scan();
        }
      } catch (err) {
        console.error("Camera access failed", err);
      }
    };

    const scan = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.height = videoRef.current.videoHeight;
          canvas.width = videoRef.current.videoWidth;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            onIngest(code.data);
            onClose();
            return;
          }
        }
      }
      animationFrame = requestAnimationFrame(scan);
    };

    if (isOpen) startCamera();

    return () => {
      cancelAnimationFrame(animationFrame);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[3rem] border-cyan-500/30 p-10 shadow-[0_0_100px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight italic">TACTICAL INGEST</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Pointing sensor at source device...</p>
        </div>

        <div className="relative aspect-square w-full bg-black rounded-[2rem] overflow-hidden border border-white/10 mb-8">
           <video ref={videoRef} className="w-full h-full object-cover" />
           <canvas ref={canvasRef} className="hidden" />
           <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
              <div className="w-full h-full border-2 border-cyan-500/30 relative">
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400" />
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400" />
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400" />
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400" />
                 <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/50 shadow-[0_0_10px_red] animate-pulse" style={{ transform: 'translateY(-50%)' }} />
              </div>
           </div>
        </div>

        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
          <h5 className="text-[9px] font-black text-slate-600 uppercase mb-3">Manual Override</h5>
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste tactical code..."
              className="flex-1 bg-black/40 border-none outline-none rounded-xl px-4 text-[10px] font-mono text-cyan-400"
            />
            <button 
              onClick={() => { onIngest(input); onClose(); }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Inject
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-6 py-3 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">Abort Scan</button>
      </div>
    </div>
  );
};

export default IngestModal;
