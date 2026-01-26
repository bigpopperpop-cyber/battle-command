
import React, { useState, useEffect } from 'react';
import { GameState, Planet, Ship, Owner } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(4));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 1. NATIVE SHARING (The "Easy" Way)
  const shareTurn = async () => {
    const data = btoa(JSON.stringify(gameState));
    const shareText = `Commander! Here are the fleet orders for ${gameState.activePlayer} (Round ${gameState.round}):\n\nCOMMAND_DATA:${data}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Stellar Commander Orders', text: shareText });
      } catch (err) {
        copyToClipboard(data);
      }
    } else {
      copyToClipboard(data);
    }
  };

  const copyToClipboard = (data: string) => {
    navigator.clipboard.writeText(data);
    alert("Orders copied to clipboard! Paste them into your chat with the Host.");
  };

  // 2. CLIPBOARD SYNC (The Host's best friend)
  const syncFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/COMMAND_DATA:(.*)/) || [null, text];
      const dataStr = match[1]?.trim();
      
      if (!dataStr) throw new Error();
      
      const decoded = JSON.parse(atob(dataStr));
      if (decoded.round && decoded.planets) {
        setGameState(decoded);
        alert("✅ Sector Data Synchronized!");
      }
    } catch (e) {
      alert("❌ No valid command data found in your clipboard. Make sure you copied the friend's message first!");
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
        logs: [...prev.logs, ...newLogs].slice(-10),
        readyPlayers: [] // Reset for next turn
      };
    });
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
      {/* Friendly HUD */}
      <header className="h-20 flex items-center justify-between px-6 glass-card border-b-white/5 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase leading-none mb-1">Stellar</span>
            <span className="text-xl font-bold tracking-tight italic">COMMANDER</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className={`px-4 py-1 rounded-full text-xs font-bold border-2 flex items-center gap-2`} 
               style={{ borderColor: PLAYER_COLORS[gameState.activePlayer], color: PLAYER_COLORS[gameState.activePlayer] }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: PLAYER_COLORS[gameState.activePlayer] }} />
            {gameState.activePlayer}'S TURN
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bank</div>
            <div className="text-xl font-bold text-amber-400">¤{gameState.playerCredits[gameState.activePlayer]?.toLocaleString()}</div>
          </div>
          <button onClick={processGlobalTurn} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-2xl font-bold shadow-lg shadow-emerald-900/40 transition-all active:scale-95">
             🚀 PROCESS GALAXY
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

        {/* Simplifed Context Menu */}
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

        {/* Sync Controls */}
        <div className="absolute top-6 right-6 flex flex-col gap-3">
           <button onClick={shareTurn} className="glass-card px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest text-cyan-400 hover:bg-cyan-400/10 flex items-center gap-2">
             📤 Send Moves to Host
           </button>
           <button onClick={syncFromClipboard} className="glass-card px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-400/10 flex items-center gap-2">
             📥 Sync Friend's Move
           </button>
        </div>

        {/* Logs */}
        <div className="absolute bottom-6 left-6 w-80 glass-card rounded-2xl p-4 bg-[#050b1a]/80">
          <h4 className="text-[10px] font-bold uppercase text-cyan-400 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Subspace Logs
          </h4>
          <div className="h-24 overflow-y-auto space-y-2 pr-2 text-xs text-slate-300">
            {gameState.logs.map((log, i) => <div key={i} className="pb-2 border-b border-white/5 last:border-0">{log}</div>)}
          </div>
        </div>
      </main>

      {/* Simple Player Switching */}
      <footer className="h-24 glass-card border-t-white/5 flex items-center justify-between px-10">
        <div className="flex gap-3">
          {Array.from({length: gameState.playerCount}).map((_, i) => {
            const pId = `P${i+1}` as Owner;
            return (
              <button 
                key={i}
                onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                className={`w-12 h-12 rounded-2xl font-bold text-sm transition-all flex flex-col items-center justify-center border-2 ${gameState.activePlayer === pId ? 'scale-110 shadow-xl' : 'opacity-40'}`}
                style={{ 
                  borderColor: PLAYER_COLORS[pId],
                  backgroundColor: gameState.activePlayer === pId ? `${PLAYER_COLORS[pId]}22` : 'transparent',
                  color: PLAYER_COLORS[pId]
                }}
              >
                {pId}
              </button>
            );
          })}
        </div>

        <button 
          onClick={() => setIsAdvisorOpen(true)}
          className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30 hover:scale-110 transition-transform active:rotate-12"
        >
          ❂
        </button>
      </footer>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
    </div>
  );
};

export default App;
