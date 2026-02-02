
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType, PlanetSpecialization, CombatScrap } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, PLANET_COUNT } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, onDisconnect, Database, off } from 'firebase/database';

const FAMILY_GALAXY_ID = "Command-Center-Alpha";
const firebaseConfig = { databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com" };

let db: Database | null = null;
try {
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app);
} catch (e) { console.error("Relay Initialization Failed:", e); }

export interface CombatEvent {
  id: string;
  attackerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  color: string;
  owner: Owner;
}

const DEFAULT_TECHS = { engine: 0, shields: 0, scanners: 0 };

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
    const unsubPresence = onValue(playersRef, (snap) => setOnlineCommanders(Object.keys(snap.val() || {}).length));
    const unsubState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
      else { setGameState(null); setHasStarted(false); }
    });
    return () => { unsubPresence(); unsubState(); if (db) { off(playersRef); off(stateRef); } };
  }, []);

  const handleResetGame = useCallback(async () => {
    if (!db || !window.confirm("ARE YOU SURE? THIS WILL TERMINATE THE GALAXY FOR EVERYONE.")) return;
    setIsProcessing(true);
    try {
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), null);
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleIssueOrder = useCallback((type: string, payload?: any) => {
    if (!playerRole || !gameState || !db) return;
    const nextState = { ...gameState };
    
    if (type === 'SET_COURSE') { setIsSettingCourse(true); return; }
    if (type === 'SEND_EMOTE') {
      nextState.emotes = { ...(nextState.emotes || {}), [playerRole]: { text: payload.text, timestamp: Date.now() } };
      set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
      return;
    }
    if (type === 'COMMIT') {
      const currentReady = nextState.readyPlayers || [];
      if (!currentReady.includes(playerRole)) {
        nextState.readyPlayers = [...currentReady, playerRole];
        set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
      }
      return;
    }
    
    if (type === 'RESEARCH_TECH') {
      const currentTechs = { ...DEFAULT_TECHS, ...(nextState.techs?.[playerRole] || {}) };
      const techKey = payload.tech as keyof typeof DEFAULT_TECHS;
      const cost = (currentTechs[techKey] + 1) * 1000;
      if (nextState.playerCredits[playerRole] < cost) return;
      nextState.playerCredits[playerRole] -= cost;
      currentTechs[techKey] += 1;
      nextState.techs = { ...(nextState.techs || {}), [playerRole]: currentTechs };
      set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
      return;
    }

    const selected = gameState.planets?.find(p => p.id === selectedId) || gameState.ships?.find(s => s.id === selectedId);
    if (!selected) return;

    nextState.readyPlayers = (gameState.readyPlayers || []).filter(p => p !== playerRole);

    if (type === 'RENAME_PLANET' && 'population' in selected) {
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, customName: payload.name } : p);
    } else if (type === 'BUILD_MINE' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 500) return;
      nextState.playerCredits[playerRole] -= 500;
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, mines: p.mines + 1 } : p);
    } else if (type === 'BUILD_FACTORY' && 'population' in selected) {
      if (nextState.playerCredits[playerRole] < 800) return;
      nextState.playerCredits[playerRole] -= 800;
      nextState.planets = (gameState.planets || []).map(p => p.id === selectedId ? { ...p, factories: p.factories + 1 } : p);
    } else if (type === 'BUILD_SHIP' && 'population' in selected) {
       const shipType = payload.type as ShipType;
       const baseStats = SHIP_STATS[shipType];
       const bonuses = getEmpireBonuses(gameState.planets || [], playerRole);
       const cost = Math.floor(baseStats.cost * (1 - bonuses.discount - (selected.specialization === 'SHIPYARD' ? 0.25 : 0)));
       if (nextState.playerCredits[playerRole] < cost) return;
       nextState.playerCredits[playerRole] -= cost;
       const newShip: Ship = {
          id: `s-${playerRole}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: `${gameState.playerNames[playerRole]} ${shipType}`,
          type: shipType, owner: playerRole, x: selected.x, y: selected.y,
          currentPlanetId: selected.id, targetPlanetId: null,
          cargo: 0, maxCargo: baseStats.cargo, cargoPeople: 0,
          maxPeopleCargo: shipType === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people,
          hp: Math.floor(baseStats.hp * bonuses.strength), maxHp: Math.floor(baseStats.hp * bonuses.strength),
          attack: Math.floor(baseStats.attack * bonuses.strength), speed: baseStats.speed, status: 'ORBITING', isScrambled: false
       };
       nextState.ships = [...(gameState.ships || []), newShip];
    } else if (type === 'SET_SHIP_TARGET' && 'attack' in selected) {
      nextState.ships = (gameState.ships || []).map(s => s.id === selected.id ? { ...s, targetPlanetId: payload.planetId, status: 'MOVING' } : s);
      setIsSettingCourse(false);
    }
    
    set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
  }, [playerRole, gameState, selectedId]);

  const humanPlayers = useMemo(() => {
    if (!gameState) return [];
    const humans: Owner[] = [];
    for (let i = 1; i <= (gameState.playerCount || 0); i++) {
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

  const executeTurn = useCallback(async () => {
    if (isProcessing || !allPlayersReady || !gameState || !db) return;
    setIsProcessing(true);
    
    try {
      const nextPlanets = (gameState.planets || []).map(p => ({...p}));
      let nextShips: Ship[] = (gameState.ships || []).map(s => ({...s, isScrambled: false}));
      const nextCredits = { ...gameState.playerCredits };
      let nextEvents = (gameState.activeEvents || []).map(e => ({...e}));
      const events: CombatEvent[] = [];
      const newScraps: CombatScrap[] = [];

      // Pre-calculate bonuses for turn resolution to avoid O(N^2) lookups
      const allOwners = Array.from(new Set([...nextPlanets.map(p => p.owner), ...nextShips.map(s => s.owner)]));
      const empireBonuses: Record<string, any> = {};
      allOwners.forEach(o => { if (o !== 'NEUTRAL') empireBonuses[o] = getEmpireBonuses(nextPlanets, o); });

      // AI Logic
      if (gameState.aiPlayers && gameState.aiPlayers.length > 0) {
        gameState.aiPlayers.forEach(ai => {
          nextPlanets.filter(p => p.owner === ai).forEach(p => {
            if (nextCredits[ai] > 2000) {
              if (p.mines < MAX_MINES) { p.mines++; nextCredits[ai] -= 500; }
              else if (p.factories < MAX_FACTORIES) { p.factories++; nextCredits[ai] -= 800; }
            }
          });
          nextShips.filter(s => s.owner === ai && s.status === 'ORBITING').forEach(s => {
            const target = nextPlanets.find(p => p.owner === 'NEUTRAL' || p.owner !== ai);
            if (target && Math.random() < 0.2) { s.targetPlanetId = target.id; s.status = 'MOVING'; }
          });
        });
      }

      // Movement & Events
      if (Math.random() < 0.1 && nextEvents.length === 0) {
        nextEvents.push({ type: 'COMET', x: 0, y: Math.random() * GRID_SIZE, targetX: GRID_SIZE, targetY: Math.random() * GRID_SIZE, roundStart: gameState.round });
      }
      nextEvents = nextEvents.filter(e => {
        if (e.type === 'COMET') {
          const dx = e.targetX! - e.x, dy = e.targetY! - e.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 50) return false;
          e.x += (dx/dist) * 200; e.y += (dy/dist) * 200;
          nextShips.forEach(s => { if (Math.sqrt((s.x-e.x)**2 + (s.y-e.y)**2) < 80) s.isScrambled = true; });
        }
        return true;
      });

      nextShips = nextShips.map(ship => {
        if (ship.isScrambled || !ship.targetPlanetId) return ship;
        const target = nextPlanets.find(p => p.id === ship.targetPlanetId);
        if (!target) return ship;
        const speedBonus = (gameState.techs?.[ship.owner]?.engine || 0) * 0.15;
        const currentSpeed = ship.speed * (1 + speedBonus);
        const dx = target.x - ship.x, dy = target.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= currentSpeed) return { ...ship, x: target.x, y: target.y, status: 'ORBITING', currentPlanetId: target.id, targetPlanetId: null };
        return { ...ship, x: ship.x + (dx/dist) * currentSpeed, y: ship.y + (dy/dist) * currentSpeed, status: 'MOVING' };
      });

      // Unified Combat Resolution
      const damageMap: Record<string, number> = {};
      nextPlanets.forEach(planet => {
        const shipsAtPlanet = nextShips.filter(s => s.currentPlanetId === planet.id && s.status === 'ORBITING');
        if (planet.owner !== 'NEUTRAL' && planet.batteries > 0) {
           const invaders = shipsAtPlanet.filter(s => s.owner !== planet.owner);
           if (invaders.length > 0) {
              const target = invaders[Math.floor(Math.random() * invaders.length)];
              damageMap[target.id] = (damageMap[target.id] || 0) + (planet.batteries * 50 * (planet.specialization === 'FORTRESS' ? 2 : 1));
              events.push({ id: `bat-${planet.id}-${target.id}`, attackerPos: { x: planet.x, y: planet.y }, targetPos: { x: target.x, y: target.y }, color: PLAYER_COLORS[planet.owner], owner: planet.owner });
           }
        }
        const owners = Array.from(new Set(shipsAtPlanet.map(s => s.owner)));
        if (owners.length > 1) {
          shipsAtPlanet.forEach(attacker => {
            if (attacker.attack > 0) {
              const enemies = shipsAtPlanet.filter(s => s.owner !== attacker.owner);
              if (enemies.length > 0) {
                const target = enemies[0];
                const dmg = attacker.attack + (empireBonuses[attacker.owner]?.firepowerBonus || 0);
                damageMap[target.id] = (damageMap[target.id] || 0) + dmg;
                events.push({ id: `ev-${attacker.id}-${target.id}`, attackerPos: { x: attacker.x, y: attacker.y }, targetPos: { x: target.x, y: target.y }, color: PLAYER_COLORS[attacker.owner], owner: attacker.owner });
              }
            }
          });
        }
      });

      nextShips = nextShips.map(s => {
        if (damageMap[s.id]) {
          s.hp -= damageMap[s.id];
          if (s.hp <= 0) newScraps.push({ id: `scrap-${s.id}-${Date.now()}`, x: s.x, y: s.y, color: PLAYER_COLORS[s.owner], timestamp: Date.now() });
        }
        return s;
      }).filter(s => s.hp > 0);

      // Economy & Victory
      nextPlanets.forEach(p => {
        if (p.owner === 'NEUTRAL') {
          const colonist = nextShips.find(s => s.currentPlanetId === p.id && s.type === 'FREIGHTER');
          if (colonist) { p.owner = colonist.owner; p.population = 1; }
        } else {
          const invaders = nextShips.filter(s => s.currentPlanetId === p.id && s.owner !== p.owner && s.type === 'WARSHIP');
          if (invaders.length > 0) {
            p.population = Math.max(0, p.population - (invaders.length * 0.4));
            if (p.population <= 0) p.owner = invaders[0].owner;
          } else {
            p.population = Math.min(MAX_PLANET_POPULATION, p.population + (p.specialization === 'INDUSTRIAL' ? 0.3 : 0.2));
          }
          nextCredits[p.owner] = (nextCredits[p.owner] || 0) + (p.mines * 60) + (p.factories * 30) + (Math.floor(p.population) * 80);
        }
      });

      const winners = Array.from(new Set(nextPlanets.filter(p => p.owner !== 'NEUTRAL').map(p => p.owner))) as Owner[];
      const winner = winners.find(o => nextPlanets.filter(p => p.owner === o).length >= PLANET_COUNT * 0.6) || null;

      const finalState: GameState = { 
        ...gameState, round: gameState.round + 1, planets: nextPlanets, ships: nextShips, 
        playerCredits: nextCredits, readyPlayers: [], winner, activeEvents: nextEvents, 
        combatScraps: [...(gameState.combatScraps || []).filter(s => Date.now() - s.timestamp < 10000), ...newScraps]
      };
      
      setCombatEvents(events);
      setTimeout(() => setCombatEvents([]), 3000);
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), finalState);
    } catch (e) { console.error("Turn execution failed:", e); } finally { setIsProcessing(false); }
  }, [gameState, allPlayersReady, isProcessing]);

  const currentSelection = useMemo(() => {
    if (!gameState || !selectedId) return null;
    return gameState.planets?.find(p => p.id === selectedId) || gameState.ships?.find(s => s.id === selectedId) || null;
  }, [gameState, selectedId]);

  const handleMapSelect = useCallback((id: string) => {
    if (isSettingCourse && selectedId?.startsWith('s-')) handleIssueOrder('SET_SHIP_TARGET', { planetId: id });
    else setSelectedId(id);
  }, [isSettingCourse, selectedId, handleIssueOrder]);

  if (!hasStarted) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#020617] text-white star-bg overflow-y-auto safe-pt safe-pb p-4">
      <div className="text-center p-8 md:p-12 glass-card rounded-[3rem] border-cyan-500/20 w-full max-w-lg shadow-2xl relative overflow-hidden">
        <h1 className="text-4xl md:text-6xl font-black italic mb-2 leading-none uppercase">Stellar<br/><span className="text-cyan-400">Commander</span></h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 md:mb-10">Sector: {FAMILY_GALAXY_ID}</p>
        <div className="space-y-4">
          {!gameState ? (
            <button onClick={() => setIsNewGameOpen(true)} className="w-full py-5 bg-cyan-600 rounded-3xl font-black text-xs md:text-sm uppercase tracking-widest shadow-xl">Initialize Galaxy</button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: gameState.playerCount }).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                if (gameState.aiPlayers?.includes(pId)) return null;
                return <button key={pId} onClick={() => { setPlayerRole(pId); setHasStarted(true); }} className="py-4 bg-slate-900 border border-white/10 rounded-2xl font-black text-[10px] uppercase">Join {pId}</button>;
              })}
            </div>
          )}
          <button onClick={() => setIsHelpOpen(true)} className="w-full py-4 bg-slate-900/60 border border-white/10 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest">📖 Field Manual</button>
        </div>
      </div>
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={async (pc, ai, names, diff) => {
        if (!db) return;
        setIsProcessing(true);
        const state = generateInitialState(pc, ai, undefined, names, diff);
        try { await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), state); setPlayerRole('P1'); setGameState(state); setHasStarted(true); setIsNewGameOpen(false); } catch (e) { console.error(e); } finally { setIsProcessing(false); }
      }} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      <header className="h-20 md:h-24 flex items-center justify-between px-4 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100] shrink-0">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest italic leading-tight truncate">{playerRole} COMMAND</span>
          <span className="text-[8px] font-bold text-slate-500 leading-tight">RND {gameState?.round || 1}</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className="flex gap-1 mr-2">
            {['👋', '⚔️', 'GG'].map(e => <button key={e} onClick={() => handleIssueOrder('SEND_EMOTE', { text: e })} className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-xs border border-white/5">{e}</button>)}
          </div>
          {playerRole === 'P1' ? (
            <div className="flex items-center gap-1.5">
               <button onClick={handleResetGame} disabled={isProcessing} className="px-3 py-2 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg text-[8px] font-black uppercase tracking-widest">Reset</button>
               <button onClick={executeTurn} disabled={isProcessing || !allPlayersReady} className="px-3 py-2 bg-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg disabled:opacity-30">GO</button>
            </div>
          ) : (
            <button onClick={() => handleIssueOrder('COMMIT')} disabled={(gameState?.readyPlayers || []).includes(playerRole!)} className={`px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest ${(gameState?.readyPlayers || []).includes(playerRole!) ? 'bg-emerald-900/40 text-emerald-500' : 'bg-cyan-600 animate-pulse'}`}>{(gameState?.readyPlayers || []).includes(playerRole!) ? 'LOCKED' : 'COMMIT'}</button>
          )}
          <button onClick={() => setIsAdvisorOpen(true)} className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center border border-white/5 shrink-0">🤖</button>
        </div>
      </header>
      <main className="flex-1 relative overflow-hidden">
        {gameState && <MapView planets={gameState.planets || []} ships={gameState.ships || []} selectedId={selectedId} onSelect={handleMapSelect} isSettingCourse={isSettingCourse} combatEvents={combatEvents} activeEvents={gameState.activeEvents} combatScraps={gameState.combatScraps} emotes={gameState.emotes} />}
        <SelectionPanel selection={currentSelection} onClose={() => setSelectedId(null)} playerRole={playerRole} credits={gameState?.playerCredits[playerRole || 'P1'] || 0} onIssueOrder={handleIssueOrder} isSettingCourse={isSettingCourse} planets={gameState?.planets || []} techLevels={playerRole && gameState?.techs?.[playerRole] ? gameState.techs[playerRole] : DEFAULT_TECHS} />
        {gameState && <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState} />}
        {gameState && <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} gameState={gameState} playerRole={playerRole} />}
      </main>
    </div>
  );
};
export default App;
