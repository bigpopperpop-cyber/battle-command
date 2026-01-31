
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType, PlanetSpecialization } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, PLANET_COUNT } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, onDisconnect, Database } from 'firebase/database';

// Centralized Family ID
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

  // 1. Presence and Global Sync
  useEffect(() => {
    if (!db) return;

    const myPresenceId = `presence-${Math.random().toString(36).substr(2, 9)}`;
    const presenceRef = ref(db, `lobbies/${FAMILY_GALAXY_ID}/players/${myPresenceId}`);
    onDisconnect(presenceRef).remove();
    set(presenceRef, { active: true, joinedAt: Date.now() });

    const playersRef = ref(db, `lobbies/${FAMILY_GALAXY_ID}/players`);
    const unsubPresence = onValue(playersRef, (snap) => {
      const players = snap.val() || {};
      setOnlineCommanders(Object.keys(players).length);
    });

    const stateRef = ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`);
    const unsubState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        // If we have data and we've chosen to enter (or are the host), we start
      }
    });

    return () => {
      unsubPresence();
      unsubState();
    };
  }, []);

  const handleIssueOrder = (type: string, payload?: any) => {
    if (!playerRole || !gameState || !db) return;
    
    if (type === 'SET_COURSE') {
      setIsSettingCourse(true);
      return;
    }

    const nextState = { ...gameState };
    nextState.readyPlayers = (gameState.readyPlayers || []).filter(p => p !== playerRole);
    
    const selected = gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId);
    if (!selected) return;

    if (type === 'BUILD_MINE' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 500) return;
      nextState.playerCredits[playerRole] -= 500;
      nextState.planets = gameState.planets.map(p => p.id === selectedId ? { ...p, mines: p.mines + 1 } : p);
    } else if (type === 'BUILD_FACTORY' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 800) return;
      nextState.playerCredits[playerRole] -= 800;
      nextState.planets = gameState.planets.map(p => p.id === selectedId ? { ...p, factories: p.factories + 1 } : p);
    } else if (type === 'SET_SPECIALIZATION' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 1500) return;
      nextState.playerCredits[playerRole] -= 1500;
      nextState.planets = gameState.planets.map(p => p.id === selectedId ? { ...p, specialization: payload.spec } : p);
    } else if (type === 'BUILD_SHIP' && 'population' in selected) {
       const shipType = payload.type as ShipType;
       const baseStats = SHIP_STATS[shipType];
       const bonuses = getEmpireBonuses(gameState.planets, playerRole);
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
       nextState.ships = [...gameState.ships, newShip];
    } else if (type === 'COMMIT') {
      if (!nextState.readyPlayers.includes(playerRole)) {
        nextState.readyPlayers = [...nextState.readyPlayers, playerRole];
      }
    }

    set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
  };

  const handleSelect = (id: string) => {
    if (!gameState || !db) return;

    if (isSettingCourse && selectedId) {
      const selectedShip = gameState.ships.find(s => s.id === selectedId);
      const targetPlanet = gameState.planets.find(p => p.id === id);

      if (selectedShip && targetPlanet) {
        const nextShips = gameState.ships.map(s => 
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
      const clickedAnotherShip = gameState.ships.find(s => s.id === id);
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
      if (!gameState.aiPlayers.includes(p)) humans.push(p);
    }
    return humans;
  }, [gameState]);

  const allPlayersReady = useMemo(() => {
    if (!gameState) return false;
    const allies = humanPlayers.filter(p => p !== 'P1');
    return allies.every(p => (gameState.readyPlayers || []).includes(p));
  }, [humanPlayers, gameState]);

  if (!hasStarted) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#020617] text-white star-bg">
      <div className="text-center p-12 glass-card rounded-[4rem] border-cyan-500/20 max-w-lg shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
        <h1 className="text-6xl font-black italic mb-2 leading-none">STELLAR<br/><span className="text-cyan-400">COMMANDER</span></h1>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 mb-10">Sector: {FAMILY_GALAXY_ID}</p>
        
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5">
             <div className="flex items-center justify-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${onlineCommanders > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-bold">{onlineCommanders} Commanders Online</span>
             </div>
             <p className="text-[10px] text-slate-500 uppercase font-black">Syncing Galaxy Data...</p>
          </div>

          {!gameState ? (
            <button 
              onClick={() => setIsNewGameOpen(true)} 
              className="w-full py-6 bg-cyan-600 hover:bg-cyan-500 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-cyan-900/40 transition-all active:scale-95"
            >
              Initialize Galaxy
            </button>
          ) : (
            <button 
              onClick={() => { setPlayerRole('P2'); setHasStarted(true); }}
              className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
            >
              Enter Battlezone
            </button>
          )}
        </div>
      </div>
      
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={(pc, ai, names, diff) => {
        const state = generateInitialState(pc, ai, undefined, names, diff);
        if (db) {
          // Set Firebase first
          set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), state).then(() => {
            // Then update local state to trigger transition
            setPlayerRole('P1');
            setGameState(state);
            setHasStarted(true);
            setIsNewGameOpen(false);
          });
        }
      }} />
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      <header className="h-24 flex items-center justify-between px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic">{playerRole} COMMAND</span>
            <span className="text-[9px] font-bold text-slate-500">RND {gameState?.round || 1} // {FAMILY_GALAXY_ID}</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
        </div>

        <div className="flex items-center gap-4">
           {playerRole === 'P1' ? (
             <button onClick={executeTurn} disabled={isProcessing || !allPlayersReady} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
               Execute Turn ({humanPlayers.length > 1 ? `${gameState?.readyPlayers?.length || 0}/${humanPlayers.length - 1} Committed` : 'Ready'})
             </button>
           ) : (
             <button 
               onClick={() => handleIssueOrder('COMMIT')} 
               disabled={(gameState?.readyPlayers || []).includes(playerRole!)}
               className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(gameState?.readyPlayers || []).includes(playerRole!) ? 'bg-emerald-900/40 text-emerald-500 border border-emerald-500/30' : 'bg-cyan-600 text-white animate-pulse'}`}
             >
               {(gameState?.readyPlayers || []).includes(playerRole!) ? 'Orders Committed' : 'Commit Orders'}
             </button>
           )}
           <div className="bg-slate-900/80 px-4 py-3 rounded-xl border border-white/5 text-amber-500 font-bold text-xs flex items-center gap-2">💰 {gameState?.playerCredits[playerRole || 'P1'] || 0}</div>
           <button onClick={() => setIsAdvisorOpen(true)} className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5">🤖</button>
        </div>
      </header>

      <main className="flex-1 relative">
        {gameState && (
          <MapView 
            planets={gameState.planets} 
            ships={gameState.ships} 
            selectedId={selectedId} 
            onSelect={handleSelect}
            isSettingCourse={isSettingCourse}
            combatEvents={combatEvents}
            playerRole={playerRole}
          />
        )}
        <SelectionPanel 
          selection={gameState ? gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null : null} 
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
