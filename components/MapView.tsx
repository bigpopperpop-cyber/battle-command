
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Planet, Ship } from '../types';
import { GRID_SIZE, PLAYER_COLORS, MAX_FACTORIES, MAX_PLANET_POPULATION } from '../gameLogic';
import { CombatEvent } from '../App';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isSettingCourse: boolean;
  combatEvents?: CombatEvent[];
}

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, onSelect, isSettingCourse, combatEvents = [] }) => {
  const [zoom, setZoom] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  useEffect(() => {
    setOffset({ 
      x: window.innerWidth / 2 - (GRID_SIZE / 2) * zoom, 
      y: window.innerHeight / 2 - (GRID_SIZE / 2) * zoom 
    });
  }, []);

  const shipDisplayPositions = useMemo(() => {
    const posMap: Record<string, { x: number, y: number }> = {};
    const planetOrbitCounters: Record<string, number> = {};

    ships.forEach(s => {
      if (s.currentPlanetId && s.status === 'ORBITING') {
        const planet = planets.find(p => p.id === s.currentPlanetId);
        if (planet) {
          const count = planetOrbitCounters[s.currentPlanetId] || 0;
          const orbitRadius = 65; 
          const angle = (count * 45) * (Math.PI / 180); 
          posMap[s.id] = {
            x: planet.x + Math.cos(angle) * orbitRadius,
            y: planet.y + Math.sin(angle) * orbitRadius
          };
          planetOrbitCounters[s.currentPlanetId] = count + 1;
        } else {
          posMap[s.id] = { x: s.x, y: s.y };
        }
      } else {
        posMap[s.id] = { x: s.x, y: s.y };
      }
    });
    return posMap;
  }, [ships, planets]);

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
      className={`w-full h-full relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing touch-none select-none ${isSettingCourse ? 'cursor-crosshair' : ''}`}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={() => isDragging.current = false}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={() => isDragging.current = false}
    >
      <style>{`
        @keyframes laser-grow {
          0% { stroke-dashoffset: 240; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes combat-impact {
          0% { transform: scale(0.5); opacity: 1; border-width: 10px; }
          100% { transform: scale(4); opacity: 0; border-width: 1px; }
        }
        @keyframes ship-shake {
          0%, 100% { transform: translate(-50%, -50%); }
          25% { transform: translate(-52%, -48%) rotate(2deg); }
          50% { transform: translate(-48%, -52%) rotate(-2deg); }
          75% { transform: translate(-51%, -49%) rotate(1deg); }
        }
        @keyframes vector-move {
          to { stroke-dashoffset: -20; }
        }
        @keyframes pulse-influence {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.05); opacity: 0.15; }
        }
      `}</style>

      <div 
        className="absolute transition-transform duration-75"
        style={{ 
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          width: GRID_SIZE,
          height: GRID_SIZE,
          transformOrigin: '0 0'
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

        {/* Influence Bubbles */}
        {planets.map(p => {
          if (p.owner === 'NEUTRAL') return null;
          const radius = 100 + p.population * 20;
          return (
            <div 
              key={`inf-${p.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{ 
                left: p.x, top: p.y, 
                width: radius * 2, height: radius * 2,
                backgroundColor: PLAYER_COLORS[p.owner],
                opacity: 0.1,
                animation: 'pulse-influence 5s ease-in-out infinite',
                filter: 'blur(30px)'
              }}
            />
          );
        })}

        {/* Combat Beams and Effects */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
          {combatEvents.map(ev => (
            <g key={ev.id}>
              <line 
                x1={ev.attackerPos.x} y1={ev.attackerPos.y}
                x2={ev.targetPos.x} y2={ev.targetPos.y}
                stroke={ev.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="10, 20"
                style={{ animation: 'laser-grow 0.6s ease-out infinite' }}
              />
            </g>
          ))}
        </svg>

        {/* Flight Paths / Vector Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {ships.map(s => {
            if (!s.targetPlanetId) return null;
            const target = planets.find(p => p.id === s.targetPlanetId);
            if (!target) return null;
            return (
              <line 
                key={`path-${s.id}`}
                x1={s.x} y1={s.y} x2={target.x} y2={target.y}
                stroke={PLAYER_COLORS[s.owner]}
                strokeWidth="1.5"
                strokeDasharray="4, 4"
                style={{ animation: 'vector-move 1s linear infinite' }}
                opacity="0.6"
              />
            );
          })}
        </svg>

        {planets.map(p => {
          const isSelected = selectedId === p.id;
          const popPercent = (p.population / MAX_PLANET_POPULATION) * 100;
          const ringRadius = 40;
          const dashArray = 2 * Math.PI * ringRadius;
          const dashOffset = dashArray - (dashArray * popPercent) / 100;

          return (
            <div 
              key={p.id}
              onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect(p.id); }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group pointer-events-auto"
              style={{ left: p.x, top: p.y }}
            >
              <svg className="absolute w-24 h-24 -translate-y-0.5 overflow-visible pointer-events-none">
                {/* Population / Health Ring */}
                <circle 
                  cx="48" cy="48" r={ringRadius}
                  fill="none" stroke="rgba(255,255,255,0.05)"
                  strokeWidth="4"
                />
                <circle 
                  cx="48" cy="48" r={ringRadius}
                  fill="none" stroke={p.owner === 'NEUTRAL' ? '#fff' : PLAYER_COLORS[p.owner]}
                  strokeWidth="4"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              </svg>

              <div 
                className={`w-14 h-14 rounded-full border-2 transition-all duration-300 flex flex-col items-center justify-center ${isSelected ? 'scale-110 border-white shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'border-white/10 opacity-80'}`}
                style={{ backgroundColor: PLAYER_COLORS[p.owner], boxShadow: `inset 0 0 20px rgba(0,0,0,0.4)` }}
              >
                <span className="text-[12px] font-black text-white">{p.name[0]}</span>
                {p.specialization !== 'NONE' && (
                  <span className="text-[8px] mt-0.5">{p.specialization === 'SHIPYARD' ? '⚓' : p.specialization === 'FORTRESS' ? '🛡️' : '🏭'}</span>
                )}
              </div>
              
              <div className={`mt-4 bg-black/60 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md transition-opacity whitespace-nowrap ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{p.name}</span>
              </div>
            </div>
          );
        })}

        {ships.map(s => {
          const pos = shipDisplayPositions[s.id] || { x: s.x, y: s.y };
          return (
            <div 
              key={s.id}
              onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect(s.id); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group p-4 z-10 transition-all duration-1000`}
              style={{ left: pos.x, top: pos.y }}
            >
              <div 
                className={`w-8 h-8 border-2 rotate-45 flex items-center justify-center bg-slate-900 shadow-xl transition-all ${selectedId === s.id ? 'scale-125 ring-4 ring-white/20' : 'hover:scale-110'}`} 
                style={{ borderColor: PLAYER_COLORS[s.owner] }}
              >
                <span className="text-[12px] -rotate-45">{s.type === 'WARSHIP' ? '⚔️' : s.type === 'FREIGHTER' ? '📦' : '🚀'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-10 right-10 flex flex-col gap-2">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="w-12 h-12 glass-card rounded-2xl font-bold text-xl">+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} className="w-12 h-12 glass-card rounded-2xl font-bold text-xl">-</button>
      </div>
    </div>
  );
};

export default MapView;
