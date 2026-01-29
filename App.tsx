
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import LobbyModal from './components/LobbyModal';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, onDisconnect, get, Database } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com",
};

let db: Database | null = null;
const isConfigSet = firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("default-rtdb");

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
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync state from Firebase
  useEffect(() => {
    if (!db || !gameId) return;
    const stateRef = ref(db, `games/${gameId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
    return () => unsubscribe();
  }, [gameId]);

  // Sync ready status from Firebase (Orders)
  useEffect(() => {
    if (!db || !gameId || viewMode !== 'HOST') return;
    const ordersRef = ref(db, `games/${gameId}/orders`);
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const orders = snapshot.val();
      if (orders) {
        setGameState(prev => ({ ...prev, readyPlayers: Object.keys(orders) as Owner[] }));
      } else {
        setGameState(prev => ({ ...prev, readyPlayers: [] }));
      }
    });
    return () => unsubscribe();
  }, [gameId, viewMode]);

  const hostGame = useCallback((pCount: number, aiCount: number, names: Record<string, string>, diff: AiDifficulty) => {
    if (!db || !isConfigSet) {
      alert("Relay Error: Check App.tsx configuration.");
      return;
    }
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialState = generateInitialState(pCount, aiCount, undefined, names, diff);
    
    setGameId(newId);
    setPlayerRole('P1');
    setViewMode('HOST');
    setGameState(initialState);
    setHasStarted(true);

    set(ref(db, `games/${newId}/state`), initialState);
    set(ref(db, `lobby/${newId}`), {
      name: `${names.P1}'s Sector`,
      players: 1,
      maxPlayers: pCount,
      round: 1,
      timestamp: Date.now()
    });
    onDisconnect(ref(db, `lobby/${newId}`)).remove();
  }, []);

  const joinGame = useCallback((id: string, role: Owner) => {
    if (!db) return;
    setGameId(id);
    setPlayerRole(role);
    setViewMode('PLAYER');
    setHasStarted(true);
    setIsLobbyOpen(false);
  }, []);

  const submitOrders = async () => {
    if (!db || !gameId || !playerRole) return;
    const orders = {
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, target: s.targetPlanetId })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, mines: p.mines, factories: p.factories }))
    };
    await set(ref(db, `games/${gameId}/orders/${playerRole}`), orders);
    alert("ORDERS TRANSMITTED VIA SUBSPACE");
  };

  const executeTurn = async () => {
    if (!db || !gameId) return;
    setIsProcessing(true);
    
    try {
      const ordersSnapshot = await get(ref(db, `games/${gameId}/orders`));
      const allOrders = ordersSnapshot.val() || {};

      let nextState = { ...gameState };
      let nextPlanets = [...gameState.planets];
      let nextShips = [...gameState.ships];
      let nextCredits = { ...gameState.playerCredits };

      // 1. Process Movements
      nextShips = nextShips.map(ship => {
        if (ship.targetPlanetId) {
          const target = nextPlanets.find(p => p.id === ship.targetPlanetId);
          if (target) {
            const dx = target.x - ship.x;
            const dy = target.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= ship.speed) {
              return { ...ship, x: target.x, y: target.y, status: 'ORBITING', currentPlanetId: target.id };
            } else {
              return { ...ship, x: ship.x + (dx/dist) * ship.speed, y: ship.y + (dy/dist) * ship.speed, status: 'MOVING' };
            }
          }
        }
        return ship;
      });

      // 2. Economy & Growth
      nextPlanets = nextPlanets.map(p => {
        if (p.owner === 'NEUTRAL') return p;
        const growth = 1;
        const income = (p.mines * 50) + (p.factories * 20) + (p.population * 50);
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;
        return { ...p, population: Math.min(MAX_PLANET_POPULATION, p.population + growth) };
      });

      const finalState = {
        ...nextState,
        round: gameState.round + 1,
        planets: nextPlanets,
        ships: nextShips,
        playerCredits: nextCredits,
        readyPlayers: []
      };

      await set(ref(db, `games/${gameId}/state`), finalState);
      await set(ref(db, `games/${gameId}/orders`), null);
      await update(ref(db, `lobby/${gameId}`), { round: finalState.round });

    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentStats = useMemo(() => {
    const role = playerRole || 'P1';
    const myP = gameState.planets.filter(p => p.owner === role);
    const income = myP.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0);
    return { credits: gameState.playerCredits[role] || 0, income };
  }, [gameState, playerRole]);

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 z-[500] star-bg">
        <div className="w-full max-w-md glass-card rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
          <h1 className="text-6xl font-black text-white italic tracking-tighter mb-1">STELLAR</h1>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-12">Sub-Ether Command Hub</p>
          
          {!isConfigSet && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
              Relay Offline: Update databaseURL
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={() => setIsNewGameOpen(true)}
              disabled={!db}
              className="w-full py-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 border-b-4 border-cyan-800"
            >
              Initialize New Galaxy
            </button>
            <button 
              onClick={() => setIsLobbyOpen(true)}
              disabled={!db}
              className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-3xl font-black text-xs uppercase tracking-widest border border-white/5 transition-all active:scale-95 disabled:opacity-50"
            >
              Search Active Sectors
            </button>
          </div>
        </div>

        <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={hostGame} />
        <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} db={db} onJoin={joinGame} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk']">
      {/* Bridge Header */}
      <header className="h-14 flex items-center justify-between px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-xl z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic leading-none">Sector {gameId}</span>
            <span className="text-xs font-bold text-slate-500">{viewMode} // Round {gameState.round}</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 uppercase">Reserves</span>
              <span className="text-sm font-bold text-amber-500">💰 {currentStats.credits}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 uppercase">Net</span>
              <span className="text-sm font-bold text-emerald-500">+{currentStats.income}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {viewMode === 'HOST' && (
            <button onClick={() => setIsInviteOpen(true)} className="w-10 h-10 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20">🔗</button>
          )}
          <button className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sm border border-white/5">?</button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={(id) => setSelectedId(id)} 
        />

        {/* Tactical Overlays */}
        {viewMode === 'HOST' && (
          <div className="absolute top-6 left-6 z-40 bg-slate-950/90 border border-white/10 p-5 rounded-[2rem] w-48 shadow-2xl backdrop-blur-3xl">
            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Command Units</h4>
            <div className="space-y-2 mb-6">
              {Array.from({length: gameState.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isReady = gameState.readyPlayers.includes(pId) || gameState.aiPlayers.includes(pId);
                return (
                  <div key={pId} className="flex justify-between items-center text-[10px]">
                    <span style={{ color: PLAYER_COLORS[pId] }} className="font-black">{pId} Unit</span>
                    <span className={isReady ? 'text-emerald-500' : 'text-slate-700'}>{isReady ? 'SYNCED' : 'AWAITING'}</span>
                  </div>
                );
              })}
            </div>
            <button 
              onClick={executeTurn}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 border-b-4 border-emerald-800"
            >
              {isProcessing ? 'CALCULATING...' : 'EXECUTE TURN'}
            </button>
          </div>
        )}

        {viewMode === 'PLAYER' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40">
            <button 
              onClick={() => setIsAdvisorOpen(true)}
              className="w-16 h-16 bg-cyan-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-xl border-b-4 border-cyan-800 active:scale-90"
            >
              ❂
            </button>
            <button 
              onClick={submitOrders}
              className="px-10 h-16 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl border-b-4 border-emerald-800 active:scale-95"
            >
              Broadcast Tactical Burst 🛰️
            </button>
          </div>
        )}
      </main>

      <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState} />
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} gameId={gameId} playerCount={gameState.playerCount} />
    </div>
  );
};

export default App;
