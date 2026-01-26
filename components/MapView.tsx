
import React, { useRef, useEffect, useState } from 'react';
import { Planet, Ship, Owner } from '../types';
// Fixed: GRID_SIZE is exported from gameLogic, not types.
import { GRID_SIZE } from '../gameLogic';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string, type: 'PLANET' | 'SHIP') => void;
}

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.8);
  const [offset, setOffset] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const getOwnerColor = (owner: Owner) => {
    switch (owner) {
      case 'PLAYER': return '#22d3ee'; // cyan
      case 'ENEMY_A': return '#f87171'; // red
      case 'ENEMY_B': return '#c084fc'; // purple
      default: return '#94a3b8'; // gray
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className="absolute transition-transform duration-75"
        style={{ 
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          width: GRID_SIZE,
          height: GRID_SIZE,
        }}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '100px 100px'
        }} />

        {/* Planet Renders */}
        {planets.map(planet => (
          <div
            key={planet.id}
            onClick={(e) => { e.stopPropagation(); onSelect(planet.id, 'PLANET'); }}
            className={`absolute cursor-pointer flex flex-col items-center group -translate-x-1/2 -translate-y-1/2`}
            style={{ left: planet.x, top: planet.y }}
          >
            <div 
              className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'scale-125 ring-4 ring-white' : 'scale-100'}`}
              style={{ 
                backgroundColor: getOwnerColor(planet.owner),
                borderColor: planet.owner === 'PLAYER' ? 'white' : 'transparent',
                boxShadow: `0 0 20px ${getOwnerColor(planet.owner)}66`
              }}
            />
            <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap drop-shadow-md">
              {planet.name}
            </span>
          </div>
        ))}

        {/* Ship Renders */}
        {ships.map(ship => (
          <div
            key={ship.id}
            onClick={(e) => { e.stopPropagation(); onSelect(ship.id, 'SHIP'); }}
            className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
            style={{ left: ship.x, top: ship.y }}
          >
             <div 
              className={`w-4 h-4 rotate-45 border transition-all ${selectedId === ship.id ? 'scale-150 border-white' : 'border-slate-400'}`}
              style={{ backgroundColor: getOwnerColor(ship.owner) }}
            />
          </div>
        ))}
      </div>

      {/* Map Controls Overlay */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="glass-card w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-800 text-white font-bold">+</button>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="glass-card w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-800 text-white font-bold">-</button>
      </div>
    </div>
  );
};

export default MapView;
