
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Planet, Ship, Owner, GalacticEvent, CombatScrap } from '../types';
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
  activeEvents?: GalacticEvent[];
  combatScraps?: CombatScrap[];
  emotes?: Record<string, { text: string, timestamp: number }>;
}

const MapView: React.FC<MapViewProps> = ({ 
  planets = [], ships = [], selectedId, onSelect, isSettingCourse, 
  combatEvents = [], playerRole, activeEvents = [], combatScraps = [], emotes = {} 
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
      setOffset({ 
        x: window.innerWidth / 2 - (GRID_SIZE / 2) * initialZoom, 
        y: (window.innerHeight / 2 - (GRID_SIZE / 2) * initialZoom) - (isMobile ? 50 : 0)
      });
    }
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
          posMap[s.id] = { x: planet.x + Math.cos(angle) * orbitRadius, y: planet.y + Math.sin(angle) * orbitRadius };
          planetOrbitCounters[s.currentPlanetId] = count + 1;
        } else posMap[s.id] = { x: s.x, y: s.y };
      } else posMap[s.id] = { x: s.x || 0, y: s.y || 0 };
    });
    return posMap;
  }, [ships, planets]);

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
        @keyframes beam-pulse { 0% { opacity: 0.4; stroke-width: 6; } 50% { opacity: 1; stroke-width: 10; } 100% { opacity: 0.4; stroke-width: 6; } }
        @keyframes muzzle-flare { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes impact-spark { 0% { transform: scale(0); opacity: 1; } 50% { transform: scale(1.2) rotate(45deg); opacity: 1; } 100% { transform: scale(0.5); opacity: 0; } }
        @keyframes scrap-fade { 0% { transform: scale(0.5); opacity: 1; border-width: 10px; } 100% { transform: scale(4); opacity: 0; border-width: 1px; } }
        @keyframes comet-glow { 0% { box-shadow: 0 0 20px #fff; } 100% { box-shadow: 0 0 80px #fff; } }
      `}</style>
      <div className="absolute transition-transform duration-75" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`, width: GRID_SIZE, height: GRID_SIZE, transformOrigin: '0 0' }}>
        
        {/* Background Grid Layer */}
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

        {/* Combat Effects Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            {Object.entries(PLAYER_COLORS).map(([key, color]) => (
              <filter key={`glow-${key}`} id={`glow-${key}`}>
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            ))}
          </defs>
          {combatEvents.map(ev => (
            <g key={ev.id}>
              {/* Outer Glow Beam */}
              <line 
                x1={ev.attackerPos?.x} y1={ev.attackerPos?.y} 
                x2={ev.targetPos?.x} y2={ev.targetPos?.y} 
                stroke={ev.color} strokeWidth="8" strokeLinecap="round" 
                style={{ animation: 'beam-pulse 0.3s infinite ease-in-out', filter: `url(#glow-${ev.id})` }} 
              />
              {/* White Core Beam */}
              <line 
                x1={ev.attackerPos?.x} y1={ev.attackerPos?.y} 
                x2={ev.targetPos?.x} y2={ev.targetPos?.y} 
                stroke="white" strokeWidth="2" strokeLinecap="round" 
                style={{ opacity: 0.9 }} 
              />
              {/* Muzzle Flare */}
              <circle 
                cx={ev.attackerPos?.x} cy={ev.attackerPos?.y} 
                r="15" fill={ev.color} 
                style={{ animation: 'muzzle-flare 0.4s forwards' }} 
              />
              {/* Impact Spark */}
              <g style={{ transform: `translate(${ev.targetPos?.x}px, ${ev.targetPos?.y}px)` }}>
                <path 
                  d="M -10 0 L 10 0 M 0 -10 L 0 10 M -7 -7 L 7 7 M -7 7 L 7 -7" 
                  stroke="white" strokeWidth="3" 
                  style={{ animation: 'impact-spark 0.4s forwards ease-out' }} 
                />
                <circle r="8" fill={ev.color} style={{ opacity: 0.5, animation: 'muzzle-flare 0.4s forwards' }} />
              </g>
            </g>
          ))}
        </svg>

        {/* Event Layer */}
        {activeEvents.map((e, idx) => e.type === 'COMET' && (
          <div key={`comet-${idx}`} className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full blur-xl animate-pulse" style={{ left: e.x, top: e.y, animation: 'comet-glow 1s infinite alternate' }} />
        ))}

        {/* Wreckage Layer */}
        {combatScraps.filter(s => Date.now() - s.timestamp < 3000).map(s => (
          <div key={s.id} className="absolute -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-orange-500 rounded-full" style={{ left: s.x, top: s.y, animation: 'scrap-fade 1.2s forwards cubic-bezier(0, 0, 0.2, 1)' }} />
        ))}

        {/* Planet Layer */}
        {planets.map(p => {
          const isSelected = selectedId === p.id;
          const emote = emotes[p.owner];
          const showEmote = emote && Date.now() - emote.timestamp < 5000;
          return (
            <div key={p.id} onPointerUp={(e) => { 
              e.stopPropagation(); 
              if (!moved.current) onSelect(p.id); 
            }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center p-24 z-20 cursor-pointer" style={{ left: p.x, top: p.y }}>
              {showEmote && <div className="absolute -top-12 bg-white text-black px-4 py-1 rounded-2xl font-black text-xl shadow-2xl animate-bounce">{emote.text}</div>}
              <div className={`w-14 h-14 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'border-white/10'}`} style={{ backgroundColor: PLAYER_COLORS[p.owner] }}>
                <span className="text-sm font-black text-white">{p.customName?.[0] || p.name[0]}</span>
              </div>
              <div className="mt-8 bg-black/90 px-4 py-1.5 rounded-full border border-white/20 whitespace-nowrap">
                <span className="text-[10px] font-black uppercase text-white">{p.customName || p.name}</span>
              </div>
            </div>
          );
        })}

        {/* Ship Layer */}
        {ships.map(s => {
          const pos = shipDisplayPositions[s.id] || { x: s.x, y: s.y };
          return (
            <div key={s.id} onPointerUp={(e) => { 
              e.stopPropagation(); 
              if (!moved.current) onSelect(s.id); 
            }} className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-8 z-40" style={{ left: pos.x, top: pos.y }}>
              <div className={`w-8 h-8 border-2 rotate-45 flex items-center justify-center bg-slate-900 transition-transform ${selectedId === s.id ? 'scale-150 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''} ${s.isScrambled ? 'opacity-30 blur-sm' : ''}`} style={{ borderColor: PLAYER_COLORS[s.owner] }}>
                <span className="text-[12px] -rotate-45">{s.isScrambled ? '⚡' : s.type === 'WARSHIP' ? '⚔️' : s.type === 'FREIGHTER' ? '📦' : '🚀'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="w-10 h-10 bg-slate-900 rounded-xl font-bold flex items-center justify-center text-xl shadow-lg border border-white/10 hover:bg-slate-800 transition-colors">+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.15))} className="w-10 h-10 bg-slate-900 rounded-xl font-bold flex items-center justify-center text-xl shadow-lg border border-white/10 hover:bg-slate-800 transition-colors">-</button>
      </div>
    </div>
  );
};
export default MapView;
