
import React from 'react';
import { PLAYER_COLORS } from '../gameLogic';
import { Owner } from '../types';

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (playerCount: number, aiCount: number) => void;
}

const NewGameModal: React.FC<NewGameModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [selectedCount, setSelectedCount] = React.useState(2);
  const [aiCount, setAiCount] = React.useState(0);

  // Ensure AI count doesn't exceed total players - 1 (need at least 1 human)
  const maxAi = selectedCount - 1;
  const effectiveAiCount = Math.min(aiCount, maxAi);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-xl glass-card rounded-[3rem] border-cyan-500/30 p-8 md:p-12 shadow-[0_0_100px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-white mb-2 tracking-tight italic">NEW GALAXY</h2>
          <p className="text-xs text-cyan-400 font-black uppercase tracking-[0.3em]">Configure Mission Parameters</p>
        </div>

        <div className="space-y-10">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 block text-center">Total Commanders (Players + AI)</label>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
              {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    setSelectedCount(count);
                    if (aiCount >= count) setAiCount(count - 1);
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${
                    selectedCount === count 
                      ? 'bg-cyan-500/20 border-cyan-500 scale-110 shadow-lg shadow-cyan-500/20' 
                      : 'bg-slate-900/50 border-white/5 hover:border-white/20'
                  }`}
                >
                  <span className={`text-xl font-bold ${selectedCount === count ? 'text-white' : 'text-slate-500'}`}>{count}</span>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({length: count}).map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1 h-1 rounded-full" 
                        style={{ backgroundColor: PLAYER_COLORS[`P${i+1}` as Owner] }} 
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 block text-center">AI Opponents (0-4)</label>
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3, 4].map((count) => {
                const disabled = count >= selectedCount;
                return (
                  <button
                    key={count}
                    disabled={disabled}
                    onClick={() => setAiCount(count)}
                    className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${
                      disabled ? 'opacity-20 cursor-not-allowed grayscale' :
                      aiCount === count 
                        ? 'bg-emerald-500/20 border-emerald-500 scale-110' 
                        : 'bg-slate-900/50 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="text-lg font-bold">🤖</span>
                    <span className="text-[10px] font-black">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-3xl p-6 my-10 border border-white/5 text-center">
          <div className="text-xs text-slate-400 mb-1">Mission Preview</div>
          <div className="text-sm font-bold text-slate-200">
            {selectedCount - effectiveAiCount} Human • {effectiveAiCount} AI • 24 Star Systems
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(selectedCount, effectiveAiCount)}
            className="flex-[2] py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
          >
            Launch Mission
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGameModal;
