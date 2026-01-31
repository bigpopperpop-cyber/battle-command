
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType, PlanetSpecialization } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, PLANET_COUNT } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import LobbyModal from './components/LobbyModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import InviteModal from './components/InviteModal';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, Database, goOnline, goOffline } from 'firebase/database';

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
  
  // Reliability States
  const [isRelayOnline, setIsRelayOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Reliability: Connection Monitor
  useEffect(() => {
    if (!db || isConfigPlaceholder) return;
    const connectedRef = ref(db, ".info/connected");
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setIsRelayOnline(true);
      } else {
        setIsRelayOnline(false);
        // Attempt forced reconnection after a delay if still offline
        setTimeout(() => {
          if (db) goOnline(db);
        }, 3000);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync state from Firebase
  useEffect(() => {
    if (!db || !gameId || isConfigPlaceholder) return;
    setIsSyncing(true);
    const stateRef = ref(db, `games/${gameId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        setIsSyncing(false);
      }
    }, (err) => {
      console.error("State Sync Failed:", err);
      setIsSyncing(false);
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
      } else if (type === 'SET_SPECIALIZATION' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 1500) return prev;
        nextState.playerCredits[playerRole] -= 1500;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, specialization: payload.spec } : p);
      } else if (type === 'BUILD_SHIP' && selected && 'population' in selected) {
         const shipType = payload.type as ShipType;
         const baseStats = SHIP_STATS[shipType];
         const bonuses = getEmpireBonuses(prev.planets, playerRole);
         
         // Spec bonus: SHIPYARD makes ships 25% cheaper at that specific planet
         const isShipyard = selected.specialization === 'SHIPYARD';
         const specDiscount = isShipyard ? 0.25 : 0;
         const cost = Math.floor(baseStats.cost * (1 - bonuses.discount - specDiscount));

         if (nextState.playerCredits[playerRole] < cost) return prev;
         nextState.playerCredits[playerRole] -= cost;
         
         const boostedHp = Math.floor(baseStats.hp * bonuses.strength);
         const boostedAtk = Math.floor(baseStats.attack * bonuses.strength);

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
            maxPeopleCargo: shipType === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people,
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

  const handleSelect = (id: string) => {
    // Logic for setting destination while in course-setting mode
    if (isSettingCourse && selectedId) {
      const selectedShip = gameState.ships.find(s => s.id === selectedId);
      const targetPlanet = gameState.planets.find(p => p.id === id);

      // Only allow setting target if selection is a ship and target is a planet
      if (selectedShip && targetPlanet) {
        setGameState(prev => {
          const nextShips = prev.ships.map(s => 
            s.id === selectedId 
              ? { ...s, targetPlanetId: id, currentPlanetId: undefined, status: 'MOVING' as const } 
              : s
          );
          const nextState = { ...prev, ships: nextShips };
          
          if (db && gameId && !isConfigPlaceholder) {
            set(ref(db, `games/${gameId}/state`), nextState);
          }
          return nextState;
        });
        setIsSettingCourse(false);
        return;
      }
    }
    
    // Normal selection
    setSelectedId(id);
    // If you tap a new object while setting course, and it wasn't a valid target, we cancel targeting
    if (isSettingCourse) setIsSettingCourse(false);
  };

  const executeTurn = async () => {
    if (isProcessing || !allPlayersReady) return;
    setIsProcessing(true);
    const events: CombatEvent[] = [];
    
    try {
      let nextPlanets = gameState.planets.map(p => ({...p}));
      let nextShips = gameState.ships.map(s => ({...s}));
      let nextCredits = { ...gameState.playerCredits };

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

      const damageMap: Record<string, number> = {};
      nextPlanets.forEach(planet => {
        const shipsAtPlanet = nextShips.filter(s => s.currentPlanetId === planet.id && s.status === 'ORBITING');
        
        if (planet.owner !== 'NEUTRAL') {
           const invaders = shipsAtPlanet.filter(s => s.owner !== planet.owner);
           if (invaders.length > 0 && planet.batteries > 0) {
              const target = invaders[Math.floor(Math.random() * invaders.length)];
              // Spec bonus: FORTRESS batteries are 2x stronger
              const batteryDamage = planet.batteries * 40 * (planet.specialization === 'FORTRESS' ? 2 : 1);
              damageMap[target.id] = (damageMap[target.id] || 0) + batteryDamage;
              events.push({
                id: `bat-${planet.id}-${target.id}`,
                attackerPos: { x: planet.x, y: planet.y },
                targetPos: { x: target.x, y: target.y },
                color: PLAYER_COLORS[planet.owner]
              });
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
          // Spec bonus: INDUSTRIAL growth is 50% faster
          const growthBase = p.specialization === 'INDUSTRIAL' ? 0.3 : 0.2;
          nextPop = Math.min(MAX_PLANET_POPULATION, p.population + growthBase);
        }

        const income = (p.mines * 50) + (p.factories * 20) + (Math.floor(nextPop) * 50);
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;

        return { ...p, population: nextPop, owner: nextPop <= 0 && invaders.length > 0 ? invaders[0].owner : p.owner };
      });

      let winner: Owner | null = null;
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

  const visibleShips = useMemo(() => {
    if (!playerRole) return gameState.ships;
    const myPlanetsIds = new Set(gameState.planets.filter(p => p.owner === playerRole).map(p => p.id));
    const myShipPlanetIds = new Set(gameState.ships.filter(s => s.owner === playerRole).map(s => s.currentPlanetId).filter(Boolean));

    return gameState.ships.filter(s => {
      if (s.owner === playerRole) return true;
      if (s.currentPlanetId && myPlanetsIds.has(s.currentPlanetId)) return true;
      if (s.currentPlanetId && myShipPlanetIds.has(s.currentPlanetId)) return true;
      return false;
    });
  }, [gameState.ships, gameState.planets, playerRole]);

  const selectedObject = useMemo(() => gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null, [selectedId, gameState]);
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
    <div className="fixed inset-0 flex items-center justify-center bg-[#020617] text-white star-bg">
      <div className="text-center p-10 glass-card rounded-[3rem] border-cyan-500/20 max-w-lg shadow-2xl animate-in fade-in zoom-in duration-700">
        <h1 className="text-6xl font-black italic tracking-tighter mb-4 leading-none">STELLAR<br/><span className="text-cyan-400">COMMANDER</span></h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-12">Universal Strategic Matrix</p>
        <div className="space-y-4">
          <button 
            onClick={() => setIsNewGameOpen(true)}
            className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
          >
            Initiate Sector
          </button>
          <button 
            onClick={() => setIsLobbyOpen(true)}
            className="w-full py-5 bg-slate-900 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
          >
            Sync Terminal
          </button>
        </div>
      </div>
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={(pc, ai, names, diff) => {
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
      }} />
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
             <h1 className="text-6xl font-black text-white italic tracking-tighter mb-4">SECTOR CONQUERED</h1>
             <p className="text-2xl font-bold text-cyan-400 uppercase tracking-[0.5em]">{gameState.playerNames[gameState.winner]}</p>
             <button onClick={() => window.location.reload()} className="mt-12 px-10 py-4 bg-cyan-600 text-white font-black rounded-2xl">Return to Core</button>
           </div>
        </div>
      )}
      
      <header className="h-24 flex items-center justify-between px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic">{playerRole} HQ</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-slate-500">RND {gameState.round}</span>
              <div className="flex items-center gap-1 bg-slate-900/50 px-2 py-0.5 rounded-full border border-white/5">
                 <div className={`w-1.5 h-1.5 rounded-full ${isRelayOnline ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                 <span className={`text-[7px] font-black uppercase ${isRelayOnline ? 'text-emerald-500/70' : 'text-red-500'}`}>
                   {isRelayOnline ? (isSyncing ? 'Syncing...' : 'Relay Active') : 'Reconnecting...'}
                 </span>
              </div>
            </div>
          </div>
          <div className="w-32 h-1 bg-slate-900 rounded-full overflow-hidden hidden md:block">
            <div 
              className="h-full bg-cyan-500 transition-all duration-1000" 
              style={{ width: `${(gameState.planets.filter(p => p.owner === playerRole).length / PLANET_COUNT) * 100}%` }} 
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
           {viewMode === 'HOST' ? (
             <button onClick={executeTurn} disabled={isProcessing || !allPlayersReady} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30">Execute Turn</button>
           ) : (
             <button className="px-6 py-3 bg-cyan-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Orders Locked</button>
           )}
           <div className="bg-slate-900/80 px-4 py-3 rounded-xl border border-white/5 text-amber-500 font-bold text-xs flex items-center gap-2">💰 {gameState.playerCredits[playerRole || 'P1']}</div>
           <button onClick={() => setIsAdvisorOpen(true)} className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5 text-xl">🤖</button>
           <button onClick={() => setIsHelpOpen(true)} className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5 text-xl">❓</button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={visibleShips} 
          selectedId={selectedId} 
          onSelect={handleSelect}
          isSettingCourse={isSettingCourse}
          combatEvents={combatEvents}
          playerRole={playerRole}
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
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} gameState={gameState} playerRole={playerRole} />
      </main>
      
      {/* Visual Reconnect Overlay (Non-blocking but informative) */}
      {!isRelayOnline && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-2xl z-[1000] animate-bounce">
          ⚠️ Signal Lost - Attempting Subspace Re-link
        </div>
      )}
    </div>
  );
};

export default App;
