
import React from 'react';
import { Planet, Ship, Owner, ShipType } from '../types';
import { PLAYER_COLORS, SHIP_STATS, MAX_FACTORIES, MAX_MINES, SHIP_COSTS } from '../gameLogic';

interface SelectionPanelProps {
  selection: Planet | Ship | null;
  onClose: () => void;
  playerRole: Owner | null;
  credits: number;
  onIssueOrder: (type: 'BUILD_MINE' | 'BUILD_FACTORY' | 'BUILD_SHIP' | 'SET_COURSE', payload?: any) => void;
  isSettingCourse: boolean;
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({ 
  selection, onClose, playerRole, credits, onIssueOrder, isSettingCourse 
}) => {
  if (!selection) return null;

  const isPlanet = 'population' in selection;
  const isMine = selection.owner === playerRole;
  const pColor = PLAYER_COLORS[selection.owner];

  return (
    <div className="fixed right-8 top-24 bottom-24 w-80 glass-card rounded-[3rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-white/5 bg-slate-900/40">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold italic text-white uppercase">{selection.name}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pColor }} />
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
             {selection.owner === 'NEUTRAL' ? 'Neutral Territory' : `${selection.owner} Controlled`}
           </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {isPlanet ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Pop</span>
                <span className="text-lg font-bold">{selection.population}</span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Defense</span>
                <span className="text-lg font-bold">{selection.defense}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                <span>Infrastructure</span>
                <span>{selection.mines + selection.factories} / 15</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500" style={{ width: `${((selection.mines+selection.factories)/15)*100}%` }} />
              </div>
            </div>

            {isMine && (
              <div className="pt-4 space-y-2">
                <button 
                  disabled={credits < 500 || selection.mines >= MAX_MINES}
                  onClick={() => onIssueOrder('BUILD_MINE')}
                  className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/30 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20"
                >
                  Build Mine ($500)
                </button>
                <button 
                  disabled={credits < 800 || selection.factories >= MAX_FACTORIES}
                  onClick={() => onIssueOrder('BUILD_FACTORY')}
                  className="w-full py-3 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-600/30 text-cyan-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20"
                >
                  Build Factory ($800)
                </button>
                
                {selection.factories > 0 && (
                  <div className="pt-4 space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase text-center mb-2">Shipyard Construction</p>
                    {(['SCOUT', 'FREIGHTER', 'WARSHIP'] as ShipType[]).map(type => (
                      <button 
                        key={type}
                        disabled={credits < SHIP_COSTS[type]}
                        onClick={() => onIssueOrder('BUILD_SHIP', { type })}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex justify-between px-4"
                      >
                        <span>{type}</span>
                        <span className="text-slate-500">${SHIP_COSTS[type]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase">Hull Integrity</span>
                 <span className="text-xs font-bold">{selection.hp} / {selection.maxHp}</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(selection.hp/selection.maxHp)*100}%` }} />
              </div>
            </div>

            {isMine && (
              <button 
                onClick={() => onIssueOrder('SET_COURSE')}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  isSettingCourse 
                    ? 'bg-amber-500 text-black animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.4)]' 
                    : 'bg-cyan-600 text-white shadow-xl shadow-cyan-900/40'
                }`}
              >
                {isSettingCourse ? 'SELECT TARGET PLANET' : 'ENGAGE NAV-COMPUTER'}
              </button>
            )}
            
            <div className="space-y-2">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Specifications</p>
               <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-900/50 rounded-xl text-center">
                     <span className="block text-[8px] text-slate-600 uppercase font-black">Speed</span>
                     <span className="text-xs font-bold">{selection.speed} LY/T</span>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-xl text-center">
                     <span className="block text-[8px] text-slate-600 uppercase font-black">Attack</span>
                     <span className="text-xs font-bold">{selection.attack} MW</span>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-900/40 border-t border-white/5 text-center">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
          Tactical data synced via<br/>Galaxy Frequency HUB
        </p>
      </div>
    </div>
  );
};

export default SelectionPanel;
