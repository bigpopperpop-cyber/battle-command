
import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[90vh] glass-card rounded-3xl flex flex-col overflow-hidden border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Manual & Intelligence</h2>
            <p className="text-[10px] text-cyan-400 uppercase tracking-[0.2em] font-bold">Stellar Commander Field Guide</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12">
          {/* Instructions Section */}
          <section>
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-400 rounded-full" /> Instructions
            </h3>
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-xl border-white/5">
                <h4 className="font-bold text-white mb-1">1. Exploration</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Tap a ship, then tap a nearby planet. Press <span className="text-cyan-400 font-bold">"Set Destination"</span>. 
                  Ships move only when you press <span className="text-white font-bold">"End Turn"</span>.
                </p>
              </div>
              <div className="glass-card p-4 rounded-xl border-white/5">
                <h4 className="font-bold text-white mb-1">2. Expansion</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Moving a ship to a <span className="text-slate-500 font-bold">Neutral (Grey)</span> planet will claim it for your empire. 
                  Planets generate credits every turn.
                </p>
              </div>
              <div className="glass-card p-4 rounded-xl border-white/5">
                <h4 className="font-bold text-white mb-1">3. Economy</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Select your planets to build <span className="text-amber-400 font-bold">Mines</span> (increase credit income) or <span className="text-amber-400 font-bold">Factories</span> (necessary for fleet logistics).
                </p>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section>
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-400 rounded-full" /> Frequently Asked Questions
            </h3>
            <div className="space-y-4">
              <details className="group glass-card rounded-xl border-white/5 overflow-hidden">
                <summary className="p-4 cursor-pointer list-none flex justify-between items-center hover:bg-white/5 transition-colors">
                  <span className="text-sm font-bold text-white">How do I get more credits?</span>
                  <span className="text-cyan-400 group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-slate-400 border-t border-white/5 pt-4">
                  Credits are earned automatically at the end of every turn. To increase your earnings, capture more planets and build <span className="text-amber-400 font-semibold">Mines</span> on them.
                </div>
              </details>

              <details className="group glass-card rounded-xl border-white/5 overflow-hidden">
                <summary className="p-4 cursor-pointer list-none flex justify-between items-center hover:bg-white/5 transition-colors">
                  <span className="text-sm font-bold text-white">Who is Admiral Jarvis?</span>
                  <span className="text-cyan-400 group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-slate-400 border-t border-white/5 pt-4">
                  Jarvis is your AI Tactical Advisor. If you're unsure what to do next, tap the ❂ icon at the bottom. You can literally ask him: "What's my best move?" or "Should I build more mines?"
                </div>
              </details>

              <details className="group glass-card rounded-xl border-white/5 overflow-hidden">
                <summary className="p-4 cursor-pointer list-none flex justify-between items-center hover:bg-white/5 transition-colors">
                  <span className="text-sm font-bold text-white">Can I lose the game?</span>
                  <span className="text-cyan-400 group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-slate-400 border-t border-white/5 pt-4">
                  In this current tactical preview, you are safe from total destruction. However, the Red and Purple sectors represent rival factions that will compete for neutral space!
                </div>
              </details>

              <details className="group glass-card rounded-xl border-white/5 overflow-hidden">
                <summary className="p-4 cursor-pointer list-none flex justify-between items-center hover:bg-white/5 transition-colors">
                  <span className="text-sm font-bold text-white">How do I win?</span>
                  <span className="text-cyan-400 group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-slate-400 border-t border-white/5 pt-4">
                  Control the majority of the star systems. Once you have colonized the galaxy, your reign is secure.
                </div>
              </details>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/80 text-center">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-cyan-900/40"
          >
            Acknowledge & Return to Bridge
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
