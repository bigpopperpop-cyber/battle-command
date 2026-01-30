
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
    <div className="fixed right-4 left-4 bottom-32 md:left-auto md:right-8 md:top-24 md:bottom-24 md:w-80 glass-card rounded-[2.5rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-300 max-h-[50vh] md:max-h-none">
      <div className="p-5 border-b border-white/5 bg-slate-900/40">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-bold italic text-white uppercase truncate">{selection.name}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1">✕</button>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pColor }} />
           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
             {selection.owner === 'NEUTRAL' ? 'Neutral Territory' : `${selection.owner === playerRole ? 'YOUR' : selection.owner} SECTOR`}
           </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {isPlanet ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Population</span>
                <span className="text-base font-bold text-white">{Math.floor(selection.population)} citizens</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Tactical Def.</span>
                <span className="text-base font-bold text-emerald-500">{selection.defense}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                <span>Core Infra</span>
                <span>{selection.mines + selection.factories} / 15</span>
              </div>
              <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: `${((selection.mines+selection.factories)/15)*100}%` }} />
              </div>
            </div>

            {isMine ? (
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    disabled={credits < 500 || selection.mines >= MAX_MINES}
                    onClick={() => onIssueOrder('BUILD_MINE')}
                    className="py-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/20 text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex flex-col items-center"
                  >
                    <span>+ Mine</span>
                    <span className="text-[8px] opacity-60">500 Cr</span>
                  </button>
                  <button 
                    disabled={credits < 800 || selection.factories >= MAX_FACTORIES}
                    onClick={() => onIssueOrder('BUILD_FACTORY')}
                    className="py-3 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-600/20 text-cyan-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex flex-col items-center"
                  >
                    <span>+ Factory</span>
                    <span className="text-[8px] opacity-60">800 Cr</span>
                  </button>
                </div>
                
                {selection.factories > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[8px] font-black text-slate-600 uppercase text-center mb-1">Orbital Shipyard</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(['SCOUT', 'FREIGHTER', 'WARSHIP'] as ShipType[]).map(type => (
                        <button 
                          key={type}
                          disabled={credits < SHIP_COSTS[type]}
                          onClick={() => onIssueOrder('BUILD_SHIP', { type })}
                          className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex justify-between px-4"
                        >
                          <span>{type}</span>
                          <span className="text-cyan-500 font-bold">{SHIP_COSTS[type]} Cr</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 text-center">
                 <p className="text-[10px] text-slate-500 leading-relaxed italic">
                   Information restricted to owner's subspace link.
                 </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-3">
                 <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Hull Stability</span>
                 <span className="text-xs font-bold text-emerald-400">{selection.hp} / {selection.maxHp}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${(selection.hp/selection.maxHp)*100}%` }} />
              </div>
            </div>

            {isMine && (
              <button 
                onClick={() => onIssueOrder('SET_COURSE')}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                  isSettingCourse 
                    ? 'bg-amber-500 text-black animate-pulse shadow-[0_0_25px_rgba(245,158,11,0.5)]' 
                    : 'bg-cyan-600 text-white shadow-xl shadow-cyan-950/40'
                }`}
              >
                {isSettingCourse ? 'SELECT TARGET PLANET' : 'INITIATE NAV-LINK'}
              </button>
            )}
            
            <div className="space-y-2">
               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Vessel Specs</p>
               <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-950/40 rounded-xl text-center border border-white/5">
                     <span className="block text-[8px] text-slate-600 uppercase font-black mb-1">Velocity</span>
                     <span className="text-xs font-bold text-white">{selection.speed} LY/T</span>
                  </div>
                  <div className="p-3 bg-slate-950/40 rounded-xl text-center border border-white/5">
                     <span className="block text-[8px] text-slate-600 uppercase font-black mb-1">Output</span>
                     <span className="text-xs font-bold text-white">{selection.attack} MW</span>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950/80 border-t border-white/5 text-center">
        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">
          Secure Link // Command Hub
        </p>
      </div>
    </div>
  );
};

export default SelectionPanel;
