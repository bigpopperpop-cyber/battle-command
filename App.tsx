
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import LobbyModal from './components/LobbyModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingCourse, setIsSettingCourse] = useState(false);

  useEffect(() => {
    if (!db || !gameId || isConfigPlaceholder) return;
    const stateRef = ref(db, `games/${gameId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
    return () => unsubscribe();
  }, [gameId]);

  const handleIssueOrder = (type: string, payload?: any) => {
    if (!playerRole) return;
    
    if (type === 'SET_COURSE') {
      setIsSettingCourse(true);
      return;
    }

    setGameState(prev => {
      const nextState = { ...prev };
      const selected = prev.planets.find(p => p.id === selectedId) || prev.ships.find(s => s.id === selectedId);
      
      if (type === 'BUILD_MINE' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 500) return prev;
        nextState.playerCredits[playerRole] -= 500;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, mines: p.mines + 1 } : p);
      } else if (type === 'BUILD_FACTORY' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 800) return prev;
        nextState.playerCredits[playerRole] -= 800;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, factories: p.factories + 1 } : p);
      } else if (type === 'BUILD_SHIP' && selected && 'population' in selected) {
         const shipType = payload.type as ShipType;
         const stats = SHIP_STATS[shipType];
         if (nextState.playerCredits[playerRole] < stats.cost) return prev;
         nextState.playerCredits[playerRole] -= stats.cost;
         const newShip: Ship = {
            id: `s-${playerRole}-${Date.now()}`,
            name: `${prev.playerNames[playerRole]} ${shipType}`,
            type: shipType,
            owner: playerRole,
            x: selected.x,
            y: selected.y,
            currentPlanetId: selected.id,
            cargo: 0,
            maxCargo: stats.cargo,
            cargoPeople: 0,
            maxPeopleCargo: stats.people,
            hp: stats.hp,
            maxHp: stats.hp,
            attack: stats.attack,
            speed: stats.speed,
            status: 'ORBITING'
         };
         nextState.ships = [...prev.ships, newShip];
      }
      return nextState;
    });
  };

  const handleSelect = (id: string) => {
    if (isSettingCourse && selectedId) {
      const ship = gameState.ships.find(s => s.id === selectedId);
      const target = gameState.planets.find(p => p.id === id);
      if (ship && target) {
        setGameState(prev => ({
          ...prev,
          ships: prev.ships.map(s => s.id === selectedId ? { ...s, targetPlanetId: id, status: 'MOVING' } : s)
        }));
        setIsSettingCourse(false);
        return;
      } else if (ship && !target) {
        setIsSettingCourse(false);
      }
    }
    setSelectedId(id);
  };

  const executeTurn = async () => {
    setIsProcessing(true);
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

      nextPlanets = nextPlanets.map(p => {
        if (p.owner === 'NEUTRAL') {
           const colonist = nextShips.find(s => s.currentPlanetId === p.id && s.type === 'FREIGHTER');
           if (colonist) return { ...p, owner: colonist.owner, population: 1 };
           return p;
        }
        const invaders = nextShips.filter(s => s.currentPlanetId === p.id && s.owner !== p.owner && s.type === 'WARSHIP');
        let nextPop = p.population;
        if (invaders.length > 0) {
           nextPop = Math.max(0, p.population - invaders.length);
        } else {
           nextPop = Math.min(MAX_PLANET_POPULATION, p.population + 0.2); 
        }
        const income = (p.mines * 50) + (p.factories * 20) + (Math.floor(nextPop) * 50);
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;
        return { 
          ...p, 
          population: nextPop, 
          owner: nextPop <= 0 && invaders.length > 0 ? invaders[0].owner : p.owner 
        };
      });

      const finalState: GameState = {
        ...gameState,
        round: gameState.round + 1,
        planets: nextPlanets,
        ships: nextShips,
        playerCredits: nextCredits,
        readyPlayers: []
      };

      if (db && gameId && !isConfigPlaceholder) {
        await set(ref(db, `games/${gameId}/state`), finalState);
      } else {
        setGameState(finalState);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const selectedObject = useMemo(() => {
    return gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null;
  }, [selectedId, gameState]);

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 z-[500] star-bg safe-pt safe-pb">
        <div className="w-full max-w-sm glass-card rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl border-cyan-500/20">
          <h1 className="text-5xl font-black text-white italic tracking-tighter mb-1">STELLAR</h1>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-10">Sector Command</p>
          <div className="space-y-4">
            <button onClick={() => setIsNewGameOpen(true)} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-cyan-800">
              Initialize New Sector
            </button>
            <button onClick={() => setIsLobbyOpen(true)} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/5 transition-all active:scale-95">
              Scan Signatures
            </button>
          </div>
        </div>
        <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={(p, a, n, d) => {
          const id = Math.random().toString(36).substring(2, 8).toUpperCase();
          setGameId(id); setPlayerRole('P1'); setViewMode('HOST');
          setGameState(generateInitialState(p, a, undefined, n, d));
          setHasStarted(true);
        }} />
        <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} db={db} onJoin={(id, role) => {
          setGameId(id); setPlayerRole(role); setViewMode('PLAYER'); setHasStarted(true);
        }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-black text-cyan-500 uppercase tracking-widest italic leading-none truncate max-w-[120px] md:max-w-none">
              {viewMode === 'HOST' ? 'HQ (P1)' : `CMD (${playerRole})`}
            </span>
            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase">RND {gameState.round}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex flex-col items-end mr-1 md:mr-0">
            <span className="text-[10px] md:text-xs font-bold text-amber-500">💰 {gameState.playerCredits[playerRole || 'P1'] || 0}</span>
          </div>
          <button onClick={() => setIsAdvisorOpen(true)} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20">🤖</button>
          <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sm border border-white/5">?</button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={handleSelect}
          isSettingCourse={isSettingCourse} 
        />
        
        {viewMode === 'HOST' && (
          <div className={`absolute z-40 transition-all duration-300 ${selectedObject ? 'bottom-44 landscape:bottom-10 landscape:right-96' : 'bottom-8 right-1/2 translate-x-1/2'}`}>
            <button 
              onClick={executeTurn} 
              disabled={isProcessing} 
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-30 border-b-4 border-emerald-800 flex items-center gap-3 whitespace-nowrap"
            >
              {isProcessing ? 'SYNCING...' : 'EXECUTE TURN'}
            </button>
          </div>
        )}

        <SelectionPanel 
          selection={selectedObject} 
          onClose={() => setSelectedId(null)}
          playerRole={playerRole}
          credits={gameState.playerCredits[playerRole || 'P1'] || 0}
          onIssueOrder={handleIssueOrder}
          isSettingCourse={isSettingCourse}
        />
      </main>

      <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} gameState={gameState} playerRole={playerRole} />
    </div>
  );
};

export default App;
