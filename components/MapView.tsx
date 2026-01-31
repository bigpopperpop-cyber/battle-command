
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Planet, Ship, Owner } from '../types';
import { GRID_SIZE, PLAYER_COLORS, MAX_FACTORIES, MAX_PLANET_POPULATION } from '../gameLogic';
import { CombatEvent } from '../App';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isSettingCourse: boolean;
  combatEvents?: CombatEvent[];
  playerRole?: Owner | null;
}

const MapView: React.FC<MapViewProps> = ({ planets = [], ships = [], selectedId, onSelect, isSettingCourse, combatEvents = [], playerRole }) => {
  const [zoom, setZoom] = useState(0.4);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      const initialZoom = isMobile ? 0.35 : 0.45;
      setZoom(initialZoom);
      setOffset({ 
        x: window.innerWidth / 2 - (GRID_SIZE / 2) * initialZoom, 
        y: (window.innerHeight / 2 - (GRID_SIZE / 2) * initialZoom) - (isMobile ? 50 : 0)
      });
    }
  }, []);

  const shipDisplayPositions = useMemo(() => {
    const posMap: Record<string, { x: number, y: number }> = {};
    const planetOrbitCounters: Record<string, number> = {};

    if (!ships || !planets) return posMap;

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
        posMap[s.id] = { x: s.x || 0, y: s.y || 0 };
      }
    });
    return posMap;
  }, [ships, planets]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    moved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved.current = true;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (!planets) return null;

  return (
    <div 
      className={`w-full h-full relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing touch-none select-none ${isSettingCourse ? 'cursor-crosshair' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <style>{`
        @keyframes laser-grow { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes target-pulse { 0% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.15); } 100% { opacity: 0.2; transform: scale(1); } }
      `}</style>

      <div 
        className="absolute transition-transform duration-75"
        style={{ 
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          width: GRID_SIZE, height: GRID_SIZE, transformOrigin: '0 0'
        }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {combatEvents && combatEvents.map(ev => (
            <line key={ev.id} x1={ev.attackerPos?.x} y1={ev.attackerPos?.y} x2={ev.targetPos?.x} y2={ev.targetPos?.y} stroke={ev.color} strokeWidth="3" strokeDasharray="5,5" style={{ animation: 'laser-grow 0.5s infinite' }} />
          ))}
          {ships && ships.map(s => {
            if (!s.targetPlanetId) return null;
            const target = planets.find(p => p.id === s.targetPlanetId);
            if (!target) return null;
            return <line key={`path-${s.id}`} x1={s.x} y1={s.y} x2={target.x} y2={target.y} stroke={PLAYER_COLORS[s.owner]} strokeWidth="1" strokeDasharray="4,4" opacity="0.3" />;
          })}
        </svg>

        {planets.map(p => {
          const isSelected = selectedId === p.id;
          const ringRadius = 40;
          const dashArray = 2 * Math.PI * ringRadius;
          const popPercent = (p.population / MAX_PLANET_POPULATION) * 100;
          const dashOffset = dashArray - (dashArray * popPercent) / 100;

          return (
            <div 
              key={p.id}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!moved.current) onSelect(p.id);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group pointer-events-auto cursor-pointer p-24 ${isSettingCourse ? 'z-[100]' : 'z-20'}`}
              style={{ left: p.x, top: p.y }}
            >
              <div className="relative flex items-center justify-center pointer-events-none">
                <svg className="absolute w-24 h-24 overflow-visible">
                  <circle cx="48" cy="48" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle cx="48" cy="48" r={ringRadius} fill="none" stroke={p.owner === 'NEUTRAL' ? '#fff' : PLAYER_COLORS[p.owner]} strokeWidth="4" strokeDasharray={dashArray} strokeDashoffset={dashOffset} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                  {isSettingCourse && (
                    <circle cx="48" cy="48" r={ringRadius + 22} fill="none" stroke="#22d3ee" strokeWidth="3" strokeDasharray="8,8" style={{ animation: 'target-pulse 1.5s ease-in-out infinite' }} />
                  )}
                </svg>

                <div className={`w-14 h-14 rounded-full border-2 transition-all flex flex-col items-center justify-center ${isSelected ? 'scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'border-white/10'}`} style={{ backgroundColor: PLAYER_COLORS[p.owner] }}>
                  <span className="text-sm font-black text-white leading-none">{p.name?.[0] || '?'}</span>
                </div>
              </div>
              
              <div className={`mt-8 bg-black/90 px-4 py-1.5 rounded-full border border-white/20 transition-opacity whitespace-nowrap pointer-events-none ${isSelected || isSettingCourse ? 'opacity-100 ring-2 ring-cyan-500/50' : 'opacity-80'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${isSettingCourse && !isSelected ? 'text-cyan-400 animate-pulse' : 'text-white'}`}>
                  {p.name}
                </span>
              </div>
            </div>
          );
        })}

        {ships && ships.map(s => {
          const pos = shipDisplayPositions[s.id] || { x: s.x, y: s.y };
          const isCurrentSelected = selectedId === s.id;
          return (
            <div 
              key={s.id} 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!moved.current) onSelect(s.id); 
              }} 
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-8 z-40 ${isSettingCourse ? 'pointer-events-none opacity-40' : 'pointer-events-auto'}`} 
              style={{ left: pos.x, top: pos.y }}
            >
              <div className={`w-8 h-8 border-2 rotate-45 flex items-center justify-center bg-slate-900 transition-all ${isCurrentSelected ? 'scale-150 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] z-50' : ''}`} style={{ borderColor: PLAYER_COLORS[s.owner] }}>
                <span className="text-[12px] -rotate-45 leading-none">{s.type === 'WARSHIP' ? '⚔️' : s.type === 'FREIGHTER' ? '📦' : '🚀'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 flex flex-col gap-2 z-50">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="w-10 h-10 md:w-12 md:h-12 glass-card rounded-xl md:rounded-2xl font-bold flex items-center justify-center text-xl hover:bg-white/10 active:scale-95">+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.15))} className="w-10 h-10 md:w-12 md:h-12 glass-card rounded-xl md:rounded-2xl font-bold flex items-center justify-center text-xl hover:bg-white/10 active:scale-95">-</button>
      </div>
    </div>
  );
};

export default MapView;
