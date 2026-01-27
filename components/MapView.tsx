
import React, { useState, useRef, useEffect } from 'react';
import { Planet, Ship, ShipType } from '../types';
import { GRID_SIZE, PLAYER_COLORS } from '../gameLogic';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string, type: 'PLANET' | 'SHIP') => void;
}

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, onSelect }) => {
  const [zoom, setZoom] = useState(0.55);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const offsetAtStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  useEffect(() => {
    // Center on P1's home planet or first neutral
    const centerPlanet = planets.find(p => p.owner === 'P1') || planets[0];
    if (centerPlanet) {
       setOffset({ 
         x: window.innerWidth/2 - centerPlanet.x * zoom, 
         y: window.innerHeight/2 - centerPlanet.y * zoom 
       });
    }
  }, []);

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
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) hasMovedRef.current = true;
    setOffset({ x: offsetAtStartRef.current.x + dx, y: offsetAtStartRef.current.y + dy });
  };

  const handleEnd = () => { isDraggingRef.current = false; };

  const handleItemClick = (e: React.MouseEvent | React.TouchEvent, id: string, type: 'PLANET' | 'SHIP') => {
    if (!hasMovedRef.current) {
      e.stopPropagation();
      onSelect(id, type);
    }
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing touch-none select-none"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => e.touches[0] && handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => e.touches[0] && handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
    >
      <div 
        className="absolute will-change-transform"
        style={{ 
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          width: `${GRID_SIZE}px`,
          height: `${GRID_SIZE}px`,
        }}
      >
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '200px 200px'
        }} />

        {planets.map(planet => (
          <div
            key={planet.id}
            onClick={(e) => handleItemClick(e, planet.id, 'PLANET')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group z-10"
            style={{ left: planet.x, top: planet.y }}
          >
            {selectedId === planet.id && (
               <div className="absolute inset-0 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-500 border-dashed animate-[spin_25s_linear_infinite]" 
                    style={{ left: '50%', top: '50%' }} />
            )}
            <div 
              className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'scale-125 border-white shadow-[0_0_50px_rgba(255,255,255,0.4)]' : 'scale-100 opacity-90'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[planet.owner],
                borderColor: planet.owner !== 'NEUTRAL' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)',
                boxShadow: `0 0 45px ${PLAYER_COLORS[planet.owner]}55`
              }}
            />
            <span className="mt-4 text-[7px] font-black uppercase tracking-[0.2em] text-white/50 bg-black/50 px-3 py-1 rounded-full border border-white/5 whitespace-nowrap">
              {planet.name}
            </span>
          </div>
        ))}

        {ships.map(ship => (
          <div
            key={ship.id}
            onClick={(e) => handleItemClick(e, ship.id, 'SHIP')}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-20 ${selectedId === ship.id ? 'scale-150 z-30' : 'opacity-90'}`}
            style={{ left: ship.x, top: ship.y }}
          >
             <div className="relative flex flex-col items-center">
                <div 
                   className="w-7 h-7 flex items-center justify-center rounded-xl border border-white/20 shadow-xl" 
                   style={{ 
                      backgroundColor: PLAYER_COLORS[ship.owner],
                      transform: 'rotate(45deg)'
                   }}
                >
                   <span className="text-[11px] -rotate-45">{ship.type === 'SCOUT' ? '🚀' : ship.type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Navigation Controls - Optimized for Left Thumb */}
      <div className="absolute bottom-24 left-6 flex flex-col gap-4 z-[150]">
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(2.5, z + 0.2)); }} 
          className="w-12 h-12 glass-card rounded-2xl flex items-center justify-center text-xl font-bold border-white/10 active:scale-90"
        >
          +
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.1, z - 0.2)); }} 
          className="w-12 h-12 glass-card rounded-2xl flex items-center justify-center text-xl font-bold border-white/10 active:scale-90"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default MapView;
