
import React, { useState } from 'react';
import { Owner } from '../types';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (data: string) => void;
  readyPlayers: Owner[];
}

const IngestModal: React.FC<IngestModalProps> = ({ isOpen, onClose, onIngest, readyPlayers }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

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
      
      <div className="relative w-full max-w-lg glass-card rounded-[3rem] border-cyan-500/30 p-8 shadow-[0_0_100px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight italic">INCOMING FEED</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Subspace Order Ingestion</p>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Paste Transmission Code</label>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="COMMAND_DATA:..."
              className="w-full h-32 bg-slate-950/50 border-none outline-none rounded-xl p-4 text-xs font-mono text-cyan-200 placeholder:text-slate-700 resize-none"
            />
            {error && <p className="text-[10px] text-red-400 mt-2 font-bold uppercase">Invalid Transmission Signature</p>}
          </div>

          <div className="flex gap-3">
             <button 
              onClick={handleIngest}
              className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
            >
              Merge Orders
            </button>
          </div>

          <div className="pt-4 border-t border-white/5">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Deployment Status</h4>
            <div className="flex gap-2 flex-wrap">
              {readyPlayers.map(p => (
                <div key={p} className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 text-[10px] font-black uppercase tracking-tighter animate-pulse">
                  {p} RECEIVED
                </div>
              ))}
              {readyPlayers.length === 0 && <span className="text-[10px] text-slate-600 italic">Waiting for incoming transmissions...</span>}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-3 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
        >
          Close Comms Hub
        </button>
      </div>
    </div>
  );
};

export default IngestModal;
