
import React, { useState, useEffect } from 'react';
import { GameState, Owner, Planet, Ship } from '../types';
import { PLAYER_COLORS, SHIP_STATS, MAX_PLANET_POPULATION, MAX_FACTORIES, MAX_MINES, getEmpireBonuses } from '../gameLogic';

export type HelpTab = 'GOAL' | 'INTERFACE' | 'ECONOMY' | 'COMMS';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInvite?: () => void;
  gameState?: GameState;
  playerRole?: Owner | null;
  initialTab?: HelpTab;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onOpenInvite, gameState, playerRole, initialTab = 'GOAL' }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isPlayer = playerRole && playerRole.startsWith('P');
  const isHost = playerRole === 'P1';
  const myPlanets = isPlayer && gameState ? gameState.planets.filter(p => p.owner === playerRole) : [];
  const myShips = isPlayer && gameState ? gameState.ships.filter(s => s.owner === playerRole) : [];

  const bonuses = isPlayer && gameState ? getEmpireBonuses(gameState.planets, playerRole!) : { discount: 0, strength: 1, firepowerBonus: 0, factoryCount: 0, scoutBonus: 0, warshipCapacity: 0 };

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
              <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Empire Intelligence // Relay v3.0</p>
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
                        <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Siege Ready</span>
                        <span className="text-xl font-bold text-red-500">{myShips.filter(s => s.type === 'WARSHIP').length}</span>
                     </div>
                   </div>

                   <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-2xl">
                     <h5 className="text-red-400 font-black text-[10px] uppercase mb-1">Tactical Combat</h5>
                     <p className="text-[11px] text-slate-300 leading-relaxed">
                       Warships automatically engage enemy vessels at the same planet. <span className="text-white font-bold">25 Base Damage</span> + <span className="text-emerald-400 font-bold">0.5 per Factory</span> in your empire.
                     </p>
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

          {activeTab === 'ECONOMY' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              {isPlayer ? (
                <>
                  <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-[2.5rem] mb-4">
                    <h4 className="text-cyan-400 font-black text-[10px] uppercase tracking-widest mb-2">Imperial Industrial Milestones</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-slate-900/40 p-3 rounded-2xl">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Scout Sabotage (15+ Fact.)</p>
                         <p className="text-lg font-bold text-emerald-400">+{Math.floor(bonuses.scoutBonus * 100)}% Bonus</p>
                       </div>
                       <div className="bg-slate-900/40 p-3 rounded-2xl">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Warship Transport</p>
                         <p className="text-lg font-bold text-cyan-400">{bonuses.warshipCapacity} Person Cap.</p>
                       </div>
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-[8px] text-slate-500"><span className="text-white font-bold">Max Factories (5):</span> Grants defensive shield (10% casualty survival).</p>
                      <p className="text-[8px] text-slate-500"><span className="text-white font-bold">Industrial Boom (5F + 10M):</span> Boosts population growth to <span className="text-emerald-400 font-bold">+1.0 / turn</span>.</p>
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-[2.5rem]">
                    <div className="flex justify-between items-end mb-4">
                       <div>
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Current Reserves</p>
                          <h3 className="text-4xl font-bold text-white">{gameState?.playerCredits[playerRole!] || 0}<span className="text-sm text-slate-500 ml-2">Cr</span></h3>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Turn Income</p>
                          <p className="text-xl font-bold text-emerald-400">+{myPlanets.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (Math.floor(p.population) * 50), 0)}</p>
                       </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                    <div className="text-2xl mb-2">🏗️</div>
                    <h5 className="text-amber-400 font-bold text-sm mb-1">Mines</h5>
                    <p className="text-xs text-slate-400">Increases credit income per turn. Max 10 per planet.</p>
                  </div>
                  <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                    <div className="text-2xl mb-2">🏭</div>
                    <h5 className="text-cyan-400 font-bold text-sm mb-1">Factories</h5>
                    <p className="text-xs text-slate-400">Powers shipyards and provides global ship buffs. Max 5 per planet.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'GOAL' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-3xl">
                <h4 className="text-cyan-400 font-black text-xs uppercase tracking-widest mb-2">Combat & Logistics</h4>
                <div className="space-y-3">
                   <div className="flex gap-3">
                     <span className="text-xl">⚔️</span>
                     <p className="text-xs text-slate-400"><span className="text-white font-bold">Warship:</span> Deals damage to 1 enemy ship per turn. Firepower grows with your empire's factory count.</p>
                   </div>
                   <div className="flex gap-3">
                     <span className="text-xl">🛡️</span>
                     <p className="text-xs text-slate-400"><span className="text-white font-bold">Defensive Shield:</span> Planets with 5 factories have a 10% chance to save citizens from warship bombardment.</p>
                   </div>
                   <div className="flex gap-3">
                     <span className="text-xl">📈</span>
                     <p className="text-xs text-slate-400"><span className="text-white font-bold">Growth:</span> Planets with 5 factories and 10 mines gain +1 population per turn during peace.</p>
                   </div>
                   <div className="flex gap-3">
                     <span className="text-xl">❤️</span>
                     <p className="text-xs text-slate-400"><span className="text-white font-bold">Repair:</span> Ships heal <span className="text-white font-bold">25% HP</span> every turn they orbit their own planets while not in combat.</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'COMMS' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <div className="p-6 bg-slate-900/80 rounded-3xl border border-cyan-500/20 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 </div>
                 <h4 className="text-cyan-400 font-black text-[10px] uppercase tracking-widest mb-4">Multi-Device Handshake</h4>
                 <div className="space-y-4 mb-8">
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center text-[11px] font-black shrink-0">1</div>
                     <p className="text-xs text-slate-300 leading-relaxed"><span className="text-white font-bold">Host Initiation:</span> Share your Sector ID or Recruitment Link with allies.</p>
                   </div>
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center text-[11px] font-black shrink-0">2</div>
                     <p className="text-xs text-slate-300 leading-relaxed"><span className="text-white font-bold">Tactical Prep:</span> Allies open the link, choose an empire, and plan their moves.</p>
                   </div>
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center text-[11px] font-black shrink-0">3</div>
                     <p className="text-xs text-slate-300 leading-relaxed"><span className="text-white font-bold">Order Push:</span> Allies tap "Push Tactical Data" to sync their intent to your bridge.</p>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900/80 text-center border-t border-white/5">
          <button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm transition-all active:scale-95">Dismiss Intelligence</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
