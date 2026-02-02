
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Planet, Ship, Owner, GalacticEvent, CombatScrap } from '../types';
import { GRID_SIZE, PLAYER_COLORS } from '../gameLogic';
import { CombatEvent } from '../App';

interface MapViewProps {
  planets: Planet[];
  ships: Ship[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isSettingCourse: boolean;
  combatEvents?: CombatEvent[];
  activeEvents?: GalacticEvent[];
  combatScraps?: CombatScrap[];
  emotes?: Record<string, { text: string, timestamp: number }>;
}

const MapView: React.FC<MapViewProps> = ({ 
  planets = [], ships = [], selectedId, onSelect, isSettingCourse, 
  combatEvents = [], activeEvents = [], combatScraps = [], emotes = {} 
}) => {
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
      const centerX = window.innerWidth / 2 - (GRID_SIZE / 2) * initialZoom;
      const centerY = (window.innerHeight / 2 - (GRID_SIZE / 2) * initialZoom) - (isMobile ? 50 : 0);
      setOffset({ 
        x: isNaN(centerX) ? 0 : centerX, 
        y: isNaN(centerY) ? 0 : centerY
      });
    }
  }, []);

  const planetMap = useMemo(() => {
    const map = new Map<string, Planet>();
    planets.forEach(p => {
      if (p && p.id) map.set(p.id, p);
    });
    return map;
  }, [planets]);

  const shipDisplayPositions = useMemo(() => {
    const posMap: Record<string, { x: number, y: number }> = {};
    const planetOrbitCounters: Record<string, number> = {};
    ships.forEach(s => {
      if (!s) return;
      if (s.currentPlanetId && s.status === 'ORBITING') {
        const planet = planetMap.get(s.currentPlanetId);
        if (planet && typeof planet.x === 'number' && typeof planet.y === 'number') {
          const count = planetOrbitCounters[s.currentPlanetId] || 0;
          const orbitRadius = 65; 
          const angle = (count * 45) * (Math.PI / 180); 
          posMap[s.id] = { 
            x: planet.x + Math.cos(angle) * orbitRadius, 
            y: planet.y + Math.sin(angle) * orbitRadius 
          };
          planetOrbitCounters[s.currentPlanetId] = count + 1;
        } else {
          posMap[s.id] = { x: s.x || 0, y: s.y || 0 };
        }
      } else {
        posMap[s.id] = { x: s.x || 0, y: s.y || 0 };
      }
    });
    return posMap;
  }, [ships, planetMap]);

  // Transform safety check
  const safeX = isNaN(offset.x) ? 0 : offset.x;
  const safeY = isNaN(offset.y) ? 0 : offset.y;
  const safeZoom = isNaN(zoom) || zoom <= 0 ? 0.4 : zoom;

  return (
    <div 
      className={`w-full h-full relative bg-[#020617] cursor-grab active:cursor-grabbing touch-none ${isSettingCourse ? 'cursor-crosshair' : ''}`}
      onPointerDown={(e) => { 
        isDragging.current = true; 
        moved.current = false; 
        startPos.current = { x: e.clientX, y: e.clientY }; 
        startOffset.current = { ...offset }; 
        (e.target as HTMLElement).setPointerCapture(e.pointerId); 
      }}
      onPointerMove={(e) => { 
        if (!isDragging.current) return; 
        const dx = e.clientX - startPos.current.x; 
        const dy = e.clientY - startPos.current.y; 
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true; 
        setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy }); 
      }}
      onPointerUp={(e) => { 
        isDragging.current = false; 
        (e.target as HTMLElement).releasePointerCapture(e.pointerId); 
      }}
    >
      <style>{`
        @keyframes laser-pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        @keyframes spark { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes shockwave { 0% { transform: scale(0.5); opacity: 1; border-width: 8px; } 100% { transform: scale(3); opacity: 0; border-width: 1px; } }
      `}</style>
      <div className="absolute transition-transform duration-75" style={{ transform: `translate3d(${safeX}px, ${safeY}px, 0) scale(${safeZoom})`, width: GRID_SIZE, height: GRID_SIZE, transformOrigin: '0 0' }}>
        
        {/* BG Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:100px_100px]" />

        {/* Combat FX Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {combatEvents.map(ev => {
            if (!ev.attackerPos || !ev.targetPos) return null;
            return (
              <g key={ev.id}>
                <line 
                  x1={ev.attackerPos.x || 0} y1={ev.attackerPos.y || 0} 
                  x2={ev.targetPos.x || 0} y2={ev.targetPos.y || 0} 
                  stroke={ev.color || '#fff'} strokeWidth="4" strokeLinecap="round" 
                  style={{ animation: 'laser-pulse 0.2s infinite ease-in-out', filter: 'drop-shadow(0 0 5px currentColor)' }} 
                />
                <circle cx={ev.attackerPos.x || 0} cy={ev.attackerPos.y || 0} r="8" fill={ev.color || '#fff'} style={{ animation: 'spark 0.3s forwards' }} />
                <g style={{ transform: `translate(${ev.targetPos.x || 0}px, ${ev.targetPos.y || 0}px)` }}>
                  <path d="M-5,-5 L5,5 M-5,5 L5,-5" stroke="white" strokeWidth="2" style={{ animation: 'spark 0.3s forwards ease-out' }} />
                </g>
              </g>
            );
          })}
        </svg>

        {activeEvents.map((e, idx) => e.type === 'COMET' && (
          <div key={`comet-${idx}`} className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full blur-xl animate-pulse" style={{ left: e.x || 0, top: e.y || 0 }} />
        ))}

        {combatScraps.filter(s => Date.now() - s.timestamp < 3000).map(s => (
          <div key={s.id} className="absolute -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-orange-500 rounded-full" style={{ left: s.x || 0, top: s.y || 0, animation: 'shockwave 1s forwards' }} />
        ))}

        {planets.map(p => {
          if (!p || typeof p.x !== 'number') return null;
          const isSelected = selectedId === p.id;
          const emote = emotes[p.owner];
          const showEmote = emote && Date.now() - emote.timestamp < 5000;
          return (
            <div key={p.id} onPointerUp={(e) => { 
              e.stopPropagation(); 
              if (!moved.current) onSelect(p.id); 
            }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center p-24 z-20 cursor-pointer" style={{ left: p.x, top: p.y }}>
              {showEmote && <div className="absolute -top-12 bg-white text-black px-4 py-1 rounded-2xl font-black text-xl shadow-2xl animate-bounce">{emote.text}</div>}
              <div className={`w-14 h-14 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'scale-110 border-white shadow-[0_0_20px_white]' : 'border-white/10'}`} style={{ backgroundColor: PLAYER_COLORS[p.owner] || '#444' }}>
                <span className="text-sm font-black text-white">{p.customName?.[0] || p.name[0] || '?'}</span>
              </div>
              <div className="mt-8 bg-black/90 px-4 py-1.5 rounded-full border border-white/20 whitespace-nowrap">
                <span className="text-[10px] font-black uppercase text-white">{p.customName || p.name}</span>
              </div>
            </div>
          );
        })}

        {ships.map(s => {
          if (!s) return null;
          const pos = shipDisplayPositions[s.id] || { x: s.x || 0, y: s.y || 0 };
          const shipColor = PLAYER_COLORS[s.owner] || '#666';
          return (
            <div key={s.id} onPointerUp={(e) => { 
              e.stopPropagation(); 
              if (!moved.current) onSelect(s.id); 
            }} className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-8 z-40" style={{ left: pos.x, top: pos.y }}>
              <div className={`w-8 h-8 border-2 rotate-45 flex items-center justify-center bg-slate-900 transition-transform ${selectedId === s.id ? 'scale-150 border-white shadow-[0_0_15px_currentColor]' : ''} ${s.isScrambled ? 'opacity-30 blur-sm' : ''}`} style={{ borderColor: shipColor, color: shipColor }}>
                <span className="text-[12px] -rotate-45 text-white">{s.isScrambled ? '⚡' : s.type === 'WARSHIP' ? '⚔️' : s.type === 'FREIGHTER' ? '📦' : '🚀'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="w-10 h-10 bg-slate-900 rounded-xl font-bold flex items-center justify-center border border-white/10 text-white shadow-lg">+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.15))} className="w-10 h-10 bg-slate-900 rounded-xl font-bold flex items-center justify-center border border-white/10 text-white shadow-lg">-</button>
      </div>
    </div>
  );
};
export default MapView;
