
import React, { useState, useCallback } from 'react';
import { Planet, Ship } from '../types';
import { GRID_SIZE, PLAYER_COLORS } from '../gameLogic';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string, type: 'PLANET' | 'SHIP') => void;
}

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, onSelect }) => {
  const [zoom, setZoom] = useState(0.7);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  const startDragging = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  }, [offset.x, offset.y]);

  const moveDragging = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = Math.abs(clientX - (dragStart.x + offset.x));
    const dy = Math.abs(clientY - (dragStart.y + offset.y));
    
    // Threshold to distinguish between accidental movement and intentional drag
    if (dx > 2 || dy > 2) {
      setHasMoved(true);
    }
    
    setOffset({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  }, [isDragging, dragStart, offset.x, offset.y]);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    startDragging(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    moveDragging(e.clientX, e.clientY);
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      startDragging(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      moveDragging(touch.clientX, touch.clientY);
    }
  };

  const handleSelect = (e: React.MouseEvent | React.TouchEvent, id: string, type: 'PLANET' | 'SHIP') => {
    // Only select if the user didn't move the map significantly
    if (!hasMoved) {
      e.stopPropagation();
      onSelect(id, type);
    }
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing touch-none select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={stopDragging}
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
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '100px 100px'
        }} />

        {planets.map(planet => (
          <div
            key={planet.id}
            onMouseDown={(e) => e.stopPropagation()} 
            onClick={(e) => handleSelect(e, planet.id, 'PLANET')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group"
            style={{ left: planet.x, top: planet.y }}
          >
            <div 
              className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'ring-4 ring-white scale-125' : 'scale-100 group-hover:scale-110'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[planet.owner],
                borderColor: planet.owner !== 'NEUTRAL' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                boxShadow: `0 0 40px ${PLAYER_COLORS[planet.owner]}55`
              }}
            />
            <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-2 py-0.5 rounded bg-black/20">
              {planet.name}
            </span>
          </div>
        ))}

        {ships.map(ship => (
          <div
            key={ship.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => handleSelect(e, ship.id, 'SHIP')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500"
            style={{ left: ship.x, top: ship.y }}
          >
             <div 
              className={`w-6 h-6 rotate-45 border-2 transition-all ${selectedId === ship.id ? 'scale-150 border-white shadow-[0_0_20px_#fff]' : 'border-white/20'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[ship.owner],
                boxShadow: `0 0 15px ${PLAYER_COLORS[ship.owner]}88`
              }}
            />
          </div>
        ))}
      </div>

      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-3 z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.2)); }} 
          className="glass-card w-12 h-12 rounded-2xl text-white font-bold text-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all shadow-lg"
        >
          +
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.1, z - 0.2)); }} 
          className="glass-card w-12 h-12 rounded-2xl text-white font-bold text-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all shadow-lg"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default MapView;
