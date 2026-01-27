
import React, { useState, useRef } from 'react';
import { Planet, Ship, ShipType } from '../types';
import { GRID_SIZE, PLAYER_COLORS } from '../gameLogic';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  tutorialTargetId?: string | null;
  onSelect: (id: string, type: 'PLANET' | 'SHIP') => void;
}

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, tutorialTargetId, onSelect }) => {
  // Use slightly zoomed out view for landscape mobile
  const [zoom, setZoom] = useState(0.55);
  const [offset, setOffset] = useState({ x: 20, y: 20 });
  
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const offsetAtStartRef = useRef({ x: 20, y: 20 });
  const hasMovedRef = useRef(false);

  const handleStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartPosRef.current = { x: clientX, y: clientY };
    offsetAtStartRef.current = { ...offset };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    
    const dx = clientX - dragStartPosRef.current.x;
    const dy = clientY - dragStartPosRef.current.y;
    
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
    }
    
    setOffset({
      x: offsetAtStartRef.current.x + dx,
      y: offsetAtStartRef.current.y + dy
    });
  };

  const handleEnd = () => {
    isDraggingRef.current = false;
  };

  const handleItemClick = (e: React.MouseEvent | React.TouchEvent, id: string, type: 'PLANET' | 'SHIP') => {
    if (!hasMovedRef.current) {
      e.stopPropagation();
      onSelect(id, type);
    }
  };

  const getShipVisualPosition = (ship: Ship) => {
    if (ship.status !== 'ORBITING' || !ship.currentPlanetId) {
      return { x: ship.x, y: ship.y };
    }

    const fleetAtPlanet = ships.filter(s => s.currentPlanetId === ship.currentPlanetId && s.status === 'ORBITING');
    const index = fleetAtPlanet.findIndex(s => s.id === ship.id);
    const total = fleetAtPlanet.length;
    
    const orbitRadius = 45; 
    const angle = (index * (360 / total)) * (Math.PI / 180);
    
    return {
      x: ship.x + Math.cos(angle) * orbitRadius,
      y: ship.y + Math.sin(angle) * orbitRadius
    };
  };

  const ShipIcon = ({ type, color, isSelected }: { type: ShipType, color: string, isSelected: boolean }) => {
    const size = isSelected ? 36 : 28;
    const glowColor = `${color}AA`;

    switch (type) {
      case 'SCOUT':
        return (
          <div className="relative flex items-center justify-center transition-all duration-300" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg" style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}>
              <path d="M12 2L4 22L12 18L20 22L12 2Z" fill={color} stroke="white" strokeWidth={isSelected ? 2 : 1} />
            </svg>
            <span className="absolute text-[10px] pointer-events-none mb-1">🚀</span>
          </div>
        );
      case 'FREIGHTER':
        return (
          <div className="relative flex items-center justify-center transition-all duration-300" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg" style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}>
              <path d="M4 6L12 2L20 6V18L12 22L4 18V6Z" fill={color} stroke="white" strokeWidth={isSelected ? 2 : 1} />
            </svg>
            <span className="absolute text-[12px] pointer-events-none">📦</span>
          </div>
        );
      case 'WARSHIP':
        return (
          <div className="relative flex items-center justify-center transition-all duration-300" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg" style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}>
              <path d="M12 2L2 22L12 16L22 22L12 2ZM12 6L18 18L12 14L6 18L12 6Z" fill={color} stroke="white" strokeWidth={isSelected ? 2 : 1} />
            </svg>
            <span className="absolute text-[12px] pointer-events-none mb-2">⚔️</span>
          </div>
        );
      default:
        return <div className="w-4 h-4 rounded-full bg-white" />;
    }
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing touch-none select-none"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (touch) handleStart(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        if (touch) handleMove(touch.clientX, touch.clientY);
      }}
      onTouchEnd={handleEnd}
    >
      <div 
        className="absolute will-change-transform transition-transform duration-75 ease-out"
        style={{ 
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          width: `${GRID_SIZE}px`,
          height: `${GRID_SIZE}px`,
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '100px 100px'
        }} />

        {planets.map(planet => (
          <div
            key={planet.id}
            onMouseDown={(e) => e.stopPropagation()} 
            onClick={(e) => handleItemClick(e, planet.id, 'PLANET')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group z-10"
            style={{ left: planet.x, top: planet.y }}
          >
            {selectedId === planet.id && (
              <div className="absolute inset-0 w-[100px] h-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 border-dashed animate-[spin_20s_linear_infinite]" 
                   style={{ left: '50%', top: '50%' }} />
            )}

            {tutorialTargetId === planet.id && (
              <div className="absolute inset-0 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-cyan-500 animate-ping opacity-30 pointer-events-none" 
                   style={{ left: '50%', top: '50%' }} />
            )}

            <div 
              className={`w-12 h-12 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'ring-4 ring-white scale-125' : 'scale-100 group-hover:scale-110'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[planet.owner],
                borderColor: planet.owner !== 'NEUTRAL' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                boxShadow: `0 0 40px ${PLAYER_COLORS[planet.owner]}55`
              }}
            />
            <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-2 py-0.5 rounded bg-black/40">
              {planet.name}
            </span>
          </div>
        ))}

        {ships.map(ship => {
          const visualPos = getShipVisualPosition(ship);
          const isSelected = selectedId === ship.id;
          return (
            <div
              key={ship.id}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleItemClick(e, ship.id, 'SHIP')}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500 z-20 ${isSelected ? 'z-30' : ''}`}
              style={{ left: visualPos.x, top: visualPos.y }}
            >
              <ShipIcon type={ship.type} color={PLAYER_COLORS[ship.owner]} isSelected={isSelected} />
              
              {isSelected && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 px-4 py-2 rounded-2xl text-[10px] font-bold text-white border border-white/20 shadow-2xl backdrop-blur-xl">
                   <div className="flex flex-col items-center">
                      <span className="uppercase tracking-[0.2em] opacity-60 text-[7px] mb-0.5">{ship.type}</span>
                      <span>{ship.name}</span>
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Zoom Controls relocated to bottom-left to avoid Admiral Jarvis overlap */}
      <div className="absolute bottom-20 left-6 flex flex-col gap-3 z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.15)); }} 
          className="glass-card w-10 h-10 rounded-xl text-white font-bold text-lg flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all border border-white/10"
        >
          +
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.1, z - 0.15)); }} 
          className="glass-card w-10 h-10 rounded-xl text-white font-bold text-lg flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all border border-white/10"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default MapView;
