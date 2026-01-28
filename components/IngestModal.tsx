
import React, { useState } from 'react';
import { Owner } from '../types';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (data: string) => void;
  readyPlayers: Owner[];
  frequency: string;
}

const IngestModal: React.FC<IngestModalProps> = ({ isOpen, onClose, onIngest, readyPlayers, frequency }) => {
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[3rem] border-cyan-500/30 p-10 shadow-[0_0_100px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-300 overflow-hidden">
        
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight italic">SUBSPACE MONITOR</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Frequency {frequency} MHz // ACTIVE</p>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900/80 p-6 rounded-[2rem] border border-white/5">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex justify-between">
              Linked Command Units <span>{readyPlayers.length} / Units Ready</span>
            </h4>
            
            <div className="space-y-3">
              {readyPlayers.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 border-2 border-slate-800 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest animate-pulse">Waiting for tactical burst...</p>
                </div>
              ) : (
                readyPlayers.map(p => (
                  <div key={p} className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                      <span className="text-xs font-black text-white">{p} EMPIRE</span>
                    </div>
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">DATA MERGED</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
            <h5 className="text-[9px] font-black text-slate-600 uppercase mb-3">Manual Override</h5>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste tactical code here if subspace is unstable..."
              className="w-full h-20 bg-black/40 border-none outline-none rounded-xl p-3 text-[10px] font-mono text-cyan-400 placeholder:text-slate-800 resize-none mb-3"
            />
            <button 
              onClick={() => { onIngest(input); setInput(''); }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Emergency Data Inject
            </button>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 py-3 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
        >
          Close Subspace Relay
        </button>
      </div>
    </div>
  );
};

export default IngestModal;
