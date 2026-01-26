
import React, { useState, useEffect } from 'react';
import { GameState, Planet, Ship, Owner } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(8));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHostDashboardOpen, setIsHostDashboardOpen] = useState(false);
  const [setupPlayerCount, setSetupPlayerCount] = useState(8);

  // 1. SMART SHARE (Player Side)
  const shareTurn = async () => {
    const data = btoa(JSON.stringify(gameState));
    const shareText = `COMMAND_DATA:${data}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `Stellar Commander - ${gameState.activePlayer} Orders`, 
          text: `Here are my moves for Round ${gameState.round}!\n\n${shareText}` 
        });
      } catch (err) {
        copyToClipboard(data);
      }
    } else {
      copyToClipboard(data);
    }
  };

  const copyToClipboard = (data: string) => {
    navigator.clipboard.writeText(`COMMAND_DATA:${data}`);
    alert("Orders copied! Send the message to your Host.");
  };

  // 2. SMART MERGE (Host Side)
  const syncFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/COMMAND_DATA:([A-Za-z0-9+/=]+)/);
      const dataStr = match ? match[1] : text.trim();
      
      if (!dataStr) throw new Error();
      
      const incomingState: GameState = JSON.parse(atob(dataStr));
      const sender = incomingState.activePlayer;

      setGameState(prev => {
        if (incomingState.round !== prev.round) {
          alert(`Round Mismatch! Incoming is Round ${incomingState.round}, but Galaxy is Round ${prev.round}.`);
          return prev;
        }

        const mergedPlanets = prev.planets.map(p => 
          p.owner === sender 
            ? incomingState.planets.find(ip => ip.id === p.id) || p 
            : p
        );

        const mergedShips = prev.ships.map(s => 
          s.owner === sender 
            ? incomingState.ships.find(is => is.id === s.id) || s 
            : s
        );

        const newReady = prev.readyPlayers.includes(sender) 
          ? prev.readyPlayers 
          : [...prev.readyPlayers, sender];

        return {
          ...prev,
          planets: mergedPlanets,
          ships: mergedShips,
          readyPlayers: newReady,
          logs: [`📡 Signal received from ${sender}. Assets synchronized.`, ...prev.logs].slice(0, 15)
        };
      });

      alert(`✅ ${sender}'s moves merged into Command!`);
    } catch (e) {
      alert("❌ Could not read move data. Make sure you copied the friend's message!");
    }
  };

  const processGlobalTurn = () => {
    setGameState(prev => {
      const nextPlanets = prev.planets.map(p => ({...p}));
      const nextShips = prev.ships.map(s => ({...s}));
      const newCredits = { ...prev.playerCredits };
      const newLogs = [`--- Turn ${prev.round} Results ---`];

      nextPlanets.forEach(p => {
        if (p.owner !== 'NEUTRAL') {
          const income = (p.mines * 50) + (p.factories * 20) + 100;
          newCredits[p.owner] = (newCredits[p.owner] || 0) + income;
        }
      });

      nextShips.forEach(s => {
        if (s.status === 'MOVING' && s.targetPlanetId) {
          const target = nextPlanets.find(p => p.id === s.targetPlanetId);
          if (target) {
            const dx = target.x - s.x;
            const dy = target.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speed = SHIP_SPEEDS[s.type];

            if (dist < speed) {
              s.x = target.x;
              s.y = target.y;
              s.status = 'ORBITING';
              s.currentPlanetId = target.id;
              if (target.owner === 'NEUTRAL') {
                target.owner = s.owner;
                newLogs.push(`🚀 ${s.owner} has colonized ${target.name}!`);
              }
            } else {
              s.x += (dx / dist) * speed;
              s.y += (dy / dist) * speed;
            }
          }
        }
      });

      return {
        ...prev,
        round: prev.round + 1,
        planets: nextPlanets,
        ships: nextShips,
        playerCredits: newCredits,
        logs: [...newLogs, ...prev.logs].slice(0, 15),
        readyPlayers: [] 
      };
    });
    setIsHostDashboardOpen(false);
  };

  const reinitializeGame = () => {
    if (window.confirm(`Are you sure? This will reset the galaxy for ${setupPlayerCount} players.`)) {
      setGameState(generateInitialState(setupPlayerCount));
      setIsHostDashboardOpen(false);
    }
  };

  const buildAction = (type: 'MINE' | 'FACTORY') => {
    const planet = gameState.planets.find(p => p.id === selectedId);
    const cost = 100;
    if (planet && gameState.playerCredits[gameState.activePlayer] >= cost) {
      setGameState(prev => ({
        ...prev,
        playerCredits: { ...prev.playerCredits, [prev.activePlayer]: prev.playerCredits[prev.activePlayer] - cost },
        planets: prev.planets.map(p => p.id === planet.id ? {
          ...p,
          mines: type === 'MINE' ? p.mines + 1 : p.mines,
          factories: type === 'FACTORY' ? p.factories + 1 : p.factories
        } : p)
      }));
    }
  };

  const setDestination = (planetId: string) => {
    setGameState(prev => ({
      ...prev,
      ships: prev.ships.map(s => s.id === selectedId ? {
        ...s,
        status: 'MOVING',
        targetPlanetId: planetId,
        currentPlanetId: undefined
      } : s)
    }));
    setSelectedId(null);
  };

  const selectedPlanet = selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null;
  const selectedShip = selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none">
      {/* HUD */}
      <header className="h-20 flex items-center justify-between px-6 glass-card border-b-white/5 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase leading-none mb-1">Stellar</span>
            <span className="text-xl font-bold tracking-tight italic">COMMANDER</span>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-4">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Round {gameState.round}</div>
             <div className={`px-4 py-1 rounded-full text-[10px] font-bold border-2 flex items-center gap-2 transition-all`} 
                  style={{ borderColor: PLAYER_COLORS[gameState.activePlayer], color: PLAYER_COLORS[gameState.activePlayer], boxShadow: `0 0 15px ${PLAYER_COLORS[gameState.activePlayer]}44` }}>
               {gameState.activePlayer}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bank</div>
            <div className="text-xl font-bold text-amber-400">¤{gameState.playerCredits[gameState.activePlayer]?.toLocaleString()}</div>
          </div>
          <button 
            onClick={() => setIsHostDashboardOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2"
          >
             📡 Command Center
             {gameState.readyPlayers.length > 0 && (
               <span className="w-5 h-5 bg-cyan-500 text-slate-950 text-[10px] rounded-full flex items-center justify-center font-black animate-pulse">
                 {gameState.readyPlayers.length}
               </span>
             )}
          </button>
        </div>
      </header>

      {/* Map Content */}
      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets}
          ships={gameState.ships}
          selectedId={selectedId}
          onSelect={(id, type) => { setSelectedId(id); setSelectedType(type); }}
        />

        {selectedPlanet && (
          <div className="absolute top-6 left-6 w-80 glass-card rounded-[2rem] p-6 shadow-2xl border-white/10 animate-in fade-in slide-in-from-left-4 duration-300">
             <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedPlanet.name}</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sector {selectedPlanet.id}</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-white">✕</button>
             </div>

             {selectedPlanet.owner === gameState.activePlayer ? (
               <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => buildAction('MINE')} className="flex flex-col items-center justify-center p-4 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors">
                    <span className="text-2xl mb-1">🏗️</span>
                    <span className="text-[10px] font-bold uppercase">Build Mine</span>
                    <span className="text-[10px] text-amber-400">¤100</span>
                  </button>
                  <button onClick={() => buildAction('FACTORY')} className="flex flex-col items-center justify-center p-4 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors">
                    <span className="text-2xl mb-1">🏭</span>
                    <span className="text-[10px] font-bold uppercase">Factory</span>
                    <span className="text-[10px] text-amber-400">¤100</span>
                  </button>
               </div>
             ) : (
               <div className="bg-slate-900/50 p-4 rounded-2xl mb-6 text-center">
                  <p className="text-xs text-slate-400 italic">This planet is controlled by {selectedPlanet.owner}.</p>
               </div>
             )}

             {selectedShip && selectedShip.owner === gameState.activePlayer && selectedShip.currentPlanetId !== selectedPlanet.id && (
                <button onClick={() => setDestination(selectedPlanet.id)} className="w-full py-4 bg-cyan-600 rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/30 active:scale-95 transition-all">
                  🚀 SEND FLEET HERE
                </button>
             )}
          </div>
        )}

        {/* Logs */}
        <div className="absolute bottom-6 left-6 w-80 glass-card rounded-2xl p-4 bg-[#050b1a]/80">
          <h4 className="text-[10px] font-bold uppercase text-cyan-400 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Subspace Feed
          </h4>
          <div className="h-24 overflow-y-auto space-y-2 pr-2 text-xs text-slate-300">
            {gameState.logs.map((log, i) => <div key={i} className="pb-2 border-b border-white/5 last:border-0">{log}</div>)}
          </div>
        </div>

        <div className="absolute bottom-6 right-6 flex items-center gap-3">
           <button onClick={shareTurn} className="bg-cyan-600 hover:bg-cyan-500 px-6 py-4 rounded-3xl font-bold text-sm shadow-xl shadow-cyan-900/40 transition-all active:scale-95 flex items-center gap-2">
             📤 Send Moves
           </button>
        </div>
      </main>

      {/* Host Dashboard Drawer */}
      {isHostDashboardOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsHostDashboardOpen(false)} />
          <div className="relative w-full max-w-sm h-full glass-card border-l border-white/10 p-8 flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold">Command Center</h2>
               <button onClick={() => setIsHostDashboardOpen(false)} className="text-slate-500 text-xl">✕</button>
            </div>

            {/* New Mission / Player Count Selector */}
            <div className="mb-8 p-5 bg-cyan-950/20 border border-cyan-500/20 rounded-3xl">
               <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">Sector Setup</h3>
               <div className="flex items-center justify-between mb-4">
                 <span className="text-sm font-bold">Player Count: {setupPlayerCount}</span>
                 <input 
                    type="range" min="2" max="8" step="1" 
                    value={setupPlayerCount} 
                    onChange={(e) => setSetupPlayerCount(parseInt(e.target.value))}
                    className="accent-cyan-500"
                 />
               </div>
               <button onClick={reinitializeGame} className="w-full py-3 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-600/30 rounded-xl text-[10px] font-black uppercase tracking-widest">
                 Re-initialize Galaxy
               </button>
            </div>

            <div className="flex-1 space-y-2 mb-8">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Commander Readiness</div>
              {Array.from({length: gameState.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isReady = gameState.readyPlayers.includes(pId);
                return (
                  <div key={pId} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[pId] }} />
                      <span className="font-bold text-xs">P{i+1}</span>
                    </div>
                    {isReady ? (
                      <span className="text-emerald-400 text-[10px] font-bold">✅ READY</span>
                    ) : (
                      <span className="text-slate-600 text-[10px] font-bold italic">WAITING</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
               <button onClick={syncFromClipboard} className="w-full py-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                 📥 Sync Moves
               </button>
               <button 
                  onClick={processGlobalTurn} 
                  disabled={gameState.readyPlayers.length < gameState.playerCount - 1}
                  className="w-full py-5 bg-cyan-600 disabled:opacity-30 disabled:grayscale rounded-2xl font-bold text-base shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
               >
                 🚀 START NEW TURN
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Nav */}
      <footer className="h-24 glass-card border-t-white/5 flex items-center justify-between px-6 md:px-10">
        <div className="flex gap-2 md:gap-3 flex-wrap max-w-[70%]">
          {Array.from({length: gameState.playerCount}).map((_, i) => {
            const pId = `P${i+1}` as Owner;
            const isActive = gameState.activePlayer === pId;
            return (
              <button 
                key={i}
                onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl font-black text-[10px] md:text-sm transition-all border-2 flex items-center justify-center ${isActive ? 'scale-110 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'opacity-30 hover:opacity-100'}`}
                style={{ 
                  borderColor: PLAYER_COLORS[pId],
                  backgroundColor: isActive ? `${PLAYER_COLORS[pId]}22` : 'transparent',
                  color: PLAYER_COLORS[pId],
                  boxShadow: isActive ? `0 0 15px ${PLAYER_COLORS[pId]}33` : 'none'
                }}
              >
                P{i+1}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="w-10 h-10 md:w-12 md:h-12 glass-card rounded-2xl flex items-center justify-center text-slate-400 hover:text-white"
          >
            ？
          </button>
          <button 
            onClick={() => setIsAdvisorOpen(true)}
            className="w-14 h-14 md:w-16 md:h-16 bg-cyan-500 rounded-full flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30 hover:scale-110 transition-transform active:rotate-12"
          >
            ❂
          </button>
        </div>
      </footer>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default App;
