
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Planet, Ship, Owner, ShipType, AiDifficulty } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS, SHIP_STATS, MAX_PLANET_POPULATION, MAX_FACTORIES, MAX_MINES } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import LobbyModal from './components/LobbyModal';
import { getAiMoves } from './services/geminiService';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, onDisconnect, get, Database } from 'firebase/database';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  // Replace with your actual project database URL from Firebase Console
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com",
};

// Initialize Firebase App and Database service safely
let db: Database | null = null;
const isConfigSet = firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("default-rtdb");

try {
    const firebaseApp: FirebaseApp = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
        
    db = getDatabase(firebaseApp);
    console.log("Stellar Command Relay Link Established.");
} catch (e) {
    console.error("Firebase Initialization Failed:", e);
}

const App: React.FC = () => {
  const [hasInitiated, setHasInitiated] = useState(false);
  const [viewMode, setViewMode] = useState<'PLAYER' | 'HOST'>('PLAYER');
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(2, 0));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const hostNewGame = useCallback((pCount: number, aiCount: number, names: Record<string, string>, diff: AiDifficulty) => {
    if (!db || !isConfigSet) {
      alert("Relay Error: Firebase Database not configured. Update databaseURL in App.tsx.");
      return;
    }
    
    const newState = generateInitialState(pCount, aiCount, undefined, names, diff);
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    setGameId(newGameId);
    setGameState(newState);
    setViewMode('HOST');
    setPlayerRole('P1');
    setHasInitiated(true);

    set(ref(db, `games/${newGameId}/state`), newState);
    set(ref(db, `lobby/${newGameId}`), {
      name: `${names.P1}'s Galaxy`,
      players: 1,
      maxPlayers: pCount,
      round: 1,
      timestamp: Date.now()
    });

    onDisconnect(ref(db, `lobby/${newGameId}`)).remove();
    
    onValue(ref(db, `games/${newGameId}/orders`), (snapshot) => {
      const orders = snapshot.val();
      if (orders) {
        const ready = Object.keys(orders) as Owner[];
        setGameState(prev => ({ ...prev, readyPlayers: ready }));
      }
    });
  }, []);

  const joinExistingGame = useCallback((id: string, role: Owner) => {
    if (!db) return;
    setGameId(id);
    setViewMode('PLAYER');
    setPlayerRole(role);

    onValue(ref(db, `games/${id}/state`), (snapshot) => {
      const state = snapshot.val();
      if (state) {
        setGameState(state);
        setHasInitiated(true);
        setIsLobbyOpen(false);
      }
    });
  }, []);

  const submitOrders = async () => {
    if (!gameId || !playerRole || !db) return;
    const myOrders = {
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, t: s.targetPlanetId, cp_p: s.cargoPeople })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, m: p.mines, f: p.factories, pop: p.population }))
    };
    
    await set(ref(db, `games/${gameId}/orders/${playerRole}`), myOrders);
    alert("TRANSMISSION COMPLETE");
  };

  const executeTurn = async () => {
    if (!gameId || !db) return;
    setIsProcessing(true);

    try {
      const snapshot = await get(ref(db, `games/${gameId}/orders`));
      const allOrders = snapshot.val() || {};
      
      let nextPlanets = gameState.planets.map(p => ({...p}));
      let nextShips = gameState.ships.map(s => ({...s}));
      let nextCredits = { ...gameState.playerCredits };

      // Simplified turn resolution for brevity
      nextPlanets.forEach(p => {
        if (p.owner !== 'NEUTRAL') {
          p.population = Math.min(MAX_PLANET_POPULATION, p.population + 1);
          const inc = (p.mines * 50) + (p.factories * 20) + (p.population * 50);
          nextCredits[p.owner] = (nextCredits[p.owner] || 0) + inc;
        }
      });

      const finalState = {
        ...gameState,
        round: gameState.round + 1,
        planets: nextPlanets,
        ships: nextShips,
        playerCredits: nextCredits,
        readyPlayers: []
      };

      await set(ref(db, `games/${gameId}/state`), finalState);
      await set(ref(db, `games/${gameId}/orders`), null);
      await update(ref(db, `lobby/${gameId}`), { round: finalState.round });

    } catch (error) {
      console.error("Turn Execution Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMapSelect = useCallback((id: string, type: 'PLANET' | 'SHIP') => {
    setSelectedId(id);
    setSelectedType(type);
  }, []);

  const economyStats = useMemo(() => {
    const role = playerRole || 'P1';
    const myP = gameState.planets.filter(p => p.owner === role);
    const inc = myP.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0);
    return { income: inc, credits: gameState.playerCredits[role] || 0 };
  }, [gameState.planets, playerRole, gameState.playerCredits]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-mono selection:bg-cyan-500/30">
      <header className="h-12 border-b border-cyan-900/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tighter text-cyan-400 uppercase italic">Stellar</h1>
            <span className="text-[8px] leading-none text-cyan-700 font-bold tracking-[0.2em] -mt-1">Cloud Command</span>
          </div>
          {hasInitiated && (
            <div className="flex gap-4 ml-8 bg-black/40 px-3 py-1 rounded-full border border-white/5">
              <span className="text-[10px] text-amber-500 font-bold">💰 {economyStats.credits}</span>
              <span className="text-[10px] text-emerald-500 font-bold">+{economyStats.income}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsHelpOpen(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">?</button>
           {viewMode === 'HOST' && <button onClick={() => setIsInviteModalOpen(true)} className="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center text-xs">🔗</button>}
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} onSelect={handleMapSelect} />
        
        {!hasInitiated && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-[100]">
             <div className="bg-slate-900 border border-cyan-900/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
                <div className="mb-8">
                  <h2 className="text-4xl font-black italic tracking-tighter text-white mb-1">STELLAR</h2>
                  <div className="text-[10px] text-cyan-500 font-bold tracking-[0.3em] uppercase">Cloud Command Interface</div>
                </div>
                {!db || !isConfigSet ? (
                  <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-red-400 text-[10px] font-bold uppercase mb-6">Relay Offline: Check configuration</div>
                ) : null}
                <div className="space-y-3">
                  <button disabled={!db} onClick={() => setIsNewGameModalOpen(true)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50">Create New Galaxy</button>
                  <button disabled={!db} onClick={() => setIsLobbyOpen(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 py-4 rounded-xl font-black uppercase tracking-widest text-sm border border-cyan-900/30 transition-all disabled:opacity-50">Find Active Galaxy</button>
                </div>
             </div>
          </div>
        )}

        {hasInitiated && viewMode === 'HOST' && (
           <div className="absolute top-4 left-4 z-40 bg-slate-950/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl w-44 shadow-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Empire Status</p>
              <div className="space-y-1 mb-4">
                 {Array.from({length: gameState.playerCount}).map((_, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                       <span style={{ color: PLAYER_COLORS[`P${i+1}` as Owner] }}>P{i+1}</span>
                       <span className={gameState.readyPlayers.includes(`P${i+1}` as Owner) ? 'text-emerald-500' : 'text-slate-600'}>
                         {gameState.readyPlayers.includes(`P${i+1}` as Owner) ? 'READY' : 'WAITING'}
                       </span>
                    </div>
                 ))}
              </div>
              <button onClick={executeTurn} disabled={isProcessing} className="w-full py-3 bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                {isProcessing ? 'PROCESSING' : 'EXECUTE TURN'}
              </button>
           </div>
        )}

        {hasInitiated && viewMode === 'PLAYER' && (
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-40">
              <button onClick={() => setIsAdvisorOpen(true)} className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl">❂</button>
              <button onClick={submitOrders} className="px-8 h-14 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">
                Push Orders 🛰️
              </button>
           </div>
        )}
      </main>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} gameState={gameState} playerRole={playerRole} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={hostNewGame} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} frequency={gameId || ''} gameState={gameState} />
      <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} onJoin={joinExistingGame} db={db} />
    </div>
  );
};

export default App;
