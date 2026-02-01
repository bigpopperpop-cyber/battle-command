
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType, PlanetSpecialization } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, PLANET_COUNT } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, onDisconnect, Database, off } from 'firebase/database';

const FAMILY_GALAXY_ID = "Command-Center-Alpha";

const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com", 
};

let db: Database | null = null;
try {
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app);
} catch (e) {
  console.error("Relay Initialization Failed:", e);
}

export interface CombatEvent {
  id: string;
  attackerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  color: string;
}

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isNewGameOpen, setIsNewGameOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingCourse, setIsSettingCourse] = useState(false);
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);
  const [onlineCommanders, setOnlineCommanders] = useState<number>(0);

  useEffect(() => {
    if (!db) return;

    const myPresenceId = `presence-${Math.random().toString(36).substr(2, 9)}`;
    const presenceRef = ref(db, `lobbies/${FAMILY_GALAXY_ID}/players/${myPresenceId}`);
    onDisconnect(presenceRef).remove();
    set(presenceRef, { active: true, joinedAt: Date.now() });

    const playersRef = ref(db, `lobbies/${FAMILY_GALAXY_ID}/players`);
    const stateRef = ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`);

    const unsubPresence = onValue(playersRef, (snap) => {
      const players = snap.val() || {};
      setOnlineCommanders(Object.keys(players).length);
    });

    const unsubState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
      } else {
        setGameState(null);
        setHasStarted(false);
      }
    });

    return () => {
      unsubPresence();
      unsubState();
      if (db) {
        off(playersRef);
        off(stateRef);
      }
    };
  }, []);

  const handleSelfDestruct = async () => {
    if (!db || !window.confirm("ARE YOU SURE? THIS WILL TERMINATE THE GALAXY FOR EVERYONE.")) return;
    setIsProcessing(true);
    try {
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), null);
    } catch (e) {
      console.error("Self-destruct failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIssueOrder = useCallback((type: string, payload?: any) => {
    if (!playerRole || !gameState || !db) return;
    
    if (type === 'SET_COURSE') {
      setIsSettingCourse(true);
      return;
    }

    const nextState = { ...gameState };
    nextState.readyPlayers = (gameState.readyPlayers || []).filter(p => p !== playerRole);
    
    const selected = gameState.planets?.find(p => p.id === selectedId) || gameState.ships?.find(s => s.id === selectedId);
    if (!selected) return;

    if (type === 'BUILD_MINE' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 500) return;
      nextState.playerCredits[playerRole] -= 500;
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, mines: p.mines + 1 } : p);
    } else if (type === 'BUILD_FACTORY' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 800) return;
      nextState.playerCredits[playerRole] -= 800;
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, factories: p.factories + 1 } : p);
    } else if (type === 'SET_SPECIALIZATION' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 1500) return;
      nextState.playerCredits[playerRole] -= 1500;
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, specialization: payload.spec } : p);
    } else if (type === 'TOGGLE_AUTO_DEFENSE' && 'population' in selected) {
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, autoDefense: !p.autoDefense } : p);
    } else if (type === 'BUILD_SHIP' && 'population' in selected) {
       const shipType = payload.type as ShipType;
       const baseStats = SHIP_STATS[shipType];
       const bonuses = getEmpireBonuses(gameState.planets || [], playerRole);
       const isShipyard = selected.specialization === 'SHIPYARD';
       const cost = Math.floor(baseStats.cost * (1 - bonuses.discount - (isShipyard ? 0.25 : 0)));

       if (nextState.playerCredits[playerRole] < cost) return;
       nextState.playerCredits[playerRole] -= cost;
       
       const newShip: Ship = {
          id: `s-${playerRole}-${Date.now()}`,
          name: `${gameState.playerNames[playerRole]} ${shipType}`,
          type: shipType,
          owner: playerRole,
          x: selected.x,
          y: selected.y,
          currentPlanetId: selected.id,
          targetPlanetId: null,
          cargo: 0,
          maxCargo: baseStats.cargo,
          cargoPeople: 0,
          maxPeopleCargo: shipType === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people,
          hp: Math.floor(baseStats.hp * bonuses.strength),
          maxHp: Math.floor(baseStats.hp * bonuses.strength),
          attack: Math.floor(baseStats.attack * bonuses.strength),
          speed: baseStats.speed,
          status: 'ORBITING'
       };
       nextState.ships = [...(gameState.ships || []), newShip];
    } else if (type === 'COMMIT') {
      if (!nextState.readyPlayers.includes(playerRole)) {
        nextState.readyPlayers = [...nextState.readyPlayers, playerRole];
      }
    }

    set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
  }, [playerRole, gameState, selectedId]);

  const handleSelect = (id: string) => {
    if (!gameState || !db) return;

    if (isSettingCourse && selectedId) {
      const selectedShip = gameState.ships?.find(s => s.id === selectedId);
      const targetPlanet = gameState.planets?.find(p => p.id === id);

      if (selectedShip && targetPlanet) {
        const nextShips = (gameState.ships || []).map(s => 
          s.id === selectedId 
            ? { ...s, targetPlanetId: id, currentPlanetId: null, status: 'MOVING' as const } 
            : s
        );
        const nextState = { 
          ...gameState, 
          ships: nextShips, 
          readyPlayers: (gameState.readyPlayers || []).filter(p => p !== playerRole) 
        };
        set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
        setIsSettingCourse(false);
        return; 
      }
      const clickedAnotherShip = gameState.ships?.find(s => s.id === id);
      if (clickedAnotherShip && id !== selectedId) {
        setSelectedId(id);
        setIsSettingCourse(false);
        return;
      }
      if (id === selectedId) return;
      return; 
    }
    setSelectedId(id);
    if (isSettingCourse) setIsSettingCourse(false);
  };

  const executeTurn = async () => {
    if (isProcessing || !allPlayersReady || !gameState || !db) return;
    setIsProcessing(true);
    const events: CombatEvent[] = [];
    
    try {
      let nextPlanets = (gameState.planets || []).map(p => ({...p}));
      let nextShips = (gameState.ships || []).map(s => ({...s}));
      let nextCredits = { ...gameState.playerCredits };

      // Process Automated Defense: Planets build warships automatically if an enemy is detected
      nextPlanets.forEach(planet => {
        if (planet.owner !== 'NEUTRAL' && planet.autoDefense && planet.factories > 0) {
          const invaders = nextShips.filter(s => s.currentPlanetId === planet.id && s.owner !== planet.owner);
          if (invaders.length > 0) {
            const shipType = 'WARSHIP' as ShipType;
            const baseStats = SHIP_STATS[shipType];
            const bonuses = getEmpireBonuses(nextPlanets, planet.owner);
            const isShipyard = planet.specialization === 'SHIPYARD';
            const cost = Math.floor(baseStats.cost * (1 - bonuses.discount - (isShipyard ? 0.25 : 0)));
            
            if (nextCredits[planet.owner] >= cost) {
              nextCredits[planet.owner] -= cost;
              const newShip: Ship = {
                id: `s-auto-${planet.owner}-${Date.now()}-${Math.random()}`,
                name: `Defense Unit ${planet.name}`,
                type: shipType,
                owner: planet.owner,
                x: planet.x,
                y: planet.y,
                currentPlanetId: planet.id,
                targetPlanetId: null,
                cargo: 0,
                maxCargo: baseStats.cargo,
                cargoPeople: 0,
                maxPeopleCargo: bonuses.warshipCapacity,
                hp: Math.floor(baseStats.hp * bonuses.strength),
                maxHp: Math.floor(baseStats.hp * bonuses.strength),
                attack: Math.floor(baseStats.attack * bonuses.strength),
                speed: baseStats.speed,
                status: 'ORBITING'
              };
              nextShips.push(newShip);
            }
          }
        }
      });

      nextShips = nextShips.map(ship => {
        if (ship.targetPlanetId) {
          const target = nextPlanets.find(p => p.id === ship.targetPlanetId);
          if (target) {
            const dx = target.x - ship.x;
            const dy = target.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= ship.speed) {
              return { ...ship, x: target.x, y: target.y, status: 'ORBITING', currentPlanetId: target.id, targetPlanetId: null };
            } else {
              return { ...ship, x: ship.x + (dx/dist) * ship.speed, y: ship.y + (dy/dist) * ship.speed, status: 'MOVING' };
            }
          }
        }
        return ship;
      });

      const damageMap: Record<string, number> = {};
      nextPlanets.forEach(planet => {
        const shipsAtPlanet = nextShips.filter(s => s.currentPlanetId === planet.id && s.status === 'ORBITING');
        if (planet.owner !== 'NEUTRAL') {
           const invaders = shipsAtPlanet.filter(s => s.owner !== planet.owner);
           if (invaders.length > 0 && planet.batteries > 0) {
              const target = invaders[Math.floor(Math.random() * invaders.length)];
              const batteryDamage = planet.batteries * 40 * (planet.specialization === 'FORTRESS' ? 2 : 1);
              damageMap[target.id] = (damageMap[target.id] || 0) + batteryDamage;
              events.push({ id: `bat-${planet.id}-${target.id}`, attackerPos: { x: planet.x, y: planet.y }, targetPos: { x: target.x, y: target.y }, color: PLAYER_COLORS[planet.owner] });
           }
        }
        const owners = Array.from(new Set(shipsAtPlanet.map(s => s.owner)));
        if (owners.length > 1) {
          shipsAtPlanet.forEach(attacker => {
            if (attacker.attack > 0) {
              const enemies = shipsAtPlanet.filter(s => s.owner !== attacker.owner);
              if (enemies.length > 0) {
                const target = enemies[0];
                const bonuses = getEmpireBonuses(nextPlanets, attacker.owner);
                const damage = attacker.attack + bonuses.firepowerBonus;
                damageMap[target.id] = (damageMap[target.id] || 0) + damage;
                events.push({ id: `ev-${attacker.id}-${target.id}`, attackerPos: { x: attacker.x, y: attacker.y }, targetPos: { x: target.x, y: target.y }, color: PLAYER_COLORS[attacker.owner] });
              }
            }
          });
        }
      });

      nextShips = nextShips.map(s => {
        if (damageMap[s.id]) s.hp -= damageMap[s.id];
        return s;
      }).filter(s => s.hp > 0);

      nextPlanets = nextPlanets.map(p => {
        if (p.owner === 'NEUTRAL') {
          const colonist = nextShips.find(s => s.currentPlanetId === p.id && s.type === 'FREIGHTER');
          if (colonist) return { ...p, owner: colonist.owner, population: 1 };
          return p;
        }
        const invaders = nextShips.filter(s => s.currentPlanetId === p.id && s.owner !== p.owner && s.type === 'WARSHIP');
        let nextPop = invaders.length > 0 ? Math.max(0, p.population - (invaders.length * 0.5)) : Math.min(MAX_PLANET_POPULATION, p.population + (p.specialization === 'INDUSTRIAL' ? 0.3 : 0.2));
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + (p.mines * 50) + (p.factories * 20) + (Math.floor(nextPop) * 50);
        return { ...p, population: nextPop, owner: nextPop <= 0 && invaders.length > 0 ? invaders[0].owner : p.owner };
      });

      const winner = (Array.from(new Set(nextPlanets.filter(p => p.owner !== 'NEUTRAL').map(p => p.owner))) as Owner[])
        .find(o => nextPlanets.filter(p => p.owner === o).length >= PLANET_COUNT * 0.6) || null;

      const finalState: GameState = { ...gameState, round: gameState.round + 1, planets: nextPlanets, ships: nextShips, playerCredits: nextCredits, readyPlayers: [], winner };
      setCombatEvents(events);
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), finalState);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const humanPlayers = useMemo(() => {
    if (!gameState) return [];
    const humans: Owner[] = [];
    for (let i = 1; i <= gameState.playerCount; i++) {
      const p = `P${i}` as Owner;
      if (!gameState.aiPlayers?.includes(p)) humans.push(p);
    }
    return humans;
  }, [gameState]);

  const allPlayersReady = useMemo(() => {
    if (!gameState) return false;
    const allies = humanPlayers.filter(p => p !== 'P1');
    return allies.every(p => (gameState.readyPlayers || []).includes(p));
  }, [humanPlayers, gameState]);

  if (!hasStarted) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#020617] text-white star-bg overflow-y-auto safe-pt safe-pb p-4">
      <div className="text-center p-8 md:p-12 glass-card rounded-[3rem] md:rounded-[4rem] border-cyan-500/20 w-full max-w-lg shadow-2xl relative overflow-hidden my-auto">
        {isProcessing && <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-400 animate-pulse text-center">Initializing Galactic Core...</p>
        </div>}
        <h1 className="text-4xl md:text-6xl font-black italic mb-2 leading-none uppercase">Stellar<br/><span className="text-cyan-400">Commander</span></h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 md:mb-10">Sector: {FAMILY_GALAXY_ID}</p>
        
        <div className="space-y-4 md:space-y-6">
          <div className="bg-slate-900/60 p-4 md:p-5 rounded-3xl border border-white/5">
             <div className="flex items-center justify-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${onlineCommanders > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs md:text-sm font-bold">{onlineCommanders} Commanders Online</span>
             </div>
             <p className="text-[9px] text-slate-500 uppercase font-black">Syncing sub-space terminals...</p>
          </div>

          {!gameState ? (
            <div className="space-y-3">
              <button 
                onClick={() => setIsNewGameOpen(true)} 
                className="w-full py-5 md:py-6 bg-cyan-600 hover:bg-cyan-500 rounded-3xl font-black text-xs md:text-sm uppercase tracking-widest shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
              >
                Initialize Galaxy
              </button>
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="w-full py-4 bg-slate-900/60 border border-white/10 text-slate-400 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
              >
                📖 Open Field Manual
              </button>
            </div>
          ) : (
            <div className="space-y-3">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Battlezone Detected</p>
               <div className="grid grid-cols-2 gap-2">
                 {Array.from({ length: gameState.playerCount }).map((_, i) => {
                   const pId = `P${i+1}` as Owner;
                   if (gameState.aiPlayers?.includes(pId)) return null;
                   return (
                     <button 
                       key={pId}
                       onClick={() => { setPlayerRole(pId); setHasStarted(true); }}
                       className="py-4 md:py-5 bg-slate-900 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/20 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all"
                     >
                       Join {pId}
                     </button>
                   );
                 })}
               </div>
               <button onClick={() => setIsHelpOpen(true)} className="w-full py-2 text-slate-500 hover:text-white text-[9px] font-black uppercase tracking-widest">View Instructions</button>
            </div>
          )}
        </div>
      </div>
      
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={async (pc, ai, names, diff) => {
        if (!db) return;
        setIsProcessing(true);
        const state = generateInitialState(pc, ai, undefined, names, diff);
        try {
          await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), state);
          setPlayerRole('P1');
          setGameState(state);
          setHasStarted(true);
          setIsNewGameOpen(false);
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
      }} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      <header className="h-20 md:h-24 flex items-center justify-between px-4 md:px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100] shrink-0">
        <div className="flex items-center gap-2 md:gap-6 max-w-[40%]">
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-black text-cyan-500 uppercase tracking-widest italic leading-tight truncate">{playerRole} COMMAND</span>
            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 leading-tight">RND {gameState?.round || 1}</span>
          </div>
          <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
        </div>

        <div className="flex items-center gap-1.5 md:gap-4 overflow-hidden">
           <div className="hidden sm:flex bg-slate-900/80 px-2 md:px-4 py-2 md:py-3 rounded-xl border border-white/5 text-amber-500 font-bold text-[10px] md:text-xs items-center gap-2">💰 {gameState?.playerCredits[playerRole || 'P1'] || 0}</div>
           {playerRole === 'P1' ? (
             <div className="flex items-center gap-1.5">
               <button onClick={handleSelfDestruct} disabled={isProcessing} className="p-2 md:px-4 md:py-3 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">💥 Reset</button>
               <button onClick={executeTurn} disabled={isProcessing || !allPlayersReady} className="px-3 md:px-6 py-2 md:py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-lg">GO</button>
             </div>
           ) : (
             <button onClick={() => handleIssueOrder('COMMIT')} disabled={(gameState?.readyPlayers || []).includes(playerRole!)} className={`px-3 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${(gameState?.readyPlayers || []).includes(playerRole!) ? 'bg-emerald-900/40 text-emerald-500' : 'bg-cyan-600 text-white animate-pulse'}`}>{(gameState?.readyPlayers || []).includes(playerRole!) ? 'LOCKED' : 'COMMIT'}</button>
           )}
           <button onClick={() => setIsAdvisorOpen(true)} className="w-9 h-9 md:w-12 md:h-12 bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center border border-white/5 shrink-0">🤖</button>
           <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 md:w-12 md:h-12 bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center border border-white/5 shrink-0">📖</button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {gameState && (
          <MapView 
            planets={gameState.planets || []} 
            ships={gameState.ships || []} 
            selectedId={selectedId} 
            onSelect={handleSelect}
            isSettingCourse={isSettingCourse}
            combatEvents={combatEvents}
            playerRole={playerRole}
          />
        )}
        <SelectionPanel 
          selection={gameState ? (gameState.planets?.find(p => p.id === selectedId) || gameState.ships?.find(s => s.id === selectedId) || null) : null} 
          onClose={() => setSelectedId(null)}
          playerRole={playerRole}
          credits={gameState?.playerCredits[playerRole || 'P1'] || 0}
          onIssueOrder={handleIssueOrder}
          isSettingCourse={isSettingCourse}
          ships={gameState?.ships || []}
          planets={gameState?.planets || []}
        />
        {gameState && <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState} />}
        {gameState && <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} gameState={gameState} playerRole={playerRole} />}
      </main>
    </div>
  );
};

export default App;
