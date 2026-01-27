
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Planet, Ship, Owner, ShipType } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import { getAiMoves } from './services/geminiService';

const SAVE_KEY = 'stellar_commander_save';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error("Save Corrupt", e); }
    }
    return generateInitialState(2, 0);
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<GameState | null>(null);
  const [relayStatus, setRelayStatus] = useState<'CONNECTED' | 'SYNCING' | 'OFFLINE'>('CONNECTED');
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Responsive Orientation Listener
  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Subspace Relay Listener (Simulates Firebase Real-time Sync)
  useEffect(() => {
    const handleSync = () => {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#join=')) return;
      try {
        const dataStr = hash.substring(6);
        const compact = JSON.parse(atob(dataStr));
        // Reconstruct state from compact relay data
        const baseState = generateInitialState(compact.pc, compact.ai.length, compact.sd, compact.nm);
        baseState.round = compact.rd;
        baseState.playerCredits = compact.cr;
        baseState.aiPlayers = compact.ai;
        compact.ps.forEach((pState: any, i: number) => {
          if (baseState.planets[i]) {
            baseState.planets[i].owner = pState[0];
            baseState.planets[i].mines = pState[1];
            baseState.planets[i].factories = pState[2];
          }
        });
        baseState.ships = compact.ss.map((s: any) => ({
          id: s.id, name: s.n, type: s.t, owner: s.o, x: s.x, y: s.y,
          status: s.st, targetPlanetId: s.tp, currentPlanetId: s.cp,
          cargo: 0, maxCargo: 100, hp: 100, maxHp: 100
        }));
        setPendingJoin(baseState);
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) { console.error("Relay Sync Failed", e); }
    };
    handleSync();
    window.addEventListener('hashchange', handleSync);
    return () => window.removeEventListener('hashchange', handleSync);
  }, []);

  const claimCommand = (pId: Owner) => {
    if (pendingJoin) {
      setGameState({ ...pendingJoin, activePlayer: pId });
      setPendingJoin(null);
      setRelayStatus('CONNECTED');
    }
  };

  const broadcastOrders = async () => {
    setRelayStatus('SYNCING');
    // Simulated network latency
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        readyPlayers: Array.from(new Set([...prev.readyPlayers, prev.activePlayer])),
        logs: [`📡 RELAY: Commander ${prev.playerNames[prev.activePlayer]} orders confirmed.`, ...prev.logs].slice(0, 10)
      }));
      setRelayStatus('CONNECTED');
    }, 600);
  };

  const executeTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Turn ${gameState.round} Processed ---`];

    // AI Logic Integration
    for (const aiId of gameState.aiPlayers) {
      try {
        const moves = await getAiMoves(gameState, aiId);
        if (moves.shipOrders) {
          moves.shipOrders.forEach((order: any) => {
            const ship = nextShips.find(s => s.id === order.shipId);
            if (ship) { ship.status = 'MOVING'; ship.targetPlanetId = order.targetPlanetId; ship.currentPlanetId = undefined; }
          });
        }
        if (moves.planetOrders) {
          moves.planetOrders.forEach((order: any) => {
            const planet = nextPlanets.find(p => p.id === order.planetId);
            if (planet && nextCredits[aiId] >= 100) {
              nextCredits[aiId] -= 100;
              if (order.build === 'MINE') planet.mines++; else planet.factories++;
            }
          });
        }
      } catch (e) { console.error(`AI ${aiId} Logic Failure`, e); }
    }

    // Physics / Movement
    nextShips.forEach(s => {
      if (s.status === 'MOVING' && s.targetPlanetId) {
        const target = nextPlanets.find(p => p.id === s.targetPlanetId);
        if (target) {
          const dx = target.x - s.x; const dy = target.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = SHIP_SPEEDS[s.type as keyof typeof SHIP_SPEEDS] || 100;
          if (dist <= speed) { s.x = target.x; s.y = target.y; s.status = 'ORBITING'; s.currentPlanetId = target.id; }
          else { s.x += (dx / dist) * speed; s.y += (dy / dist) * speed; }
        }
      }
    });

    // Capture & Economy
    nextPlanets.forEach(planet => {
      const shipsPresent = nextShips.filter(s => Math.abs(s.x - planet.x) < 5 && Math.abs(s.y - planet.y) < 5);
      if (shipsPresent.length > 0 && planet.owner === 'NEUTRAL') {
        planet.owner = shipsPresent[0].owner;
        newLogs.push(`🚀 ${gameState.playerNames[planet.owner]} captured ${planet.name}`);
      }
      if (planet.owner !== 'NEUTRAL') {
        const income = (planet.mines * 50) + (planet.factories * 20) + 100;
        nextCredits[planet.owner] = (nextCredits[planet.owner] || 0) + income;
      }
    });

    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      logs: [...newLogs, ...prev.logs].slice(0, 15),
      readyPlayers: [] 
    }));
    setIsProcessing(false);
    setSelectedId(null);
  };

  const handleMapSelect = (id: string, type: 'PLANET' | 'SHIP') => {
    if (selectedType === 'SHIP' && type === 'PLANET' && selectedId) {
       const ship = gameState.ships.find(s => s.id === selectedId);
       if (ship && ship.owner === gameState.activePlayer) {
          setGameState(prev => ({
            ...prev,
            ships: prev.ships.map(s => s.id === selectedId ? { ...s, status: 'MOVING', targetPlanetId: id, currentPlanetId: undefined } : s)
          }));
          setSelectedId(null); setSelectedType(null); return;
       }
    }
    setSelectedId(id);
    setSelectedType(type);
  };

  const economyStats = useMemo(() => {
    const myPlanets = gameState.planets.filter(p => p.owner === gameState.activePlayer);
    const income = myPlanets.reduce((acc, p) => acc + (p.mines * 50) + (p.factories * 20) + 100, 0);
    return { income };
  }, [gameState.planets, gameState.activePlayer]);

  // Fix: Added memoized selection helpers to resolve "Cannot find name" errors for selectedPlanet and selectedShip
  const selectedPlanet = useMemo(() => 
    selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null
  , [selectedId, selectedType, gameState.planets]);

  const selectedShip = useMemo(() => 
    selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null
  , [selectedId, selectedType, gameState.ships]);

  // Persistence
  useEffect(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); }, [gameState]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none touch-none font-['Space_Grotesk']">
      
      {/* SLIM HUD (TOP) */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-10 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between px-6">
         <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${relayStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">RD {gameState.round}</span>
         </div>

         <div className="flex items-center gap-6 bg-slate-900/40 px-4 py-1 rounded-full border border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
               <span className="text-amber-400 text-xs">💰</span>
               <span className="text-xs font-black text-amber-400">{gameState.playerCredits[gameState.activePlayer]}</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-emerald-400 text-xs">📈</span>
               <span className="text-xs font-black text-emerald-400">+{economyStats.income}</span>
            </div>
         </div>

         <div className="flex items-center gap-3">
            <button onClick={() => setIsInviteModalOpen(true)} className="w-8 h-8 rounded-lg bg-cyan-600/10 flex items-center justify-center text-xs">🔗</button>
            <button onClick={() => setIsHelpOpen(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">?</button>
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={handleMapSelect} 
        />

        {/* DUAL-ORIENTATION ACTION HUB */}
        <div className={`absolute z-[120] flex transition-all duration-300 ${isLandscape ? 'bottom-6 right-6 flex-col items-end gap-3' : 'bottom-0 left-0 right-0 p-4 justify-between bg-gradient-to-t from-slate-950 to-transparent translate-y-0'}`}>
           {/* Orientation-specific player switcher */}
           <div className={`flex gap-1.5 bg-slate-900/80 p-2 rounded-2xl border border-white/10 backdrop-blur-xl ${isLandscape ? 'flex-col' : ''}`}>
              {Array.from({length: gameState.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isActive = gameState.activePlayer === pId;
                return (
                  <button 
                    key={i}
                    onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                    className={`w-9 h-9 rounded-xl font-black text-[9px] transition-all border-2 flex items-center justify-center ${isActive ? 'scale-105 border-white shadow-lg shadow-white/10' : 'opacity-20 border-transparent'}`}
                    style={{ backgroundColor: PLAYER_COLORS[pId], color: '#000' }}
                  >
                    {pId}
                  </button>
                );
              })}
           </div>

           <div className={`flex items-center gap-3 ${isLandscape ? 'flex-col' : ''}`}>
              <button 
                onClick={() => setIsAdvisorOpen(true)} 
                className="w-14 h-14 bg-cyan-500 rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-cyan-500/30 active:scale-90 border-b-4 border-cyan-700"
              >
                ❂
              </button>
              
              <button 
                onClick={gameState.activePlayer === 'P1' ? executeTurn : broadcastOrders} 
                disabled={isProcessing}
                className={`${gameState.activePlayer === 'P1' ? 'bg-emerald-600 border-emerald-800' : 'bg-white text-black border-slate-300'} px-8 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4`}
              >
                {isProcessing ? 'SYNC' : (gameState.activePlayer === 'P1' ? 'EXECUTE' : 'DEPLOY')}
              </button>
           </div>
        </div>

        {/* TACTICAL INTELLIGENCE PANEL (Dual-Wing Responsive) */}
        <div className={`absolute transition-all duration-500 ease-out z-[130] 
          ${isLandscape 
            ? `top-14 bottom-14 left-0 w-80 ${selectedId ? 'translate-x-4' : '-translate-x-full'}` 
            : `bottom-0 left-0 right-0 ${selectedId ? 'translate-y-0' : 'translate-y-full'}`
          }`}
        >
          <div className={`${isLandscape ? 'h-full w-full rounded-[2.5rem]' : 'mx-2 rounded-t-[3rem]'} bg-slate-900/95 backdrop-blur-3xl border border-white/20 p-6 flex flex-col shadow-2xl`}>
             {!isLandscape && <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />}
             
             <div className="flex justify-between items-start mb-6">
                <div className="max-w-[80%]">
                   <h2 className="text-2xl font-bold italic text-white truncate">{selectedPlanet?.name || selectedShip?.name || 'Unknown Object'}</h2>
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tactical Scan Overlay</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400">✕</button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                {selectedPlanet && (
                  <div className="space-y-6">
                    {selectedPlanet.owner === gameState.activePlayer ? (
                      <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => {
                                if (gameState.playerCredits[gameState.activePlayer] >= 100) {
                                  setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, mines: pl.mines+1} : pl)}));
                                }
                            }} className="p-4 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center active:scale-95">
                               <span className="text-xl mb-1">🏗️</span>
                               <span className="text-[10px] font-black uppercase">Mine</span>
                               <span className="text-[8px] text-amber-500 font-bold">100 Cr</span>
                            </button>
                            <button onClick={() => {
                                if (gameState.playerCredits[gameState.activePlayer] >= 100) {
                                  setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, factories: pl.factories+1} : pl)}));
                                }
                            }} className="p-4 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center active:scale-95">
                               <span className="text-xl mb-1">🏭</span>
                               <span className="text-[10px] font-black uppercase">Factory</span>
                               <span className="text-[8px] text-amber-500 font-bold">100 Cr</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-center mb-1">Orbital Yard</h4>
                            {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                              <button key={type} onClick={() => {
                                const cost = SHIP_COSTS[type as ShipType];
                                if (gameState.playerCredits[gameState.activePlayer] >= cost) {
                                   const newShip: Ship = { id: `s-${Date.now()}`, name: `${gameState.playerNames[gameState.activePlayer]} ${type}`, type: type as ShipType, owner: gameState.activePlayer, x: selectedPlanet!.x, y: selectedPlanet!.y, currentPlanetId: selectedPlanet!.id, cargo: 0, maxCargo: 100, hp: 100, maxHp: 100, status: 'ORBITING' };
                                   setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-cost}, ships: [...p.ships, newShip]}));
                                }
                              }} className="p-4 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between active:scale-98">
                                <div className="flex items-center gap-3">
                                   <span className="text-lg">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                                   <span className="text-[10px] font-black uppercase tracking-wider">{type}</span>
                                </div>
                                <span className="text-[10px] text-amber-500 font-bold">{SHIP_COSTS[type as ShipType]} Cr</span>
                              </button>
                            ))}
                          </div>
                      </div>
                    ) : (
                      <div className="bg-black/40 p-6 rounded-[2.5rem] border border-white/5 text-center">
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 italic">Under Control Of</p>
                          <p className="text-lg font-black" style={{ color: PLAYER_COLORS[selectedPlanet.owner] }}>{gameState.playerNames[selectedPlanet.owner]}</p>
                          <div className="grid grid-cols-2 gap-3 mt-6">
                            <div className="bg-white/5 p-4 rounded-3xl">
                              <span className="block text-[7px] text-slate-500 font-bold uppercase">Mines</span>
                              <span className="text-lg font-black">{selectedPlanet.mines}</span>
                            </div>
                            <div className="bg-white/5 p-4 rounded-3xl">
                              <span className="block text-[7px] text-slate-500 font-bold uppercase">Fact.</span>
                              <span className="text-lg font-black">{selectedPlanet.factories}</span>
                            </div>
                          </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedShip && (
                   <div className="bg-black/50 p-6 rounded-[2.5rem] border border-white/10 space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="px-3 py-1 bg-cyan-600/20 rounded-full text-[8px] font-black text-cyan-400 uppercase tracking-[0.2em]">{selectedShip.type}</span>
                        <span className="text-[10px] font-bold text-emerald-400 animate-pulse">{selectedShip.status}</span>
                     </div>
                     {selectedShip.owner === gameState.activePlayer ? (
                       <div className="p-5 bg-cyan-600/10 border border-cyan-500/30 rounded-3xl text-center">
                         <p className="text-[10px] text-cyan-300 font-black mb-1">NAV PROTOCOL ACTIVE</p>
                         <p className="text-[9px] text-white/50 italic leading-relaxed">Select a planet in the sector to initiate jump-drive.</p>
                       </div>
                     ) : (
                       <p className="text-[10px] text-slate-600 text-center italic">Encryption too strong for passive scanners.</p>
                     )}
                   </div>
                )}
             </div>
          </div>
        </div>
      </main>

      {/* OVERLAYS */}
      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n) => { setGameState(generateInitialState(p, a, undefined, n)); setIsNewGameModalOpen(false); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={`${window.location.origin}${window.location.pathname}#join=${btoa(JSON.stringify({sd: gameState.seed, rd: gameState.round, pc: gameState.playerCount, ai: gameState.aiPlayers, cr: gameState.playerCredits, nm: gameState.playerNames, ps: gameState.planets.map(p => [p.owner, p.mines, p.factories]), ss: gameState.ships.map(s => ({id: s.id, n: s.name, t: s.type, o: s.owner, x: Math.round(s.x), y: Math.round(s.y), st: s.status, tp: s.targetPlanetId, cp: s.currentPlanetId}))}))}`} />

      {pendingJoin && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl">
          <div className="w-full max-sm glass-card rounded-[3rem] p-10 text-center border-cyan-500/30 shadow-[0_0_80px_rgba(34,211,238,0.2)]">
            <h2 className="text-3xl font-bold mb-2 italic">GALAXY DETECTED</h2>
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-10">Synchronizing Subspace Feed</p>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({length: pendingJoin.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isAi = pendingJoin.aiPlayers.includes(pId);
                return (
                  <button
                    key={pId}
                    disabled={isAi}
                    onClick={() => claimCommand(pId)}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-1 ${isAi ? 'opacity-20 grayscale' : 'bg-white/5 border-white/10 active:scale-95'}`}
                    style={{ color: isAi ? '#475569' : PLAYER_COLORS[pId] }}
                  >
                    <span className="text-2xl font-black">{pId}</span>
                    <span className="text-[8px] font-bold text-white/40 truncate w-full text-center">{pendingJoin.playerNames[pId]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/95 backdrop-blur-3xl">
           <div className="flex flex-col items-center">
              <div className="w-14 h-14 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 animate-pulse">Relaying Galactic Flux...</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
