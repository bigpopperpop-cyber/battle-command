
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Planet, Ship, Owner, ShipType, AiDifficulty } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS, SHIP_STATS, MAX_PLANET_POPULATION } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import IngestModal from './components/IngestModal';
import { getAiMoves } from './services/geminiService';

const SAVE_KEY = 'stellar_commander_save_v3';
const KIRK_CHANCE = 0.15; 

const App: React.FC = () => {
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

  useEffect(() => {
    const handleSync = () => {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#join=')) return;
      try {
        const dataStr = hash.substring(6);
        const compact = JSON.parse(atob(dataStr));
        const baseState = generateInitialState(compact.pc, compact.ai.length, compact.sd, compact.nm, compact.dif || 'EASY');
        baseState.round = compact.rd;
        baseState.playerCredits = compact.cr;
        baseState.aiPlayers = compact.ai;
        compact.ps.forEach((pState: any, i: number) => {
          if (baseState.planets[i]) {
            baseState.planets[i].owner = pState[0];
            baseState.planets[i].mines = pState[1];
            baseState.planets[i].factories = pState[2];
            baseState.planets[i].defense = pState[3] || 100;
            baseState.planets[i].population = pState[4] !== undefined ? pState[4] : 1;
          }
        });
        baseState.ships = compact.ss.map((s: any) => {
          const stats = SHIP_STATS[s.t as ShipType];
          return {
            id: s.id, name: s.n, type: s.t, owner: s.o, x: s.x, y: s.y,
            status: s.st, targetPlanetId: s.tp, currentPlanetId: s.cp,
            cargo: 0, maxCargo: stats.cargo, 
            cargoPeople: s.cp_p || 0,
            maxPeopleCargo: stats.people,
            hp: s.h || stats.hp, maxHp: stats.hp,
            attack: stats.attack, speed: stats.speed
          }
        });
        setGameState(prev => ({ ...baseState, activePlayer: playerRole || baseState.activePlayer }));
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) { console.error("Relay Sync Failed", e); }
    };
    handleSync();
    window.addEventListener('hashchange', handleSync);
    return () => window.removeEventListener('hashchange', handleSync);
  }, [playerRole]);

  const submitOrdersToHost = () => {
    const myOrders = {
      pId: playerRole,
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, t: s.targetPlanetId, cp_p: s.cargoPeople })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, m: p.mines, f: p.factories, pop: p.population }))
    };
    const code = btoa(JSON.stringify(myOrders));
    navigator.clipboard.writeText(`COMMAND_DATA:${code}`);
    setGameState(prev => ({ ...prev, readyPlayers: Array.from(new Set([...prev.readyPlayers, playerRole!])) }));
    alert("Tactical Data Copied. Hand the code to your Host.");
  };

  const executeTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Round ${gameState.round} Resolution ---`];

    // AI Logic - Gemini processing for computer empires
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

    // Resolve Movement
    nextShips.forEach(s => {
      if (s.status === 'MOVING' && s.targetPlanetId) {
        const target = nextPlanets.find(p => p.id === s.targetPlanetId);
        if (target) {
          const dx = target.x - s.x; const dy = target.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= s.speed) { s.x = target.x; s.y = target.y; s.status = 'ORBITING'; s.currentPlanetId = target.id; }
          else { s.x += (dx / dist) * s.speed; s.y += (dy / dist) * s.speed; }
        }
      }
    });

    // Population Growth
    nextPlanets.forEach(p => {
      if (p.owner !== 'NEUTRAL') p.population = Math.min(MAX_PLANET_POPULATION, p.population + 1);
    });

    // Conflict Resolution
    nextPlanets.forEach(planet => {
      const orbitingShips = nextShips.filter(s => s.currentPlanetId === planet.id);
      const owners = Array.from(new Set(orbitingShips.map(s => s.owner)));
      
      if (owners.length > 1) {
        newLogs.push(`⚔️ Skirmish at ${planet.name}`);
        const strengths = owners.map(o => ({ owner: o, power: orbitingShips.filter(s => s.owner === o).reduce((a, s) => a + s.attack + (s.hp / 10), 0) })).sort((a,b) => a.power - b.power);
        const underdog = strengths[0];
        const topDog = strengths[strengths.length-1];
        
        let kirk = false;
        if (underdog.power < topDog.power * 0.6 && Math.random() < KIRK_CHANCE) {
          kirk = true;
          newLogs.push(`💫 KIRK MANEUVER: ${gameState.playerNames[underdog.owner]} turns the tide!`);
        }

        owners.forEach(atkId => {
          const myFleet = orbitingShips.filter(s => s.owner === atkId);
          let totalAtk = myFleet.reduce((sum, s) => sum + s.attack, 0);
          if (kirk && atkId === underdog.owner) totalAtk *= 6;
          
          const targets = owners.filter(o => o !== atkId);
          const targetFleet = orbitingShips.filter(s => s.owner === targets[0]);
          if (targetFleet.length > 0) {
            const victim = targetFleet[Math.floor(Math.random() * targetFleet.length)];
            victim.hp -= totalAtk;
            if (victim.hp <= 0) newLogs.push(`💥 ${victim.owner} ${victim.type} lost.`);
          }
        });
      }

      nextShips = nextShips.filter(s => s.hp > 0);
      const survivors = nextShips.filter(s => s.currentPlanetId === planet.id);
      const hostiles = survivors.filter(s => s.owner !== planet.owner && s.type === 'WARSHIP');
      
      if (hostiles.length > 0 && planet.owner !== 'NEUTRAL') {
        planet.population = Math.max(0, planet.population - hostiles.length);
        newLogs.push(`💣 ${planet.name} bombardment!`);
      }

      if (planet.population <= 0) {
        const conquerors = survivors.filter(s => s.owner !== planet.owner);
        if (conquerors.length > 0) {
          planet.owner = conquerors[0].owner;
          planet.population = 1;
          newLogs.push(`🚩 ${planet.name} conquered by ${planet.owner}`);
        } else if (planet.owner !== 'NEUTRAL') {
          planet.owner = 'NEUTRAL';
          newLogs.push(`🌑 ${planet.name} dark.`);
        }
      }

      if (planet.owner !== 'NEUTRAL') {
        nextCredits[planet.owner] = (nextCredits[planet.owner] || 0) + (planet.mines * 50) + (planet.factories * 20) + (planet.population * 50);
        planet.defense = Math.min(planet.maxDefense, planet.defense + 10);
      }
    });

    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      logs: [...newLogs, ...prev.logs].slice(0, 20),
      readyPlayers: [] 
    }));
    setIsProcessing(false);
    setSelectedId(null);
  };

  const handleMapSelect = (id: string, type: 'PLANET' | 'SHIP') => {
    if (viewMode === 'HOST') { setSelectedId(id); setSelectedType(type); return; }
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
    setSelectedId(id); setSelectedType(type);
  };

  const selectedPlanet = useMemo(() => selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null, [selectedId, selectedType, gameState.planets]);
  const selectedShip = useMemo(() => selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null, [selectedId, selectedType, gameState.ships]);
  const economyStats = useMemo(() => {
    const role = playerRole || 'P1';
    const myP = gameState.planets.filter(p => p.owner === role);
    const inc = myP.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0);
    return { income: inc, credits: gameState.playerCredits[role] };
  }, [gameState.planets, playerRole, gameState.playerCredits]);

  const handleLoadPerson = (sId: string, pId: string) => {
    setGameState(prev => {
      const p = prev.planets.find(p => p.id === pId);
      const s = prev.ships.find(s => s.id === sId);
      if (p && s && p.population > 0 && s.cargoPeople < s.maxPeopleCargo) {
        return { ...prev, planets: prev.planets.map(pl => pl.id === pId ? {...pl, population: pl.population-1} : pl), ships: prev.ships.map(sh => sh.id === sId ? {...sh, cargoPeople: sh.cargoPeople+1} : sh) };
      }
      return prev;
    });
  };

  const handleUnloadPerson = (sId: string, pId: string) => {
    setGameState(prev => {
      const p = prev.planets.find(p => p.id === pId);
      const s = prev.ships.find(s => s.id === sId);
      if (p && s && s.cargoPeople > 0 && p.population < MAX_PLANET_POPULATION) {
        return { ...prev, planets: prev.planets.map(pl => pl.id === pId ? {...pl, population: pl.population+1} : pl), ships: prev.ships.map(sh => sh.id === sId ? {...sh, cargoPeople: sh.cargoPeople-1} : sh) };
      }
      return prev;
    });
  };

  useEffect(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); }, [gameState]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none touch-none font-['Space_Grotesk']">
      
      <div className="absolute top-0 left-0 right-0 z-[100] h-14 bg-gradient-to-b from-slate-950/95 to-transparent flex items-center justify-between px-4 md:px-8">
         <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${relayStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <div className="hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 leading-none">SECTOR SNAPSHOT</p>
              <p className="text-[12px] font-bold text-cyan-400">ROUND {gameState.round}</p>
            </div>
            <div className="sm:hidden text-[12px] font-black text-cyan-400">R-{gameState.round}</div>
         </div>

         {viewMode === 'PLAYER' && (
            <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-lg">
                <div className="flex items-center gap-1.5">
                   <span className="text-amber-400 text-xs">💰</span>
                   <span className="text-sm font-black text-amber-100">{economyStats.credits}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5">
                   <span className="text-emerald-400 text-xs">📈</span>
                   <span className="text-xs font-black text-emerald-400">+{economyStats.income}</span>
                </div>
            </div>
         )}

         <div className="flex items-center gap-1.5">
            {viewMode === 'HOST' ? (
              <>
                <button onClick={() => setIsInviteModalOpen(true)} className="w-9 h-9 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20 active:bg-cyan-600/40">🔗</button>
                <button onClick={() => setIsIngestModalOpen(true)} className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center text-sm border border-emerald-500/20 active:bg-emerald-600/40">📡</button>
              </>
            ) : (
              <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/10 active:bg-white/10">?</button>
            )}
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} onSelect={handleMapSelect} />

        {viewMode === 'HOST' && !selectedId && (
           <div className="absolute top-20 left-4 z-40 bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl w-48 shadow-2xl">
              <div className="mb-3">
                 <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Empire Sync</h4>
                 <p className="text-[7px] text-amber-500 font-bold uppercase">{gameState.aiDifficulty} Mode</p>
              </div>
              <div className="space-y-2 mb-4">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isAi = gameState.aiPlayers.includes(pId);
                    const isReady = gameState.readyPlayers.includes(pId) || isAi;
                    return (
                       <div key={pId} className="flex items-center justify-between">
                          <span className="text-[10px] font-bold truncate pr-2" style={{ color: PLAYER_COLORS[pId] }}>{gameState.playerNames[pId]}</span>
                          <span className={`text-[8px] font-black ${isReady ? 'text-emerald-500' : 'text-slate-600 animate-pulse'}`}>{isReady ? 'READY' : 'WAIT'}</span>
                       </div>
                    );
                 })}
              </div>
              <button onClick={executeTurn} disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                {isProcessing ? 'SYNC...' : 'EXECUTE'}
              </button>
           </div>
        )}

        {viewMode === 'PLAYER' && (
           <div className={`absolute z-[120] flex pointer-events-none transition-all duration-300 ${isLandscape ? 'bottom-6 right-6 flex-col items-end gap-3' : 'bottom-4 left-4 right-4 justify-between items-end'}`}>
              <div className="pointer-events-auto flex items-end gap-3 w-full justify-between">
                  <button onClick={() => setIsAdvisorOpen(true)} className="w-16 h-16 bg-cyan-500 rounded-3xl flex items-center justify-center text-4xl shadow-2xl shadow-cyan-500/40 active:scale-90 border-b-4 border-cyan-700">❂</button>
                  <button onClick={submitOrdersToHost} className="flex-1 max-w-[200px] bg-white text-black h-16 rounded-3xl font-black text-[12px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-b-4 border-slate-300 flex items-center justify-center gap-2">
                    <span>PUSH ORDERS</span>
                    <span className="text-xl">📡</span>
                  </button>
              </div>
           </div>
        )}

        <div className={`absolute transition-all duration-500 ease-out z-[130] 
          ${isLandscape 
            ? `top-20 bottom-20 left-0 w-80 ${selectedId ? 'translate-x-6' : '-translate-x-full'}` 
            : `bottom-0 left-0 right-0 ${selectedId ? 'translate-y-0' : 'translate-y-[100%]'}`
          }`}
        >
          <div className={`
            relative flex flex-col bg-slate-900/98 backdrop-blur-3xl border-white/10 shadow-2xl overflow-hidden
            ${isLandscape ? 'h-full rounded-[3rem] border' : 'rounded-t-[3.5rem] border-t max-h-[50vh] min-h-[40vh]'}
          `}>
             {!isLandscape && <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full" />}
             
             <div className="p-8 pb-4 flex justify-between items-start">
                <div className="max-w-[75%]">
                   <h2 className="text-xl font-bold italic text-white truncate">{selectedPlanet?.name || selectedShip?.name || 'Unknown'}</h2>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Tactical Analysis</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">✕</button>
             </div>
             
             <div className="flex-1 overflow-y-auto px-8 pb-10 space-y-6 custom-scrollbar">
                {selectedPlanet && (
                  <div className="space-y-6">
                    <div className="bg-black/40 p-5 rounded-[2.5rem] border border-white/5">
                        <div className="flex justify-between items-center mb-3">
                           <div className="flex items-center gap-2">
                              <span className="text-sm">👥</span>
                              <span className={`text-[11px] font-black ${selectedPlanet.population < 2 ? 'text-red-400' : 'text-white'}`}>{selectedPlanet.population} / {MAX_PLANET_POPULATION}</span>
                           </div>
                           <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: PLAYER_COLORS[selectedPlanet.owner] }}>{gameState.playerNames[selectedPlanet.owner]}</p>
                        </div>
                        
                        <div className="space-y-1.5">
                           <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                              <span>Shields</span>
                              <span>{Math.round(selectedPlanet.defense)} HP</span>
                           </div>
                           <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(selectedPlanet.defense / selectedPlanet.maxDefense) * 100}%` }} />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-6">
                          <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                            <span className="block text-[7px] text-slate-500 font-bold uppercase mb-0.5">Mines</span>
                            <span className="text-lg font-black">{selectedPlanet.mines}</span>
                          </div>
                          <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                            <span className="block text-[7px] text-slate-500 font-bold uppercase mb-0.5">Fact.</span>
                            <span className="text-lg font-black">{selectedPlanet.factories}</span>
                          </div>
                        </div>
                    </div>

                    {viewMode === 'PLAYER' && selectedPlanet.owner === playerRole && (
                      <div className="space-y-2">
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mb-1">Production Hub</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                            <button key={type} onClick={() => {
                              const cost = SHIP_COSTS[type as ShipType];
                              if (gameState.playerCredits[playerRole!] >= cost) {
                                 const stats = SHIP_STATS[type as ShipType];
                                 const newShip: Ship = { id: `s-${Date.now()}`, name: `${gameState.playerNames[playerRole!]} ${type}`, type: type as ShipType, owner: playerRole!, x: selectedPlanet!.x, y: selectedPlanet!.y, currentPlanetId: selectedPlanet!.id, cargo: 0, maxCargo: stats.cargo, cargoPeople: 0, maxPeopleCargo: stats.people, hp: stats.hp, maxHp: stats.hp, attack: stats.attack, speed: stats.speed, status: 'ORBITING' };
                                 setGameState(p => ({...p, playerCredits: {...p.playerCredits, [playerRole!]: p.playerCredits[playerRole!]-cost}, ships: [...p.ships, newShip]}));
                              }
                            }} className="p-4 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between active:bg-cyan-900/20 transition-all">
                              <span className="text-lg">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                              <div className="flex flex-col items-end">
                                 <span className="text-[10px] font-black uppercase">{type}</span>
                                 <span className="text-[9px] text-amber-500 font-bold">{SHIP_COSTS[type as ShipType]} Cr</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedShip && (
                   <div className="bg-black/60 p-6 rounded-[2.5rem] border border-white/5 space-y-6">
                     <div className="flex justify-between items-center">
                        <span className="px-4 py-1.5 bg-cyan-600/20 rounded-xl text-[9px] font-black text-cyan-400 uppercase">{selectedShip.type}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-bold text-emerald-400">{selectedShip.status}</span>
                           {selectedShip.cargoPeople > 0 && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black border border-amber-500/20">👥 {selectedShip.cargoPeople}</span>}
                        </div>
                     </div>
                     
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                           <div className="flex justify-between text-[7px] font-black uppercase text-slate-600"><span>Warp Drive</span><span>{selectedShip.speed} km/h</span></div>
                           <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${(selectedShip.speed / 180) * 100}%` }} /></div>
                        </div>
                        <div className="space-y-1.5">
                           <div className="flex justify-between text-[7px] font-black uppercase text-slate-600"><span>Attack Yield</span><span>{selectedShip.attack} yield</span></div>
                           <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${(selectedShip.attack / 50) * 100}%` }} /></div>
                        </div>
                     </div>

                     {viewMode === 'PLAYER' && selectedShip.owner === playerRole && (
                       <div className="space-y-3">
                         {selectedShip.type === 'FREIGHTER' && selectedShip.currentPlanetId && (
                            <div className="grid grid-cols-2 gap-2">
                               <button disabled={selectedShip.cargoPeople >= selectedShip.maxPeopleCargo} onClick={() => handleLoadPerson(selectedShip.id, selectedShip.currentPlanetId!)} className="py-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-[9px] font-black uppercase text-amber-400 disabled:opacity-20 active:scale-95">Load 👤</button>
                               <button disabled={selectedShip.cargoPeople === 0} onClick={() => handleUnloadPerson(selectedShip.id, selectedShip.currentPlanetId!)} className="py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-[9px] font-black uppercase text-emerald-400 disabled:opacity-20 active:scale-95">Drop 👤</button>
                            </div>
                         )}
                         <div className="p-4 bg-cyan-600/10 border border-cyan-500/20 rounded-2xl text-center">
                           <p className="text-[9px] text-cyan-300 font-black mb-0.5 tracking-widest uppercase">Navigation Locked</p>
                           <p className="text-[9px] text-white/40 italic leading-tight">Designate coordinates via star chart.</p>
                         </div>
                       </div>
                     )}
                   </div>
                )}
             </div>
          </div>
        </div>
      </main>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <IngestModal isOpen={isIngestModalOpen} onClose={() => setIsIngestModalOpen(false)} onIngest={(data) => {
          try {
            const raw = data.replace('COMMAND_DATA:', '');
            const orders = JSON.parse(atob(raw));
            setGameState(prev => {
              const nextShips = prev.ships.map(s => {
                const order = orders.ships.find((o:any) => o.id === s.id);
                return order ? { ...s, status: 'MOVING', targetPlanetId: order.t, currentPlanetId: undefined, cargoPeople: order.cp_p !== undefined ? order.cp_p : s.cargoPeople } : s;
              });
              const nextPlanets = prev.planets.map(p => {
                const order = orders.builds.find((o:any) => o.id === p.id);
                return order ? { ...p, mines: order.m, factories: order.f, population: order.pop !== undefined ? order.pop : p.population } : p;
              });
              return { ...prev, ships: nextShips, planets: nextPlanets, readyPlayers: Array.from(new Set([...prev.readyPlayers, orders.pId])) };
            });
            setIsIngestModalOpen(false);
          } catch(e) { console.error(e); }
        }} readyPlayers={gameState.readyPlayers} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n, d) => { setGameState(generateInitialState(p, a, undefined, n, d)); setIsNewGameModalOpen(false); setSelectedId(null); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={`${window.location.origin}${window.location.pathname}`} gameState={gameState} />
    </div>
  );
};

export default App;
