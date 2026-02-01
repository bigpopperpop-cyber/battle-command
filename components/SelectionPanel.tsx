
import React, { useMemo, useState, useEffect } from 'react';
import { Planet, Ship, Owner, ShipType, PlanetSpecialization } from '../types';
import { PLAYER_COLORS, SHIP_STATS, MAX_FACTORIES, MAX_MINES, getEmpireBonuses } from '../gameLogic';

interface SelectionPanelProps {
  selection: Planet | Ship | null;
  onClose: () => void;
  playerRole: Owner | null;
  credits: number;
  onIssueOrder: (type: any, payload?: any) => void;
  isSettingCourse: boolean;
  ships?: Ship[];
  planets?: Planet[];
  techLevels: { engine: number, shields: number, scanners: number };
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({ 
  selection, onClose, playerRole, credits, onIssueOrder, isSettingCourse, planets = [], techLevels
}) => {
  const [tab, setTab] = useState<'INFO' | 'TECH'>('INFO');
  const [newName, setNewName] = useState('');

  // Reset local state when selection changes to avoid "stale" input text
  useEffect(() => {
    setNewName('');
    setTab('INFO');
  }, [selection?.id]);

  if (!selection) return null;

  const isPlanet = 'population' in selection;
  const isMine = playerRole && selection.owner === playerRole;
  const pColor = PLAYER_COLORS[selection.owner] || '#94a3b8';

  const bonuses = useMemo(() => {
    if (!playerRole || !planets.length) return { discount: 0, strength: 1, factoryCount: 0 };
    return getEmpireBonuses(planets, playerRole);
  }, [planets, playerRole]);

  return (
    <div className="fixed inset-x-2 bottom-2 md:bottom-4 md:inset-x-auto md:right-4 md:top-28 md:w-80 glass-card rounded-[2rem] border-white/10 shadow-2xl z-[80] flex flex-col overflow-hidden animate-in slide-in-from-bottom max-h-[50vh] md:max-h-none">
      <div className="p-4 border-b border-white/5 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
           <h3 className="text-xs font-bold italic text-white uppercase truncate">{selection.name}</h3>
        </div>
        <div className="flex gap-2 shrink-0">
           {isMine && <button onClick={() => setTab(tab === 'INFO' ? 'TECH' : 'INFO')} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black">{tab === 'INFO' ? '🔬' : '📊'}</button>}
           <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {tab === 'INFO' ? (
          <>
            {isPlanet && isMine && (
              <div className="flex gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Rename colony..." className="flex-1 bg-black/40 border-none rounded-lg px-3 text-[10px] outline-none text-white h-9" />
                <button onClick={() => { if(newName.trim()) onIssueOrder('RENAME_PLANET', { name: newName }); setNewName(''); }} className="px-3 h-9 bg-cyan-600 rounded-lg text-[8px] font-black uppercase">Apply</button>
              </div>
            )}
            {isPlanet ? (
              <div className="grid grid-cols-3 gap-2">
                {['Pop', 'Mines', 'Fact'].map((label, i) => (
                  <div key={label} className="bg-slate-950/60 p-2 rounded-xl border border-white/5 text-center">
                    <span className="block text-[7px] font-black text-slate-600 uppercase mb-0.5">{label}</span>
                    <span className="text-xs font-bold text-white">{(i === 0 ? (selection.population || 0).toFixed(1) : i === 1 ? selection.mines : selection.factories)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5">
                <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Integrity: {selection.hp}/{selection.maxHp}</p>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(0, (selection.hp/selection.maxHp)*100)}%` }} />
                </div>
              </div>
            )}
            {isMine && (
              <div className="space-y-4">
                {isPlanet && (
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={credits < 500} onClick={() => onIssueOrder('BUILD_MINE')} className="py-2.5 bg-amber-600/10 border border-amber-600/20 text-amber-400 rounded-lg text-[8px] font-black uppercase disabled:opacity-20">Mine (500)</button>
                    <button disabled={credits < 800} onClick={() => onIssueOrder('BUILD_FACTORY')} className="py-2.5 bg-cyan-600/10 border border-cyan-600/20 text-cyan-400 rounded-lg text-[8px] font-black uppercase disabled:opacity-20">Fact (800)</button>
                  </div>
                )}
                <button onClick={() => onIssueOrder(isPlanet ? 'BUILD_SHIP' : 'SET_COURSE', { type: 'WARSHIP' })} className="w-full py-4 bg-cyan-600 rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-cyan-500 transition-colors">
                  {isPlanet ? 'Build Warship' : isSettingCourse ? '📡 Tap Target' : '🚀 Set Course'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {Object.entries(techLevels).map(([t, level]) => {
              const safeLevel = typeof level === 'number' ? level : 0;
              const cost = (safeLevel + 1) * 1000;
              return (
                <div key={t} className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-black text-white uppercase truncate">{t} LVL {safeLevel}</p>
                    <p className="text-[8px] text-slate-500 truncate">{t === 'engine' ? '+15% Move Spd' : t === 'shields' ? '+10% Integrity' : '+10% Recon Scope'}</p>
                  </div>
                  <button onClick={() => onIssueOrder('RESEARCH_TECH', { tech: t })} disabled={credits < cost} className="px-3 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase disabled:opacity-20 shrink-0">UP: {cost}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default SelectionPanel;
