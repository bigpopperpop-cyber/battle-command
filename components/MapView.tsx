
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

const MapView: React.FC<MapViewProps> = ({ planets, ships, selectedId, onSelect, isSettingCourse, combatEvents = [], playerRole }) => {
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

  const scoutedPlanetIds = useMemo(() => {
    if (!playerRole) return new Set<string>();
    return new Set(
      ships
        .filter(s => s.owner === playerRole && s.type === 'SCOUT' && s.currentPlanetId)
        .map(s => s.currentPlanetId!)
    );
  }, [ships, playerRole]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    moved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    // Use pointer capture for smoother dragging across the whole window
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    // High tolerance (30px) for taps to distinguish them from intentional drags
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) moved.current = true;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

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
          {combatEvents.map(ev => (
            <line key={ev.id} x1={ev.attackerPos.x} y1={ev.attackerPos.y} x2={ev.targetPos.x} y2={ev.targetPos.y} stroke={ev.color} strokeWidth="3" strokeDasharray="5,5" style={{ animation: 'laser-grow 0.5s infinite' }} />
          ))}
          {ships.map(s => {
            if (!s.targetPlanetId) return null;
            const target = planets.find(p => p.id === s.targetPlanetId);
            if (!target) return null;
            return <line key={`path-${s.id}`} x1={s.x} y1={s.y} x2={target.x} y2={target.y} stroke={PLAYER_COLORS[s.owner]} strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />;
          })}
        </svg>

        {planets.map(p => {
          const isSelected = selectedId === p.id;
          const isScouted = scoutedPlanetIds.has(p.id) || p.owner === playerRole;
          const ringRadius = 40;
          const dashArray = 2 * Math.PI * ringRadius;
          const popPercent = (p.population / MAX_PLANET_POPULATION) * 100;
          const dashOffset = dashArray - (dashArray * popPercent) / 100;

          return (
            <div 
              key={p.id}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!moved.current) {
                  onSelect(p.id);
                }
              }}
              // Planets pushed to extremely high Z during targeting to ensure they catch the tap
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group pointer-events-auto cursor-pointer p-16 ${isSettingCourse ? 'z-[60]' : 'z-20'}`}
              style={{ left: p.x, top: p.y }}
            >
              <div className="relative flex items-center justify-center pointer-events-none">
                <svg className="absolute w-24 h-24 overflow-visible">
                  <circle cx="48" cy="48" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle cx="48" cy="48" r={ringRadius} fill="none" stroke={p.owner === 'NEUTRAL' ? '#fff' : PLAYER_COLORS[p.owner]} strokeWidth="4" strokeDasharray={dashArray} strokeDashoffset={isScouted ? dashOffset : dashArray} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                  {isSettingCourse && (
                    <circle cx="48" cy="48" r={ringRadius + 22} fill="none" stroke="#22d3ee" strokeWidth="3" strokeDasharray="8,8" style={{ animation: 'target-pulse 1.5s ease-in-out infinite' }} />
                  )}
                </svg>

                <div className={`w-14 h-14 rounded-full border-2 transition-all flex flex-col items-center justify-center ${isSelected ? 'scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'border-white/10'}`} style={{ backgroundColor: PLAYER_COLORS[p.owner] }}>
                  <span className="text-[12px] font-black text-white">{isScouted ? p.name[0] : '?'}</span>
                </div>
              </div>
              
              <div className={`mt-8 bg-black/90 px-4 py-1.5 rounded-full border border-white/20 transition-opacity whitespace-nowrap pointer-events-none ${isSelected || isSettingCourse ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isSettingCourse && !isSelected ? 'text-cyan-400 animate-pulse' : 'text-white'}`}>
                  {isSettingCourse && !isSelected ? `NAV-SYNC: ${p.name}` : (isScouted ? p.name : 'Classified Sector')}
                </span>
              </div>
            </div>
          );
        })}

        {ships.map(s => {
          const pos = shipDisplayPositions[s.id] || { x: s.x, y: s.y };
          const isCurrentSelected = selectedId === s.id;
          return (
            <div 
              key={s.id} 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!moved.current) onSelect(s.id); 
              }} 
              // Almost entirely disable ship interaction during targeting mode unless it's a target switch intent
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-6 z-40 ${isSettingCourse ? (isCurrentSelected ? 'pointer-events-none' : 'pointer-events-auto') : 'pointer-events-auto'}`} 
              style={{ left: pos.x, top: pos.y }}
            >
              <div className={`w-8 h-8 border-2 rotate-45 flex items-center justify-center bg-slate-900 transition-opacity ${isSettingCourse && !isCurrentSelected ? 'opacity-30' : 'opacity-100'} ${isCurrentSelected ? 'scale-125 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : ''}`} style={{ borderColor: PLAYER_COLORS[s.owner] }}>
                <span className="text-[12px] -rotate-45">{s.type === 'WARSHIP' ? '⚔️' : s.type === 'FREIGHTER' ? '📦' : '🚀'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-10 right-10 flex flex-col gap-2 z-50">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="w-12 h-12 glass-card rounded-2xl font-bold flex items-center justify-center text-xl hover:bg-white/10 active:scale-95">+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} className="w-12 h-12 glass-card rounded-2xl font-bold flex items-center justify-center text-xl hover:bg-white/10 active:scale-95">-</button>
      </div>
    </div>
  );
};

export default MapView;
