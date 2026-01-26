
import React, { useRef, useState } from 'react';
import { Planet, Ship, Owner } from '../types';
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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <div 
        className="absolute transition-transform duration-75"
        style={{ 
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          width: GRID_SIZE,
          height: GRID_SIZE,
        }}
      >
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '100px 100px'
        }} />

        {planets.map(planet => (
          <div
            key={planet.id}
            onClick={() => onSelect(planet.id, 'PLANET')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center"
            style={{ left: planet.x, top: planet.y }}
          >
            <div 
              className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${selectedId === planet.id ? 'ring-4 ring-white scale-125' : 'scale-100'}`}
              style={{ 
                backgroundColor: PLAYER_COLORS[planet.owner],
                borderColor: planet.owner !== 'NEUTRAL' ? 'white' : 'transparent',
                boxShadow: `0 0 30px ${PLAYER_COLORS[planet.owner]}44`
              }}
            />
            <span className="mt-2 text-[8px] font-bold uppercase tracking-tighter text-white drop-shadow-lg">{planet.name}</span>
          </div>
        ))}

        {ships.map(ship => (
          <div
            key={ship.id}
            onClick={() => onSelect(ship.id, 'SHIP')}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500"
            style={{ left: ship.x, top: ship.y }}
          >
             <div 
              className={`w-5 h-5 rotate-45 border transition-all ${selectedId === ship.id ? 'scale-150 border-white' : 'border-slate-400'}`}
              style={{ backgroundColor: PLAYER_COLORS[ship.owner] }}
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-30">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="glass-card w-10 h-10 rounded-full text-white font-bold">+</button>
        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="glass-card w-10 h-10 rounded-full text-white font-bold">-</button>
      </div>
    </div>
  );
};

export default MapView;
