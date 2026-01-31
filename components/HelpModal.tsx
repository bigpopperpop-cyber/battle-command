
import React, { useState, useEffect } from 'react';
import { GameState, Owner } from '../types';
import { getEmpireBonuses } from '../gameLogic';

export type HelpTab = 'QUICKSTART' | 'INTERFACE' | 'ECONOMY' | 'GOAL' | 'COMMS';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInvite?: () => void;
  gameState?: GameState;
  playerRole?: Owner | null;
  initialTab?: HelpTab;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, gameState, playerRole, initialTab = 'QUICKSTART' }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isPlayer = playerRole && playerRole.startsWith('P');
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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl max-h-[85vh] glass-card rounded-[3.5rem] border-cyan-500/30 flex flex-col overflow-hidden shadow-[0_0_120px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300">
        
        <div className="p-8 border-b border-white/10 bg-slate-900/40">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white italic tracking-tight uppercase">Empire Field Manual</h2>
              <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Tactical Overview & Logistics</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-2xl hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">✕</button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <TabButton id="QUICKSTART" label="Start" icon="⚡" />
            <TabButton id="INTERFACE" label="Bridge" icon="🛰️" />
            <TabButton id="ECONOMY" label="Economy" icon="💎" />
            <TabButton id="GOAL" label="Combat" icon="⚔️" />
            <TabButton id="COMMS" label="Comms" icon="📡" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950/50 custom-scrollbar">
          
          {activeTab === 'QUICKSTART' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center font-black shrink-0">1</div>
                  <div>
                    <h5 className="text-white font-bold text-xs uppercase mb-1">Expand Reach</h5>
                    <p className="text-[11px] text-slate-400">Select a <b>Freighter</b> and set a Nav-Link to a nearby Neutral planet to colonize it.</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center font-black shrink-0">2</div>
                  <div>
                    <h5 className="text-white font-bold text-xs uppercase mb-1">Build Economy</h5>
                    <p className="text-[11px] text-slate-400">Add <b>Mines</b> for credits and <b>Factories</b> for global empire bonuses.</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center font-black shrink-0">3</div>
                  <div>
                    <h5 className="text-white font-bold text-xs uppercase mb-1">Commit Orders</h5>
                    <p className="text-[11px] text-slate-400">All commanders must tap <b>Commit Orders</b> before the Host can execute the turn.</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center font-black shrink-0">4</div>
                  <div>
                    <h5 className="text-white font-bold text-xs uppercase mb-1">Victory Condition</h5>
                    <p className="text-[11px] text-slate-400">Total dominance is achieved when one empire controls <b>60% of all planets</b>.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-cyan-600/10 border border-cyan-500/30 rounded-3xl flex items-center gap-4">
                 <span className="text-3xl">🤖</span>
                 <p className="text-[11px] text-cyan-100 leading-relaxed italic">
                   "Admiral, remember: Your factories provide a global firepower bonus to every warship in your fleet. Industrialize fast to dominate the stars!" — <b>Jarvis</b>
                 </p>
              </div>
            </div>
          )}

          {activeTab === 'INTERFACE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/5">
                 <h5 className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Map Navigation</h5>
                 <ul className="space-y-3 text-xs text-slate-400">
                   <li className="flex gap-3"><span className="text-cyan-500">☝️</span> Tap any planet or ship to open its tactical panel.</li>
                   <li className="flex gap-3"><span className="text-cyan-500">🖱️</span> Drag to pan through the sector grid.</li>
                   <li className="flex gap-3"><span className="text-cyan-500">🔍</span> Use the +/- buttons to adjust tactical zoom.</li>
                 </ul>
               </div>
               
               {isPlayer && (
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
               )}
            </div>
          )}

          {activeTab === 'ECONOMY' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-[2.5rem]">
                <h4 className="text-amber-500 font-black text-[10px] uppercase tracking-widest mb-4">Revenue Stream</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                    <h6 className="text-amber-400 font-bold text-[11px] mb-1">Mines (500 Cr)</h6>
                    <p className="text-[10px] text-slate-400">Produces +50 Credits per round. Essential for expansion.</p>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                    <h6 className="text-cyan-400 font-bold text-[11px] mb-1">Factories (800 Cr)</h6>
                    <p className="text-[10px] text-slate-400">Produces +20 Credits. Grants global +0.5 damage and fleet discounts.</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-900/80 rounded-3xl border border-white/5">
                 <h5 className="text-white font-bold text-[11px] uppercase tracking-widest mb-3">Industrial Perks</h5>
                 <ul className="space-y-2 text-[10px] text-slate-400">
                   <li><b className="text-white">15+ Factories:</b> Scouts gain Sabotage bonus.</li>
                   <li><b className="text-white">Shipyard Perk:</b> Specializing a planet as a Shipyard grants <b className="text-emerald-400">25% discount</b> on ship construction.</li>
                 </ul>
              </div>
            </div>
          )}

          {activeTab === 'GOAL' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <div className="p-6 bg-red-950/20 border border-red-500/30 rounded-3xl">
                 <h4 className="text-red-400 font-black text-xs uppercase tracking-widest mb-4">Tactical Combat</h4>
                 <div className="space-y-4">
                   <div className="flex gap-4">
                     <span className="text-xl">⚔️</span>
                     <div>
                       <p className="text-[11px] text-slate-200 font-bold">Automatic Engagement</p>
                       <p className="text-[10px] text-slate-400 leading-relaxed">Ships automatically attack enemies at the same coordinates. Damage = Ship Base Attack + Global Factory Bonus.</p>
                     </div>
                   </div>
                   <div className="flex gap-4">
                     <span className="text-xl">🛠️</span>
                     <div>
                       <p className="text-[11px] text-slate-200 font-bold">Subspace Repairs</p>
                       <p className="text-[10px] text-slate-400 leading-relaxed">Ships heal <b className="text-white">25% HP</b> every turn they spend orbiting a friendly planet while not in active combat.</p>
                     </div>
                   </div>
                   <div className="flex gap-4">
                     <span className="text-xl">💥</span>
                     <div>
                       <p className="text-[11px] text-slate-200 font-bold">Battery Defense</p>
                       <p className="text-[10px] text-slate-400 leading-relaxed">Planets with batteries fire back at orbiters. Fortress specialization doubles this damage.</p>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'COMMS' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
               <div className="p-6 bg-slate-900/80 rounded-3xl border border-cyan-500/20 relative overflow-hidden">
                 <h4 className="text-cyan-400 font-black text-[10px] uppercase tracking-widest mb-4">Command Link Procedure</h4>
                 <div className="space-y-4">
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center text-[11px] font-black shrink-0">1</div>
                     <p className="text-xs text-slate-300 leading-relaxed"><span className="text-white font-bold">Host:</span> Sets up the galaxy and shares the link.</p>
                   </div>
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center text-[11px] font-black shrink-0">2</div>
                     <p className="text-xs text-slate-300 leading-relaxed"><span className="text-white font-bold">Allies:</span> Join, plan moves, and tap <b>Commit Orders</b>.</p>
                   </div>
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 flex items-center justify-center text-[11px] font-black shrink-0">3</div>
                     <p className="text-xs text-slate-300 leading-relaxed"><span className="text-white font-bold">Resolution:</span> Host executes turn after everyone is ready.</p>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900/80 text-center border-t border-white/5">
          <button onClick={onClose} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-sm transition-all active:scale-95">Dismiss Manual</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
