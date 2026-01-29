
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

const SAVE_KEY = 'stellar_commander_save_v6';

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
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isOrderQrModalOpen, setIsOrderQrModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [currentOrderCode, setCurrentOrderCode] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Networking State
  const [isLinked, setIsLinked] = useState(false);
  const [frequency, setFrequency] = useState<string>('');
  const [joinInput, setJoinInput] = useState('');
  const peerRef = useRef<Peer | null>(null);

  const initHostPeer = useCallback((seed: number) => {
    const hostFreq = (seed % 9000 + 1000).toString(); 
    if (peerRef.current) peerRef.current.destroy();
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
    } catch(e) { console.error(e); }
  };

  const connectToHost = useCallback((hostFreq: string, role?: Owner) => {
    if (peerRef.current) peerRef.current.destroy();
    const peer = new Peer();
    peer.on('open', () => {
      const conn = peer.connect(`SC-HOST-${hostFreq}`);
      conn.on('open', () => {
        setIsLinked(true);
        setFrequency(hostFreq);
        setHasInitiated(true);
        setIsLinkModalOpen(false);
        if (role) setPlayerRole(role);
      });
      conn.on('error', () => alert("Link Failed. Is the host online?"));
    });
    peerRef.current = peer;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFreq = params.get('freq');
    const urlRole = params.get('role') as Owner;
    const mode = params.get('mode');
    
    // Auto-Join if URL has parameters
    if (urlFreq && urlRole) {
      setViewMode('PLAYER');
      setPlayerRole(urlRole);
      connectToHost(urlFreq, urlRole);
    } else if (mode === 'host') {
      setViewMode('HOST');
      initHostPeer(gameState.seed);
      setHasInitiated(true);
    }

    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [connectToHost, initHostPeer, gameState.seed]);

  const submitOrdersToHost = async () => {
    if (!playerRole) return;
    const myOrders = {
      pId: playerRole,
      ships: gameState.ships.filter(s => s.owner === playerRole).map(s => ({ id: s.id, t: s.targetPlanetId, cp_p: s.cargoPeople })),
      builds: gameState.planets.filter(p => p.owner === playerRole).map(p => ({ id: p.id, m: p.mines, f: p.factories, pop: p.population }))
    };
    const code = btoa(JSON.stringify(myOrders));
    const commandString = `COMMAND_DATA:${code}`;
    
    if (isLinked && peerRef.current && frequency) {
      const conn = peerRef.current.connect(`SC-HOST-${frequency}`);
      conn.on('open', () => {
        conn.send(commandString);
        alert("TRANSMISSION SUCCESSFUL");
        setGameState(prev => ({ ...prev, readyPlayers: Array.from(new Set([...prev.readyPlayers, playerRole])) }));
      });
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

    // ... Game Resolution Logic ...
    for (const aiId of gameState.aiPlayers) {
      try {
        const moves = await getAiMoves(gameState, aiId);
        if (moves.shipOrders) {
          moves.shipOrders.forEach((order: any) => {
            const ship = nextShips.find(s => s.id === order.shipId);
            if (ship) { ship.status = 'MOVING'; ship.targetPlanetId = order.targetPlanetId; ship.currentPlanetId = undefined; }
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

  const economyStats = useMemo(() => {
    const role = playerRole || 'P1';
    const myP = gameState.planets.filter(p => p.owner === role);
    const inc = myP.reduce((a, p) => a + (p.mines * 50) + (p.factories * 20) + (p.population * 50), 0);
    return { income: inc, credits: gameState.playerCredits[role] || 0 };
  }, [gameState.planets, playerRole, gameState.playerCredits]);

  if (!hasInitiated) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 text-center z-[500] star-bg">
        <div className="w-full max-w-md glass-card rounded-[3rem] border-cyan-500/20 p-10 shadow-2xl">
           <h1 className="text-4xl font-black text-white italic mb-1 tracking-tighter">STELLAR COMMAND</h1>
           <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-10">Neural Interface v6.0</p>
           
           <div className="space-y-4">
              <button onClick={() => { setViewMode('HOST'); initHostPeer(gameState.seed); setHasInitiated(true); }} className="w-full py-5 bg-cyan-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border-b-4 border-cyan-800">
                HOST NEW GALAXY
              </button>
              
              <div className="relative py-6">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                 <div className="relative flex justify-center text-[8px] font-black text-slate-600 uppercase tracking-widest"><span className="bg-[#020617] px-4">OR JOIN EMPIRE</span></div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="flex-1 bg-slate-900 border-2 border-white/10 rounded-xl p-3 text-center text-xl font-black text-cyan-400 outline-none focus:border-cyan-500"
                />
                <select 
                  onChange={(e) => setPlayerRole(e.target.value as Owner)}
                  className="bg-slate-900 border-2 border-white/10 rounded-xl p-3 text-[10px] font-black text-white outline-none"
                >
                  <option value="">ROLE</option>
                  {[2,3,4,5,6,7,8].map(i => <option key={i} value={`P${i}`}>P{i}</option>)}
                </select>
              </div>

              <button 
                disabled={!joinInput || !playerRole}
                onClick={() => { setViewMode('PLAYER'); connectToHost(joinInput); }} 
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border-b-4 border-emerald-800 disabled:opacity-20"
              >
                TUNE LINK
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden select-none font-['Space_Grotesk']">
      {/* HUD Header */}
      <div className="absolute top-0 left-0 right-0 z-[100] h-14 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between px-4 md:px-8">
         <div className="flex items-center gap-2">
            <button 
              onClick={() => viewMode === 'PLAYER' && setIsLinkModalOpen(true)}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-full backdrop-blur-md border ${isLinked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30 animate-pulse'}`}
            >
              <div className={`w-2 h-2 rounded-full ${isLinked ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`} />
              <span className="text-[10px] font-black tracking-widest">{isLinked ? `${frequency}` : 'OFFLINE'}</span>
            </button>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest hidden sm:block">
              {viewMode === 'HOST' ? 'HOST' : `EMP ${playerRole}`}
            </span>
         </div>

         {viewMode === 'PLAYER' && (
            <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-1 rounded-2xl border border-white/10">
                <span className="text-sm font-black text-amber-100">💰 {economyStats.credits}</span>
                <span className="text-[10px] font-black text-emerald-400">+{economyStats.income}</span>
            </div>
         )}

         <div className="flex items-center gap-2">
            {viewMode === 'HOST' ? (
              <>
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/10">🆕</button>
                <button onClick={() => setIsInviteModalOpen(true)} className="w-9 h-9 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20">🔗</button>
                <button onClick={() => setIsIngestModalOpen(true)} className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center text-sm border border-emerald-500/20">📡</button>
              </>
            ) : (
              <button onClick={() => setIsHelpOpen(true)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-sm border border-white/10">?</button>
            )}
         </div>
      </div>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} onSelect={handleMapSelect} />

        {viewMode === 'HOST' && !selectedId && (
           <div className="absolute top-20 left-4 z-40 bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl w-44 shadow-2xl">
              <h4 className="text-[8px] font-black text-slate-500 uppercase mb-3">Sync Status (R{gameState.round})</h4>
              <div className="space-y-1.5 mb-4">
                 {Array.from({length: gameState.playerCount}).map((_, i) => {
                    const pId = `P${i+1}` as Owner;
                    const isReady = gameState.readyPlayers.includes(pId) || gameState.aiPlayers.includes(pId);
                    return (
                       <div key={pId} className="flex items-center justify-between text-[10px] font-bold">
                          <span style={{ color: PLAYER_COLORS[pId] }}>{pId}</span>
                          <span className={isReady ? 'text-emerald-500' : 'text-slate-600'}>{isReady ? 'READY' : '...'}</span>
                       </div>
                    );
                 })}
              </div>
              <button onClick={executeTurn} disabled={isProcessing} className="w-full py-3 bg-emerald-600 rounded-xl text-[9px] font-black uppercase shadow-lg disabled:opacity-50">
                {isProcessing ? 'CALCULATING' : 'EXECUTE TURN'}
              </button>
           </div>
        )}

        {viewMode === 'PLAYER' && (
           <div className="absolute z-[120] bottom-6 left-1/2 -translate-x-1/2 flex gap-3 pointer-events-none">
              <div className="pointer-events-auto flex gap-2 bg-slate-950/80 backdrop-blur-2xl p-2 rounded-[2rem] border border-white/10 shadow-2xl">
                  <button onClick={() => setIsAdvisorOpen(true)} className="w-12 h-12 bg-cyan-600 rounded-2xl flex items-center justify-center text-2xl border-b-4 border-cyan-800">❂</button>
                  <button onClick={submitOrdersToHost} className={`px-6 h-12 rounded-2xl font-black text-[10px] uppercase border-b-4 transition-all ${isLinked ? 'bg-emerald-600 text-white border-emerald-800' : 'bg-slate-700 text-slate-400 border-slate-900'}`}>
                    PUSH ORDERS 📡
                  </button>
              </div>
           </div>
        )}
      </main>

      {/* Manual Link Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 star-bg">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsLinkModalOpen(false)} />
          <div className="relative w-full max-w-sm glass-card rounded-[3rem] p-10 border border-cyan-500/20 text-center">
             <h2 className="text-2xl font-black mb-1 italic">SUBSPACE TUNING</h2>
             <p className="text-[8px] text-cyan-400 font-black uppercase tracking-widest mb-8">Reconnect to Command Hub</p>
             <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="FREQ"
                  className="flex-1 bg-slate-900 border-2 border-white/10 rounded-xl p-3 text-center text-xl font-black text-cyan-400 outline-none"
                />
                <select 
                  value={playerRole || ''}
                  onChange={(e) => setPlayerRole(e.target.value as Owner)}
                  className="bg-slate-900 border-2 border-white/10 rounded-xl p-3 text-white outline-none"
                >
                  <option value="">ROLE</option>
                  {[2,3,4,5,6,7,8].map(i => <option key={i} value={`P${i}`}>P{i}</option>)}
                </select>
             </div>
             <button onClick={() => connectToHost(joinInput)} className="w-full py-4 bg-emerald-600 rounded-xl font-black text-[10px] uppercase border-b-4 border-emerald-800">SYNC CHANNEL</button>
          </div>
        </div>
      )}

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal gameState={gameState} playerRole={playerRole} isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} frequency={frequency} gameState={gameState} />
      <IngestModal isOpen={isIngestModalOpen} onClose={() => setIsIngestModalOpen(false)} onIngest={handleIncomingOrders} readyPlayers={gameState.readyPlayers} frequency={frequency} />
      <OrderQrModal isOpen={isOrderQrModalOpen} onClose={() => setIsOrderQrModalOpen(false)} orderCode={currentOrderCode} playerName={playerRole || 'Empire'} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n, d) => { setGameState(generateInitialState(p, a, undefined, n, d)); setIsNewGameModalOpen(false); setHasInitiated(true); setViewMode('HOST'); initHostPeer(gameState.seed); }} />
    </div>
  );
};

export default App;
