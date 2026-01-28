
import React, { useState, useEffect } from 'react';
import { GameState, Owner, Planet, Ship } from '../types';
import { PLAYER_COLORS, SHIP_STATS, MAX_PLANET_POPULATION } from '../gameLogic';

export type HelpTab = 'GOAL' | 'INTERFACE' | 'ECONOMY' | 'COMMS';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState?: GameState;
  playerRole?: Owner | null;
  initialTab?: HelpTab;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, gameState, playerRole, initialTab = 'GOAL' }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>(initialTab);

  // Sync tab when initialTab changes (e.g. clicking different hub buttons)
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isPlayer = playerRole && playerRole.startsWith('P');
  const myPlanets = isPlayer && gameState ? gameState.planets.filter(p => p.owner === playerRole) : [];
  const myShips = isPlayer && gameState ? gameState.ships.filter(s => s.owner === playerRole) : [];

  const TabButton: React.FC<{ id: HelpTab; label: string; icon: string }> = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 px-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 flex flex-col items-center gap-1 ${
        activeTab === id 
          ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
          : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/20'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl max-h-[85vh] glass-card rounded-[3.5rem] border-cyan-500/30 flex flex-col overflow-hidden shadow-[0_0_120px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        
        <div className="p-8 border-b border-white/10 bg-slate-900/40">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white italic tracking-tight">COMMAND CENTER</h2>
              <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Empire Intelligence // Relay v2.5</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-2xl hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">✕</button>
          </div>

          <div className="flex gap-2">
            <TabButton id="INTERFACE" label="Bridge" icon="🛰️" />
            <TabButton id="ECONOMY" label="Economy" icon="💎" />
            <TabButton id="GOAL" label="Mission" icon="🎯" />
            <TabButton id="COMMS" label="Comms" icon="📡" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950/50 custom-scrollbar">
          
          {/* BRIDGE TAB: Fleet Intel */}
          {activeTab === 'INTERFACE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               {isPlayer ? (
                 <>
                   <div className="grid grid-cols-3 gap-2">
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/5 text-center">
                        <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Total Fleet</span>
                        <span className="text-xl font-bold">{myShips.length}</span>
                     </div>
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/5 text-center">
                        <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">In Transit</span>
                        <span className="text-xl font-bold text-cyan-400">{myShips.filter(s => s.status === 'MOVING').length}</span>
                     </div>
                     <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/5 text-center">
                        <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Combat Ready</span>
                        <span className="text-xl font-bold text-red-500">{myShips.filter(s => s.type === 'WARSHIP').length}</span>
                     </div>
                   </div>

                   <div className="space-y-2">
                     <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Vessel Registry</h4>
                     {myShips.length === 0 ? (
                       <p className="text-xs text-slate-600 italic">No ships currently under command.</p>
                     ) : (
                       myShips.map(s => (
                         <div key={s.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3">
                               <span className="text-xl">{s.type === 'SCOUT' ? '🚀' : s.type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                               <div>
                                  <p className="text-xs font-bold text-white leading-none mb-1">{s.name}</p>
                                  <p className="text-[9px] font-black text-cyan-500 uppercase">{s.status}</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black text-slate-500">HP {s.hp}/{s.maxHp}</p>
                               <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${(s.hp/s.maxHp)*100}%` }} />
                               </div>
                            </div>
                         </div>
                       ))
                     )}
                   </div>
                 </>
               ) : (
                 <div className="p-6 bg-slate-900/80 rounded-3xl border border-white/5">
                   <h5 className="text-white font-bold text-sm mb-2">Bridge Controls</h5>
                   <p className="text-xs text-slate-400 leading-relaxed">Drag to pan the map. Use the +/- controls for zoom. Tap any object to open its tactical data drawer.</p>
                 </div>
               )}
            </div>
          )}

          {/* ECONOMY TAB: Fiscal Intel */}
          {activeTab === 'ECONOMY' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              {isPlayer ? (
                <>
                  <div className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-[2.5rem]">
                    <div className="flex justify-between items-end mb-4">
                       <div>
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Current Reserves</p>
                          <h3 className="text-4xl font-bold text-white">{gameState?.playerCredits[playerRole!] || 0}<span className="text-sm text-slate-500 ml-2">Cr</span></h3>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Turn Income</p>
                          <p className="text-xl font-bold text-emerald-400">+{myPlanets.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0)}</p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Colonial Holdings ({myPlanets.length})</h4>
                    {myPlanets.map(p => (
                      <div key={p.id} className="grid grid-cols-4 gap-2 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                         <div className="col-span-2">
                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">👤 {p.population} Citizens</p>
                         </div>
                         <div className="text-center">
                            <p className="text-[8px] font-black text-slate-600 uppercase">Mines</p>
                            <p className="text-xs font-bold">{p.mines}</p>
                         </div>
                         <div className="text-center">
                            <p className="text-[8px] font-black text-slate-600 uppercase">Fact.</p>
                            <p className="text-xs font-bold">{p.factories}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                    <div className="text-2xl mb-2">🏗️</div>
                    <h5 className="text-amber-400 font-bold text-sm mb-1">Mines</h5>
                    <p className="text-xs text-slate-400">Increases credit income per turn.</p>
                  </div>
                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                    <div className="text-2xl mb-2">🏭</div>
                    <h5 className="text-cyan-400 font-bold text-sm mb-1">Factories</h5>
                    <p className="text-xs text-slate-400">Powers your planetary shipyard.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MISSION TAB */}
          {activeTab === 'GOAL' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-3xl">
                <h4 className="text-cyan-400 font-black text-xs uppercase tracking-widest mb-2">Prime Objective</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Your mission is <span className="text-white font-bold">Galactic Dominance</span>. Control the majority of the sectors by colonizing neutral planets and out-maneuvering rival factions.
                </p>
              </div>
            </div>
          )}

          {/* COMMS TAB */}
          {activeTab === 'COMMS' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
               <div className="p-6 bg-slate-900/80 rounded-3xl border border-cyan-500/20">
                 <h4 className="text-cyan-400 font-black text-[10px] uppercase tracking-widest mb-4">Multi-Device Handshake</h4>
                 <div className="space-y-4">
                   <div className="flex gap-3">
                     <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                     <p className="text-xs text-slate-300"><span className="text-white font-bold">Host:</span> Share the "Recruit Allies" link.</p>
                   </div>
                   <div className="flex gap-3">
                     <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                     <p className="text-xs text-slate-300"><span className="text-white font-bold">Guests:</span> Open link, make moves, and tap <span className="text-white">"Push Orders"</span>.</p>
                   </div>
                   <div className="flex gap-3">
                     <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                     <p className="text-xs text-slate-300"><span className="text-white font-bold">Host:</span> Ingest codes and <span className="text-white">"Execute Turn"</span>.</p>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900/80 text-center border-t border-white/5">
          <button onClick={onClose} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-sm transition-all shadow-xl shadow-cyan-900/40 active:scale-95">Return to Star Map</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
