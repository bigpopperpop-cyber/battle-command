
import React, { useMemo } from 'react';
import { Planet, Ship, Owner, ShipType, PlanetSpecialization } from '../types';
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

  // Logic to determine if detailed intel is available
  // Fog of war disabled: always provide full intel
  const hasIntel = true;

  const bonuses = useMemo(() => {
    if (!playerRole || !planets.length) return { discount: 0, strength: 1, factoryCount: 0 };
    return getEmpireBonuses(planets, playerRole);
  }, [planets, playerRole]);

  const handleSpecialization = (spec: PlanetSpecialization) => {
    if (credits < 1500) return;
    onIssueOrder('SET_SPECIALIZATION', { spec });
  };

  return (
    <div className="fixed inset-x-4 bottom-4 landscape:right-4 landscape:top-20 landscape:bottom-4 landscape:w-80 glass-card rounded-[2.5rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
      <div className="p-5 border-b border-white/5 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
           <div className="truncate">
             <h3 className="text-sm font-bold italic text-white uppercase truncate">
               {selection.name}
             </h3>
             <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
               {selection.owner === 'NEUTRAL' ? 'Neutral Sector' : `${selection.owner} Space`}
             </span>
           </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        {isPlanet ? (
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500">
                ● Deep Sensor Lock
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Pop</span>
                <span className="text-sm font-bold text-white">{selection.population.toFixed(1)}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Mines</span>
                <span className="text-sm font-bold text-amber-500">{selection.mines}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-600 uppercase mb-1">Fact</span>
                <span className="text-sm font-bold text-cyan-500">{selection.factories}</span>
              </div>
            </div>

            {isMine && (
              <div className="space-y-4">
                <div className="space-y-2">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Construction</p>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        disabled={credits < 500 || selection.mines >= MAX_MINES}
                        onClick={() => onIssueOrder('BUILD_MINE')}
                        className="py-3 bg-amber-600/10 border border-amber-600/20 text-amber-400 rounded-xl text-[9px] font-black uppercase disabled:opacity-20"
                      >
                        Mine (500)
                      </button>
                      <button 
                        disabled={credits < 800 || selection.factories >= MAX_FACTORIES}
                        onClick={() => onIssueOrder('BUILD_FACTORY')}
                        className="py-3 bg-cyan-600/10 border border-cyan-600/20 text-cyan-400 rounded-xl text-[9px] font-black uppercase disabled:opacity-20"
                      >
                        Factory (800)
                      </button>
                   </div>
                </div>

                <div className="space-y-2">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Specialization (1500 Cr)</p>
                   <div className="grid grid-cols-3 gap-1.5">
                      {(['SHIPYARD', 'FORTRESS', 'INDUSTRIAL'] as PlanetSpecialization[]).map(spec => (
                        <button 
                          key={spec}
                          disabled={credits < 1500 || selection.specialization === spec}
                          onClick={() => handleSpecialization(spec)}
                          className={`py-3 rounded-xl text-[8px] font-black uppercase border transition-all ${selection.specialization === spec ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-white/5 text-slate-400'}`}
                        >
                          <span className="block text-xs mb-0.5">{spec === 'SHIPYARD' ? '⚓' : spec === 'FORTRESS' ? '🛡️' : '🏭'}</span>
                          {spec}
                        </button>
                      ))}
                   </div>
                </div>

                {selection.factories > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Shipyard Output</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['SCOUT', 'FREIGHTER', 'WARSHIP'] as ShipType[]).map(type => {
                        const baseCost = SHIP_STATS[type].cost;
                        const shipyardDiscount = (selection as Planet).specialization === 'SHIPYARD' ? 0.25 : 0;
                        const finalCost = Math.floor(baseCost * (1 - bonuses.discount - shipyardDiscount));
                        const canAfford = credits >= finalCost;
                        
                        return (
                          <button 
                            key={type}
                            disabled={!canAfford}
                            onClick={() => onIssueOrder('BUILD_SHIP', { type })}
                            className={`py-2 px-1 border rounded-xl transition-all flex flex-col items-center justify-center ${canAfford ? 'bg-slate-800 border-white/10 hover:bg-slate-700 text-white' : 'bg-slate-900 border-white/5 text-slate-600 opacity-40 cursor-not-allowed'}`}
                          >
                            <span className="text-[8px] font-black uppercase tracking-tighter mb-0.5">{type}</span>
                            <span className={`text-[9px] font-bold ${canAfford ? 'text-amber-400' : 'text-slate-600'}`}>${finalCost}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
             <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Hull Integrity</p>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                   <div 
                      className="h-full bg-emerald-500 transition-all duration-500" 
                      style={{ width: `${(selection.hp / selection.maxHp) * 100}%` }}
                   />
                </div>
                <p className="text-xs font-bold text-white mt-2">{selection.hp} / {selection.maxHp} HP</p>
             </div>
             
             {isMine && (
               <button 
                 onClick={() => onIssueOrder('SET_COURSE')} 
                 className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isSettingCourse ? 'bg-amber-500 text-black animate-pulse' : 'bg-cyan-600 text-white'}`}
               >
                 {isSettingCourse ? '📡 Tap Target Planet' : '🚀 Set Nav-Link'}
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectionPanel;
