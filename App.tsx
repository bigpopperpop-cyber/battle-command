
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Planet, Ship, Owner, ShipType } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import IngestModal from './components/IngestModal';
import { getAiMoves } from './services/geminiService';

const SAVE_KEY = 'stellar_commander_save';

const App: React.FC = () => {
  // Determine if this device is a Player Controller or the main Host Board
  const [viewMode, setViewMode] = useState<'HOST' | 'PLAYER'>('HOST');
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);

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
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [relayStatus, setRelayStatus] = useState<'CONNECTED' | 'SYNCING' | 'OFFLINE'>('CONNECTED');
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Initialization & Role Detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') as Owner;
    if (role && role.startsWith('P')) {
      setViewMode('PLAYER');
      setPlayerRole(role);
      setGameState(prev => ({ ...prev, activePlayer: role }));
    }

    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Subspace Relay: Auto-Join from Link
  useEffect(() => {
    const handleSync = () => {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#join=')) return;
      try {
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
        
        // If we are already a player, keep our role but update the world
        setGameState(prev => ({
          ...baseState,
          activePlayer: playerRole || baseState.activePlayer
        }));
        
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) { console.error("Relay Sync Failed", e); }
    };
    handleSync();
    window.addEventListener('hashchange', handleSync);
    return () => window.removeEventListener('hashchange', handleSync);
  }, [playerRole]);

  // Turn Submission (Phone to Laptop)
  const submitOrdersToHost = () => {
    const myOrders = {
      pId: playerRole,
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, t: s.targetPlanetId })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, m: p.mines, f: p.factories }))
    };
    const code = btoa(JSON.stringify(myOrders));
    // In a real app, this would POST to a server. Here, we show it to the user.
    const feedback = `COMMAND_DATA:${code}`;
    navigator.clipboard.writeText(feedback);
    setGameState(prev => ({ ...prev, readyPlayers: Array.from(new Set([...prev.readyPlayers, playerRole!])) }));
    alert("Orders Encrypted & Copied! Send this code to the Host or wait for Subspace Sync.");
  };

  const executeTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Sector Update: Turn ${gameState.round} ---`];

    // AI Logic
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

    // Physics
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

    // Capture & Income
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
    if (viewMode === 'HOST') {
      setSelectedId(id); setSelectedType(type); return;
    }
    // Player specific movement logic
    if (selectedType === 'SHIP' && type === 'PLANET' && selectedId) {
       const ship = gameState.ships.find(s => s.id === selectedId);
       if (ship && ship.owner === playerRole) {
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
    const role = playerRole || 'P1';
    const myPlanets = gameState.planets.filter(p => p.owner === role);
    const income = myPlanets.reduce((acc, p) => acc + (p.mines * 50) + (p.factories * 20) + 100, 0);
    return { income, credits: gameState.playerCredits[role] };
  }, [gameState.planets, playerRole, gameState.playerCredits]);

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
      
      {/* GLOBAL HUD */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-12 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between px-6">
         <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${relayStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                {viewMode === 'HOST' ? 'WAR ROOM HUD' : `COMMANDER: ${playerRole}`}
              </p>
              <p className="text-[8px] font-bold text-cyan-400">SECTOR ROUND {gameState.round}</p>
            </div>
         </div>

         {viewMode === 'PLAYER' && (
            <div className="flex items-center gap-6 bg-slate-900/60 px-6 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                   <span className="text-amber-400 text-sm">💰</span>
                   <span className="text-sm font-black text-amber-400">{economyStats.credits}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-emerald-400 text-sm">📈</span>
                   <span className="text-sm font-black text-emerald-400">+{economyStats.income}</span>
                </div>
            </div>
         )}

         <div className="flex items-center gap-2">
            {viewMode === 'HOST' ? (
              <>
                <button onClick={() => setIsInviteModalOpen(true)} className="w-9 h-9 rounded-xl bg-cyan-600/10 flex items-center justify-center text-sm border border-white/5 hover:bg-cyan-600/20" title="Empire Codes">🔗</button>
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/5" title="Reset Simulation">🆕</button>
                <button onClick={() => setIsIngestModalOpen(true)} className="w-9 h-9 rounded-xl bg-emerald-600/10 flex items-center justify-center text-sm border border-white/5 hover:bg-emerald-600/20" title="Receive Transmission">📡</button>
              </>
            ) : (
              <button onClick={() => window.location.reload()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/5" title="Sync from Hub">🔄</button>
            )}
            <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/5">?</button>
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={handleMapSelect} 
        />

        {/* HOST: READINESS MONITOR */}
        {viewMode === 'HOST' && (
           <div className="absolute top-20 left-6 z-40 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl w-48 shadow-2xl">
              <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Empire Status</h4>
              <div className="space-y-2">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isAi = gameState.aiPlayers.includes(pId);
                    const isReady = gameState.readyPlayers.includes(pId) || isAi;
                    return (
                       <div key={pId} className="flex items-center justify-between">
                          <span className="text-[10px] font-bold" style={{ color: PLAYER_COLORS[pId] }}>{gameState.playerNames[pId]}</span>
                          <span className={`text-[8px] font-black ${isReady ? 'text-emerald-500' : 'text-slate-600 animate-pulse'}`}>{isReady ? 'READY' : 'WAITING'}</span>
                       </div>
                    );
                 })}
              </div>
              <button 
                onClick={executeTurn}
                disabled={isProcessing}
                className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
              >
                {isProcessing ? 'PROCESSING...' : 'EXECUTE TURN'}
              </button>
           </div>
        )}

        {/* PLAYER: ACTION HUB */}
        {viewMode === 'PLAYER' && (
           <div className={`absolute z-[120] flex transition-all duration-300 ${isLandscape ? 'bottom-6 right-6 flex-col items-end gap-3' : 'bottom-0 left-0 right-0 p-4 justify-between bg-gradient-to-t from-slate-950 to-transparent'}`}>
              <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsAdvisorOpen(true)} 
                    className="w-16 h-16 bg-cyan-500 rounded-3xl flex items-center justify-center text-4xl shadow-xl shadow-cyan-500/30 active:scale-90 border-b-4 border-cyan-700"
                  >
                    ❂
                  </button>
                  
                  <button 
                    onClick={submitOrdersToHost} 
                    className="bg-white text-black px-10 h-16 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-slate-300 flex items-center gap-3"
                  >
                    <span>SUBMIT ORDERS</span>
                    <span className="text-lg">📡</span>
                  </button>
              </div>
           </div>
        )}

        {/* TACTICAL INTELLIGENCE PANEL (Contextual) */}
        <div className={`absolute transition-all duration-500 ease-out z-[130] 
          ${isLandscape 
            ? `top-16 bottom-16 left-0 w-80 ${selectedId ? 'translate-x-6' : '-translate-x-full'}` 
            : `bottom-0 left-0 right-0 ${selectedId ? 'translate-y-0' : 'translate-y-full'}`
          }`}
        >
          <div className={`${isLandscape ? 'h-full w-full rounded-[3rem]' : 'mx-2 rounded-t-[3rem]'} bg-slate-900/95 backdrop-blur-3xl border border-white/10 p-8 flex flex-col shadow-2xl`}>
             <div className="flex justify-between items-start mb-6">
                <div className="max-w-[80%]">
                   <h2 className="text-2xl font-bold italic text-white truncate">{selectedPlanet?.name || selectedShip?.name || 'Unknown'}</h2>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Tactical Analysis Overlay</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">✕</button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                {selectedPlanet && (
                  <div className="space-y-6">
                    {(viewMode === 'PLAYER' && selectedPlanet.owner === playerRole) ? (
                      <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => {
                                if (gameState.playerCredits[playerRole!] >= 100) {
                                  setGameState(p => ({...p, playerCredits: {...p.playerCredits, [playerRole!]: p.playerCredits[playerRole!]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, mines: pl.mines+1} : pl)}));
                                }
                            }} className="p-5 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center active:scale-95">
                               <span className="text-2xl mb-1">🏗️</span>
                               <span className="text-[10px] font-black uppercase">Mine</span>
                               <span className="text-[9px] text-amber-500 font-bold">100 Cr</span>
                            </button>
                            <button onClick={() => {
                                if (gameState.playerCredits[playerRole!] >= 100) {
                                  setGameState(p => ({...p, playerCredits: {...p.playerCredits, [playerRole!]: p.playerCredits[playerRole!]-100}, planets: p.planets.map(pl => pl.id === selectedId ? {...pl, factories: pl.factories+1} : pl)}));
                                }
                            }} className="p-5 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center active:scale-95">
                               <span className="text-2xl mb-1">🏭</span>
                               <span className="text-[10px] font-black uppercase">Factory</span>
                               <span className="text-[9px] text-amber-500 font-bold">100 Cr</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center mb-1">Orbital Construction</h4>
                            {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                              <button key={type} onClick={() => {
                                const cost = SHIP_COSTS[type as ShipType];
                                if (gameState.playerCredits[playerRole!] >= cost) {
                                   const newShip: Ship = { id: `s-${Date.now()}`, name: `${gameState.playerNames[playerRole!]} ${type}`, type: type as ShipType, owner: playerRole!, x: selectedPlanet!.x, y: selectedPlanet!.y, currentPlanetId: selectedPlanet!.id, cargo: 0, maxCargo: 100, hp: 100, maxHp: 100, status: 'ORBITING' };
                                   setGameState(p => ({...p, playerCredits: {...p.playerCredits, [playerRole!]: p.playerCredits[playerRole!]-cost}, ships: [...p.ships, newShip]}));
                                }
                              }} className="p-4 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between active:scale-98">
                                <div className="flex items-center gap-3">
                                   <span className="text-xl">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                                   <span className="text-[10px] font-black uppercase tracking-wider">{type}</span>
                                </div>
                                <span className="text-[10px] text-amber-500 font-bold">{SHIP_COSTS[type as ShipType]} Cr</span>
                              </button>
                            ))}
                          </div>
                      </div>
                    ) : (
                      <div className="bg-black/40 p-8 rounded-[3rem] border border-white/5 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 italic">Empire Affiliation</p>
                          <p className="text-xl font-black" style={{ color: PLAYER_COLORS[selectedPlanet.owner] }}>{gameState.playerNames[selectedPlanet.owner]}</p>
                          <div className="grid grid-cols-2 gap-4 mt-8">
                            <div className="bg-white/5 p-5 rounded-3xl">
                              <span className="block text-[8px] text-slate-500 font-bold uppercase mb-1">Mines</span>
                              <span className="text-xl font-black">{selectedPlanet.mines}</span>
                            </div>
                            <div className="bg-white/5 p-5 rounded-3xl">
                              <span className="block text-[8px] text-slate-500 font-bold uppercase mb-1">Factories</span>
                              <span className="text-xl font-black">{selectedPlanet.factories}</span>
                            </div>
                          </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedShip && (
                   <div className="bg-black/50 p-8 rounded-[3rem] border border-white/10 space-y-6">
                     <div className="flex justify-between items-center">
                        <span className="px-4 py-1.5 bg-cyan-600/20 rounded-full text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em]">{selectedShip.type}</span>
                        <span className="text-[11px] font-bold text-emerald-400 animate-pulse">{selectedShip.status}</span>
                     </div>
                     {(viewMode === 'PLAYER' && selectedShip.owner === playerRole) ? (
                       <div className="p-6 bg-cyan-600/10 border border-cyan-500/30 rounded-3xl text-center">
                         <p className="text-[11px] text-cyan-300 font-black mb-1">NAVIGATION ACTIVE</p>
                         <p className="text-[10px] text-white/50 italic leading-relaxed">Select a destination in the star chart to lock in warp vector.</p>
                       </div>
                     ) : (
                       <p className="text-[11px] text-slate-600 text-center italic">Passive sensors unable to bypass encryption.</p>
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
      <IngestModal 
        isOpen={isIngestModalOpen} 
        onClose={() => setIsIngestModalOpen(false)} 
        onIngest={(data) => {
          try {
            const raw = data.replace('COMMAND_DATA:', '');
            const orders = JSON.parse(atob(raw));
            setGameState(prev => {
              const nextShips = prev.ships.map(s => {
                const order = orders.ships.find((o:any) => o.id === s.id);
                return order ? { ...s, status: 'MOVING', targetPlanetId: order.t, currentPlanetId: undefined } : s;
              });
              const nextPlanets = prev.planets.map(p => {
                const order = orders.builds.find((o:any) => o.id === p.id);
                return order ? { ...p, mines: order.m, factories: order.f } : p;
              });
              return { 
                ...prev, 
                ships: nextShips, 
                planets: nextPlanets, 
                readyPlayers: Array.from(new Set([...prev.readyPlayers, orders.pId])) 
              };
            });
            setIsIngestModalOpen(false);
          } catch(e) { console.error(e); }
        }}
        readyPlayers={gameState.readyPlayers}
      />
      <NewGameModal 
        isOpen={isNewGameModalOpen} 
        onClose={() => setIsNewGameModalOpen(false)} 
        onConfirm={(p, a, n) => { 
          setGameState(generateInitialState(p, a, undefined, n)); 
          setIsNewGameModalOpen(false); 
          setSelectedId(null);
        }} 
      />
      <InviteModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        joinUrl={`${window.location.origin}${window.location.pathname}`}
        gameState={gameState}
      />
    </div>
  );
};

export default App;
