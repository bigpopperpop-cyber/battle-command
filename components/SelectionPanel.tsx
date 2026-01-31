
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

  const bonuses = useMemo(() => {
    if (!playerRole || !planets.length) return { discount: 0, strength: 1, factoryCount: 0 };
    return getEmpireBonuses(planets, playerRole);
  }, [planets, playerRole]);

  const handleSpecialization = (spec: PlanetSpecialization) => {
    if (credits < 1500) return;
    onIssueOrder('SET_SPECIALIZATION', { spec });
  };

  return (
    <div className="fixed inset-x-2 bottom-2 md:bottom-4 md:inset-x-auto md:right-4 md:top-28 md:w-80 glass-card rounded-[2rem] md:rounded-[2.5rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[45vh] md:max-h-none md:h-auto">
      <div className="p-4 md:p-5 border-b border-white/5 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
           <div className="truncate">
             <h3 className="text-xs md:text-sm font-bold italic text-white uppercase truncate leading-tight">
               {selection.name}
             </h3>
             <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none block">
               {selection.owner === 'NEUTRAL' ? 'Neutral Sector' : `${selection.owner} Space`}
             </span>
           </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="md:hidden bg-slate-950/80 px-3 py-1.5 rounded-lg border border-white/5 text-amber-500 font-bold text-[10px] flex items-center gap-1.5">💰 {credits}</div>
          <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white shrink-0">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-6 custom-scrollbar pb-6 md:pb-5">
        {isPlanet ? (
          <>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-slate-950/60 p-2 md:p-3 rounded-xl md:rounded-2xl border border-white/5 text-center">
                <span className="block text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-0.5 md:mb-1">Pop</span>
                <span className="text-xs md:text-sm font-bold text-white leading-none">{selection.population.toFixed(1)}</span>
              </div>
              <div className="bg-slate-950/60 p-2 md:p-3 rounded-xl md:rounded-2xl border border-white/5 text-center">
                <span className="block text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-0.5 md:mb-1">Mines</span>
                <span className="text-xs md:text-sm font-bold text-amber-500 leading-none">{selection.mines}</span>
              </div>
              <div className="bg-slate-950/60 p-2 md:p-3 rounded-xl md:rounded-2xl border border-white/5 text-center">
                <span className="block text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-0.5 md:mb-1">Fact</span>
                <span className="text-xs md:text-sm font-bold text-cyan-500 leading-none">{selection.factories}</span>
              </div>
            </div>

            {isMine && (
              <div className="space-y-4">
                <div className="space-y-1.5 md:space-y-2">
                   <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Construction</p>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        disabled={credits < 500 || selection.mines >= MAX_MINES}
                        onClick={() => onIssueOrder('BUILD_MINE')}
                        className="py-2.5 md:py-3 bg-amber-600/10 border border-amber-600/20 text-amber-400 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase disabled:opacity-20 transition-colors active:bg-amber-600/20"
                      >
                        Mine (500)
                      </button>
                      <button 
                        disabled={credits < 800 || selection.factories >= MAX_FACTORIES}
                        onClick={() => onIssueOrder('BUILD_FACTORY')}
                        className="py-2.5 md:py-3 bg-cyan-600/10 border border-cyan-600/20 text-cyan-400 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase disabled:opacity-20 transition-colors active:bg-cyan-600/20"
                      >
                        Factory (800)
                      </button>
                   </div>
                </div>

                <div className="space-y-1.5 md:space-y-2">
                   <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Specialization (1500 Cr)</p>
                   <div className="grid grid-cols-3 gap-1.5">
                      {(['SHIPYARD', 'FORTRESS', 'INDUSTRIAL'] as PlanetSpecialization[]).map(spec => (
                        <button 
                          key={spec}
                          disabled={credits < 1500 || selection.specialization === spec}
                          onClick={() => handleSpecialization(spec)}
                          className={`py-2 md:py-3 rounded-lg md:rounded-xl text-[7px] md:text-[8px] font-black uppercase border transition-all ${selection.specialization === spec ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/40' : 'bg-slate-800 border-white/5 text-slate-400'}`}
                        >
                          <span className="block text-xs mb-0.5 leading-none">{spec === 'SHIPYARD' ? '⚓' : spec === 'FORTRESS' ? '🛡️' : '🏭'}</span>
                          {spec}
                        </button>
                      ))}
                   </div>
                </div>

                {selection.factories > 0 && (
                  <div className="space-y-1.5 md:space-y-2 pt-1 md:pt-2">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Shipyard Output</p>
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
                            className={`py-2 px-1 border rounded-lg md:rounded-xl transition-all flex flex-col items-center justify-center min-h-[50px] md:min-h-[60px] ${canAfford ? 'bg-slate-800 border-white/10 hover:bg-slate-700 text-white active:scale-95' : 'bg-slate-900 border-white/5 text-slate-600 opacity-40'}`}
                          >
                            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter mb-0.5">{type}</span>
                            <span className={`text-[8px] md:text-[9px] font-bold ${canAfford ? 'text-amber-400' : 'text-slate-600'}`}>${finalCost}</span>
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
          <div className="space-y-4 md:space-y-6">
             <div className="bg-slate-950/60 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 text-center">
                <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase mb-1.5 md:mb-2 leading-none">Hull Integrity</p>
                <div className="w-full h-1.5 md:h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                   <div 
                      className="h-full bg-emerald-500 transition-all duration-500" 
                      style={{ width: `${(selection.hp / selection.maxHp) * 100}%` }}
                   />
                </div>
                <p className="text-[10px] md:text-xs font-bold text-white mt-2 leading-none">{selection.hp} / {selection.maxHp} HP</p>
             </div>
             
             {isMine && (
               <button 
                 onClick={() => onIssueOrder('SET_COURSE')} 
                 className={`w-full py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isSettingCourse ? 'bg-amber-500 text-black animate-pulse' : 'bg-cyan-600 text-white'}`}
               >
                 {isSettingCourse ? '📡 Tap Target' : '🚀 Set Course'}
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectionPanel;
