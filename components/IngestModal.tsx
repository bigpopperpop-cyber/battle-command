
import React, { useState, useRef, useEffect } from 'react';
import { Owner } from '../types';
import { GoogleGenAI } from "@google/genai";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (data: string) => void;
  readyPlayers: Owner[];
}

const IngestModal: React.FC<IngestModalProps> = ({ isOpen, onClose, onIngest, readyPlayers }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    setIsScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        // Start "Artificial Intelligence" Vision Loop
        scanIntervalRef.current = window.setInterval(captureAndAnalyze, 4000);
      }
    } catch (err) {
      alert("Camera access denied or unavailable.");
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    
    // Use Gemini to "read" the QR code or text from the screen
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "Extract the alphanumeric string starting with 'COMMAND_DATA:' from this image. Only return the string, nothing else. If not found, return 'NOT_FOUND'." }
          ]
        }
      });

      const result = response.text?.trim();
      if (result && result !== 'NOT_FOUND' && result.includes('COMMAND_DATA:')) {
        onIngest(result);
        stopCamera();
      }
    } catch (e) {
      console.error("Optical Scan Error", e);
    }
  };

  if (!isOpen) return null;

  const handleIngest = () => {
    if (!input.trim()) return;
    try {
      onIngest(input);
      setInput('');
      setError(false);
    } catch (e) {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[3rem] border-cyan-500/30 p-8 shadow-[0_0_100px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-300 overflow-hidden">
        
        {isScanning && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col">
            <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* HUD Overlays */}
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
               <div className="w-full h-full border-2 border-cyan-500/50 rounded-3xl relative">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-400/30 animate-[scan_2s_infinite]" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-[10px] font-black text-cyan-400 tracking-widest uppercase animate-pulse">
                    Analyzing Optical Link...
                  </div>
               </div>
            </div>

            <button 
              onClick={stopCamera}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-red-500/20 hover:bg-red-500/40 border border-red-500 text-red-500 px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest transition-all"
            >
              Abort Optical Scan
            </button>
          </div>
        )}

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight italic">COMMS HUB</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Subspace Order Ingestion</p>
        </div>

        <div className="space-y-6">
          <button 
            onClick={startCamera}
            className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-3 border-2 border-white/10"
          >
            <span className="text-2xl">📷</span> SCAN ALLY SCREEN
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-[8px] font-black text-slate-600 uppercase tracking-[0.5em]">or manual entry</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste encrypted tactical code..."
              className="w-full h-24 bg-slate-950/50 border-none outline-none rounded-xl p-4 text-xs font-mono text-cyan-200 placeholder:text-slate-700 resize-none mb-3"
            />
            <button onClick={handleIngest} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-all">Merge Manual Feed</button>
            {error && <p className="text-[10px] text-red-400 mt-2 font-bold uppercase">Invalid Transmission Signature</p>}
          </div>

          <div className="pt-4 border-t border-white/5">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex justify-between">
              Status <span>{readyPlayers.length} / Units</span>
            </h4>
            <div className="flex gap-2 flex-wrap">
              {readyPlayers.map(p => (
                <div key={p} className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[10px] font-black uppercase tracking-tighter animate-pulse">
                  {p} LINKED
                </div>
              ))}
              {readyPlayers.length === 0 && <span className="text-[10px] text-slate-600 italic">Waiting for incoming links...</span>}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-3 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
        >
          Return to Bridge
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0% }
          50% { top: 100% }
          100% { top: 0% }
        }
      `}</style>
    </div>
  );
};

export default IngestModal;
