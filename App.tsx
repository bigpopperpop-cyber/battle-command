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
  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(8, 2));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHostDashboardOpen, setIsHostDashboardOpen] = useState(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Auto-load galaxy if joined via link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#join=')) {
      try {
        const dataStr = hash.substring(6);
        const incomingState: GameState = JSON.parse(atob(dataStr));
        incomingState.logs = [`🌌 Successfully joined Galaxy. Command initialized for Round ${incomingState.round}.`, ...incomingState.logs].slice(0, 15);
        setGameState(incomingState);
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        console.error("Failed to join via link", e);
      }
    }
  }, []);

  const shareTurn = async () => {
    const data = btoa(JSON.stringify(gameState));
    const shareText = `COMMAND_DATA:${data}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `Stellar Commander - ${gameState.activePlayer} Orders`, 
          text: `Here are my moves for Round ${gameState.round}!\n\n${shareText}` 
        });
      } catch (err) {
        copyToClipboard(shareText, "Orders copied! Send the message to your Host.");
      }
    } else {
      copyToClipboard(shareText, "Orders copied! Send the message to your Host.");
    }
  };

  const inviteAllies = () => {
    const data = btoa(JSON.stringify(gameState));
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
    
    // Deep copies for immutability
    let nextPlanets = gameState.planets.map(p => ({...p}));
    let nextShips = gameState.ships.map(s => ({...s}));
    let nextCredits = { ...gameState.playerCredits };
    const newLogs: string[] = [`--- Turn ${gameState.round} Results ---`];

    // 1. Generate AI Moves
    for (const aiId of gameState.aiPlayers) {
      try {
        const moves = await getAiMoves(gameState, aiId);
        
        if (moves.shipOrders) {
          moves.shipOrders.forEach((order: any) => {
            const ship = nextShips.find(s => s.id === order.shipId);
            if (ship) {
              ship.status = 'MOVING';
              ship.targetPlanetId = order.targetPlanetId;
              ship.currentPlanetId = undefined;
            }
          });
        }

        if (moves.planetOrders) {
          moves.planetOrders.forEach((order: any) => {
            const planet = nextPlanets.find(p => p.id === order.planetId);
            const cost = 100;
            if (planet && nextCredits[aiId] >= cost) {
              nextCredits[aiId] -= cost;
              if (order.build === 'MINE') planet.mines++;
              else if (order.build === 'FACTORY') planet.factories++;
            }
          });
        }
      } catch (e) {
        console.error(`AI ${aiId} failed:`, e);
      }
    }

    // 2. Movement Phase
    nextShips.forEach(s => {
      if (s.status === 'MOVING' && s.targetPlanetId) {
        const target = nextPlanets.find(p => p.id === s.targetPlanetId);
        if (target) {
          const dx = target.x - s.x;
          const dy = target.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = SHIP_SPEEDS[s.type as keyof typeof SHIP_SPEEDS] || 100;

          if (dist <= speed) {
            s.x = target.x;
            s.y = target.y;
            s.status = 'ORBITING';
            s.currentPlanetId = target.id;
          } else {
            s.x += (dx / dist) * speed;
            s.y += (dy / dist) * speed;
          }
        }
      }
    });

    // 3. Colonization & Presence Pass
    // Check every planet to see if a ship is present and claim neutral ones
    nextPlanets.forEach(planet => {
      const shipsPresent = nextShips.filter(s => 
        Math.abs(s.x - planet.x) < 5 && Math.abs(s.y - planet.y) < 5
      );

      if (shipsPresent.length > 0) {
        // If neutral, first ship's owner claims it
        if (planet.owner === 'NEUTRAL') {
          const newOwner = shipsPresent[0].owner;
          planet.owner = newOwner;
          planet.population = 500; // Colonization starting pop
          newLogs.push(`🚀 ${newOwner} has colonized ${planet.name}!`);
        }
        
        // Update all ships at this location to be orbiting this planet
        shipsPresent.forEach(s => {
          s.currentPlanetId = planet.id;
        });
      }
    });

    // 4. Economy Phase (Income generation)
    nextPlanets.forEach(p => {
      if (p.owner !== 'NEUTRAL') {
        const income = (p.mines * 50) + (p.factories * 20) + 100;
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;
      }
    });

    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      planets: nextPlanets,
      ships: nextShips,
      playerCredits: nextCredits,
      logs: [...newLogs, ...prev.logs].slice(0, 15),
      readyPlayers: [] 
    }));
    
    setIsProcessing(false);
    setIsHostDashboardOpen(false);
  };

  const handleStartNewGame = (count: number, aiCount: number) => {
    setGameState(generateInitialState(count, aiCount));
    setIsNewGameModalOpen(false);
    setIsHostDashboardOpen(false);
    setSelectedId(null);
  };

  const buildAction = (type: 'MINE' | 'FACTORY') => {
    const planet = gameState.planets.find(p => p.id === selectedId);
    const cost = 100;
    if (planet && gameState.playerCredits[gameState.activePlayer] >= cost) {
      setGameState(prev => ({
        ...prev,
        playerCredits: { ...prev.playerCredits, [prev.activePlayer]: prev.playerCredits[prev.activePlayer] - cost },
        planets: prev.planets.map(p => p.id === planet.id ? {
          ...p,
          mines: type === 'MINE' ? p.mines + 1 : p.mines,
          factories: type === 'FACTORY' ? p.factories + 1 : p.factories
        } : p)
      }));
    }
  };

  const buildShip = (type: ShipType) => {
    const planet = gameState.planets.find(p => p.id === selectedId);
    const cost = SHIP_COSTS[type];
    if (planet && gameState.playerCredits[gameState.activePlayer] >= cost) {
      const newShip: Ship = {
        id: `s-${gameState.activePlayer}-${Date.now()}`,
        name: `${gameState.activePlayer} ${type} ${gameState.ships.length + 1}`,
        type,
        owner: gameState.activePlayer,
        x: planet.x,
        y: planet.y,
        currentPlanetId: planet.id,
        cargo: 0,
        maxCargo: type === 'FREIGHTER' ? 500 : (type === 'SCOUT' ? 50 : 20),
        hp: type === 'WARSHIP' ? 300 : (type === 'SCOUT' ? 100 : 50),
        maxHp: type === 'WARSHIP' ? 300 : (type === 'SCOUT' ? 100 : 50),
        status: 'ORBITING'
      };

      setGameState(prev => ({
        ...prev,
        playerCredits: { ...prev.playerCredits, [prev.activePlayer]: prev.playerCredits[prev.activePlayer] - cost },
        ships: [...prev.ships, newShip],
        logs: [`🛠️ Orbital Shipyard at ${planet.name} has launched a new ${type}.`, ...prev.logs].slice(0, 15)
      }));
    } else {
      alert("Insufficient credits for this ship class.");
    }
  };

  const setDestination = (planetId: string) => {
    setGameState(prev => ({
      ...prev,
      ships: prev.ships.map(s => s.id === selectedId ? {
        ...s,
        status: 'MOVING',
        targetPlanetId: planetId,
        currentPlanetId: undefined
      } : s)
    }));
    setSelectedId(null);
  };

  const selectedPlanet = selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null;
  const selectedShip = selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null;

  const currentCredits = gameState.playerCredits[gameState.activePlayer] || 0;

  const humanPlayers = Array.from({length: gameState.playerCount})
    .map((_, i) => `P${i+1}` as Owner)
    .filter(p => !gameState.aiPlayers.includes(p));
  
  const humanReadyCount = gameState.readyPlayers.filter(p => humanPlayers.includes(p)).length;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050b1a] text-slate-100 overflow-hidden select-none">
      <header className="h-20 flex items-center justify-between px-6 glass-card border-b-white/5 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsNewGameModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Start New Mission"
          >
            🛰️
          </button>
          <button 
            onClick={inviteAllies}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-cyan-500/30"
            title="Recruit Allies (Link/QR)"
          >
            📢
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase leading-none mb-1">Stellar</span>
            <span className="text-xl font-bold tracking-tight italic leading-none">COMMANDER</span>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-4">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Round {gameState.round}</div>
             <div className={`px-4 py-1 rounded-full text-[10px] font-bold border-2 flex items-center gap-2 transition-all`} 
                  style={{ borderColor: PLAYER_COLORS[gameState.activePlayer], color: PLAYER_COLORS[gameState.activePlayer], boxShadow: `0 0 15px ${PLAYER_COLORS[gameState.activePlayer]}44` }}>
               {gameState.activePlayer} {gameState.aiPlayers.includes(gameState.activePlayer) && '🤖'}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bank</div>
            <div className="text-xl font-bold text-amber-400">¤{currentCredits.toLocaleString()}</div>
          </div>
          <button 
            onClick={processGlobalTurn}
            disabled={isProcessing}
            className="bg-cyan-600 hover:bg-cyan-500 px-6 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/40 disabled:opacity-50"
          >
             {isProcessing ? '⚙️ Processing...' : '📡 Execute Orders'}
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets}
          ships={gameState.ships}
          selectedId={selectedId}
          onSelect={(id, type) => { setSelectedId(id); setSelectedType(type); }}
        />

        {selectedPlanet && (
          <div className="absolute top-6 left-6 w-80 glass-card rounded-[2rem] p-6 shadow-2xl border-white/10 animate-in fade-in slide-in-from-left-4 duration-300 max-h-[calc(100%-3rem)] overflow-y-auto">
             <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedPlanet.name}</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sector {selectedPlanet.id}</span>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-white">✕</button>
             </div>

             {selectedPlanet.owner === gameState.activePlayer ? (
               <div className="space-y-6">
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Planetary Development</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => buildAction('MINE')} 
                        disabled={currentCredits < 100}
                        className="flex flex-col items-center justify-center p-3 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"
                      >
                        <span className="text-xl mb-1">🏗️</span>
                        <span className="text-[10px] font-bold uppercase">Mine</span>
                        <span className="text-[10px] text-amber-400">¤100</span>
                      </button>
                      <button 
                        onClick={() => buildAction('FACTORY')} 
                        disabled={currentCredits < 100}
                        className="flex flex-col items-center justify-center p-3 bg-slate-900/50 rounded-2xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"
                      >
                        <span className="text-xl mb-1">🏭</span>
                        <span className="text-[10px] font-bold uppercase">Factory</span>
                        <span className="text-[10px] text-amber-400">¤100</span>
                      </button>
                    </div>
                 </div>

                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Orbital Shipyard</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => buildShip('SCOUT')} 
                        disabled={currentCredits < SHIP_COSTS.SCOUT}
                        className="flex flex-col items-center justify-center p-2 bg-slate-900/50 rounded-xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"
                      >
                        <span className="text-lg mb-1">🚀</span>
                        <span className="text-[8px] font-bold uppercase">Scout</span>
                        <span className="text-[8px] text-amber-400">¤200</span>
                      </button>
                      <button 
                        onClick={() => buildShip('FREIGHTER')} 
                        disabled={currentCredits < SHIP_COSTS.FREIGHTER}
                        className="flex flex-col items-center justify-center p-2 bg-slate-900/50 rounded-xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"
                      >
                        <span className="text-lg mb-1">📦</span>
                        <span className="text-[8px] font-bold uppercase">Freight</span>
                        <span className="text-[8px] text-amber-400">¤400</span>
                      </button>
                      <button 
                        onClick={() => buildShip('WARSHIP')} 
                        disabled={currentCredits < SHIP_COSTS.WARSHIP}
                        className="flex flex-col items-center justify-center p-2 bg-slate-900/50 rounded-xl hover:bg-white/5 border border-white/5 transition-colors disabled:opacity-30"
                      >
                        <span className="text-lg mb-1">⚔️</span>
                        <span className="text-[8px] font-bold uppercase">Warship</span>
                        <span className="text-[8px] text-amber-400">¤800</span>
                      </button>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="bg-slate-900/50 p-4 rounded-2xl mb-6 text-center border border-white/5">
                  <p className="text-xs text-slate-400 italic">This sector is controlled by {selectedPlanet.owner}.</p>
               </div>
             )}

             {selectedShip && selectedShip.owner === gameState.activePlayer && selectedShip.currentPlanetId !== selectedPlanet.id && (
                <button onClick={() => setDestination(selectedPlanet.id)} className="w-full mt-6 py-4 bg-cyan-600 rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/30 active:scale-95 transition-all">
                  🚀 SEND FLEET HERE
                </button>
             )}
          </div>
        )}

        <div className="absolute bottom-6 left-6 w-80 glass-card rounded-2xl p-4 bg-[#050b1a]/80 hidden md:block">
          <h4 className="text-[10px] font-bold uppercase text-cyan-400 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Subspace Feed
          </h4>
          <div className="h-24 overflow-y-auto space-y-2 pr-2 text-xs text-slate-300">
            {gameState.logs.map((log, i) => <div key={i} className="pb-2 border-b border-white/5 last:border-0">{log}</div>)}
          </div>
        </div>

        <div className="absolute bottom-6 right-6 flex items-center gap-3">
           <button 
             onClick={shareTurn} 
             disabled={gameState.aiPlayers.includes(gameState.activePlayer)}
             className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 px-6 py-4 rounded-3xl font-bold text-sm shadow-xl shadow-cyan-900/40 transition-all active:scale-95 flex items-center gap-2"
           >
             📤 Send Moves
           </button>
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
                className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl font-black text-[10px] md:text-sm transition-all border-2 flex items-center justify-center relative ${isActive ? 'scale-110 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'opacity-30 hover:opacity-100'}`}
                style={{ 
                  borderColor: PLAYER_COLORS[pId],
                  backgroundColor: isActive ? `${PLAYER_COLORS[pId]}22` : 'transparent',
                  color: PLAYER_COLORS[pId],
                  boxShadow: isActive ? `0 0 15px ${PLAYER_COLORS[pId]}33` : 'none'
                }}
              >
                P{i+1}
                {isAi && <span className="absolute -top-1 -right-1 text-[8px]">🤖</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="w-10 h-10 md:w-12 md:h-12 glass-card rounded-2xl flex items-center justify-center text-slate-400 hover:text-white"
          >
            ？
          </button>
          <button 
            onClick={() => setIsAdvisorOpen(true)}
            className="w-14 h-14 md:w-16 md:h-16 bg-cyan-500 rounded-full flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30 hover:scale-110 transition-transform active:rotate-12"
          >
            ❂
          </button>
        </div>
      </footer>

      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <NewGameModal 
        isOpen={isNewGameModalOpen} 
        onClose={() => setIsNewGameModalOpen(false)} 
        onConfirm={handleStartNewGame} 
      />
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        joinUrl={shareUrl}
      />
    </div>
  );
};

export default App;