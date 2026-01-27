
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
    const p1Planet = planets.find(p => p.owner === 'P1');
    if (p1Planet) {
       setOffset({ 
         x: window.innerWidth/2 - p1Planet.x * zoom, 
         y: window.innerHeight/2 - p1Planet.y * zoom 
       });
    } else {
       setOffset({ x: window.innerWidth/2 - 300, y: window.innerHeight/2 - 300 });
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
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMovedRef.current = true;
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
        <div className="absolute inset-0 opacity-[0.03]" style={{
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
               <div className="absolute inset-0 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-500 border-dashed animate-[spin_20s_linear_infinite]" 
                    style={{ left: '50%', top: '50%' }} />
            )}
            <div 
              className={`w-9 h-9 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'scale-125 border-white shadow-[0_0_40px_rgba(255,255,255,0.4)]' : 'scale-100 opacity-90'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[planet.owner],
                borderColor: planet.owner !== 'NEUTRAL' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)',
                boxShadow: `0 0 50px ${PLAYER_COLORS[planet.owner]}44`
              }}
            />
            <span className="mt-4 text-[7px] font-black uppercase tracking-widest text-white/50 bg-black/50 px-3 py-1 rounded-full border border-white/5">
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
                   className="w-6 h-6 flex items-center justify-center rounded-xl border border-white/10" 
                   style={{ 
                      backgroundColor: PLAYER_COLORS[ship.owner],
                      transform: 'rotate(45deg)'
                   }}
                >
                   <span className="text-[10px] -rotate-45">{ship.type === 'SCOUT' ? '🚀' : ship.type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Navigation Controls - Re-positioned for Left Thumb accessibility in Landscape */}
      <div className="absolute bottom-20 left-6 flex flex-col gap-3 z-[150]">
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(2.5, z + 0.15)); }} 
          className="w-10 h-10 glass-card rounded-xl flex items-center justify-center text-lg font-bold border-white/10 active:scale-90 transition-all"
        >
          +
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.1, z - 0.15)); }} 
          className="w-10 h-10 glass-card rounded-xl flex items-center justify-center text-lg font-bold border-white/10 active:scale-90 transition-all"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default MapView;
