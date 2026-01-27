
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
  const [showFleetStatus, setShowFleetStatus] = useState(false);

  // Economic HUD Stats
  const economyStats = useMemo(() => {
    const myPlanets = gameState.planets.filter(p => p.owner === gameState.activePlayer);
    let income = 0;
    let totalMines = 0;
    let totalFactories = 0;
    myPlanets.forEach(p => {
      income += (p.mines * 50) + (p.factories * 20) + 100;
      totalMines += p.mines;
      totalFactories += p.factories;
    });
    return { income, totalMines, totalFactories };
  }, [gameState.planets, gameState.activePlayer]);

  // Persistence
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Real-time Hash Listener
  useEffect(() => {
    const handleSync = () => {
      const hash = window.location.hash;
      if (!hash) return;
      try {
        if (hash.startsWith('#join=')) {
          const dataStr = hash.substring(6);
          const compact = JSON.parse(atob(dataStr));
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
        }
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
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        readyPlayers: Array.from(new Set([...prev.readyPlayers, prev.activePlayer])),
        logs: [`📡 BROADCAST: Sector orders for ${prev.playerNames[prev.activePlayer]} are live.`, ...prev.logs].slice(0, 15)
      }));
      setRelayStatus('CONNECTED');
    }, 800);
  };

  const executeTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Turn ${gameState.round} Results ---`];

    // AI Strategic Phase
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
      } catch (e) { console.error(`AI ${aiId} Error`, e); }
    }

    // Physics Phase
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

    // Economics/Capture
    nextPlanets.forEach(planet => {
      const shipsPresent = nextShips.filter(s => Math.abs(s.x - planet.x) < 5 && Math.abs(s.y - planet.y) < 5);
      if (shipsPresent.length > 0 && planet.owner === 'NEUTRAL') {
        const newOwner = shipsPresent[0].owner;
        planet.owner = newOwner;
        newLogs.push(`🚀 ${gameState.playerNames[newOwner]} colonized ${planet.name}!`);
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
          setSelectedId(null);
          setSelectedType(null);
          return;
       }
    }
    setSelectedId(id);
    setSelectedType(type);
  };

  const selectedPlanet = selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null;
  const selectedShip = selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none touch-none font-['Space_Grotesk']">
      
      {/* MOBILE HUD (TOP) */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-12 bg-gradient-to-b from-slate-950/80 to-transparent flex items-center justify-between px-4">
         <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${relayStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/50">RD {gameState.round}</span>
         </div>

         <div className="flex items-center gap-4 bg-slate-900/60 px-3 py-1 rounded-full border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-1.5">
               <span className="text-amber-400 text-xs">💰</span>
               <span className="text-xs font-black text-amber-400">{gameState.playerCredits[gameState.activePlayer]}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
               <span className="text-emerald-400 text-xs">📈</span>
               <span className="text-xs font-black text-emerald-400">+{economyStats.income}</span>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <button onClick={() => setIsInviteModalOpen(true)} className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center text-[10px]">➕</button>
            <button onClick={() => setIsHelpOpen(true)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px]">?</button>
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={handleMapSelect} 
        />

        {/* FLEET STATUS TOGGLE (FLOATING TOP LEFT) */}
        <div className="absolute top-16 left-4 z-40">
           <button 
             onClick={() => setShowFleetStatus(!showFleetStatus)}
             className={`w-10 h-10 rounded-xl glass-card flex items-center justify-center border-white/10 transition-all ${showFleetStatus ? 'bg-cyan-600/20' : ''}`}
           >
              📡
           </button>
           {showFleetStatus && (
              <div className="absolute top-12 left-0 bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 w-40 shadow-2xl animate-in slide-in-from-top-2">
                 <h4 className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-2">Relay Status</h4>
                 <div className="space-y-1">
                    {Array.from({length: gameState.playerCount}).map((_, i) => {
                       const pId = `P${i+1}` as Owner;
                       const isReady = gameState.readyPlayers.includes(pId);
                       return (
                          <div key={pId} className="flex items-center justify-between text-[8px] font-bold">
                             <span style={{ color: PLAYER_COLORS[pId] }}>{gameState.playerNames[pId]}</span>
                             <span className={isReady ? "text-emerald-500" : "text-slate-600"}>{isReady ? 'READY' : '...'}</span>
                          </div>
                       );
                    })}
                 </div>
              </div>
           )}
        </div>

        {/* MOBILE COMMAND DECK (BOTTOM DOCK) */}
        <div className={`absolute bottom-0 left-0 right-0 z-[120] transition-all duration-300 ${selectedId ? 'translate-y-full' : 'translate-y-0'}`}>
          <div className="mx-4 mb-4 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl">
            
            {/* Player Quick-Switcher */}
            <div className="flex gap-1.5 bg-black/40 p-1.5 rounded-2xl">
              {Array.from({length: gameState.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isActive = gameState.activePlayer === pId;
                return (
                  <button 
                    key={i}
                    onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                    className={`w-9 h-9 rounded-xl font-black text-[10px] transition-all border-2 flex items-center justify-center ${isActive ? 'scale-105 border-white shadow-lg' : 'opacity-20 border-transparent'}`}
                    style={{ backgroundColor: PLAYER_COLORS[pId], color: '#000' }}
                  >
                    {pId}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsAdvisorOpen(true)} 
                className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-cyan-500/20 active:scale-90"
              >
                ❂
              </button>
              
              <button 
                onClick={gameState.activePlayer === 'P1' ? executeTurn : broadcastOrders} 
                disabled={isProcessing}
                className={`${gameState.activePlayer === 'P1' ? 'bg-emerald-600' : 'bg-white text-black'} px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95`}
              >
                {isProcessing ? '...' : (gameState.activePlayer === 'P1' ? 'EXECUTE' : 'DEPLOY')}
              </button>
            </div>
          </div>
        </div>

        {/* SECTOR INTEL BOTTOM-SHEET */}
        <div className={`absolute bottom-0 left-0 right-0 z-[130] transition-all duration-500 transform ${selectedId ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="mx-2 bg-slate-900/95 backdrop-blur-3xl border border-white/20 rounded-t-[3rem] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
             <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
             
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h2 className="text-2xl font-bold italic text-white">{selectedPlanet?.name || selectedShip?.name}</h2>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sector Tactical View</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">✕</button>
             </div>
             
             {selectedPlanet && (
               <div className="animate-in slide-in-from-bottom-4 duration-300">
                 {selectedPlanet.owner === gameState.activePlayer ? (
                   <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => {
                            if (gameState.playerCredits[gameState.activePlayer] >= 100) {
                              setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, mines: pl.mines+1} : pl)}));
                            }
                        }} className="p-4 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center group active:scale-95 transition-all">
                           <span className="text-2xl mb-1">🏗️</span>
                           <span className="text-[10px] font-black uppercase">Add Mine</span>
                           <span className="text-[8px] text-amber-500 font-bold">100 Cr</span>
                        </button>
                        <button onClick={() => {
                            if (gameState.playerCredits[gameState.activePlayer] >= 100) {
                              setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, factories: pl.factories+1} : pl)}));
                            }
                        }} className="p-4 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center group active:scale-95 transition-all">
                           <span className="text-2xl mb-1">🏭</span>
                           <span className="text-[10px] font-black uppercase">Add Fact.</span>
                           <span className="text-[8px] text-amber-500 font-bold">100 Cr</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Orbital Shipyard</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                            <button key={type} onClick={() => {
                              const cost = SHIP_COSTS[type as ShipType];
                              if (gameState.playerCredits[gameState.activePlayer] >= cost) {
                                 const newShip: Ship = { id: `s-${Date.now()}`, name: `${gameState.playerNames[gameState.activePlayer]} ${type}`, type: type as ShipType, owner: gameState.activePlayer, x: selectedPlanet!.x, y: selectedPlanet!.y, currentPlanetId: selectedPlanet!.id, cargo: 0, maxCargo: 100, hp: 100, maxHp: 100, status: 'ORBITING' };
                                 setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-cost}, ships: [...p.ships, newShip]}));
                              }
                            }} className="p-3 bg-slate-950 rounded-2xl border border-white/10 flex flex-col items-center active:scale-95 transition-all">
                              <span className="text-xl mb-1">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                              <span className="text-[7px] font-black uppercase">{type}</span>
                              <span className="text-[6px] text-amber-500 font-bold">{SHIP_COSTS[type as ShipType]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                   </div>
                 ) : (
                   <div className="bg-black/40 p-6 rounded-[2rem] text-center border border-white/10">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Sector Allegiance</p>
                      <p className="text-lg font-black" style={{ color: PLAYER_COLORS[selectedPlanet.owner] }}>{gameState.playerNames[selectedPlanet.owner]}</p>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <span className="block text-[7px] text-slate-500 uppercase font-bold">Mines</span>
                          <span className="text-sm font-black">{selectedPlanet.mines}</span>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <span className="block text-[7px] text-slate-500 uppercase font-bold">Factories</span>
                          <span className="text-sm font-black">{selectedPlanet.factories}</span>
                        </div>
                      </div>
                   </div>
                 )}
               </div>
             )}

             {selectedShip && (
               <div className="animate-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-black/40 p-6 rounded-[2rem] border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                       <span className="px-3 py-1 bg-cyan-600/20 rounded-full text-[8px] font-black text-cyan-400 uppercase tracking-widest">{selectedShip.type}</span>
                       <span className="text-[10px] font-bold text-emerald-400">{selectedShip.status}</span>
                    </div>
                    {selectedShip.owner === gameState.activePlayer ? (
                      <div className="p-4 bg-cyan-600/10 border border-cyan-500/20 rounded-2xl text-center">
                        <p className="text-[10px] text-cyan-300 font-bold mb-1">Targeting Protocol</p>
                        <p className="text-[9px] text-white/70 italic">Tap a planet on the map to set course.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center italic">This vessel is encrypted. Tactical data unavailable.</p>
                    )}
                  </div>
               </div>
             )}
          </div>
        </div>
      </main>

      {/* MODALS */}
      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n) => { setGameState(generateInitialState(p, a, undefined, n)); setIsNewGameModalOpen(false); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={`${window.location.origin}${window.location.pathname}#join=${btoa(JSON.stringify({sd: gameState.seed, rd: gameState.round, pc: gameState.playerCount, ai: gameState.aiPlayers, cr: gameState.playerCredits, nm: gameState.playerNames, ps: gameState.planets.map(p => [p.owner, p.mines, p.factories]), ss: gameState.ships.map(s => ({id: s.id, n: s.name, t: s.type, o: s.owner, x: Math.round(s.x), y: Math.round(s.y), st: s.status, tp: s.targetPlanetId, cp: s.currentPlanetId}))}))}`} />

      {/* JOIN OVERLAY */}
      {pendingJoin && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl">
          <div className="w-full max-w-sm glass-card rounded-[3rem] p-10 text-center border-cyan-500/30 shadow-2xl">
            <h2 className="text-3xl font-bold mb-2 italic">GALAXY DETECTED</h2>
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-10">Select Your Command Console</p>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({length: pendingJoin.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isAi = pendingJoin.aiPlayers.includes(pId);
                return (
                  <button
                    key={pId}
                    disabled={isAi}
                    onClick={() => claimCommand(pId)}
                    className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-1 ${isAi ? 'opacity-20 grayscale border-transparent' : 'bg-white/5 border-white/10 active:border-cyan-500 active:scale-95'}`}
                    style={{ color: isAi ? '#475569' : PLAYER_COLORS[pId] }}
                  >
                    <span className="text-2xl font-black">{pId}</span>
                    <span className="text-[8px] font-bold text-white/60 truncate w-full text-center">{pendingJoin.playerNames[pId]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL TRANSITION OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl">
           <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6" />
              <p className="text-xs font-black uppercase tracking-[0.4em] text-cyan-400 animate-pulse">Synchronizing Galaxy...</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
