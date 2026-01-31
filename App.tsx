
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
import { getDatabase, ref, onValue, set, Database, goOnline } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com", 
};

let db: Database | null = null;
const isConfigPlaceholder = !firebaseConfig.databaseURL || firebaseConfig.databaseURL === "" || firebaseConfig.databaseURL.includes("REPLACE_WITH");

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
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isNewGameOpen, setIsNewGameOpen] = useState(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingCourse, setIsSettingCourse] = useState(false);
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);
  
  const [isRelayOnline, setIsRelayOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'CONNECTING' | 'SYNCED' | 'FAILED'>('IDLE');

  // Deep Link Detection - Priority Execution
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('gameId');
    const urlRole = params.get('role') as Owner | null;

    if (urlGameId && urlRole) {
      setGameId(urlGameId);
      setPlayerRole(urlRole);
      setViewMode('PLAYER');
      setHasStarted(true);
      setSyncStatus('CONNECTING');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Connection Monitor
  useEffect(() => {
    if (!db || isConfigPlaceholder) return;
    const connectedRef = ref(db, ".info/connected");
    const unsubscribe = onValue(connectedRef, (snap) => {
      setIsRelayOnline(snap.val() === true);
    });
    return () => unsubscribe();
  }, []);

  // Authoritative State Sync
  useEffect(() => {
    if (!db || !gameId || isConfigPlaceholder) return;
    
    setIsSyncing(true);
    const stateRef = ref(db, `games/${gameId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        setIsSyncing(false);
        setSyncStatus('SYNCED');
      }
    }, (err) => {
      console.error("Relay Error:", err);
      setSyncStatus('FAILED');
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
    if (!playerRole || !gameState) return;
    
    if (type === 'SET_COURSE') {
      setIsSettingCourse(true);
      return;
    }

    const nextState = { ...gameState };
    // Any change un-readies the player
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

    if (db && gameId && !isConfigPlaceholder) {
      set(ref(db, `games/${gameId}/state`), nextState);
    } else {
      setGameState(nextState);
    }
  };

  const handleSelect = (id: string) => {
    if (!gameState) return;

    if (isSettingCourse && selectedId) {
      const selectedShip = gameState.ships.find(s => s.id === selectedId);
      const targetPlanet = gameState.planets.find(p => p.id === id);

      if (selectedShip && targetPlanet) {
        // SUCCESS: Ship targeted a planet
        const nextShips = gameState.ships.map(s => 
          s.id === selectedId 
            ? { ...s, targetPlanetId: id, currentPlanetId: undefined, status: 'MOVING' as const } 
            : s
        );
        const nextState = { 
          ...gameState, 
          ships: nextShips, 
          readyPlayers: (gameState.readyPlayers || []).filter(p => p !== playerRole) 
        };
        
        if (db && gameId && !isConfigPlaceholder) {
          set(ref(db, `games/${gameId}/state`), nextState);
        } else {
          setGameState(nextState);
        }
        setIsSettingCourse(false);
        return; 
      }
      
      const clickedAnotherShip = gameState.ships.find(s => s.id === id);
      if (clickedAnotherShip) {
        // USER INTENT CHANGE: Selected a different vessel, cancel targeting for previous one
        setSelectedId(id);
        setIsSettingCourse(false);
        return;
      }

      // If they clicked something that isn't a planet or a ship, we don't automatically cancel.
      // We keep the "isSettingCourse" mode active so they can try to click the planet again.
      return; 
    }
    
    // Normal non-targeting selection
    setSelectedId(id);
    if (isSettingCourse) setIsSettingCourse(false);
  };

  const executeTurn = async () => {
    if (isProcessing || !allPlayersReady || !gameState) return;
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

      const ownersList = Array.from(new Set(nextPlanets.filter(p => p.owner !== 'NEUTRAL').map(p => p.owner))) as Owner[];
      const winner = ownersList.find(o => nextPlanets.filter(p => p.owner === o).length >= PLANET_COUNT * 0.6) || null;

      const finalState: GameState = { ...gameState, round: gameState.round + 1, planets: nextPlanets, ships: nextShips, playerCredits: nextCredits, readyPlayers: [], winner };
      setCombatEvents(events);
      if (db && gameId && !isConfigPlaceholder) {
        await set(ref(db, `games/${gameId}/state`), finalState);
        await set(ref(db, `lobby/${gameId}`), { id: gameId, round: finalState.round, name: `${finalState.playerNames['P1']}'s Sector`, playerCount: finalState.playerCount });
      } else {
        setGameState(finalState);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const visibleShips = useMemo(() => {
    if (!gameState || !playerRole) return gameState?.ships || [];
    const myPlanetsIds = new Set(gameState.planets.filter(p => p.owner === playerRole).map(p => p.id));
    const myShipPlanetIds = new Set(gameState.ships.filter(s => s.owner === playerRole).map(s => s.currentPlanetId).filter(Boolean));
    return gameState.ships.filter(s => s.owner === playerRole || (s.currentPlanetId && (myPlanetsIds.has(s.currentPlanetId) || myShipPlanetIds.has(s.currentPlanetId))));
  }, [gameState, playerRole]);

  const selectedObject = useMemo(() => gameState ? gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null : null, [selectedId, gameState]);
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
      <div className="text-center p-10 glass-card rounded-[3rem] border-cyan-500/20 max-w-lg shadow-2xl">
        <h1 className="text-6xl font-black italic mb-4 leading-none">STELLAR<br/><span className="text-cyan-400">COMMANDER</span></h1>
        <div className="space-y-4">
          <button onClick={() => setIsNewGameOpen(true)} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black text-xs uppercase tracking-widest">Initiate Sector</button>
          <button onClick={() => setIsLobbyOpen(true)} className="w-full py-5 bg-slate-900 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-widest">Sync Terminal</button>
        </div>
      </div>
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={(pc, ai, names, diff) => {
        const state = generateInitialState(pc, ai, undefined, names, diff);
        const newFreq = Math.floor(100 + Math.random() * 899).toString();
        setGameId(newFreq); setPlayerRole('P1'); setViewMode('HOST'); setHasStarted(true); setIsNewGameOpen(false); setSyncStatus('SYNCED');
        if (db && !isConfigPlaceholder) {
          set(ref(db, `games/${newFreq}/state`), state);
          set(ref(db, `lobby/${newFreq}`), { id: newFreq, round: state.round, name: `${state.playerNames['P1']}'s Sector`, playerCount: state.playerCount });
        }
        setGameState(state);
      }} />
      <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} db={db} onJoin={(id, role) => {
        setGameId(id); setPlayerRole(role); setViewMode('PLAYER'); setHasStarted(true); setIsLobbyOpen(false); setSyncStatus('CONNECTING');
      }} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      {(!gameState || syncStatus === 'CONNECTING') && (
        <div className="fixed inset-0 z-[2000] bg-black/95 flex flex-col items-center justify-center p-12 text-center">
           <div className="w-32 h-32 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-12" />
           <h2 className="text-3xl font-black italic text-cyan-500 uppercase tracking-widest mb-4">Establishing Bridge Link</h2>
           <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Syncing Sector {gameId}...</p>
        </div>
      )}

      <header className="h-24 flex items-center justify-between px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic">{playerRole} COMMAND</span>
            <span className="text-[9px] font-bold text-slate-500">RND {gameState?.round || 1} // SEC {gameId}</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
        </div>

        <div className="flex items-center gap-4">
           {viewMode === 'HOST' ? (
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
           <button onClick={() => setIsInviteOpen(true)} className="w-12 h-12 bg-cyan-600/20 border border-cyan-500/40 rounded-xl flex items-center justify-center">📢</button>
           <button onClick={() => setIsAdvisorOpen(true)} className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5">🤖</button>
        </div>
      </header>

      <main className="flex-1 relative">
        {gameState && (
          <MapView 
            planets={gameState.planets} 
            ships={visibleShips} 
            selectedId={selectedId} 
            onSelect={handleSelect}
            isSettingCourse={isSettingCourse}
            combatEvents={combatEvents}
            playerRole={playerRole}
          />
        )}
        <SelectionPanel 
          selection={selectedObject} 
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
        {gameId && gameState && <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} frequency={gameId} gameState={gameState} />}
      </main>
    </div>
  );
};

export default App;
