
import React, { useState, useEffect } from 'react';
import { GameState } from './types';
import { generateInitialState, SHIP_SPEEDS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import LandingPage from './components/LandingPage';

const App: React.FC = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [gameState, setGameState] = useState<GameState>(generateInitialState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleSelect = (id: string, type: 'PLANET' | 'SHIP') => {
    setSelectedId(id);
    setSelectedType(type);
  };

  const processTurn = () => {
    setGameState(prev => {
      const nextPlanets = [...prev.planets];
      const nextShips = [...prev.ships];
      const newLogs = [`Day ${prev.round} over!`];
      let newGold = prev.gold;

      // 1. Economic phase
      nextPlanets.forEach(p => {
        if (p.owner === 'PLAYER') {
          const income = (p.goldIncome * 50) + (p.supplies * 20);
          newGold += income;
        }
      });

      // 2. Movement phase
      nextShips.forEach(s => {
        if (s.status === 'MOVING' && s.targetPlanetId) {
          const target = nextPlanets.find(p => p.id === s.targetPlanetId);
          if (target) {
            const dx = target.x - s.x;
            const dy = target.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speed = SHIP_SPEEDS[s.type];

            if (dist < speed) {
              s.x = target.x;
              s.y = target.y;
              s.status = 'ORBITING';
              s.currentPlanetId = target.id;
              if (s.owner === 'PLAYER') {
                newLogs.push(`${s.name} arrived at ${target.name}!`);
                if (target.owner === 'NEUTRAL') {
                  target.owner = 'PLAYER';
                  newLogs.push(`We claimed ${target.name}! 🎉`);
                }
              }
            } else {
              s.x += (dx / dist) * speed;
              s.y += (dy / dist) * speed;
            }
          }
        }
      });

      return {
        ...prev,
        round: prev.round + 1,
        planets: nextPlanets,
        ships: nextShips,
        gold: newGold,
        logs: [...prev.logs, ...newLogs].slice(-10)
      };
    });
  };

  const selectedPlanet = selectedType === 'PLANET' ? gameState.planets.find(p => p.id === selectedId) : null;
  const selectedShip = selectedType === 'SHIP' ? gameState.ships.find(s => s.id === selectedId) : null;

  const orderMovement = (planetId: string) => {
    if (selectedShip && selectedShip.owner === 'PLAYER') {
      setGameState(prev => ({
        ...prev,
        ships: prev.ships.map(s => s.id === selectedShip.id ? {
          ...s,
          status: 'MOVING',
          targetPlanetId: planetId,
          currentPlanetId: undefined
        } : s)
      }));
      setSelectedId(null);
      setSelectedType(null);
    }
  };

  const upgradeWorld = (type: 'GOLD' | 'SUPPLY') => {
    if (selectedPlanet && selectedPlanet.owner === 'PLAYER' && gameState.gold >= 100) {
      setGameState(prev => ({
        ...prev,
        gold: prev.gold - 100,
        planets: prev.planets.map(p => p.id === selectedPlanet.id ? {
          ...p,
          goldIncome: type === 'GOLD' ? p.goldIncome + 1 : p.goldIncome,
          supplies: type === 'SUPPLY' ? p.supplies + 1 : p.supplies
        } : p)
      }));
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {!isStarted && <LandingPage onStart={() => setIsStarted(true)} />}

      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 glass-card border-b-0 z-10">
        <div className="flex items-center gap-4">
          <div className="text-cyan-400 font-black tracking-tighter text-xl italic">STELLAR CMD</div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Day</span>
            <span className="text-lg font-bold leading-none">{gameState.round}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase font-bold">My Gold</span>
            <span className="text-lg font-bold text-amber-400 leading-none">💰 {gameState.gold.toLocaleString()}</span>
          </div>
          <button 
            onClick={processTurn}
            className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition-all text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-cyan-900/20 uppercase text-xs tracking-widest"
          >
            Next Day
          </button>
        </div>
      </header>

      {/* Main Map View */}
      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets}
          ships={gameState.ships}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        {/* Selected Planet Overlay */}
        {selectedPlanet && (
          <div className="absolute top-6 left-6 w-72 glass-card rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
             <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedPlanet.name}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${selectedPlanet.owner === 'PLAYER' ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                  {selectedPlanet.owner === 'PLAYER' ? 'My World' : 'Empty Space'}
                </span>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            
            {selectedPlanet.owner === 'PLAYER' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                   <div className="flex-1 bg-slate-900/50 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Mines</p>
                    <p className="text-xl font-bold">⛏️ {selectedPlanet.goldIncome}</p>
                  </div>
                  <div className="flex-1 bg-slate-900/50 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Supplies</p>
                    <p className="text-xl font-bold">📦 {selectedPlanet.supplies}</p>
                  </div>
                </div>
                <button 
                  onClick={() => upgradeWorld('GOLD')}
                  className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl text-sm font-bold transition-all border border-white/5 flex justify-between px-4 items-center"
                >
                  <span>Build Gold Mine</span>
                  <span className="text-amber-400">💰 100</span>
                </button>
                <button 
                  onClick={() => upgradeWorld('SUPPLY')}
                  className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl text-sm font-bold transition-all border border-white/5 flex justify-between px-4 items-center"
                >
                  <span>Add Supplies</span>
                  <span className="text-amber-400">💰 100</span>
                </button>
              </div>
            )}

            {selectedShip && selectedShip.owner === 'PLAYER' && selectedShip.currentPlanetId !== selectedPlanet.id && (
              <button 
                onClick={() => orderMovement(selectedPlanet.id)}
                className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 py-4 rounded-2xl font-bold text-base shadow-xl shadow-cyan-500/20"
              >
                Go Here 🚀
              </button>
            )}
          </div>
        )}

        {/* Selected Ship Overlay */}
        {selectedShip && selectedType === 'SHIP' && (
          <div className="absolute top-6 left-6 w-72 glass-card rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedShip.name}</h2>
                <span className="text-[10px] px-3 py-1 rounded-full bg-amber-500 text-black uppercase font-bold">
                  {selectedShip.type === 'SCOUT' ? 'Explorer Ship' : 'Cargo Ship'}
                </span>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Current Task</p>
                <p className="text-base font-bold flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${selectedShip.status === 'MOVING' ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                  {selectedShip.status === 'MOVING' ? 'Traveling...' : 'Waiting for Orders'}
                </p>
              </div>
            </div>

            <p className="mt-6 text-[11px] text-cyan-400 font-bold text-center italic bg-cyan-500/10 py-2 rounded-xl">
              Tap a star on the map to set a new goal!
            </p>
          </div>
        )}

        {/* Logs */}
        <div className="absolute bottom-6 left-6 w-80 h-32 glass-card rounded-3xl p-4 opacity-90 flex flex-col pointer-events-none">
          <div className="text-[10px] text-cyan-400 font-bold uppercase mb-2 tracking-widest">Notifications</div>
          <div className="flex-1 overflow-y-auto space-y-2 text-[12px]">
            {gameState.logs.map((log, i) => (
              <div key={i} className="text-slate-300 flex gap-2">
                <span className="text-cyan-500">•</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Simplified Navigation */}
      <nav className="h-24 glass-card border-t border-white/10 flex items-center justify-center px-4 gap-4 md:gap-12 z-20">
        <NavButton active={true} onClick={() => {}} icon="🔭" label="View Galaxy" />
        <NavButton active={false} onClick={() => setIsHelpOpen(true)} icon="📖" label="How to Play" />
        <div className="h-12 w-px bg-white/10 mx-2" />
        <button 
          onClick={() => setIsAdvisorOpen(!isAdvisorOpen)}
          className={`flex flex-col items-center justify-center min-w-[80px] h-16 transition-all rounded-2xl p-2 ${isAdvisorOpen ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <span className="text-2xl mb-1">🤖</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Ask Jarvis</span>
        </button>
      </nav>

      {/* Overlays */}
      <AdvisorPanel gameState={gameState} isOpen={isAdvisorOpen} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center min-w-[80px] h-16 rounded-2xl transition-all ${active ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'}`}
  >
    <span className="text-2xl mb-0.5">{icon}</span>
    <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
  </button>
);

export default App;
