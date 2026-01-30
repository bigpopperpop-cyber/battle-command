
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
  isSpied?: boolean;
  ships?: Ship[];
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({ 
  selection, onClose, playerRole, credits, onIssueOrder, isSettingCourse, isSpied, ships = []
}) => {
  if (!selection) return null;

  const isPlanet = 'population' in selection;
  const isMine = selection.owner === playerRole;
  const pColor = PLAYER_COLORS[selection.owner];
  const canSeeDetails = isMine || isSpied;

  // Check if I am being spied ON at this planet
  const hostilesOrbiting = isPlanet && !isMine && selection.owner !== 'NEUTRAL' ? [] : 
    isPlanet && isMine ? ships.filter(s => s.currentPlanetId === selection.id && s.owner !== playerRole && s.status === 'ORBITING') : [];
  
  const isBeingSpiedOn = hostilesOrbiting.some(s => s.type === 'SCOUT');

  return (
    <div className="fixed inset-x-4 bottom-4 landscape:inset-x-auto landscape:right-4 landscape:top-20 landscape:bottom-4 landscape:w-80 glass-card rounded-[2rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-bottom landscape:slide-in-from-right duration-300 max-h-[45vh] landscape:max-h-none">
      <div className="p-4 border-b border-white/5 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
           <div className="truncate">
             <h3 className="text-sm font-bold italic text-white uppercase truncate">{selection.name}</h3>
             <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
               {selection.owner === 'NEUTRAL' ? 'Neutral' : `${selection.owner === playerRole ? 'YOUR' : selection.owner} SECTOR`}
             </span>
           </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isPlanet ? (
          <>
            {isSpied && !isMine && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl flex items-center gap-2 mb-2">
                <span className="text-xs">📡</span>
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">Scout Intel Link Active</span>
              </div>
            )}
            {isBeingSpiedOn && (
              <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-xl flex items-center gap-2 mb-2 animate-pulse">
                <span className="text-xs">⚠️</span>
                <span className="text-[8px] font-black text-red-400 uppercase tracking-widest leading-none">Subspace Sabotage Detected: Mines -25%</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5 text-center">
                <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Pop.</span>
                <span className="text-sm font-bold text-white">
                  {canSeeDetails ? Math.floor(selection.population) : '??'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5 text-center">
                <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Def.</span>
                <span className="text-sm font-bold text-emerald-500">
                  {canSeeDetails ? selection.defense : '??'}
                </span>
              </div>
            </div>

            {canSeeDetails && (
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-slate-950/40 p-2 rounded-xl border border-white/5 text-center">
                   <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Mines</span>
                   <span className="text-sm font-bold text-amber-500">{selection.mines}</span>
                 </div>
                 <div className="bg-slate-950/40 p-2 rounded-xl border border-white/5 text-center">
                   <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Factories</span>
                   <span className="text-sm font-bold text-cyan-500">{selection.factories}</span>
                 </div>
              </div>
            )}
            
            {isMine && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    disabled={credits < 500 || selection.mines >= MAX_MINES}
                    onClick={() => onIssueOrder('BUILD_MINE')}
                    className="py-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/20 text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20"
                  >
                    + Mine (500)
                  </button>
                  <button 
                    disabled={credits < 800 || selection.factories >= MAX_FACTORIES}
                    onClick={() => onIssueOrder('BUILD_FACTORY')}
                    className="py-3 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-600/20 text-cyan-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20"
                  >
                    + Fact (800)
                  </button>
                </div>
                
                {selection.factories > 0 && (
                  <div className="pt-2">
                    <p className="text-[7px] font-black text-slate-600 uppercase mb-2">Build Vessel</p>
                    <div className="grid grid-cols-3 landscape:grid-cols-1 gap-1.5">
                      {(['SCOUT', 'FREIGHTER', 'WARSHIP'] as ShipType[]).map(type => (
                        <button 
                          key={type}
                          disabled={credits < SHIP_COSTS[type]}
                          onClick={() => onIssueOrder('BUILD_SHIP', { type })}
                          className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex flex-col items-center justify-center"
                        >
                          <span>{type}</span>
                          <span className="text-cyan-500">{SHIP_COSTS[type]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Hull</span>
                 <span className="text-[10px] font-bold text-emerald-400">{selection.hp}/{selection.maxHp}</span>
              </div>
              <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(selection.hp/selection.maxHp)*100}%` }} />
              </div>
            </div>

            {isMine && (
              <button 
                onClick={() => onIssueOrder('SET_COURSE')}
                className={`w-full py-4 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all ${
                  isSettingCourse 
                    ? 'bg-amber-500 text-black animate-pulse' 
                    : 'bg-cyan-600 text-white'
                }`}
              >
                {isSettingCourse ? 'TARGETING...' : 'INITIATE NAV-LINK'}
              </button>
            )}
            
            <div className="grid grid-cols-2 gap-2">
               <div className="p-2 bg-slate-950/40 rounded-lg text-center border border-white/5">
                  <span className="block text-[7px] text-slate-600 uppercase font-black">Vel.</span>
                  <span className="text-[10px] font-bold text-white">{selection.speed}</span>
               </div>
               <div className="p-2 bg-slate-950/40 rounded-lg text-center border border-white/5">
                  <span className="block text-[7px] text-slate-600 uppercase font-black">Atk.</span>
                  <span className="text-[10px] font-bold text-white">{selection.attack === 0 ? 'N/A' : selection.attack}</span>
               </div>
            </div>

            {selection.type === 'SCOUT' && selection.status === 'ORBITING' && selection.owner === playerRole && (
               <div className="p-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-center">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Intelligence Mission Active</span>
               </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-950/80 border-t border-white/5 text-center shrink-0">
        <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none">
          Encrypted Subspace Link
        </p>
      </div>
    </div>
  );
};

export default SelectionPanel;
