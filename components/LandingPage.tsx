
import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 blur-[150px] rounded-full animate-pulse delay-700" />
      
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="w-24 h-24 mb-8 bg-cyan-500 rounded-3xl rotate-12 flex items-center justify-center shadow-[0_0_50px_rgba(34,211,238,0.3)] border-2 border-cyan-300">
           <span className="text-4xl">🚀</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4 italic">
          STELLAR<br/>COMMANDER
        </h1>
        
        <p className="text-slate-400 text-lg md:text-xl max-w-md mb-12 font-medium">
          A cozy adventure across the stars. <br/>
          No stress, just space.
        </p>
        
        <button 
          onClick={onStart}
          className="group relative px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl font-bold text-xl transition-all shadow-2xl shadow-cyan-500/40 hover:scale-105 active:scale-95"
        >
          <span className="relative z-10 flex items-center gap-3">
            Start Mission 
            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
          <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <p className="mt-12 text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold">
          Powered by Jarvis AI
        </p>
      </div>
      
      {/* Floating Stars Decor */}
      {[...Array(20)].map((_, i) => (
        <div 
          key={i} 
          className="absolute bg-white rounded-full opacity-20 animate-ping" 
          style={{
            width: Math.random() * 4 + 'px',
            height: Math.random() * 4 + 'px',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            animationDuration: (Math.random() * 3 + 2) + 's'
          }}
        />
      ))}
    </div>
  );
};

export default LandingPage;
