
import React, { useState } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'GOAL' | 'INTERFACE' | 'ECONOMY' | 'FLEET';

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('GOAL');

  if (!isOpen) return null;

  const TabButton: React.FC<{ id: Tab; label: string; icon: string }> = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex flex-col items-center gap-1 ${
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
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[85vh] glass-card rounded-[3rem] border-cyan-500/30 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(34,211,238,0.1)] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-white/10 bg-slate-900/40">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white italic">COMMAND MANUAL</h2>
              <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">Protocol v2.5.0 // Field Intelligence</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-2xl hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2">
            <TabButton id="GOAL" label="Mission" icon="🎯" />
            <TabButton id="INTERFACE" label="Bridge" icon="🎮" />
            <TabButton id="ECONOMY" label="Economy" icon="🏭" />
            <TabButton id="FLEET" label="Fleet" icon="🚀" />
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-950/50">
          
          {activeTab === 'GOAL' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-cyan-500/5 border border-cyan-500/20 rounded-3xl">
                <h4 className="text-cyan-400 font-black text-xs uppercase tracking-widest mb-2">Prime Objective</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Your mission is <span className="text-white font-bold">Galactic Dominance</span>. Control the majority of the 24 sectors by colonizing neutral planets and out-maneuvering rival factions.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                  <span className="text-2xl block mb-2">🤝</span>
                  <h5 className="text-white font-bold text-sm mb-1">Multiplayer</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">Invite friends via QR code. Each turn, share your encrypted orders with the Host to proceed.</p>
                </div>
                <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                  <span className="text-2xl block mb-2">🤖</span>
                  <h5 className="text-white font-bold text-sm mb-1">AI Adversaries</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">AI Commanders (Red/Purple) will aggressively pursue neutral space. Block their path to win.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'INTERFACE' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                 <div className="bg-slate-800 p-3 rounded-xl font-bold text-xs text-cyan-400">01</div>
                 <div>
                   <h5 className="text-white font-bold text-sm">Navigating Space</h5>
                   <p className="text-xs text-slate-400">Drag to pan the star chart. Use the <span className="text-white">+ / -</span> buttons to zoom. Select any planet or ship to view its data.</p>
                 </div>
               </div>
               <div className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                 <div className="bg-slate-800 p-3 rounded-xl font-bold text-xs text-cyan-400">02</div>
                 <div>
                   <h5 className="text-white font-bold text-sm">Giving Orders</h5>
                   <p className="text-xs text-slate-400">Tap a ship, then tap a target planet. A "Send Fleet Here" button will appear. Orders are only executed once "End Turn" is pressed.</p>
                 </div>
               </div>
               <div className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                 <div className="bg-slate-800 p-3 rounded-xl font-bold text-xs text-cyan-400">03</div>
                 <div>
                   <h5 className="text-white font-bold text-sm">Admiral Jarvis</h5>
                   <p className="text-xs text-slate-400">Tap the ❂ icon anytime. Ask him: <span className="italic text-cyan-200">"What should I do next?"</span> or <span className="italic text-cyan-200">"Am I winning?"</span></p>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'ECONOMY' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                  <div className="text-2xl mb-2">🏗️</div>
                  <h5 className="text-amber-400 font-bold text-sm mb-1">Mines</h5>
                  <p className="text-xs text-slate-400">Increases credit income per turn. Essential for scaling your empire's wealth.</p>
                  <div className="mt-3 text-[10px] font-black text-white/40">COST: ¤100</div>
                </div>
                <div className="p-5 bg-slate-900/80 rounded-2xl border border-white/5">
                  <div className="text-2xl mb-2">🏭</div>
                  <h5 className="text-cyan-400 font-bold text-sm mb-1">Factories</h5>
                  <p className="text-xs text-slate-400">Powers your planetary shipyard. Necessary to build larger, more complex vessels.</p>
                  <div className="mt-3 text-[10px] font-black text-white/40">COST: ¤100</div>
                </div>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <h6 className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest mb-1">Pro Tip: Passive Income</h6>
                <p className="text-xs text-slate-400 italic">Every planet you own generates ¤100 baseline. Capturing planets is the fastest way to get rich!</p>
              </div>
            </div>
          )}

          {activeTab === 'FLEET' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
               <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex gap-4 items-center">
                 <div className="text-2xl">🚀</div>
                 <div className="flex-1">
                   <div className="flex justify-between items-center mb-1">
                     <h5 className="text-white font-bold text-sm uppercase">Scout Class</h5>
                     <span className="text-[10px] text-cyan-400 font-black">FAST</span>
                   </div>
                   <p className="text-xs text-slate-400">High speed, low cargo. Perfect for rapid colonization of neutral systems.</p>
                 </div>
               </div>
               <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex gap-4 items-center">
                 <div className="text-2xl">📦</div>
                 <div className="flex-1">
                   <div className="flex justify-between items-center mb-1">
                     <h5 className="text-white font-bold text-sm uppercase">Freighter</h5>
                     <span className="text-[10px] text-amber-400 font-black">LOGISTICS</span>
                   </div>
                   <p className="text-xs text-slate-400">Massive cargo space. Necessary for transporting resources between sectors.</p>
                 </div>
               </div>
               <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex gap-4 items-center">
                 <div className="text-2xl">⚔️</div>
                 <div className="flex-1">
                   <div className="flex justify-between items-center mb-1">
                     <h5 className="text-white font-bold text-sm uppercase">Warship</h5>
                     <span className="text-[10px] text-red-400 font-black">HEAVY</span>
                   </div>
                   <p className="text-xs text-slate-400">High HP and defense. Use these to protect your borders or invade rivals.</p>
                 </div>
               </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-900/80 text-center border-t border-white/5">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-sm transition-all shadow-xl shadow-cyan-900/40 active:scale-95"
          >
            Acknowledge & Return to Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
