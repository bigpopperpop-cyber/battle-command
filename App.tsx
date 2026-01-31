
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType } from './types';
// Fixed: Added PLANET_COUNT to imports
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, PLANET_COUNT } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import LobbyModal from './components/LobbyModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import InviteModal from './components/InviteModal';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, Database } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com", 
};

let db: Database | null = null;
const isConfigPlaceholder = !firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes("default-rtdb");

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
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);
  const [viewMode, setViewMode] = useState<'HOST' | 'PLAYER'>('HOST');
  
  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(2, 0));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isNewGameOpen, setIsNewGameOpen] = useState(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingCourse, setIsSettingCourse] = useState(false);
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);

  // Deep Link Detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('gameId');
    const urlRole = params.get('role') as Owner | null;

    if (urlGameId && urlRole) {
      setGameId(urlGameId);
      setPlayerRole(urlRole);
      setViewMode('PLAYER');
      setHasStarted(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Sync state from Firebase
  useEffect(() => {
    if (!db || !gameId || isConfigPlaceholder) return;
    const stateRef = ref(db, `games/${gameId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
    return () => unsubscribe();
  }, [gameId]);

  useEffect(() => {
    if (combatEvents.length > 0) {
      const timer = setTimeout(() => setCombatEvents([]), 3500);
      return () => clearTimeout(timer);
    }
  }, [combatEvents]);

  const handleIssueOrder = (type: string, payload?: any) => {
    if (!playerRole) return;
    
    if (type === 'SET_COURSE') {
      setIsSettingCourse(true);
      return;
    }

    setGameState(prev => {
      const readyPlayers = (prev.readyPlayers || []).filter(p => p !== playerRole);
      const nextState = { ...prev, readyPlayers };
      const selected = prev.planets.find(p => p.id === selectedId) || prev.ships.find(s => s.id === selectedId);
      
      if (type === 'BUILD_MINE' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 500) return prev;
        nextState.playerCredits[playerRole] -= 500;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, mines: p.mines + 1 } : p);
      } else if (type === 'BUILD_FACTORY' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 800) return prev;
        nextState.playerCredits[playerRole] -= 800;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, factories: p.factories + 1 } : p);
      } else if (type === 'BUILD_BATTERY' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 1200) return prev;
        nextState.playerCredits[playerRole] -= 1200;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, batteries: p.batteries + 1 } : p);
      } else if (type === 'BUILD_SHIP' && selected && 'population' in selected) {
         const shipType = payload.type as ShipType;
         const baseStats = SHIP_STATS[shipType];
         const bonuses = getEmpireBonuses(prev.planets, playerRole);
         const cost = Math.floor(baseStats.cost * (1 - bonuses.discount));

         if (nextState.playerCredits[playerRole] < cost) return prev;
         nextState.playerCredits[playerRole] -= cost;
         
         const boostedHp = Math.floor(baseStats.hp * bonuses.strength);
         const boostedAtk = Math.floor(baseStats.attack * bonuses.strength);
         const peopleCapacity = shipType === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people;

         const newShip: Ship = {
            id: `s-${playerRole}-${Date.now()}`,
            name: `${prev.playerNames[playerRole]} ${shipType}`,
            type: shipType,
            owner: playerRole,
            x: selected.x,
            y: selected.y,
            currentPlanetId: selected.id,
            cargo: 0,
            maxCargo: baseStats.cargo,
            cargoPeople: 0,
            maxPeopleCargo: peopleCapacity,
            hp: boostedHp,
            maxHp: boostedHp,
            attack: boostedAtk,
            speed: baseStats.speed,
            status: 'ORBITING'
         };
         nextState.ships = [...prev.ships, newShip];
      }

      if (db && gameId && !isConfigPlaceholder) {
        set(ref(db, `games/${gameId}/state`), nextState);
      }
      return nextState;
    });
  };

  const executeTurn = async () => {
    if (isProcessing || !allPlayersReady) return;
    setIsProcessing(true);
    const events: CombatEvent[] = [];
    
    try {
      let nextPlanets = gameState.planets.map(p => ({...p}));
      let nextShips = gameState.ships.map(s => ({...s}));
      let nextCredits = { ...gameState.playerCredits };

      // Movement
      nextShips = nextShips.map(ship => {
        if (ship.targetPlanetId) {
          const target = nextPlanets.find(p => p.id === ship.targetPlanetId);
          if (target) {
            const dx = target.x - ship.x;
            const dy = target.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= ship.speed) {
              return { ...ship, x: target.x, y: target.y, status: 'ORBITING', currentPlanetId: target.id, targetPlanetId: undefined };
            } else {
              return { ...ship, x: ship.x + (dx/dist) * ship.speed, y: ship.y + (dy/dist) * ship.speed, status: 'MOVING' };
            }
          }
        }
        return ship;
      });

      // Combat logic including Batteries
      const damageMap: Record<string, number> = {};
      nextPlanets.forEach(planet => {
        const shipsAtPlanet = nextShips.filter(s => s.currentPlanetId === planet.id && s.status === 'ORBITING');
        
        // 1. Planetary Batteries vs Hostiles
        if (planet.owner !== 'NEUTRAL' && planet.batteries > 0) {
           const invaders = shipsAtPlanet.filter(s => s.owner !== planet.owner);
           if (invaders.length > 0) {
              const target = invaders[Math.floor(Math.random() * invaders.length)];
              const batteryDamage = planet.batteries * 40;
              damageMap[target.id] = (damageMap[target.id] || 0) + batteryDamage;
              
              events.push({
                id: `bat-${planet.id}-${target.id}`,
                attackerPos: { x: planet.x, y: planet.y },
                targetPos: { x: target.x, y: target.y },
                color: PLAYER_COLORS[planet.owner]
              });
           }
        }

        // 2. Ships vs Ships
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
                events.push({
                   id: `ev-${attacker.id}-${target.id}`,
                   attackerPos: { x: attacker.x, y: attacker.y },
                   targetPos: { x: target.x, y: target.y },
                   color: PLAYER_COLORS[attacker.owner]
                });
              }
            }
          });
        }
      });

      nextShips = nextShips.map(s => {
        if (damageMap[s.id]) s.hp -= damageMap[s.id];
        return s;
      }).filter(s => s.hp > 0);

      // Economy and Planet Growth
      nextPlanets = nextPlanets.map(p => {
        if (p.owner === 'NEUTRAL') {
          const colonist = nextShips.find(s => s.currentPlanetId === p.id && s.type === 'FREIGHTER');
          if (colonist) return { ...p, owner: colonist.owner, population: 1 };
          return p;
        }
        const invaders = nextShips.filter(s => s.currentPlanetId === p.id && s.owner !== p.owner && s.type === 'WARSHIP');
        let nextPop = p.population;
        if (invaders.length > 0) {
          nextPop = Math.max(0, p.population - (invaders.length * 0.5));
        } else {
          nextPop = Math.min(MAX_PLANET_POPULATION, p.population + 0.2);
        }

        const income = (p.mines * 50) + (p.factories * 20) + (Math.floor(nextPop) * 50);
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;

        return { ...p, population: nextPop, owner: nextPop <= 0 && invaders.length > 0 ? invaders[0].owner : p.owner };
      });

      // Check Victory Condition (60% of planets)
      let winner: Owner | null = null;
      // Fixed: Explicitly cast to Owner[] and added PLANET_COUNT for calculation
      const ownersList = Array.from(new Set(nextPlanets.filter(p => p.owner !== 'NEUTRAL').map(p => p.owner))) as Owner[];
      ownersList.forEach(o => {
        const owned = nextPlanets.filter(p => p.owner === o).length;
        if (owned >= PLANET_COUNT * 0.6) winner = o;
      });

      const finalState: GameState = { ...gameState, round: gameState.round + 1, planets: nextPlanets, ships: nextShips, playerCredits: nextCredits, readyPlayers: [], winner };
      setCombatEvents(events);
      if (db && gameId && !isConfigPlaceholder) await set(ref(db, `games/${gameId}/state`), finalState);
      else setGameState(finalState);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  // --- Fog of War filtering ---
  const visibleShips = useMemo(() => {
    if (!playerRole) return gameState.ships;
    const myPlanetsIds = new Set(gameState.planets.filter(p => p.owner === playerRole).map(p => p.id));
    const myShipPlanetIds = new Set(gameState.ships.filter(s => s.owner === playerRole).map(s => s.currentPlanetId).filter(Boolean));

    return gameState.ships.filter(s => {
      if (s.owner === playerRole) return true;
      // Revealed if orbiting my planet
      if (s.currentPlanetId && myPlanetsIds.has(s.currentPlanetId)) return true;
      // Revealed if at same planet as my ship
      if (s.currentPlanetId && myShipPlanetIds.has(s.currentPlanetId)) return true;
      // Scout ships could have a radius check here too
      return false;
    });
  }, [gameState.ships, gameState.planets, playerRole]);

  const selectedObject = useMemo(() => gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null, [selectedId, gameState]);
  const handleReadyToggle = () => { /* Logic already exists in standard component */ };
  const humanPlayers = useMemo(() => {
    const humans: Owner[] = [];
    for (let i = 1; i <= gameState.playerCount; i++) {
      const p = `P${i}` as Owner;
      if (!gameState.aiPlayers.includes(p)) humans.push(p);
    }
    return humans;
  }, [gameState.playerCount, gameState.aiPlayers]);
  const allPlayersReady = useMemo(() => humanPlayers.filter(p => p !== 'P1').every(p => (gameState.readyPlayers || []).includes(p)), [humanPlayers, gameState.readyPlayers]);

  if (!hasStarted) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#020617] text-white">
      <div className="text-center p-10 glass-card rounded-[3rem] border-cyan-500/20 max-w-lg shadow-2xl">
        <h1 className="text-5xl font-black italic tracking-tighter mb-4">STELLAR<br/>COMMANDER</h1>
        <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.5em] mb-12">Galactic Hegemony Engine</p>
        <div className="space-y-4">
          <button 
            onClick={() => setIsNewGameOpen(true)}
            className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
          >
            Initiate New Sector
          </button>
          <button 
            onClick={() => setIsLobbyOpen(true)}
            className="w-full py-5 bg-slate-900 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
          >
            Connect to Uplink
          </button>
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="w-full py-4 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest"
          >
            Tactical Handbook
          </button>
        </div>
      </div>
      <NewGameModal 
        isOpen={isNewGameOpen} 
        onClose={() => setIsNewGameOpen(false)} 
        onConfirm={(pc, ai, names, diff) => {
          const state = generateInitialState(pc, ai, undefined, names, diff);
          setGameState(state);
          setPlayerRole('P1');
          setViewMode('HOST');
          setHasStarted(true);
          setIsNewGameOpen(false);
          if (db && !isConfigPlaceholder) {
            const newFreq = Math.floor(100 + Math.random() * 899).toString();
            setGameId(newFreq);
            set(ref(db, `games/${newFreq}/state`), state);
          }
        }} 
      />
      <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} db={db} onJoin={(id, role) => {
        setGameId(id);
        setPlayerRole(role);
        setViewMode('PLAYER');
        setHasStarted(true);
        setIsLobbyOpen(false);
      }} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      {gameState.winner && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-1000">
           <div className="text-center">
             <h1 className="text-6xl font-black text-white italic tracking-tighter mb-4">HEGEMONY ACHIEVED</h1>
             <p className="text-2xl font-bold text-cyan-400 uppercase tracking-[0.5em]">{gameState.playerNames[gameState.winner]} Dominates the Sector</p>
             <button onClick={() => window.location.reload()} className="mt-12 px-10 py-4 bg-cyan-600 text-white font-black rounded-2xl">Return to Command</button>
           </div>
        </div>
      )}
      
      <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic">{playerRole} Command</span>
            <span className="text-[9px] font-bold text-slate-500">ROUND {gameState.round}</span>
          </div>
          <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden ml-6 hidden lg:block">
            <div 
              className="h-full bg-cyan-500 transition-all duration-1000" 
              // Fixed: Added PLANET_COUNT for progress bar calculation
              style={{ width: `${(gameState.planets.filter(p => p.owner === playerRole).length / PLANET_COUNT) * 100}%` }} 
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
           {viewMode === 'HOST' ? (
             <button onClick={executeTurn} disabled={isProcessing || !allPlayersReady} className="px-6 py-2.5 bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Execute Turn</button>
           ) : (
             <button className="px-6 py-2.5 bg-cyan-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Submit Orders</button>
           )}
           <div className="bg-slate-900 px-4 py-2 rounded-xl text-amber-500 font-bold text-xs">💰 {gameState.playerCredits[playerRole || 'P1']}</div>
           <button onClick={() => setIsAdvisorOpen(true)} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5">🤖</button>
           <button onClick={() => setIsHelpOpen(true)} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5">❓</button>
           {viewMode === 'HOST' && <button onClick={() => setIsInviteOpen(true)} className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center">📡</button>}
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={visibleShips} 
          selectedId={selectedId} 
          onSelect={(id) => setSelectedId(id)}
          isSettingCourse={isSettingCourse}
          combatEvents={combatEvents}
        />
        <SelectionPanel 
          selection={selectedObject} 
          onClose={() => setSelectedId(null)}
          playerRole={playerRole}
          credits={gameState.playerCredits[playerRole || 'P1']}
          onIssueOrder={handleIssueOrder}
          isSettingCourse={isSettingCourse}
          ships={gameState.ships}
          planets={gameState.planets}
        />
        <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState} />
        {isInviteOpen && gameId && <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} frequency={gameId} gameState={gameState} />}
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} gameState={gameState} playerRole={playerRole} />
      </main>
    </div>
  );
};

export default App;
