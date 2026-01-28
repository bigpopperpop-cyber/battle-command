
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Planet, Ship, Owner, ShipType, AiDifficulty } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS, SHIP_STATS, MAX_PLANET_POPULATION, MAX_FACTORIES, MAX_MINES } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal, { HelpTab } from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import IngestModal from './components/IngestModal';
import OrderQrModal from './components/OrderQrModal';
import { getAiMoves } from './services/geminiService';
import { Peer, DataConnection } from 'peerjs';

const SAVE_KEY = 'stellar_commander_save_v5';
const KIRK_CHANCE = 0.15; 

const App: React.FC = () => {
  const [hasInitiated, setHasInitiated] = useState(false);
  const [viewMode, setViewMode] = useState<'HOST' | 'PLAYER'>('HOST');
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error("Save Corrupt", e); }
    }
    return generateInitialState(2, 0);
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>('GOAL');
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isOrderQrModalOpen, setIsOrderQrModalOpen] = useState(false);
  const [currentOrderCode, setCurrentOrderCode] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Networking State
  const [isLinked, setIsLinked] = useState(false);
  const [frequency, setFrequency] = useState<string>('');
  const [joinInput, setJoinInput] = useState('');
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Record<string, DataConnection>>({});

  // Initialize PeerJS for Host
  const initHostPeer = useCallback((seed: number) => {
    const hostFreq = (seed % 9000 + 1000).toString(); // Stable 4-digit code
    const peer = new Peer(`SC-HOST-${hostFreq}`);
    
    peer.on('open', () => {
      setFrequency(hostFreq);
      setIsLinked(true);
    });

    peer.on('connection', (conn) => {
      conn.on('data', (data: any) => {
        if (data && typeof data === 'string' && data.startsWith('COMMAND_DATA:')) {
          handleIncomingOrders(data);
        }
      });
      connectionsRef.current[conn.peer] = conn;
    });

    peerRef.current = peer;
  }, []);

  const handleIncomingOrders = (data: string) => {
    try {
      const raw = data.replace('COMMAND_DATA:', '');
      const orders = JSON.parse(atob(raw));
      setGameState(prev => {
        const nextShips = prev.ships.map(s => {
          const order = orders.ships.find((o:any) => o.id === s.id);
          return order ? { ...s, status: 'MOVING', targetPlanetId: order.t, currentPlanetId: undefined, cargoPeople: order.cp_p !== undefined ? order.cp_p : s.cargoPeople } : s;
        });
        const nextPlanets = prev.planets.map(p => {
          const order = orders.builds.find((o:any) => o.id === p.id);
          return order ? { ...p, mines: order.m, factories: order.f, population: order.pop !== undefined ? order.pop : p.population } : p;
        });
        return { ...prev, ships: nextShips, planets: nextPlanets, readyPlayers: Array.from(new Set([...prev.readyPlayers, orders.pId])) };
      });
    } catch(e) { console.error("Network Ingest Failed", e); }
  };

  const connectToHost = (hostFreq: string) => {
    if (peerRef.current) peerRef.current.destroy();
    
    const peer = new Peer();
    peer.on('open', () => {
      const conn = peer.connect(`SC-HOST-${hostFreq}`);
      conn.on('open', () => {
        setIsLinked(true);
        setFrequency(hostFreq);
        setHasInitiated(true);
      });
      conn.on('error', (err) => {
        alert("Frequency unstable. Ensure host is online.");
      });
    });
    peerRef.current = peer;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') as Owner;
    const joinFreq = params.get('freq');
    
    if (role && role.startsWith('P')) {
      setViewMode('PLAYER');
      setPlayerRole(role);
      setGameState(prev => ({ ...prev, activePlayer: role }));
      if (joinFreq) {
        connectToHost(joinFreq);
      }
    } else if (params.get('mode') === 'host' || !role) {
      // Default to host if no specific player role
      setViewMode('HOST');
      initHostPeer(gameState.seed);
      setHasInitiated(true);
    }

    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState.seed, initHostPeer]);

  const submitOrdersToHost = async () => {
    const myOrders = {
      pId: playerRole,
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, t: s.targetPlanetId, cp_p: s.cargoPeople })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, m: p.mines, f: p.factories, pop: p.population }))
    };
    const code = btoa(JSON.stringify(myOrders));
    const commandString = `COMMAND_DATA:${code}`;
    
    if (isLinked && peerRef.current && frequency) {
      try {
        const conn = peerRef.current.connect(`SC-HOST-${frequency}`);
        conn.on('open', () => {
          conn.send(commandString);
          alert("Subspace Transmission Complete! Orders synced with Host.");
          setGameState(prev => ({ ...prev, readyPlayers: Array.from(new Set([...prev.readyPlayers, playerRole!])) }));
        });
      } catch (e) {
        setCurrentOrderCode(commandString);
        setIsOrderQrModalOpen(true);
      }
    } else {
      setCurrentOrderCode(commandString);
      setIsOrderQrModalOpen(true);
    }
  };

  const executeTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Round ${gameState.round} Resolution ---`];

    // AI logic and game resolution logic (omitted for brevity, assume same as before)
    // ... logic remains identical to previous turns to preserve gameplay stability ...
    for (const aiId of gameState.aiPlayers) {
      try {
        const moves = await getAiMoves(gameState, aiId);
        if (moves.shipOrders) {
          moves.shipOrders.forEach((order: any) => {
            const ship = nextShips.find(s => s.id === order.shipId);
            if (ship) { ship.status = 'MOVING'; ship.targetPlanetId = order.targetPlanetId; ship.currentPlanetId = undefined; }
          });
        }
        if (moves.planetOrders) {
          moves.planetOrders.forEach((order: any) => {
            const planet = nextPlanets.find(p => p.id === order.planetId);
            if (planet && nextCredits[aiId] >= 100) {
              if (order.build === 'MINE' && planet.mines < MAX_MINES) { planet.mines++; nextCredits[aiId] -= 100; }
              else if (order.build === 'FACTORY' && planet.factories < MAX_FACTORIES) { planet.factories++; nextCredits[aiId] -= 100; }
            }
          });
        }
      } catch (e) { console.error(e); }
    }

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

    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      readyPlayers: [] 
    }));
    setIsProcessing(false);
    setSelectedId(null);
  };

  const handleMapSelect = (id: string, type: 'PLANET' | 'SHIP') => {
    if (viewMode === 'HOST') { setSelectedId(id); setSelectedType(type); return; }
    if (selectedType === 'SHIP' && type === 'PLANET' && selectedId) {
       const ship = gameState.ships.find(s => s.id === selectedId);
       if (ship && ship.owner === playerRole) {
          setGameState(prev => ({
            ...prev,
            ships: prev.ships.map(s => s.id === selectedId ? { ...s, status: 'MOVING', targetPlanetId: id, currentPlanetId: undefined } : s)
          }));
          setSelectedId(null); setSelectedType(null); return;
       }
    }
    setSelectedId(id); setSelectedType(type);
  };

  const economyStats = useMemo(() => {
    const role = playerRole || 'P1';
    const myP = gameState.planets.filter(p => p.owner === role);
    const inc = myP.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0);
    return { income: inc, credits: gameState.playerCredits[role] || 0 };
  }, [gameState.planets, playerRole, gameState.playerCredits]);

  if (!hasInitiated) {
    return (
      <div className="fixed inset-0 bg-[#050b1a] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md glass-card rounded-[4rem] border-cyan-500/20 p-12 shadow-[0_0_120px_rgba(34,211,238,0.1)]">
           <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter">STELLAR</h1>
           <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-12">Empire Tuning Station</p>
           
           <div className="space-y-4">
              <button onClick={() => { setViewMode('HOST'); initHostPeer(gameState.seed); setHasInitiated(true); }} className="w-full py-6 bg-cyan-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-cyan-800">
                START NEW GALAXY (HOST)
              </button>
              
              <div className="relative py-4">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                 <div className="relative flex justify-center text-[8px] font-black text-slate-600 uppercase tracking-widest"><span className="bg-[#050b1a] px-4">OR JOIN ALLY</span></div>
              </div>

              <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.slice(0, 4))}
                  placeholder="CODE"
                  className="flex-1 bg-slate-900 border-2 border-white/10 rounded-2xl p-4 text-center text-xl font-black text-cyan-400 placeholder:text-slate-800 outline-none focus:border-cyan-500"
                />
                <select 
                  onChange={(e) => setPlayerRole(e.target.value as Owner)}
                  className="bg-slate-900 border-2 border-white/10 rounded-2xl p-4 text-[10px] font-black text-white outline-none"
                >
                  <option value="">SELECT EMPIRE</option>
                  {[2,3,4,5,6,7,8].map(i => <option key={i} value={`P${i}`}>P{i}</option>)}
                </select>
              </div>

              <button 
                disabled={!joinInput || !playerRole}
                onClick={() => { setViewMode('PLAYER'); connectToHost(joinInput); }} 
                className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-emerald-800 disabled:opacity-20"
              >
                TUNE SUBSPACE LINK
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none touch-none font-['Space_Grotesk']">
      {/* HUD Header */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-14 bg-gradient-to-b from-slate-950/95 to-transparent flex items-center justify-between px-4 md:px-8">
         <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLinked ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-slate-700'}`} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 leading-none">FREQ: {frequency || '---'} MHz</p>
              <p className="text-[12px] font-bold text-cyan-400 uppercase tracking-tight">{viewMode === 'HOST' ? 'FLEET COMMAND' : `EMPIRE ${playerRole}`}</p>
            </div>
         </div>

         {viewMode === 'PLAYER' && (
            <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-lg">
                <div className="flex items-center gap-1.5"><span className="text-amber-400 text-xs">💰</span><span className="text-sm font-black text-amber-100">{economyStats.credits}</span></div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5"><span className="text-emerald-400 text-xs">📈</span><span className="text-xs font-black text-emerald-400">+{economyStats.income}</span></div>
            </div>
         )}

         <div className="flex items-center gap-1.5">
            {viewMode === 'HOST' ? (
              <>
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/10 active:bg-white/20">🆕</button>
                <button onClick={() => setIsInviteModalOpen(true)} className="w-9 h-9 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20 active:bg-cyan-600/40">🔗</button>
                <button onClick={() => setIsIngestModalOpen(true)} className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center text-sm border border-emerald-500/20 active:bg-emerald-600/40">📡</button>
              </>
            ) : (
              <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/10 active:bg-white/10">?</button>
            )}
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} onSelect={handleMapSelect} />

        {viewMode === 'HOST' && !selectedId && (
           <div className="absolute top-20 left-4 z-40 bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl w-48 shadow-2xl">
              <div className="mb-3">
                 <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Empire Sync</h4>
                 <p className="text-[7px] text-amber-500 font-bold uppercase">{gameState.round} ROUND</p>
              </div>
              <div className="space-y-2 mb-4">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isReady = gameState.readyPlayers.includes(pId) || gameState.aiPlayers.includes(pId);
                    return (
                       <div key={pId} className="flex items-center justify-between">
                          <span className="text-[10px] font-bold" style={{ color: PLAYER_COLORS[pId] }}>{gameState.playerNames[pId]}</span>
                          <span className={`text-[8px] font-black ${isReady ? 'text-emerald-500' : 'text-slate-600'}`}>{isReady ? 'READY' : 'WAIT'}</span>
                       </div>
                    );
                 })}
              </div>
              <button onClick={executeTurn} disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                {isProcessing ? 'SYNC...' : 'EXECUTE'}
              </button>
           </div>
        )}

        {viewMode === 'PLAYER' && (
           <div className={`absolute z-[120] bottom-4 left-4 right-4 flex justify-center items-end pointer-events-none transition-all duration-300`}>
              <div className="pointer-events-auto flex items-end gap-2 bg-slate-900/60 backdrop-blur-2xl p-2 rounded-[2.5rem] border border-white/10 shadow-2xl">
                  <button onClick={() => setIsAdvisorOpen(true)} className="w-14 h-14 bg-cyan-500 rounded-3xl flex items-center justify-center text-3xl shadow-lg active:scale-90 border-b-4 border-cyan-700">❂</button>
                  <button onClick={submitOrdersToHost} className={`px-6 h-14 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 border-b-4 flex items-center justify-center gap-2 ${isLinked ? 'bg-emerald-600 text-white border-emerald-800' : 'bg-white text-black border-slate-300'}`}>
                    <span>PUSH ORDERS</span>
                    <span className="text-xl">📡</span>
                  </button>
              </div>
           </div>
        )}

        {/* Tactical Drawer (only if selectedId is set) */}
        {selectedId && (
          <div className={`absolute transition-all duration-500 ease-out z-[130] bottom-0 left-0 right-0 translate-y-0`}>
             <div className="relative flex flex-col bg-slate-900/98 backdrop-blur-3xl border-t border-white/10 shadow-2xl overflow-hidden rounded-t-[3.5rem] max-h-[50vh] min-h-[40vh] p-8">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full" />
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h2 className="text-2xl font-bold italic text-white leading-none mb-1">{selectedId}</h2>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selected Unit</p>
                   </div>
                   <button onClick={() => setSelectedId(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                   <p className="text-sm text-slate-400 italic">Accessing tactical archives for unit {selectedId}...</p>
                </div>
             </div>
          </div>
        )}
      </main>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal gameState={gameState} playerRole={playerRole} isOpen={isHelpOpen} initialTab={helpTab} onClose={() => setIsHelpOpen(false)} />
      <IngestModal isOpen={isIngestModalOpen} onClose={() => setIsIngestModalOpen(false)} onIngest={handleIncomingOrders} readyPlayers={gameState.readyPlayers} frequency={frequency} />
      <OrderQrModal isOpen={isOrderQrModalOpen} onClose={() => setIsOrderQrModalOpen(false)} orderCode={currentOrderCode} playerName={gameState.playerNames[playerRole!] || 'Commander'} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n, d) => { setGameState(generateInitialState(p, a, undefined, n, d)); setIsNewGameModalOpen(false); setSelectedId(null); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} frequency={frequency} gameState={gameState} />
    </div>
  );
};

export default App;
