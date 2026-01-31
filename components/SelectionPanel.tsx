
import React, { useMemo } from 'react';
import { Planet, Ship, Owner, ShipType } from '../types';
import { PLAYER_COLORS, SHIP_STATS, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, getEmpireBonuses } from '../gameLogic';

interface SelectionPanelProps {
  selection: Planet | Ship | null;
  onClose: () => void;
  playerRole: Owner | null;
  credits: number;
  onIssueOrder: (type: any, payload?: any) => void;
  isSettingCourse: boolean;
  isSpied?: boolean;
  ships?: Ship[];
  planets?: Planet[];
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({ 
  selection, onClose, playerRole, credits, onIssueOrder, isSettingCourse, isSpied, ships = [], planets = []
}) => {
  if (!selection) return null;

  const isPlanet = 'population' in selection;
  const isMine = selection.owner === playerRole;
  const pColor = PLAYER_COLORS[selection.owner];

  const bonuses = useMemo(() => {
    if (!playerRole || !planets.length) return { discount: 0, strength: 1, factoryCount: 0 };
    return getEmpireBonuses(planets, playerRole);
  }, [planets, playerRole]);

  return (
    <div className="fixed inset-x-4 bottom-4 landscape:right-4 landscape:top-20 landscape:bottom-4 landscape:w-80 glass-card rounded-[2rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
      <div className="p-4 border-b border-white/5 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
           <div className="truncate">
             <h3 className="text-sm font-bold italic text-white uppercase truncate">{selection.name}</h3>
             <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
               {selection.owner === 'NEUTRAL' ? 'Neutral Sector' : `${selection.owner} Space`}
             </span>
           </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isPlanet ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5 text-center">
                <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Pop</span>
                <span className="text-sm font-bold text-white">{Math.floor(selection.population)}</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5 text-center">
                <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Fact</span>
                <span className="text-sm font-bold text-cyan-500">{selection.factories}</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5 text-center">
                <span className="block text-[7px] font-black text-slate-600 uppercase mb-1">Batt</span>
                <span className="text-sm font-bold text-red-500">{selection.batteries}</span>
              </div>
            </div>

            {isMine && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    disabled={credits < 500 || selection.mines >= MAX_MINES}
                    onClick={() => onIssueOrder('BUILD_MINE')}
                    className="py-3 bg-amber-600/10 border border-amber-600/20 text-amber-400 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-20"
                  >
                    + Mine (500)
                  </button>
                  <button 
                    disabled={credits < 800 || selection.factories >= MAX_FACTORIES}
                    onClick={() => onIssueOrder('BUILD_FACTORY')}
                    className="py-3 bg-cyan-600/10 border border-cyan-600/20 text-cyan-400 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-20"
                  >
                    + Fact (800)
                  </button>
                </div>
                <button 
                  disabled={credits < 1200 || selection.batteries >= MAX_BATTERIES}
                  onClick={() => onIssueOrder('BUILD_BATTERY')}
                  className="w-full py-3 bg-red-600/10 border border-red-600/20 text-red-400 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-20"
                >
                  Install Orbital Battery (1200)
                </button>
                
                {selection.factories > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 pt-2">
                    {(['SCOUT', 'FREIGHTER', 'WARSHIP'] as ShipType[]).map(type => (
                      <button 
                        key={type}
                        onClick={() => onIssueOrder('BUILD_SHIP', { type })}
                        className="py-2 bg-white/5 border border-white/10 text-white rounded-lg text-[8px] font-black uppercase"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
             {/* Ship controls already defined in existing components */}
             <p className="text-xs text-slate-400 text-center">Hull Integrity: {selection.hp}/{selection.maxHp}</p>
             {isMine && (
               <button onClick={() => onIssueOrder('SET_COURSE')} className={`w-full py-4 rounded-xl font-black text-[9px] uppercase ${isSettingCourse ? 'bg-amber-500 text-black' : 'bg-cyan-600 text-white'}`}>
                 {isSettingCourse ? 'Confirm Target' : 'Set Nav Link'}
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectionPanel;
