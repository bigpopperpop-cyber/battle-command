
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Planet, Ship, Owner, ShipType, AiDifficulty } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS, SHIP_STATS, MAX_PLANET_POPULATION, MAX_FACTORIES, MAX_MINES } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal, { HelpTab } from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import LobbyModal from './components/LobbyModal';
import { getAiMoves } from './services/geminiService';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, update, push, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// --- FIREBASE CONFIGURATION ---
// Replace the databaseURL below with the one from your Firebase Console
const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com", 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const SAVE_KEY = 'stellar_commander_save_v7';

const App: React.FC = () => {
  const [hasInitiated, setHasInitiated] = useState(false);
  const [viewMode, setViewMode] = useState<'HOST' | 'PLAYER'>('HOST');
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
    if (!gameId || !playerRole) return;
    const myOrders = {
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, t: s.targetPlanetId, cp_p: s.cargoPeople })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, m: p.mines, f: p.factories, pop: p.population }))
    };
    
    await set(ref(db, `games/${gameId}/orders/${playerRole}`), myOrders);
    alert("SUB-ETHER TRANSMISSION COMPLETE");
  };

  const executeTurn = async () => {
    if (!gameId) return;
    setIsProcessing(true);

    onValue(ref(db, `games/${gameId}/orders`), async (snapshot) => {
      const allOrders = snapshot.val() || {};
      let nextPlanets = gameState.planets.map(p => ({...p}));
      let nextShips = gameState.ships.map(s => ({...s}));
      let nextCredits = { ...gameState.playerCredits };

      Object.keys(allOrders).forEach((pId) => {
        const orders = allOrders[pId];
        orders.ships.forEach((o: any) => {
          const ship = nextShips.find(s => s.id === o.id);
          if (ship) { ship.status = 'MOVING'; ship.targetPlanetId = o.t; ship.currentPlanetId = undefined; }
        });
        orders.builds.forEach((o: any) => {
          const planet = nextPlanets.find(p => p.id === o.id);
          if (planet) { planet.mines = o.m; planet.factories = o.f; planet.population = o.pop; }
        });
      });

      // AI and Movement logic (simplified)
      nextShips.forEach(s => {
        if (s.status === 'MOVING' && s.targetPlanetId) {
          const target = nextPlanets.find(p => p.id === s.targetPlanetId);
          if (target) {
            const dx = target.x - s.x; const dy = target.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= s.speed) { s.x = target.x; s.y = target.y; s.status = 'ORBITING'; s.currentPlanetId = target.id; }
            else { s.x += (dx / dist) * s.speed; s.y += (dy / dist) * s.speed; }
          }
        }
      });

      nextPlanets.forEach(p => {
        if (p.owner !== 'NEUTRAL') {
          p.population = Math.min(MAX_PLANET_POPULATION, p.population + 1);
          const inc = (p.mines * 50) + (p.factories * 20) + (p.population * 50);
          nextCredits[p.owner] = (nextCredits[p.owner] || 0) + inc;
          p.defense = Math.min(p.maxDefense, p.defense + 10);
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
      update(ref(db, `lobby/${gameId}`), { round: finalState.round });

      setIsProcessing(false);
      setSelectedId(null);
    }, { onlyOnce: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('gameId');
    const urlRole = params.get('role') as Owner;
    if (urlGameId && urlRole) joinExistingGame(urlGameId, urlRole);
  }, [joinExistingGame]);

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

  if (!hasInitiated) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 text-center z-[500] star-bg overflow-hidden">
        <div className="w-full max-w-md glass-card rounded-[3.5rem] border-cyan-500/20 p-12 shadow-2xl relative overflow-hidden">
           <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent animate-pulse" />
           <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter relative z-10">STELLAR</h1>
           <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-12 relative z-10">Cloud Command Interface</p>
           
           <div className="space-y-4 relative z-10">
              <button 
                onClick={() => setIsNewGameModalOpen(true)} 
                className="w-full py-6 bg-cyan-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-cyan-800"
              >
                CREATE NEW GALAXY
              </button>
              
              <button 
                onClick={() => setIsLobbyOpen(true)}
                className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-2 border-white/5 hover:border-cyan-500/50"
              >
                FIND ACTIVE GALAXY
              </button>
           </div>
           
           <p className="mt-8 text-[8px] text-slate-600 uppercase font-black tracking-widest">Connected to Firebase Relay // Sector 0-1</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden select-none font-['Space_Grotesk']">
      <div className="absolute top-0 left-0 right-0 z-[100] h-14 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between px-4 md:px-8">
         <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black tracking-widest text-cyan-400">{gameId}</span>
            </div>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest hidden sm:block">
              {viewMode === 'HOST' ? 'ADMIRAL' : `EMPIRE ${playerRole}`}
            </span>
         </div>

         {viewMode === 'PLAYER' && (
            <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <span className="text-sm font-black text-amber-100">💰 {economyStats.credits}</span>
                <span className="text-[10px] font-black text-emerald-400">+{economyStats.income}</span>
            </div>
         )}

         <div className="flex items-center gap-2">
            <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/10">?</button>
            {viewMode === 'HOST' && (
              <button onClick={() => setIsInviteModalOpen(true)} className="w-9 h-9 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20">🔗</button>
            )}
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} onSelect={handleMapSelect} />

        {viewMode === 'HOST' && !selectedId && (
           <div className="absolute top-20 left-4 z-40 bg-slate-950/90 backdrop-blur-3xl border border-white/10 p-5 rounded-[2.5rem] w-48 shadow-2xl">
              <div className="mb-4">
                 <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Fleet Readiness</h4>
                 <p className="text-[10px] text-amber-500 font-bold uppercase">ROUND {gameState.round}</p>
              </div>
              <div className="space-y-2 mb-6">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isReady = gameState.readyPlayers.includes(pId) || gameState.aiPlayers.includes(pId);
                    return (
                       <div key={pId} className="flex items-center justify-between text-[10px] font-bold">
                          <span style={{ color: PLAYER_COLORS[pId] }}>EMPIRE {pId}</span>
                          <span className={isReady ? 'text-emerald-500' : 'text-slate-600'}>{isReady ? 'READY' : 'WAITING'}</span>
                       </div>
                    );
                 })}
              </div>
              <button onClick={executeTurn} disabled={isProcessing} className="w-full py-4 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all border-b-4 border-emerald-800 disabled:opacity-50">
                {isProcessing ? 'CALCULATING' : 'EXECUTE TURN'}
              </button>
           </div>
        )}

        {viewMode === 'PLAYER' && (
           <div className="absolute z-[120] bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/80 backdrop-blur-2xl p-2.5 rounded-[3rem] border border-white/10 shadow-2xl">
                  <button onClick={() => setIsAdvisorOpen(true)} className="w-14 h-14 bg-cyan-600 rounded-[2rem] flex items-center justify-center text-3xl border-b-4 border-cyan-800 active:scale-90 transition-all">❂</button>
                  <button onClick={submitOrders} className="px-8 h-14 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] border-b-4 border-emerald-800 active:scale-95 transition-all">
                    PUSH ORDERS 🛰️
                  </button>
              </div>
           </div>
        )}
      </main>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal gameState={gameState} playerRole={playerRole} isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} frequency={gameId || ''} gameState={gameState} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={hostNewGame} />
      <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} onJoin={joinExistingGame} db={db} />
    </div>
  );
};

export default App;
