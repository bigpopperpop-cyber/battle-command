
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Planet, Ship, Owner, ShipType } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import IngestModal from './components/IngestModal';
import { getAiMoves } from './services/geminiService';

const SAVE_KEY = 'stellar_commander_save';

const App: React.FC = () => {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<GameState | null>(null);
  const [showMoveQr, setShowMoveQr] = useState(false);
  const [showPostTurnSync, setShowPostTurnSync] = useState(false);
  const [lastSyncUrl, setLastSyncUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Persistence Hook
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  const handleIngest = useCallback((rawCode: string) => {
    try {
      const code = rawCode.replace('COMMAND_DATA:', '').trim();
      const externalState = JSON.parse(atob(code));
      
      if (externalState.sd !== gameState.seed) {
        alert("⚠️ Galaxy Mismatch: This link is for a different game session.");
        return;
      }
      if (externalState.rd !== gameState.round) {
        alert(`⚠️ Chronology Error: These moves are for Round ${externalState.rd}, but you are on Round ${gameState.round}.`);
        return;
      }

      setGameState(current => {
        const nextPlanets = [...current.planets];
        const nextShips = [...current.ships];
        const readyPlayers = new Set(current.readyPlayers);

        const sampleShip = externalState.ss.find((s: any) => s.o !== 'P1' && !current.aiPlayers.includes(s.o));
        if (!sampleShip) return current;
        
        const guestId = sampleShip.o as Owner;
        if (readyPlayers.has(guestId)) return current; 

        externalState.ss.forEach((s: any) => {
          if (s.o === guestId) {
            const index = nextShips.findIndex(existing => existing.id === s.id);
            const updated = {
              id: s.id, name: s.n, type: s.t, owner: s.o, x: s.x, y: s.y,
              status: s.st, targetPlanetId: s.tp, currentPlanetId: s.cp,
              cargo: 0, maxCargo: 100, hp: 100, maxHp: 100
            };
            if (index !== -1) nextShips[index] = updated; else nextShips.push(updated);
          }
        });

        externalState.ps.forEach((pArr: any, i: number) => {
          if (pArr[0] === guestId) {
            nextPlanets[i].mines = pArr[1];
            nextPlanets[i].factories = pArr[2];
          }
        });

        readyPlayers.add(guestId);

        return {
          ...current,
          planets: nextPlanets,
          ships: nextShips,
          readyPlayers: Array.from(readyPlayers),
          logs: [`📡 RELAY: Received tactical orders from ${current.playerNames[guestId]}`, ...current.logs].slice(0, 15)
        };
      });
    } catch (e) {
      console.error("Ingest failed", e);
    }
  }, [gameState.seed, gameState.round]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      try {
        if (hash.startsWith('#join=')) {
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
        } else if (hash.startsWith('#moves=')) {
          const code = hash.substring(7);
          handleIngest(code);
        }
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        console.error("Link Processing Failed", e);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [handleIngest]);

  const claimCommand = (pId: Owner) => {
    if (pendingJoin) {
      const newState = { ...pendingJoin, activePlayer: pId };
      const myName = newState.playerNames[pId];
      newState.logs = [`✅ ${myName} Bridge Active.`, ...newState.logs];
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
    const shareUrlWithMoves = `${window.location.origin}${window.location.pathname}#moves=${data}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `Move Pack: Round ${gameState.round}`, 
          text: `Commander, my orders for Round ${gameState.round} are sealed. Tap the link to merge.`, 
          url: shareUrlWithMoves 
        });
      } catch (err) { 
        navigator.clipboard.writeText(shareUrlWithMoves);
        setCopyStatus("Link Copied! Send it to the Host.");
        setShowMoveQr(true); 
      }
    } else {
      navigator.clipboard.writeText(shareUrlWithMoves);
      setCopyStatus("Link Copied! Send it to the Host.");
      setShowMoveQr(true);
    }
  };

  const processGlobalTurn = async () => {
    setIsProcessing(true);
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Turn ${gameState.round} Results ---`];

    // AI Logic
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

    // Movement
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

    // Colonization
    nextPlanets.forEach(planet => {
      const shipsPresent = nextShips.filter(s => Math.abs(s.x - planet.x) < 5 && Math.abs(s.y - planet.y) < 5);
      if (shipsPresent.length > 0) {
        if (planet.owner === 'NEUTRAL') {
          const newOwner = shipsPresent[0].owner;
          planet.owner = newOwner;
          planet.population = 500;
          newLogs.push(`🚀 ${gameState.playerNames[newOwner]} colonized ${planet.name}!`);
        }
      }
    });

    // Economy
    nextPlanets.forEach(p => {
      if (p.owner !== 'NEUTRAL') {
        const income = (p.mines * 50) + (p.factories * 20) + 100;
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;
      }
    });

    const nextRoundState: GameState = {
      ...gameState,
      round: gameState.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      logs: [...newLogs, ...gameState.logs].slice(0, 15),
      readyPlayers: [] 
    };

    setGameState(nextRoundState);
    setIsProcessing(false);

    const data = getShareableData(nextRoundState);
    const syncUrl = `${window.location.origin}${window.location.pathname}#join=${data}`;
    setLastSyncUrl(syncUrl);
    setShowPostTurnSync(true);

    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `GALAXY UPDATE: Round ${nextRoundState.round}`, 
          text: `The combat results are in! Everyone tap this to update your map to Round ${nextRoundState.round}.`, 
          url: syncUrl 
        });
        setShowPostTurnSync(false);
      } catch (err) {
        navigator.clipboard.writeText(syncUrl);
        setCopyStatus("Sync Link Copied! Send it to the others.");
      }
    } else {
      navigator.clipboard.writeText(syncUrl);
      setCopyStatus("Sync Link Copied! Send it to the others.");
    }
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
    if (planet && gameState.playerCredits[gameState.activePlayer] >= cost) {
      const newShip: Ship = { 
        id: `s-${gameState.activePlayer}-${Date.now()}`, 
        name: `${gameState.playerNames[gameState.activePlayer]} ${type}`, 
        type, owner: gameState.activePlayer, x: planet.x, y: planet.y, 
        currentPlanetId: planet.id, cargo: 0, maxCargo: 100, hp: 100, maxHp: 100, status: 'ORBITING' 
      };
      setGameState(prev => ({
        ...prev,
        playerCredits: { ...prev.playerCredits, [prev.activePlayer]: prev.playerCredits[prev.activePlayer] - cost },
        ships: [...prev.ships, newShip],
        logs: [`🛠️ Shipyard at ${planet.name} launched a ${type}.`, ...prev.logs].slice(0, 15)
      }));
    }
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
  const homePlanetId = gameState.round === 1 && !selectedId ? gameState.planets.find(p => p.owner === gameState.activePlayer)?.id : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none">
      {/* PERSISTENT STATUS HEADER (FOR WIFE/EASE OF USE) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[50] w-full px-6 pointer-events-none">
         <div className="max-w-md mx-auto bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full py-2 px-4 flex items-center justify-between shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                 {gameState.activePlayer}: {gameState.playerCredits[gameState.activePlayer]} Credits
               </span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
              Round {gameState.round}
            </div>
         </div>
      </div>

      {/* PROCESSING OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
           <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(6,182,212,0.5)]" />
              <div className="text-center">
                 <h2 className="text-2xl font-bold italic text-white mb-2">PROCESSING TURN</h2>
                 <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest animate-pulse">Calculating Subspace Trajectories...</p>
              </div>
           </div>
        </div>
      )}

      {/* POST-TURN SYNC MODAL */}
      {showPostTurnSync && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl">
          <div className="max-w-md w-full glass-card rounded-[3rem] p-10 text-center border-emerald-500/30 shadow-[0_0_100px_rgba(16,185,129,0.1)]">
             <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🛰️</span>
             </div>
             <h2 className="text-3xl font-bold mb-2 italic">ROUND {gameState.round - 1} COMPLETE</h2>
             <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.3em] mb-8">Broadcast New Coordinates</p>
             <p className="text-sm text-slate-400 mb-8 leading-relaxed">Map updated! Send this to your players so their devices know what happened.</p>
             <div className="space-y-3">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(lastSyncUrl);
                    setCopyStatus("Copied! Paste in your chat.");
                  }}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
                >
                  {copyStatus || "📋 Copy & Send to Group"}
                </button>
                <button onClick={() => { setShowPostTurnSync(false); setCopyStatus(null); }} className="w-full py-3 text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-widest">
                  Close & View Map
                </button>
             </div>
          </div>
        </div>
      )}

      {pendingJoin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl">
          <div className="max-w-md w-full glass-card rounded-[3rem] p-10 text-center border-cyan-500/30 animate-in zoom-in-95 duration-500">
            <h2 className="text-3xl font-bold mb-2 italic">GALAXY DETECTED</h2>
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-8">Select Your Empire</p>
            <div className="grid grid-cols-1 gap-3">
              {Array.from({length: pendingJoin.playerCount}).map((_, i) => {
                const pId = `P${i+1}` as Owner;
                const isAi = pendingJoin.aiPlayers.includes(pId);
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
                          <span className="text-sm font-bold text-white truncate w-32">{pendingJoin.playerNames[pId]}</span>
                          <span className="text-[8px] font-bold uppercase tracking-widest">{isAi ? 'AI Pilot' : 'Open'}</span>
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

      {showMoveQr && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl" onClick={() => { setShowMoveQr(false); setCopyStatus(null); }}>
          <div className="max-w-md w-full glass-card rounded-[3rem] p-10 text-center border-cyan-500/30 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-bold mb-2 italic">SENDING MOVES</h2>
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-8">{copyStatus || "Ready to Transmit"}</p>
            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-3xl mb-8">
               <p className="text-sm text-slate-300 leading-relaxed">
                 {copyStatus ? "I've copied your orders to your clipboard. Just open your messages and paste them to the Host!" : "Tap the button below to share your orders."}
               </p>
            </div>
            <button onClick={() => setShowMoveQr(false)} className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/40">Got it!</button>
          </div>
        </div>
      )}

      <header className="h-20 flex items-center justify-between px-6 glass-card border-b-white/5 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsNewGameModalOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700" title="New Game">🛰️</button>
          <button onClick={() => setIsInviteModalOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/30" title="Invite">📢</button>
          <button onClick={() => setIsIngestModalOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/30" title="Manual Ingest">📡</button>
          <div className="flex flex-col hidden sm:flex">
            <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase leading-none mb-1">Stellar</span>
            <span className="text-xl font-bold tracking-tight italic leading-none">COMMANDER</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={processGlobalTurn} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1">
             {isProcessing ? '⚙️ Processing...' : '📡 Execute Turn'}
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} selectedId={selectedId} tutorialTargetId={homePlanetId} onSelect={(id, type) => { setSelectedId(id); setSelectedType(type); }} />
        {selectedPlanet && (
          <div className="absolute top-24 left-6 w-80 glass-card rounded-[2.5rem] p-6 shadow-2xl border-white/10 animate-in fade-in slide-in-from-left-4 duration-300">
             <div className="flex justify-between items-start mb-4">
                <div><h2 className="text-2xl font-bold">{selectedPlanet.name}</h2><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sector {selectedPlanet.id}</span></div>
                <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-white">✕</button>
             </div>
             {selectedPlanet.owner === gameState.activePlayer ? (
               <div className="space-y-6">
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Development</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => buildAction('MINE')} className="flex flex-col items-center justify-center p-3 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors"><span className="text-xl mb-1">🏗️</span><span className="text-[10px] font-bold uppercase">Mine</span></button>
                      <button onClick={() => buildAction('FACTORY')} className="flex flex-col items-center justify-center p-3 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors"><span className="text-xl mb-1">🏭</span><span className="text-[10px] font-bold uppercase">Factory</span></button>
                    </div>
                 </div>
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Shipyard</h4>
                    <div className="grid grid-cols-3 gap-2">
                       {['SCOUT', 'FREIGHTER', 'WARSHIP'].map(type => (
                         <button key={type} onClick={() => buildShip(type as ShipType)} className="p-2 bg-slate-900/80 rounded-xl border border-white/5 flex flex-col items-center gap-1 hover:border-cyan-500/50">
                           <span className="text-sm">{type === 'SCOUT' ? '🚀' : type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                           <span className="text-[7px] font-black">{type}</span>
                         </button>
                       ))}
                    </div>
                 </div>
               </div>
             ) : (
               <div className="bg-slate-900/50 p-4 rounded-2xl text-center border border-white/5">
                 <p className="text-xs text-slate-400 italic">Sector controlled by <br/><span className="font-bold text-white">{gameState.playerNames[selectedPlanet.owner] || selectedPlanet.owner}</span></p>
               </div>
             )}
             {selectedShip && selectedShip.owner === gameState.activePlayer && selectedShip.currentPlanetId !== selectedPlanet.id && (
                <button onClick={() => setDestination(selectedPlanet.id)} className="w-full mt-6 py-4 bg-cyan-600 rounded-2xl font-bold text-sm active:scale-95 transition-all">🚀 SEND FLEET HERE</button>
             )}
          </div>
        )}
        
        <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3">
           <div className="bg-slate-950/80 px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-cyan-400 mb-2 animate-pulse">
              {gameState.readyPlayers.length} / {gameState.playerCount - gameState.aiPlayers.length} Commanders Ready
           </div>
           <button 
             onClick={shareTurn} 
             className="bg-cyan-600 hover:bg-cyan-500 px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-cyan-900/40 transition-all active:scale-90 border-b-4 border-cyan-800 active:border-b-0 flex items-center gap-3"
           >
             📤 {gameState.activePlayer === 'P1' ? 'SYNC GALAXY' : 'SEND MOVES'}
           </button>
        </div>
      </main>

      <footer className="h-24 glass-card border-t-white/5 flex items-center justify-between px-6 md:px-10">
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {Array.from({length: gameState.playerCount}).map((_, i) => {
            const pId = `P${i+1}` as Owner;
            const isActive = gameState.activePlayer === pId;
            const isReady = gameState.readyPlayers.includes(pId);
            return (
              <button 
                key={i}
                onClick={() => setGameState(p => ({...p, activePlayer: pId}))}
                className={`w-12 h-12 rounded-2xl font-black text-sm transition-all border-2 flex items-center justify-center relative ${isActive ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'opacity-30 hover:opacity-100'}`}
                style={{ borderColor: PLAYER_COLORS[pId], backgroundColor: isActive ? `${PLAYER_COLORS[pId]}22` : 'transparent', color: PLAYER_COLORS[pId] }}
              >
                {pId}
                {isReady && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse shadow-lg" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsHelpOpen(true)} className="w-12 h-12 glass-card rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all"><span className="text-xl italic">?</span></button>
          <button onClick={() => setIsAdvisorOpen(true)} className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30 hover:scale-110 transition-transform active:rotate-12">❂</button>
        </div>
      </footer>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <NewGameModal isOpen={isNewGameModalOpen} onClose={() => setIsNewGameModalOpen(false)} onConfirm={(p, a, n) => { setGameState(generateInitialState(p, a, undefined, n)); setIsNewGameModalOpen(false); }} />
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} joinUrl={getShareableData(gameState)} />
      <IngestModal isOpen={isIngestModalOpen} onClose={() => setIsIngestModalOpen(false)} onIngest={handleIngest} readyPlayers={gameState.readyPlayers} />
    </div>
  );
};

export default App;
