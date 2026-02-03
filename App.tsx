
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType, PlanetSpecialization, CombatScrap } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES, MAX_BATTERIES, PLANET_COUNT } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import InviteModal from './components/InviteModal';
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

/** 
 * Firebase can return arrays as objects with numeric keys if they are sparse.
 * This helper ensures we always have a clean, dense array for React rendering.
 */
function ensureArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  if (typeof data === 'object') {
    return Object.values(data).filter(Boolean) as T[];
  }
  return [];
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
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);
  const [onlineCommanders, setOnlineCommanders] = useState<number>(0);

  const processingRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Check for role in URL (for shared join links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') as Owner;
    if (role) setPlayerRole(role);
  }, []);

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
      if (data) {
        // Robust normalization to prevent property-access crashes
        const normalized: GameState = {
          ...data,
          planets: ensureArray<Planet>(data.planets),
          ships: ensureArray<Ship>(data.ships),
          readyPlayers: ensureArray<Owner>(data.readyPlayers),
          aiPlayers: ensureArray<Owner>(data.aiPlayers),
          combatScraps: ensureArray<CombatScrap>(data.combatScraps),
          activeEvents: ensureArray<any>(data.activeEvents),
          logs: ensureArray<string>(data.logs),
          playerCredits: data.playerCredits || {},
          playerNames: data.playerNames || {}
        };
        
        // Prevent setting state if planets are completely missing (corrupt data check)
        if (normalized.planets.length > 0) {
          setGameState(normalized);
          setHasStarted(true);
        }
      } else if (data === null && !processingRef.current) {
        setGameState(null);
        setHasStarted(false);
      }
    });

    return () => { unsubPresence(); unsubState(); if (db) { off(playersRef); off(stateRef); } };
  }, []);

  const handleResetGame = useCallback(async () => {
    if (!db || !window.confirm("ARE YOU SURE? THIS WILL TERMINATE THE GALAXY FOR EVERYONE.")) return;
    setIsProcessing(true);
    processingRef.current = true;
    try {
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), null);
      setGameState(null);
      setHasStarted(false);
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, []);

  const handleIssueOrder = useCallback((type: string, payload?: any) => {
    const currentG = gameStateRef.current;
    if (!playerRole || !currentG || !db) return;
    
    // Safety check for critical state pieces before deep cloning
    if (!currentG.planets || !currentG.playerCredits) return;

    if (type === 'SET_COURSE') { setIsSettingCourse(true); return; }

    const nextState = JSON.parse(JSON.stringify(currentG)) as GameState;
    let needsUpdate = true;
    
    if (type === 'SEND_EMOTE') {
      nextState.emotes = { ...(nextState.emotes || {}), [playerRole]: { text: payload.text, timestamp: Date.now() } };
    } else if (type === 'COMMIT') {
      const currentReady = nextState.readyPlayers || [];
      if (!currentReady.includes(playerRole)) {
        nextState.readyPlayers = [...currentReady, playerRole];
      } else {
        needsUpdate = false;
      }
    } else if (type === 'RESEARCH_TECH') {
      const currentTechs = { ...DEFAULT_TECHS, ...(nextState.techs?.[playerRole] || {}) };
      const techKey = payload.tech as keyof typeof DEFAULT_TECHS;
      const cost = (currentTechs[techKey] + 1) * 1000;
      if ((nextState.playerCredits[playerRole] || 0) < cost) return;
      nextState.playerCredits[playerRole] -= cost;
      currentTechs[techKey] += 1;
      nextState.techs = { ...(nextState.techs || {}), [playerRole]: currentTechs };
    } else {
      const selected = nextState.planets.find(p => p.id === selectedId) || nextState.ships.find(s => s.id === selectedId);
      if (!selected) return;

      // When an order is issued, the player is no longer "ready"
      nextState.readyPlayers = (nextState.readyPlayers || []).filter(p => p !== playerRole);

      if (type === 'RENAME_PLANET' && 'population' in selected) {
        nextState.planets = nextState.planets.map(p => p.id === selectedId ? { ...p, customName: payload.name } : p);
      } else if (type === 'BUILD_MINE' && 'population' in selected) {
        if ((nextState.playerCredits[playerRole] || 0) < 500) return;
        nextState.playerCredits[playerRole] -= 500;
        nextState.planets = nextState.planets.map(p => p.id === selectedId ? { ...p, mines: (p.mines || 0) + 1 } : p);
      } else if (type === 'BUILD_FACTORY' && 'population' in selected) {
        if ((nextState.playerCredits[playerRole] || 0) < 800) return;
        nextState.playerCredits[playerRole] -= 800;
        nextState.planets = nextState.planets.map(p => p.id === selectedId ? { ...p, factories: (p.factories || 0) + 1 } : p);
      } else if (type === 'BUILD_SHIP' && 'population' in selected) {
         const shipType = payload.type as ShipType;
         const baseStats = SHIP_STATS[shipType];
         const bonuses = getEmpireBonuses(nextState.planets, playerRole);
         const cost = Math.floor(baseStats.cost * (1 - bonuses.discount - (selected.specialization === 'SHIPYARD' ? 0.25 : 0)));
         if ((nextState.playerCredits[playerRole] || 0) < cost) return;
         nextState.playerCredits[playerRole] -= cost;
         const newShip: Ship = {
            id: `s-${playerRole}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: `${nextState.playerNames[playerRole]} ${shipType}`,
            type: shipType, owner: playerRole, x: selected.x, y: selected.y,
            currentPlanetId: selected.id, targetPlanetId: null,
            cargo: 0, maxCargo: baseStats.cargo, cargoPeople: 0,
            maxPeopleCargo: shipType === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people,
            hp: Math.floor(baseStats.hp * bonuses.strength), maxHp: Math.floor(baseStats.hp * bonuses.strength),
            attack: Math.floor(baseStats.attack * bonuses.strength), speed: baseStats.speed, status: 'ORBITING',
            isScrambled: false
         };
         nextState.ships.push(newShip);
      }
    }

    if (needsUpdate && db) {
      set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
    }
  }, [playerRole, selectedId]);

  const handleSelect = useCallback((id: string) => {
    // If setting a course, the second selection is the target planet
    if (isSettingCourse && selectedId && selectedId.startsWith('s-')) {
      const ship = gameState?.ships.find(s => s.id === selectedId);
      if (ship && ship.owner === playerRole) {
        const nextState = JSON.parse(JSON.stringify(gameState)) as GameState;
        const targetShip = nextState.ships.find(s => s.id === selectedId);
        if (targetShip) {
          targetShip.targetPlanetId = id;
          targetShip.status = 'MOVING';
          targetShip.currentPlanetId = null;
          nextState.readyPlayers = (nextState.readyPlayers || []).filter(p => p !== playerRole);
          if (db) set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
        }
      }
      setIsSettingCourse(false);
    } else {
      setSelectedId(id);
    }
  }, [isSettingCourse, selectedId, gameState, playerRole]);

  const handleExecuteTurn = useCallback(async () => {
    if (!gameState || !db || playerRole !== 'P1') return;
    setIsProcessing(true);
    processingRef.current = true;
    
    const nextState = JSON.parse(JSON.stringify(gameState)) as GameState;
    nextState.round += 1;
    nextState.readyPlayers = [];
    
    // Simple turn simulation logic
    nextState.ships = nextState.ships.map(ship => {
      if (ship.status === 'MOVING' && ship.targetPlanetId) {
        const target = nextState.planets.find(p => p.id === ship.targetPlanetId);
        if (target) {
          return { ...ship, x: target.x, y: target.y, status: 'ORBITING', currentPlanetId: target.id, targetPlanetId: null };
        }
      }
      return ship;
    });

    // Basic income and population growth simulation
    nextState.planets = nextState.planets.map(p => {
      if (p.owner !== 'NEUTRAL') {
        nextState.playerCredits[p.owner] = (nextState.playerCredits[p.owner] || 0) + (p.mines * 50) + (p.factories * 20);
        const newPop = Math.min(MAX_PLANET_POPULATION, p.population + 0.1);
        return { ...p, population: newPop };
      }
      return p;
    });

    try {
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), nextState);
    } catch (e) {
      console.error("Turn execution failed:", e);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [gameState, playerRole]);

  const handleNewGame = useCallback(async (playerCount: number, aiCount: number, names: Record<string, string>, difficulty: AiDifficulty) => {
    if (!db) return;
    setIsProcessing(true);
    processingRef.current = true;
    const initialState = generateInitialState(playerCount, aiCount, undefined, names, difficulty);
    try {
      await set(ref(db, `lobbies/${FAMILY_GALAXY_ID}/state`), initialState);
      setPlayerRole('P1');
      setIsNewGameOpen(false);
    } catch (e) {
      console.error("Game creation failed:", e);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, []);

  const selection = useMemo(() => {
    if (!gameState || !selectedId) return null;
    return gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null;
  }, [gameState, selectedId]);

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full glass-card rounded-[3rem] p-10 border-cyan-500/20 shadow-2xl space-y-8">
          <h1 className="text-5xl font-black text-white italic tracking-tighter">STELLAR<br/>COMMANDER</h1>
          <p className="text-xs text-cyan-400 font-black uppercase tracking-[0.4em]">Sector Command Interface</p>
          <div className="space-y-3">
             <button onClick={() => setIsNewGameOpen(true)} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-cyan-900/40 transition-all active:scale-95">ESTABLISH GALAXY</button>
             <button onClick={() => setIsHelpOpen(true)} className="w-full py-4 bg-slate-900 text-slate-400 rounded-2xl font-bold text-sm">OPERATIONS MANUAL</button>
          </div>
          <p className="text-[10px] text-slate-600 uppercase font-black">Online Commanders: {onlineCommanders}</p>
        </div>
        <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={handleNewGame} />
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </div>
    );
  }

  const isReady = gameState?.readyPlayers?.includes(playerRole || 'NEUTRAL');

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#020617] text-slate-200">
      {/* Header Info */}
      <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center px-6 pointer-events-none">
        <div className="flex-1">
           <h2 className="text-xl font-black italic text-white tracking-tighter">RD {gameState?.round}</h2>
           <p className="text-[8px] font-black text-cyan-500 uppercase tracking-widest">{gameState?.playerNames[playerRole || 'P1']}</p>
        </div>
        <div className="pointer-events-auto flex gap-3">
           <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 flex flex-col items-end">
              <span className="text-[7px] font-black text-slate-500 uppercase">Credits</span>
              <span className="text-sm font-bold text-amber-400">{gameState?.playerCredits[playerRole || 'P1']?.toLocaleString()}</span>
           </div>
           <button onClick={() => setIsAdvisorOpen(true)} className="w-12 h-12 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 flex items-center justify-center text-xl">🤖</button>
        </div>
      </div>

      <MapView 
        planets={gameState?.planets || []} 
        ships={gameState?.ships || []} 
        selectedId={selectedId} 
        onSelect={handleSelect}
        isSettingCourse={isSettingCourse}
        combatEvents={combatEvents}
        activeEvents={gameState?.activeEvents || []}
        combatScraps={gameState?.combatScraps || []}
        emotes={gameState?.emotes}
      />

      <SelectionPanel 
        selection={selection} 
        onClose={() => setSelectedId(null)} 
        playerRole={playerRole} 
        credits={gameState?.playerCredits[playerRole || 'P1'] || 0}
        onIssueOrder={handleIssueOrder}
        isSettingCourse={isSettingCourse}
        planets={gameState?.planets}
        techLevels={gameState?.techs?.[playerRole || 'P1'] || DEFAULT_TECHS}
      />

      {/* Bottom Controls */}
      <div className="absolute bottom-6 inset-x-6 flex items-center gap-4 z-[60]">
        <button onClick={() => setIsHelpOpen(true)} className="w-12 h-12 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 flex items-center justify-center">❓</button>
        <button onClick={() => setIsInviteOpen(true)} className="w-12 h-12 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/5 flex items-center justify-center">👥</button>
        <div className="flex-1" />
        {playerRole === 'P1' ? (
          <button 
            disabled={isProcessing || (gameState?.readyPlayers?.length || 0) < (gameState?.playerCount || 1)}
            onClick={handleExecuteTurn} 
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
          >
            {isProcessing ? 'Processing...' : 'EXECUTE TURN'}
          </button>
        ) : (
          <button 
            disabled={isReady}
            onClick={() => handleIssueOrder('COMMIT')} 
            className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isReady ? 'bg-slate-800 text-slate-500' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
          >
            {isReady ? 'READY' : 'COMMIT ORDERS'}
          </button>
        )}
      </div>

      <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState!} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} playerRole={playerRole} gameState={gameState!} />
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} frequency={FAMILY_GALAXY_ID} gameState={gameState!} />
      
      {isProcessing && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center"><div className="text-cyan-500 font-black animate-pulse uppercase tracking-[0.5em]">Synchronizing Galaxy...</div></div>}
    </div>
  );
};

export default App;
