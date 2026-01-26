
import React, { useState, useEffect } from 'react';
import { GameState, Planet, Ship, Owner, ShipType } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import { getAiMoves } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(2, 0));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [pendingJoin, setPendingJoin] = useState<GameState | null>(null);

  // Handle joining via Link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#join=')) {
      try {
        const dataStr = hash.substring(6);
        const compact = JSON.parse(atob(dataStr));
        const baseState = generateInitialState(compact.pc, compact.ai.length, compact.sd, compact.nm);
        
        baseState.round = compact.rd;
        baseState.playerCredits = compact.cr;
        baseState.aiPlayers = compact.ai;
        
        compact.ps.forEach((pState: any, i: number) => {
          if (baseState.planets[i]) {
            baseState.planets[i].owner = pState[0];
            baseState.planets[i].mines = pState[1];
            baseState.planets[i].factories = pState[2];
          }
        });

        baseState.ships = compact.ss.map((s: any) => ({
          id: s.id, name: s.n, type: s.t, owner: s.o, x: s.x, y: s.y,
          status: s.st, targetPlanetId: s.tp, currentPlanetId: s.cp,
          cargo: 0, maxCargo: 100, hp: 100, maxHp: 100
        }));

        setPendingJoin(baseState);
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        console.error("Join Failed", e);
      }
    }
  }, []);

  const claimCommand = (pId: Owner) => {
    if (pendingJoin) {
      const newState = { ...pendingJoin, activePlayer: pId };
      const myName = newState.playerNames[pId];
      newState.logs = [`✅ ${myName} Command Established.`, ...newState.logs];
      setGameState(newState);
      setPendingJoin(null);
    }
  };

  const getShareableData = (state: GameState) => {
    const compact = {
      sd: state.seed, rd: state.round, pc: state.playerCount, ai: state.aiPlayers,
      cr: state.playerCredits, nm: state.playerNames,
      ps: state.planets.map(p => [p.owner, p.mines, p.factories]),
      ss: state.ships.map(s => ({
        id: s.id, n: s.name, t: s.type, o: s.owner, x: Math.round(s.x), y: Math.round(s.y), st: s.status, tp: s.targetPlanetId, cp: s.currentPlanetId
      }))
    };
    return btoa(JSON.stringify(compact));
  };

  const shareTurn = async () => {
    const data = getShareableData(gameState);
    const shareText = `COMMAND_DATA:${data}`;
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `Stellar Commander - ${gameState.playerNames[gameState.activePlayer]} Orders`, 
          text: `Here are my moves for Round ${gameState.round}!\n\n${shareText}` 
        });
      } catch (err) { copyToClipboard(shareText, "Orders copied!"); }
    } else { copyToClipboard(shareText, "Orders copied!"); }
  };

  const inviteAllies = () => {
    const data = getShareableData(gameState);
    const joinUrl = `${window.location.origin}${window.location.pathname}#join=${data}`;
    setShareUrl(joinUrl);
    setIsInviteModalOpen(true);
  };

  const copyToClipboard = (text: string, alertMsg: string) => {
    navigator.clipboard.writeText(text);
    alert(alertMsg);
  };

  const processGlobalTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Turn ${gameState.round} Results ---`];

    // 1. AI Logic
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
              nextCredits[aiId] -= 100;
              if (order.build === 'MINE') planet.mines++; else planet.factories++;
            }
          });
        }
      } catch (e) { console.error(`AI ${aiId} Error`, e); }
    }

    // 2. Movement
    nextShips.forEach(s => {
      if (s.status === 'MOVING' && s.targetPlanetId) {
        const target = nextPlanets.find(p => p.id === s.targetPlanetId);
        if (target) {
          const dx = target.x - s.x; const dy = target.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = SHIP_SPEEDS[s.type as keyof typeof SHIP_SPEEDS] || 100;
          if (dist <= speed) { s.x = target.x; s.y = target.y; s.status = 'ORBITING'; s.currentPlanetId = target.id; }
          else { s.x += (dx / dist) * speed; s.y += (dy / dist) * speed; }
        }
      }
    });

    // 3. Presence/Colonization
    nextPlanets.forEach(planet => {
      const shipsPresent = nextShips.filter(s => Math.abs(s.x - planet.x) < 5 && Math.abs(s.y - planet.y) < 5);
      if (shipsPresent.length > 0) {
        if (planet.owner === 'NEUTRAL') {
          const newOwner = shipsPresent[0].owner;
          planet.owner = newOwner;
          planet.population = 500;
          newLogs.push(`🚀 ${gameState.playerNames[newOwner]} colonized ${planet.name}!`);
        }
        shipsPresent.forEach(s => s.currentPlanetId = planet.id);
      }
    });

    // 4. Economy
    nextPlanets.forEach(p => {
      if (p.owner !== 'NEUTRAL') {
        const income = (p.mines * 50) + (p.factories * 20) + 100;
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;
      }
    });

    setGameState(prev => ({
      ...prev, round: prev.round + 1, planets: nextPlanets, ships: nextShips,
      playerCredits: nextCredits, logs: [...newLogs, ...prev.logs].slice(0, 15), readyPlayers: [] 
    }));
    setIsProcessing(false);
  };

  const buildAction = (type: 'MINE' | 'FACTORY') => {
    const planet = gameState.planets.find(p => p.id === selectedId);
    if (planet && gameState.playerCredits[gameState.activePlayer] >= 100) {
      setGameState(prev => ({
        ...prev,
        playerCredits: { ...prev.playerCredits, [prev.activePlayer]: prev.playerCredits[prev.activePlayer] - 100 },
        planets: prev.planets.map(p => p.id === planet.id ? { ...p, mines: type === 'MINE' ? p.mines + 1 : p.mines, factories: type === 'FACTORY' ? p.factories + 1 : p.factories } : p)
      }));
    }
  };

  const buildShip = (type: ShipType) => {
    const planet = gameState.planets.find(p => p.id === selectedId);
    const cost = SHIP_COSTS[type];
    const myName = gameState.playerNames[gameState.activePlayer];
    if (planet && gameState.playerCredits[gameState.activePlayer] >= cost) {
      const newShip: Ship = { id: `s-${gameState.activePlayer}-${Date.now()}`, name: `${myName} ${type} ${gameState.ships.length + 1}`, type, owner: gameState.activePlayer, x: planet.x, y: planet.y, currentPlanetId: planet.id, cargo: 0, maxCargo: 100, hp: 100, maxHp: 100, status: 'ORBITING' };
      setGameState(prev => ({
        ...prev,
        playerCredits: { ...prev.playerCredits, [prev.activePlayer]: prev.playerCredits[prev.activePlayer] - cost },
        ships: [...prev.ships, newShip],
        logs: [`🛠️ shipyard at ${planet.name} launched a ${type}.`, ...prev.logs].slice(0, 15)
      }));
    } else { alert("Insufficient Credits"); }
  };

  const setDestination = (planetId: string) => {
    setGameState(prev => ({
      ...prev,
      ships: prev.ships.map(s => s.id === selectedId ? { ...s, status: 'MOVING', targetPlanetId: planetId, currentPlanetId: undefined } : s)
    }));
    setSelectedId(null);
  };

  const selectedPlanet = selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null;
  const selectedShip = selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null;
  const currentCredits = gameState.playerCredits[gameState.activePlayer] || 0;
  const currentPlayerName = gameState.playerNames[gameState.activePlayer];

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none">
      {pendingJoin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl">
          <div className="max-w-md w-full glass-card rounded-[3rem] p-10 text-center border-cyan-500/30 animate-in zoom-in-95 duration-500">
            <h2 className="text-3xl font-bold mb-2 italic">GALAXY DETECTED</h2>
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-8">Select Your Empire</p>
            <div className="grid grid-cols-1 gap-3">
              {Array.from({length: pendingJoin.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isAi = pendingJoin.aiPlayers.includes(pId);
                const empireName = pendingJoin.playerNames[pId];
                return (
                  <button
                    key={pId}
                    disabled={isAi}
                    onClick={() => claimCommand(pId)}
                    className={`p-5 rounded-2xl border-2 transition-all group flex items-center justify-between gap-4 ${isAi ? 'opacity-20 grayscale border-slate-800' : 'bg-slate-900/50 border-white/10 hover:border-cyan-500 hover:scale-105 active:scale-95'}`}
                    style={{ color: isAi ? '#475569' : PLAYER_COLORS[pId] }}
                  >
                    <div className="flex items-center gap-3 text-left">
                       <span className="text-xl font-black">{pId}</span>
                       <div className="flex flex-col">
                          <span className="text-sm font-bold text-white truncate w-32">{empireName}</span>
                          <span className="text-[8px] font-bold uppercase tracking-widest">{isAi ? 'Automated' : 'Ready'}</span>
                       </div>
                    </div>
                    {!isAi && <span className="text-xs">Claim →</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <header className="h-20 flex items-center justify-between px-6 glass-card border-b-white/5 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsNewGameModalOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700" title="New Mission">🛰️</button>
          <button onClick={inviteAllies} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/30" title="Recruit Allies">📢</button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase leading-none mb-1">Stellar</span>
            <span className="text-xl font-bold tracking-tight italic leading-none">COMMANDER</span>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-4">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Turn {gameState.round}</div>
             <div className="px-4 py-1.5 rounded-full text-[10px] font-bold border-2 flex flex-col transition-all max-w-[150px]" 
                  style={{ borderColor: PLAYER_COLORS[gameState.activePlayer], color: PLAYER_COLORS[gameState.activePlayer], boxShadow: `0 0 15px ${PLAYER_COLORS[gameState.activePlayer]}44` }}>
               <span className="text-[8px] opacity-60 uppercase tracking-widest">{gameState.activePlayer}</span>
               <span className="truncate">{currentPlayerName}</span>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reserve</div>
            <div className="text-xl font-bold text-amber-400">¤{currentCredits.toLocaleString()}</div>
          </div>
          <button onClick={processGlobalTurn} disabled={isProcessing} className="bg-cyan-600 hover:bg-cyan-500 px-6 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/40 disabled:opacity-50">
             {isProcessing ? '⚙️ Processing...' : '📡 Execute Orders'}
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} onSelect={(id, type) => { setSelectedId(id); setSelectedType(type); }} />
        
        {/* Tutorial Prompt for Round 1 */}
        {gameState.round === 1 && !selectedId && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 animate-bounce pointer-events-none">
            <div className="bg-cyan-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl shadow-cyan-500/50">
              TAP YOUR HOME PLANET TO START
            </div>
            <span className="text-4xl">👇</span>
          </div>
        )}

        {selectedPlanet && (
          <div className="absolute top-6 left-6 w-80 glass-card rounded-[2rem] p-6 shadow-2xl border-white/10 animate-in fade-in slide-in-from-left-4 duration-300 max-h-[calc(100%-3rem)] overflow-y-auto">
             <div className="flex justify-between items-start mb-4">
                <div><h2 className="text-2xl font-bold">{selectedPlanet.name}</h2><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sector {selectedPlanet.id}</span></div>
                <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-white">✕</button>
             </div>
             {selectedPlanet.owner === gameState.activePlayer ? (
               <div className="space-y-6">
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Planetary Development</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => buildAction('MINE')} className="flex flex-col items-center justify-center p-3 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"><span className="text-xl mb-1">🏗️</span><span className="text-[10px] font-bold uppercase">Mine</span><span className="text-[10px] text-amber-400">¤100</span></button>
                      <button onClick={() => buildAction('FACTORY')} className="flex flex-col items-center justify-center p-3 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"><span className="text-xl mb-1">🏭</span><span className="text-[10px] font-bold uppercase">Factory</span><span className="text-[10px] text-amber-400">¤100</span></button>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="bg-slate-900/50 p-4 rounded-2xl mb-6 text-center border border-white/5">
                 <p className="text-xs text-slate-400 italic">Sector controlled by <br/><span className="font-bold text-white">{gameState.playerNames[selectedPlanet.owner] || selectedPlanet.owner}</span></p>
               </div>
             )}
             {selectedShip && selectedShip.owner === gameState.activePlayer && selectedShip.currentPlanetId !== selectedPlanet.id && (
                <button onClick={() => setDestination(selectedPlanet.id)} className="w-full mt-6 py-4 bg-cyan-600 rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/30 active:scale-95 transition-all">🚀 SEND FLEET HERE</button>
             )}
          </div>
        )}
        <div className="absolute bottom-6 left-6 w-80 glass-card rounded-2xl p-4 bg-[#050b1a]/80 hidden md:block">
          <h4 className="text-[10px] font-bold uppercase text-cyan-400 mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Subspace Feed</h4>
          <div className="h-24 overflow-y-auto space-y-2 pr-2 text-xs text-slate-300">
            {gameState.logs.map((log, i) => <div key={i} className="pb-2 border-b border-white/5 last:border-0">{log}</div>)}
          </div>
        </div>
        <div className="absolute bottom-6 right-6 flex items-center gap-3">
           <button onClick={shareTurn} disabled={gameState.aiPlayers.includes(gameState.activePlayer)} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 px-6 py-4 rounded-3xl font-bold text-sm shadow-xl shadow-cyan-900/40 transition-all active:scale-95 flex items-center gap-2">📤 Send Moves</button>
        </div>
      </main>

      <footer className="h-24 glass-card border-t-white/5 flex items-center justify-between px-6 md:px-10">
        <div className="flex gap-2 md:gap-3 flex-wrap max-w-[70%]">
          {Array.from({length: gameState.playerCount}).map((_, i) => {
            const pId = `P${i+1}` as Owner;
            const isActive = gameState.activePlayer === pId;
            const isAi = gameState.aiPlayers.includes(pId);
            return (
              <button 
                key={i}
                onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl font-black text-[10px] md:text-sm transition-all border-2 flex items-center justify-center relative ${isActive ? 'scale-110' : 'opacity-30 hover:opacity-100'}`}
                style={{ borderColor: PLAYER_COLORS[pId], backgroundColor: isActive ? `${PLAYER_COLORS[pId]}22` : 'transparent', color: PLAYER_COLORS[pId], boxShadow: isActive ? `0 0-15px ${PLAYER_COLORS[pId]}33` : 'none' }}
                title={gameState.playerNames[pId]}
              >
                {pId}{isAi && <span className="absolute -top-1 -right-1 text-[8px]">🤖</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => setIsHelpOpen(true)} 
            className="w-10 h-10 md:w-12 md:h-12 glass-card rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105"
          >
            <span className="text-xl">？</span>
            <span className="text-[6px] font-black uppercase tracking-tighter">Manual</span>
          </button>
          <button onClick={() => setIsAdvisorOpen(true)} className="w-14 h-14 md:w-16 md:h-16 bg-cyan-500 rounded-full flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30 hover:scale-110 transition-transform active:rotate-12">❂</button>
        </div>
      </footer>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n) => { setGameState(generateInitialState(p, a, undefined, n)); setIsNewGameModalOpen(false); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={shareUrl} />
    </div>
  );
};

export default App;
