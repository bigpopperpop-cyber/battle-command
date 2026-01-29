
import React, { useState, useRef, useEffect } from 'react';
import { Planet, Ship } from '../types';
import { GRID_SIZE, PLAYER_COLORS } from '../gameLogic';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, onSelect }) => {
  const [zoom, setZoom] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  useEffect(() => {
    // Initial centering
    setOffset({ x: window.innerWidth / 2 - (GRID_SIZE / 2) * zoom, y: window.innerHeight / 2 - (GRID_SIZE / 2) * zoom });
  }, []);

  const handleStart = (x: number, y: number) => {
    isDragging.current = true;
    moved.current = false;
    startPos.current = { x, y };
    startOffset.current = { ...offset };
  };

  const handleMove = (x: number, y: number) => {
    if (!isDragging.current) return;
    const dx = x - startPos.current.x;
    const dy = y - startPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing touch-none select-none"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={() => isDragging.current = false}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={() => isDragging.current = false}
    >
      <div 
        className="absolute transition-transform duration-75"
        style={{ 
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          width: GRID_SIZE,
          height: GRID_SIZE,
          transformOrigin: '0 0'
        }}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

        {planets.map(p => (
          <div 
            key={p.id}
            onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect(p.id); }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group pointer-events-auto"
            style={{ left: p.x, top: p.y }}
          >
            <div 
              className={`w-14 h-14 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${selectedId === p.id ? 'scale-125 border-white shadow-[0_0_40px_rgba(255,255,255,0.4)]' : 'border-white/10 opacity-80'}`}
              style={{ backgroundColor: PLAYER_COLORS[p.owner], boxShadow: `0 0 30px ${PLAYER_COLORS[p.owner]}44` }}
            >
              <span className="text-[10px] font-black text-white/20 select-none">{p.name[0]}</span>
            </div>
            <div className="mt-3 bg-black/60 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{p.name}</span>
            </div>
            {/* Pop Indicator */}
            <div className="flex gap-0.5 mt-1">
              {Array.from({length: p.population}).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40" />
              ))}
            </div>
          </div>
        ))}

        {ships.map(s => (
          <div 
            key={s.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: s.x, top: s.y, transition: 'all 2s ease-in-out' }}
          >
            <div className="w-6 h-6 border-2 rotate-45 flex items-center justify-center bg-slate-900 shadow-xl" style={{ borderColor: PLAYER_COLORS[s.owner] }}>
              <span className="text-[10px] -rotate-45">🚀</span>
            </div>
          </div>
        ))}
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-10 left-10 flex flex-col gap-2">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="w-12 h-12 bg-slate-900 border border-white/10 rounded-xl font-bold text-xl">+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} className="w-12 h-12 bg-slate-900 border border-white/10 rounded-xl font-bold text-xl">-</button>
      </div>
    </div>
  );
};

export default MapView;
