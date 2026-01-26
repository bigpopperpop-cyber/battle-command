
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Planet, Ship, ShipType } from './types';
import { generateInitialState, SHIP_SPEEDS, SHIP_COSTS } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(generateInitialState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [view, setView] = useState<'MAP' | 'FLEET' | 'EMPIRE'>('MAP');
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Auto-save logic (local state only)
  useEffect(() => {
    const saved = localStorage.getItem('stellar_commander_save');
    if (saved) {
      // For demo, we start fresh, but could load here
    }
  }, []);

  const handleSelect = (id: string, type: 'PLANET' | 'SHIP') => {
    setSelectedId(id);
    setSelectedType(type);
  };

  const processTurn = () => {
    setGameState(prev => {
      const nextPlanets = [...prev.planets];
      const nextShips = [...prev.ships];
      const newLogs = [`Turn ${prev.round} Completed.`];
      let newCredits = prev.credits;

      // 1. Economic phase
      nextPlanets.forEach(p => {
        if (p.owner === 'PLAYER') {
          const income = (p.mines * 50) + (p.factories * 20);
          newCredits += income;
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
                newLogs.push(`${s.name} arrived at ${target.name}.`);
                if (target.owner === 'NEUTRAL') {
                  target.owner = 'PLAYER';
                  newLogs.push(`We have claimed ${target.name}!`);
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
        credits: newCredits,
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

  const buildStructure = (type: 'MINE' | 'FACTORY') => {
    if (selectedPlanet && selectedPlanet.owner === 'PLAYER' && gameState.credits >= 100) {
      setGameState(prev => ({
        ...prev,
        credits: prev.credits - 100,
        planets: prev.planets.map(p => p.id === selectedPlanet.id ? {
          ...p,
          mines: type === 'MINE' ? p.mines + 1 : p.mines,
          factories: type === 'FACTORY' ? p.factories + 1 : p.factories
        } : p)
      }));
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 glass-card border-b-0 z-10">
        <div className="flex items-center gap-4">
          <div className="text-cyan-400 font-black tracking-tighter text-xl italic">STELLAR CMD</div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Round</span>
            <span className="text-lg font-bold leading-none">{gameState.round}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-all border border-white/5"
            title="Help & Instructions"
          >
            <span className="text-xl font-bold">?</span>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Credits</span>
            <span className="text-lg font-bold text-amber-400 leading-none">¤ {gameState.credits.toLocaleString()}</span>
          </div>
          <button 
            onClick={processTurn}
            className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition-all text-white px-4 md:px-6 py-2 rounded-lg font-bold shadow-lg shadow-cyan-900/20 uppercase text-[10px] md:text-xs tracking-widest"
          >
            End Turn
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

        {/* Selected Overlay */}
        {selectedPlanet && (
          <div className="absolute top-6 left-6 w-72 glass-card rounded-2xl p-5 shadow-2xl animate-in slide-in-from-left duration-300">
             <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedPlanet.name}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${selectedPlanet.owner === 'PLAYER' ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                  {selectedPlanet.owner} Territory
                </span>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-900/50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase">Mines</p>
                <p className="text-lg font-bold">{selectedPlanet.mines}</p>
              </div>
              <div className="bg-slate-900/50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase">Factories</p>
                <p className="text-lg font-bold">{selectedPlanet.factories}</p>
              </div>
            </div>

            {selectedPlanet.owner === 'PLAYER' && (
              <div className="space-y-2">
                <button 
                  onClick={() => buildStructure('MINE')}
                  className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-sm font-medium transition-colors border border-white/5 flex justify-between px-4"
                >
                  <span>Build Mine</span>
                  <span className="text-amber-400">¤ 100</span>
                </button>
                <button 
                  onClick={() => buildStructure('FACTORY')}
                  className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-sm font-medium transition-colors border border-white/5 flex justify-between px-4"
                >
                  <span>Build Factory</span>
                  <span className="text-amber-400">¤ 100</span>
                </button>
              </div>
            )}

            {selectedShip && selectedShip.owner === 'PLAYER' && selectedShip.currentPlanetId !== selectedPlanet.id && (
              <button 
                onClick={() => orderMovement(selectedPlanet.id)}
                className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg font-bold text-sm"
              >
                Set Destination
              </button>
            )}
          </div>
        )}

        {selectedShip && selectedType === 'SHIP' && (
          <div className="absolute top-6 left-6 w-72 glass-card rounded-2xl p-5 shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedShip.name}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-black uppercase font-bold">
                  {selectedShip.type} CLASS
                </span>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 uppercase mb-1">
                  <span>Structural Integrity</span>
                  <span>{selectedShip.hp}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${(selectedShip.hp / selectedShip.maxHp) * 100}%` }} />
                </div>
              </div>

              <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase">Status</p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedShip.status === 'MOVING' ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                  {selectedShip.status === 'MOVING' ? 'In Hyperspace' : 'Holding Position'}
                </p>
              </div>
            </div>

            <p className="mt-6 text-[10px] text-slate-500 uppercase font-bold text-center">
              Select a planet on the map to set course
            </p>
          </div>
        )}

        {/* Console / Log (Bottom Left) */}
        <div className="absolute bottom-6 left-6 w-80 h-32 glass-card rounded-2xl p-3 opacity-80 hover:opacity-100 transition-opacity flex flex-col">
          <div className="text-[10px] text-cyan-400 font-bold uppercase mb-2">Comms Channel</div>
          <div className="flex-1 overflow-y-auto space-y-1 text-[11px]">
            {gameState.logs.map((log, i) => (
              <div key={i} className="text-slate-300 border-l border-cyan-500/30 pl-2">{log}</div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Nav Bar */}
      <nav className="h-20 glass-card border-t border-white/10 flex items-center justify-center px-4 gap-2 md:gap-8 z-20">
        <NavButton active={view === 'MAP'} onClick={() => setView('MAP')} icon="⊕" label="Tactical Map" />
        <NavButton active={view === 'FLEET'} onClick={() => setView('FLEET')} icon="▲" label="Fleet" />
        <NavButton active={view === 'EMPIRE'} onClick={() => setView('EMPIRE')} icon="⬡" label="Planets" />
        <div className="h-10 w-px bg-white/10 mx-2" />
        <button 
          onClick={() => setIsAdvisorOpen(!isAdvisorOpen)}
          className={`flex flex-col items-center justify-center min-w-[64px] transition-all rounded-xl p-2 ${isAdvisorOpen ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
        >
          <span className="text-xl mb-1">❂</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Jarvis AI</span>
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
    className={`flex flex-col items-center justify-center min-w-[72px] h-14 rounded-xl transition-all ${active ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
  >
    <span className="text-xl mb-0.5">{icon}</span>
    <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
  </button>
);

export default App;
