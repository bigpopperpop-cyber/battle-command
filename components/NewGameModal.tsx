
import React from 'react';
import { PLAYER_COLORS } from '../gameLogic';
import { Owner, AiDifficulty } from '../types';

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (playerCount: number, aiCount: number, names: Record<string, string>, difficulty: AiDifficulty) => void;
}

const NewGameModal: React.FC<NewGameModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [selectedCount, setSelectedCount] = React.useState(2);
  const [aiCount, setAiCount] = React.useState(0);
  const [difficulty, setDifficulty] = React.useState<AiDifficulty>('EASY');
  const [names, setNames] = React.useState<Record<string, string>>({
    P1: 'Commander One',
    P2: 'Commander Two'
  });

  const handleNameChange = (pId: string, val: string) => {
    setNames(prev => ({ ...prev, [pId]: val }));
  };

  const maxAi = selectedCount - 1;
  const effectiveAiCount = Math.min(aiCount, maxAi);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto glass-card rounded-[3rem] border-cyan-500/30 p-8 md:p-12 shadow-[0_0_100px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-2 tracking-tight italic">NEW GALAXY</h2>
          <p className="text-xs text-cyan-400 font-black uppercase tracking-[0.3em]">Configure Mission Parameters</p>
        </div>

        <div className="space-y-8">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block text-center">Command Count</label>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    setSelectedCount(count);
                    const newNames = { ...names };
                    for (let i = 1; i <= count; i++) {
                      if (!newNames[`P${i}`]) newNames[`P${i}`] = `Empire ${i}`;
                    }
                    setNames(newNames);
                    if (aiCount >= count) setAiCount(count - 1);
                  }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all border-2 ${
                    selectedCount === count 
                      ? 'bg-cyan-500/20 border-cyan-500 scale-105 shadow-lg shadow-cyan-500/20' 
                      : 'bg-slate-900/50 border-white/5 hover:border-white/20'
                  }`}
                >
                  <span className={`text-lg font-bold ${selectedCount === count ? 'text-white' : 'text-slate-500'}`}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block text-center">Empire Names</label>
            <div className="space-y-2">
              {Array.from({ length: selectedCount }).map((_, i) => {
                const pId = `P${i+1}`;
                return (
                  <div key={pId} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs" style={{ backgroundColor: PLAYER_COLORS[pId as Owner], color: '#000' }}>
                      {pId}
                    </div>
                    <input 
                      value={names[pId] || ''}
                      onChange={(e) => handleNameChange(pId, e.target.value)}
                      placeholder={`Name for ${pId}...`}
                      className="bg-transparent border-none outline-none text-sm font-bold text-white flex-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block text-center">AI Opponents</label>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3, 4].map((count) => {
                  const disabled = count >= selectedCount;
                  return (
                    <button
                      key={count}
                      disabled={disabled}
                      onClick={() => setAiCount(count)}
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all border-2 ${
                        disabled ? 'opacity-20 grayscale' :
                        aiCount === count 
                          ? 'bg-emerald-500/20 border-emerald-500 scale-105 shadow-lg shadow-emerald-500/20' 
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

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block text-center">AI Difficulty</label>
              <div className="flex justify-center gap-3">
                {(['EASY', 'ADVANCED'] as AiDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-3 px-4 rounded-xl flex flex-col items-center justify-center transition-all border-2 ${
                      difficulty === d 
                        ? 'bg-amber-500/20 border-amber-500 scale-105 shadow-lg shadow-amber-500/20 text-white' 
                        : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/20'
                    }`}
                  >
                    <span className="text-lg font-bold">{d === 'EASY' ? '🕊️' : '⚔️'}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{d === 'EASY' ? 'Casual' : 'Warlord'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-10">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:text-white transition-all">Cancel</button>
          <button 
            onClick={() => onConfirm(selectedCount, effectiveAiCount, names, difficulty)}
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
