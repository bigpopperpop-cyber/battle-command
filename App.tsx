
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
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

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

  // Real-time Hash Listener (Simulated Subspace Relay)
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
      const newState = { ...pendingJoin, activePlayer: pId };
      setGameState(newState);
      setPendingJoin(null);
      setRelayStatus('CONNECTED');
    }
  };

  const getShareableData = (state: GameState) => {
    const compact = {
      sd: state.seed, rd: state.round, pc: state.playerCount, ai: state.aiPlayers,
      cr: state.playerCredits, nm: state.playerNames,
      ps: state.planets.map(p => [p.owner, p.mines, p.factories]),
      ss: state.ships.map(s => ({
        id: s.id, n: s.name, t: s.type, o: s.owner, x: Math.round(s.x), y: Math.round(s.y), st: s.status, tp: s.targetPlanetId, cp: s.currentPlanetId
      }))
    };
    return btoa(JSON.stringify(compact));
  };

  const broadcastOrders = async () => {
    setRelayStatus('SYNCING');
    // In a real Firebase app, this would be: db.collection('orders').doc(round).set(myOrders)
    // For now, we simulate the pulse.
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        readyPlayers: Array.from(new Set([...prev.readyPlayers, prev.activePlayer])),
        logs: [`📡 BROADCAST: Sector orders for ${prev.playerNames[prev.activePlayer]} are live.`, ...prev.logs].slice(0, 15)
      }));
      setRelayStatus('CONNECTED');
      setLastSyncTime(new Date());
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

    // Physics/Movement Phase
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

    // Colonization Phase
    nextPlanets.forEach(planet => {
      const shipsPresent = nextShips.filter(s => Math.abs(s.x - planet.x) < 5 && Math.abs(s.y - planet.y) < 5);
      if (shipsPresent.length > 0 && planet.owner === 'NEUTRAL') {
        const newOwner = shipsPresent[0].owner;
        planet.owner = newOwner;
        planet.population = 500;
        newLogs.push(`🚀 ${gameState.playerNames[newOwner]} colonized ${planet.name}!`);
      }
    });

    // Economic Phase
    nextPlanets.forEach(p => {
      if (p.owner !== 'NEUTRAL') {
        const income = (p.mines * 50) + (p.factories * 20) + 100;
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;
      }
    });

    const nextRoundState: GameState = {
      ...gameState,
      round: gameState.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      logs: [...newLogs, ...gameState.logs].slice(0, 15),
      readyPlayers: [] 
    };

    setGameState(nextRoundState);
    setIsProcessing(false);
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
      
      {/* SUBSPACE RELAY STRIP (TOP) */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-14 bg-slate-900/40 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-6">
         <div className="flex items-center gap-4">
            <div className="flex flex-col">
               <span className="text-[7px] font-black tracking-[0.3em] text-cyan-400 uppercase leading-none mb-1">Bridge Link</span>
               <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${relayStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="text-[10px] font-bold tracking-tighter text-white/70">
                    {relayStatus === 'CONNECTED' ? 'SIGNAL ESTABLISHED' : 'SYNCING RELAY...'}
                  </span>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-8 bg-black/20 px-6 py-2 rounded-2xl border border-white/5">
            <div className="flex flex-col items-center">
               <span className="text-[7px] font-black uppercase text-amber-500/60">Credits</span>
               <span className="text-sm font-black text-amber-400 leading-none">{gameState.playerCredits[gameState.activePlayer]}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
               <span className="text-[7px] font-black uppercase text-emerald-500/60">Income</span>
               <span className="text-sm font-black text-emerald-400 leading-none">+{economyStats.income}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
               <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Rd</span>
               <span className="text-sm font-black text-cyan-400 leading-none">{gameState.round}</span>
            </div>
         </div>

         <div className="flex items-center gap-3">
            <button onClick={() => setIsHelpOpen(true)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs">?</button>
            <button onClick={() => setIsInviteModalOpen(true)} className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-600/40 transition-all">Recruit</button>
         </div>
      </div>

      <main className="flex-1 relative mt-14">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={handleMapSelect} 
        />
        
        {/* ACTION CLUSTER (BOTTOM RIGHT - THE THUMB ZONE) */}
        <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-40">
           {/* READY LIST PANEL */}
           <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 w-48 shadow-2xl animate-in slide-in-from-right-4">
              <h4 className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Live Fleet Status</h4>
              <div className="space-y-1.5">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isReady = gameState.readyPlayers.includes(pId);
                    return (
                       <div key={pId} className="flex items-center justify-between text-[9px] font-bold">
                          <span style={{ color: PLAYER_COLORS[pId] }}>{gameState.playerNames[pId]}</span>
                          <span className={isReady ? "text-emerald-500" : "text-slate-600"}>{isReady ? 'DEPLOYED' : 'WAITING'}</span>
                       </div>
                    );
                 })}
              </div>
           </div>

           <button onClick={() => setIsAdvisorOpen(true)} className="w-14 h-14 bg-cyan-500 rounded-2xl flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30 active:scale-90 transition-all">❂</button>
           
           <button 
             onClick={gameState.activePlayer === 'P1' ? executeTurn : broadcastOrders} 
             disabled={isProcessing}
             className={`${gameState.activePlayer === 'P1' ? 'bg-emerald-600' : 'bg-cyan-600'} px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-90 border-b-4 border-black/20 flex items-center gap-3`}
           >
             {isProcessing ? 'PROCESSING...' : (gameState.activePlayer === 'P1' ? '🚀 EXECUTE MISSION' : '📡 DEPLOY ORDERS')}
           </button>
        </div>

        {/* SIDE DRAWER: SECTOR INTEL */}
        {selectedPlanet && (
          <div className="absolute top-4 bottom-4 left-4 w-72 glass-card rounded-[2.5rem] p-6 shadow-2xl border-white/10 animate-in slide-in-from-left-4 duration-300 z-50 overflow-y-auto">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h2 className="text-xl font-bold leading-tight italic">{selectedPlanet.name}</h2>
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Sector Intelligence</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-slate-400">✕</button>
             </div>
             
             {selectedPlanet.owner === gameState.activePlayer ? (
               <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => {
                        if (gameState.playerCredits[gameState.activePlayer] >= 100) {
                          setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, mines: pl.mines+1} : pl)}));
                        }
                    }} className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex flex-col items-center group active:bg-cyan-500/20">
                       <span className="text-2xl mb-1 group-active:scale-125 transition-transform">🏗️</span>
                       <span className="text-[9px] font-black uppercase">Mine</span>
                       <span className="text-[7px] text-amber-500 font-bold">100 Cr</span>
                    </button>
                    <button onClick={() => {
                        if (gameState.playerCredits[gameState.activePlayer] >= 100) {
                          setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, factories: pl.factories+1} : pl)}));
                        }
                    }} className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex flex-col items-center group active:bg-cyan-500/20">
                       <span className="text-2xl mb-1 group-active:scale-125 transition-transform">🏭</span>
                       <span className="text-[9px] font-black uppercase">Factory</span>
                       <span className="text-[7px] text-amber-500 font-bold">100 Cr</span>
                    </button>
                 </div>
                 <div className="h-px bg-white/5" />
                 <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Shipyard Console</h4>
                 <div className="grid grid-cols-3 gap-2">
                    {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                      <button key={type} onClick={() => {
                        const cost = SHIP_COSTS[type as ShipType];
                        if (gameState.playerCredits[gameState.activePlayer] >= cost) {
                           const newShip: Ship = { id: `s-${Date.now()}`, name: `${gameState.playerNames[gameState.activePlayer]} ${type}`, type: type as ShipType, owner: gameState.activePlayer, x: selectedPlanet.x, y: selectedPlanet.y, currentPlanetId: selectedPlanet.id, cargo: 0, maxCargo: 100, hp: 100, maxHp: 100, status: 'ORBITING' };
                           setGameState(p => ({...p, playerCredits: {...p.playerCredits, [p.activePlayer]: p.playerCredits[p.activePlayer]-cost}, ships: [...p.ships, newShip]}));
                        }
                      }} className="p-3 bg-slate-950/80 rounded-xl border border-white/5 flex flex-col items-center hover:border-cyan-500/50 active:scale-95 transition-all">
                        <span className="text-lg">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                        <span className="text-[6px] font-black mt-1 uppercase">{type}</span>
                      </button>
                    ))}
                 </div>
               </div>
             ) : (
               <div className="bg-slate-950/50 p-6 rounded-3xl text-center border border-white/5">
                 <p className="text-[10px] text-slate-500 italic mb-1 uppercase tracking-widest">Controlled By</p>
                 <p className="font-bold text-white text-sm" style={{ color: PLAYER_COLORS[selectedPlanet.owner] }}>{gameState.playerNames[selectedPlanet.owner] || selectedPlanet.owner}</p>
                 <div className="mt-4 flex flex-col gap-2">
                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-500"><span>Infrastructure</span><span>{selectedPlanet.mines + selectedPlanet.factories} Units</span></div>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden"><div className="bg-cyan-500 h-full" style={{ width: '40%' }} /></div>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* PLAYER SELECTOR (BOTTOM LEFT) */}
        <div className="absolute bottom-6 left-6 flex gap-2 z-40 bg-slate-900/60 p-2 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl">
          {Array.from({length: gameState.playerCount}).map((_, i) => {
            const pId = `P${i+1}` as Owner;
            const isActive = gameState.activePlayer === pId;
            return (
              <button 
                key={i}
                onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                className={`w-10 h-10 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center relative ${isActive ? 'scale-110 shadow-lg' : 'opacity-40 hover:opacity-100'}`}
                style={{ 
                   borderColor: PLAYER_COLORS[pId], 
                   backgroundColor: isActive ? `${PLAYER_COLORS[pId]}22` : 'transparent', 
                   color: PLAYER_COLORS[pId] 
                }}
              >
                {pId}
              </button>
            );
          })}
        </div>
      </main>

      {/* SESSION LOADING OVERLAY */}
      {pendingJoin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl">
          <div className="max-w-md w-full glass-card rounded-[3rem] p-10 text-center border-cyan-500/30">
            <h2 className="text-3xl font-bold mb-1 italic">RELAY DETECTED</h2>
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-10">Select Your Console</p>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({length: pendingJoin.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isAi = pendingJoin.aiPlayers.includes(pId);
                return (
                  <button
                    key={pId}
                    disabled={isAi}
                    onClick={() => claimCommand(pId)}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${isAi ? 'opacity-20 grayscale' : 'bg-slate-900/50 border-white/10 hover:border-cyan-500 active:scale-95'}`}
                    style={{ color: isAi ? '#475569' : PLAYER_COLORS[pId] }}
                  >
                    <span className="text-xl font-black">{pId}</span>
                    <span className="text-[8px] font-bold text-white truncate w-full text-center">{pendingJoin.playerNames[pId]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n) => { setGameState(generateInitialState(p, a, undefined, n)); setIsNewGameModalOpen(false); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={`${window.location.origin}${window.location.pathname}#join=${getShareableData(gameState)}`} />
    </div>
  );
};

export default App;
