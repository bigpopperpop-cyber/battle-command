
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Planet, Ship, Owner, ShipType } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS, SHIP_STATS, MAX_PLANET_POPULATION } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import IngestModal from './components/IngestModal';
import { getAiMoves } from './services/geminiService';

const SAVE_KEY = 'stellar_commander_save_v2';
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
        const baseState = generateInitialState(compact.pc, compact.ai.length, compact.sd, compact.nm);
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
    alert("Tactical Data Encrypted. Codes copied to clipboard.");
  };

  const executeTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Sector Update: Round ${gameState.round} ---`];

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

    // 1. Movement Phase
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

    // 2. Population Growth Phase (+1 for all owned planets)
    nextPlanets.forEach(p => {
      if (p.owner !== 'NEUTRAL') {
        p.population = Math.min(MAX_PLANET_POPULATION, p.population + 1);
      }
    });

    // 3. Combat & Siege Phase
    nextPlanets.forEach(planet => {
      const orbitingShips = nextShips.filter(s => s.currentPlanetId === planet.id);
      const owners = Array.from(new Set(orbitingShips.map(s => s.owner)));
      
      // Ship vs Ship Combat
      if (owners.length > 1) {
        newLogs.push(`⚔️ Battle for ${planet.name} orbit...`);
        const empireStrengths = owners.map(o => ({
          owner: o,
          power: orbitingShips.filter(s => s.owner === o).reduce((acc, s) => acc + s.attack + (s.hp / 10), 0)
        })).sort((a, b) => a.power - b.power);
        const underdog = empireStrengths[0];
        const topDog = empireStrengths[empireStrengths.length - 1];
        
        let kirkEffectTriggered = false;
        if (underdog.power < topDog.power * 0.6 && Math.random() < KIRK_CHANCE) {
          kirkEffectTriggered = true;
          newLogs.push(`💫 MIRACLE: ${gameState.playerNames[underdog.owner]} exploited a localized ion storm!`);
        }

        owners.forEach(attackerId => {
          const myFleet = orbitingShips.filter(s => s.owner === attackerId);
          let totalAtk = myFleet.reduce((sum, s) => sum + s.attack, 0);
          if (kirkEffectTriggered && attackerId === underdog.owner) totalAtk *= 5;

          const targetEmpires = owners.filter(o => o !== attackerId);
          const targetId = targetEmpires[Math.floor(Math.random() * targetEmpires.length)];
          const targetFleet = orbitingShips.filter(s => s.owner === targetId);
          if (targetFleet.length > 0) {
            const victim = targetFleet[Math.floor(Math.random() * targetFleet.length)];
            victim.hp -= totalAtk;
            if (victim.hp <= 0) newLogs.push(`💥 ${victim.owner} lost a ${victim.type} in the crossfire.`);
          }
        });
      }

      // 4. Siege & Population Destruction Phase
      nextShips = nextShips.filter(s => s.hp > 0);
      const survivingOrbiters = nextShips.filter(s => s.currentPlanetId === planet.id);
      const enemyWarships = survivingOrbiters.filter(s => s.owner !== planet.owner && s.type === 'WARSHIP');
      
      if (enemyWarships.length > 0 && planet.owner !== 'NEUTRAL') {
        const popLoss = enemyWarships.length;
        planet.population = Math.max(0, planet.population - popLoss);
        newLogs.push(`💣 ${planet.name} bombarded! ${popLoss} survivors lost.`);
      }

      // 5. Conquest Phase (Ownership depends on population)
      if (planet.population <= 0) {
        const hostiles = survivingOrbiters.filter(s => s.owner !== planet.owner);
        if (hostiles.length > 0) {
          const newOwner = hostiles[0].owner;
          if (planet.owner !== 'NEUTRAL') newLogs.push(`🚩 ${planet.name} abandoned by ${planet.owner} due to zero population!`);
          planet.owner = newOwner;
          planet.population = 1; // Survivors landing to secure the base
          planet.defense = planet.maxDefense / 2;
          newLogs.push(`🛰️ ${gameState.playerNames[newOwner]} forces occupied ${planet.name}.`);
        } else if (planet.owner !== 'NEUTRAL') {
          newLogs.push(`🌑 ${planet.name} has gone dark. Zero population remaining.`);
          planet.owner = 'NEUTRAL';
        }
      }

      // Recovery
      if (planet.owner !== 'NEUTRAL') {
        const income = (planet.mines * 50) + (planet.factories * 20) + (planet.population * 50);
        nextCredits[planet.owner] = (nextCredits[planet.owner] || 0) + income;
        planet.defense = Math.min(planet.maxDefense, planet.defense + 10);
      }
    });

    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      logs: [...newLogs, ...prev.logs].slice(0, 25),
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

  const selectedPlanet = useMemo(() => 
    selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null
  , [selectedId, selectedType, gameState.planets]);

  const selectedShip = useMemo(() => 
    selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null
  , [selectedId, selectedType, gameState.ships]);

  const economyStats = useMemo(() => {
    const role = playerRole || 'P1';
    const myPlanets = gameState.planets.filter(p => p.owner === role);
    const income = myPlanets.reduce((acc, p) => acc + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0);
    return { income, credits: gameState.playerCredits[role] };
  }, [gameState.planets, playerRole, gameState.playerCredits]);

  // Actions for transport
  const handleLoadPerson = (shipId: string, planetId: string) => {
    setGameState(prev => {
      const planet = prev.planets.find(p => p.id === planetId);
      const ship = prev.ships.find(s => s.id === shipId);
      if (planet && ship && planet.population > 0 && ship.cargoPeople < ship.maxPeopleCargo) {
        return {
          ...prev,
          planets: prev.planets.map(p => p.id === planetId ? {...p, population: p.population - 1} : p),
          ships: prev.ships.map(s => s.id === shipId ? {...s, cargoPeople: s.cargoPeople + 1} : s)
        };
      }
      return prev;
    });
  };

  const handleUnloadPerson = (shipId: string, planetId: string) => {
    setGameState(prev => {
      const planet = prev.planets.find(p => p.id === planetId);
      const ship = prev.ships.find(s => s.id === shipId);
      if (planet && ship && ship.cargoPeople > 0 && planet.population < MAX_PLANET_POPULATION) {
        return {
          ...prev,
          planets: prev.planets.map(p => p.id === planetId ? {...p, population: p.population + 1} : p),
          ships: prev.ships.map(s => s.id === shipId ? {...s, cargoPeople: s.cargoPeople - 1} : s)
        };
      }
      return prev;
    });
  };

  useEffect(() => { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); }, [gameState]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none touch-none font-['Space_Grotesk']">
      
      {/* HUD: GLOBAL STATUS */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-12 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between px-6">
         <div className="flex items-center gap-4">
            <div className={`w-2.5 h-2.5 rounded-full ${relayStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                {viewMode === 'HOST' ? 'GALACTIC WAR ROOM' : `TACTICAL LINK: ${playerRole}`}
              </p>
              <p className="text-[8px] font-bold text-cyan-400">ROUND {gameState.round}</p>
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
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/5" title="New Galaxy">🆕</button>
                <button onClick={() => setIsIngestModalOpen(true)} className="w-9 h-9 rounded-xl bg-emerald-600/10 flex items-center justify-center text-sm border border-white/5 hover:bg-emerald-600/20" title="Receive Feed">📡</button>
              </>
            ) : (
              <button onClick={() => window.location.reload()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/5" title="Refresh">🔄</button>
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

        {/* HOST VIEW: STATUS MONITOR */}
        {viewMode === 'HOST' && (
           <div className="absolute top-20 left-6 z-40 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-5 rounded-3xl w-56 shadow-2xl">
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Command Status</h4>
              <div className="space-y-2.5">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isAi = gameState.aiPlayers.includes(pId);
                    const isReady = gameState.readyPlayers.includes(pId) || isAi;
                    return (
                       <div key={pId} className="flex items-center justify-between">
                          <span className="text-[11px] font-bold" style={{ color: PLAYER_COLORS[pId] }}>{gameState.playerNames[pId]}</span>
                          <span className={`text-[8px] font-black ${isReady ? 'text-emerald-500' : 'text-slate-600 animate-pulse'}`}>{isReady ? 'READY' : 'WAITING'}</span>
                       </div>
                    );
                 })}
              </div>
              <button 
                onClick={executeTurn}
                disabled={isProcessing}
                className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
              >
                {isProcessing ? 'SYNCING GALAXY...' : 'EXECUTE ROUND'}
              </button>
              
              <div className="mt-5 p-4 bg-black/50 rounded-2xl border border-white/5 h-48 overflow-y-auto custom-scrollbar">
                <h4 className="text-[7px] font-black text-slate-500 uppercase mb-2">Tactical Logs</h4>
                {gameState.logs.map((log, i) => (
                  <p key={i} className={`text-[8px] mb-2 leading-tight ${log.includes('bombard') || log.includes('lost') ? 'text-red-400' : log.includes('MIRACLE') ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>{log}</p>
                ))}
              </div>
           </div>
        )}

        {/* PLAYER VIEW: ACTION CONTROLS */}
        {viewMode === 'PLAYER' && (
           <div className={`absolute z-[120] flex transition-all duration-300 ${isLandscape ? 'bottom-6 right-6 flex-col items-end gap-3' : 'bottom-0 left-0 right-0 p-6 justify-between bg-gradient-to-t from-slate-950 to-transparent'}`}>
              <div className="flex items-center gap-4">
                  <button onClick={() => setIsAdvisorOpen(true)} className="w-16 h-16 bg-cyan-500 rounded-3xl flex items-center justify-center text-4xl shadow-xl shadow-cyan-500/30 active:scale-90 border-b-4 border-cyan-700">❂</button>
                  <button onClick={submitOrdersToHost} className="bg-white text-black px-12 h-16 rounded-3xl font-black text-[12px] uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-slate-300 flex items-center gap-3">
                    <span>PUSH ORDERS</span>
                    <span className="text-xl">📡</span>
                  </button>
              </div>
           </div>
        )}

        {/* HUD: TACTICAL PANEL */}
        <div className={`absolute transition-all duration-500 ease-out z-[130] 
          ${isLandscape 
            ? `top-16 bottom-16 left-0 w-80 ${selectedId ? 'translate-x-6' : '-translate-x-full'}` 
            : `bottom-0 left-0 right-0 ${selectedId ? 'translate-y-0' : 'translate-y-full'}`
          }`}
        >
          <div className={`${isLandscape ? 'h-full w-full rounded-[3rem]' : 'mx-2 rounded-t-[4rem]'} bg-slate-900/95 backdrop-blur-3xl border border-white/10 p-10 flex flex-col shadow-2xl`}>
             <div className="flex justify-between items-start mb-8">
                <div className="max-w-[80%]">
                   <h2 className="text-2xl font-bold italic text-white truncate">{selectedPlanet?.name || selectedShip?.name || 'Object'}</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Tactical Telemetry</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white">✕</button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
                {selectedPlanet && (
                  <div className="space-y-8">
                    <div className="bg-black/50 p-6 rounded-[3rem] border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                           <p className="text-[10px] text-slate-500 uppercase tracking-widest italic">Affiliation</p>
                           <div className="flex items-center gap-2">
                              <span className="text-xs">👥</span>
                              <span className={`text-xs font-black ${selectedPlanet.population < 2 ? 'text-red-400' : 'text-white'}`}>{selectedPlanet.population} / {MAX_PLANET_POPULATION}</span>
                           </div>
                        </div>
                        <p className="text-xl font-black" style={{ color: PLAYER_COLORS[selectedPlanet.owner] }}>{gameState.playerNames[selectedPlanet.owner]}</p>
                        
                        <div className="mt-5">
                           <div className="flex justify-between text-[8px] font-black uppercase text-slate-500 mb-1.5">
                              <span>Shield Strength</span>
                              <span>{Math.round(selectedPlanet.defense)} / {selectedPlanet.maxDefense}</span>
                           </div>
                           <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-700" style={{ width: `${(selectedPlanet.defense / selectedPlanet.maxDefense) * 100}%` }} />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-8">
                          <div className="bg-white/5 p-6 rounded-3xl text-center">
                            <span className="block text-[8px] text-slate-500 font-bold uppercase mb-1">Mines</span>
                            <span className="text-2xl font-black">{selectedPlanet.mines}</span>
                          </div>
                          <div className="bg-white/5 p-6 rounded-3xl text-center">
                            <span className="block text-[8px] text-slate-500 font-bold uppercase mb-1">Fact.</span>
                            <span className="text-2xl font-black">{selectedPlanet.factories}</span>
                          </div>
                        </div>
                    </div>

                    {(viewMode === 'PLAYER' && selectedPlanet.owner === playerRole) && (
                      <div className="space-y-3">
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Colonial Expansion</h4>
                        {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                          <button key={type} onClick={() => {
                            const cost = SHIP_COSTS[type as ShipType];
                            if (gameState.playerCredits[playerRole!] >= cost) {
                               const stats = SHIP_STATS[type as ShipType];
                               const newShip: Ship = { 
                                  id: `s-${Date.now()}`, 
                                  name: `${gameState.playerNames[playerRole!]} ${type}`, 
                                  type: type as ShipType, 
                                  owner: playerRole!, 
                                  x: selectedPlanet!.x, y: selectedPlanet!.y, 
                                  currentPlanetId: selectedPlanet!.id, 
                                  cargo: 0, maxCargo: stats.cargo, 
                                  cargoPeople: 0, maxPeopleCargo: stats.people,
                                  hp: stats.hp, maxHp: stats.hp, 
                                  attack: stats.attack, speed: stats.speed,
                                  status: 'ORBITING' 
                               };
                               setGameState(p => ({...p, playerCredits: {...p.playerCredits, [playerRole!]: p.playerCredits[playerRole!]-cost}, ships: [...p.ships, newShip]}));
                            }
                          }} className="p-5 bg-slate-950/80 rounded-3xl border border-white/10 flex items-center justify-between active:scale-95 transition-all">
                            <div className="flex items-center gap-4">
                               <span className="text-2xl">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                               <span className="text-[11px] font-black uppercase tracking-widest">{type}</span>
                            </div>
                            <span className="text-[11px] text-amber-500 font-bold">{SHIP_COSTS[type as ShipType]} Cr</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedShip && (
                   <div className="bg-black/60 p-8 rounded-[3rem] border border-white/10 space-y-8">
                     <div className="flex justify-between items-center">
                        <span className="px-5 py-2 bg-cyan-600/20 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">{selectedShip.type}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[12px] font-bold text-emerald-400">{selectedShip.status}</span>
                           {selectedShip.cargoPeople > 0 && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[9px] font-black border border-amber-500/30">👥 {selectedShip.cargoPeople}</span>}
                        </div>
                     </div>
                     
                     <div className="space-y-5">
                        <div className="space-y-2.5">
                           <div className="flex justify-between text-[8px] font-black uppercase text-slate-500"><span>Warp Efficiency</span><span>{selectedShip.speed} km/h</span></div>
                           <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${(selectedShip.speed / 180) * 100}%` }} /></div>
                        </div>
                        <div className="space-y-2.5">
                           <div className="flex justify-between text-[8px] font-black uppercase text-slate-500"><span>Tactical Yield</span><span>{selectedShip.attack} atk</span></div>
                           <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${(selectedShip.attack / 50) * 100}%` }} /></div>
                        </div>
                        <div className="space-y-2.5">
                           <div className="flex justify-between text-[8px] font-black uppercase text-slate-500"><span>Storage Mass</span><span>{selectedShip.maxCargo} ton</span></div>
                           <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(selectedShip.maxCargo / 1000) * 100}%` }} /></div>
                        </div>
                     </div>

                     {(viewMode === 'PLAYER' && selectedShip.owner === playerRole) && (
                       <div className="space-y-4">
                         {selectedShip.type === 'FREIGHTER' && selectedShip.currentPlanetId && (
                            <div className="grid grid-cols-2 gap-3">
                               <button 
                                 disabled={selectedShip.cargoPeople >= selectedShip.maxPeopleCargo}
                                 onClick={() => handleLoadPerson(selectedShip.id, selectedShip.currentPlanetId!)}
                                 className="py-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-[10px] font-black uppercase text-amber-400 disabled:opacity-30 active:scale-95"
                               >
                                 Load Colonist
                               </button>
                               <button 
                                 disabled={selectedShip.cargoPeople === 0}
                                 onClick={() => handleUnloadPerson(selectedShip.id, selectedShip.currentPlanetId!)}
                                 className="py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-[10px] font-black uppercase text-emerald-400 disabled:opacity-30 active:scale-95"
                               >
                                 Unload Colonist
                               </button>
                            </div>
                         )}
                         <div className="p-6 bg-cyan-600/10 border border-cyan-500/20 rounded-3xl text-center">
                           <p className="text-[11px] text-cyan-300 font-black mb-1">NAV-COM READY</p>
                           <p className="text-[10px] text-white/40 italic leading-relaxed">Designate destination to commit vector.</p>
                         </div>
                       </div>
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
        }}
        readyPlayers={gameState.readyPlayers}
      />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n) => { setGameState(generateInitialState(p, a, undefined, n)); setIsNewGameModalOpen(false); setSelectedId(null); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={`${window.location.origin}${window.location.pathname}`} gameState={gameState} />
    </div>
  );
};

export default App;
