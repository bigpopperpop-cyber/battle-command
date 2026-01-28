
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
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '200px 200px'
        }} />

        {planets.map(planet => (
          <div
            key={planet.id}
            onClick={(e) => handleItemClick(e, planet.id, 'PLANET')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group z-10"
            style={{ left: planet.x, top: planet.y, padding: '20px' }} // Added padding for larger tap target
          >
            {selectedId === planet.id && (
               <div className="absolute inset-0 w-28 h-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-cyan-400 border-dashed animate-[spin_10s_linear_infinite] opacity-60" 
                    style={{ left: '50%', top: '50%' }} />
            )}
            <div 
              className={`w-12 h-12 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'scale-125 border-white shadow-[0_0_60px_#fff8]' : 'scale-100 opacity-90 border-white/20'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[planet.owner],
                boxShadow: `0 0 50px ${PLAYER_COLORS[planet.owner]}66`
              }}
            />
            <div className="mt-4 flex flex-col items-center gap-1">
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white bg-black/60 px-4 py-1.5 rounded-2xl border border-white/10 whitespace-nowrap shadow-xl">
                 {planet.name}
               </span>
               <div className="flex gap-0.5">
                  {Array.from({length: planet.population}).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/80" />
                  ))}
               </div>
            </div>
          </div>
        ))}

        {ships.map(ship => (
          <div
            key={ship.id}
            onClick={(e) => handleItemClick(e, ship.id, 'SHIP')}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-20 ${selectedId === ship.id ? 'scale-[2.0] z-30 shadow-[0_0_30px_#fff8]' : 'opacity-90'}`}
            style={{ left: ship.x, top: ship.y, padding: '15px' }} // Tap target padding
          >
             <div className="relative flex flex-col items-center">
                <div 
                   className="w-8 h-8 flex items-center justify-center rounded-2xl border border-white/20 shadow-2xl" 
                   style={{ 
                      backgroundColor: PLAYER_COLORS[ship.owner],
                      transform: 'rotate(45deg)'
                   }}
                >
                   <span className="text-sm -rotate-45">{ship.type === 'SCOUT' ? '🚀' : ship.type === 'FREIGHTER' ? '📦' : '⚔️'}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Navigation Controls - Optimized for Phone Thumbs */}
      <div className="absolute bottom-28 left-4 flex flex-col gap-3 z-[150]">
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3.0, z + 0.3)); }} 
          className="w-14 h-14 bg-slate-900/90 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl font-black border border-white/10 active:scale-90 shadow-2xl text-cyan-400"
        >
          +
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.1, z - 0.3)); }} 
          className="w-14 h-14 bg-slate-900/90 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl font-black border border-white/10 active:scale-90 shadow-2xl text-slate-400"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default MapView;
