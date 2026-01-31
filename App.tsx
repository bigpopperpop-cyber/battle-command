
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Owner, AiDifficulty, Planet, Ship, ShipType } from './types';
import { generateInitialState, PLAYER_COLORS, MAX_PLANET_POPULATION, SHIP_STATS, GRID_SIZE, getEmpireBonuses, MAX_FACTORIES, MAX_MINES } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import NewGameModal from './components/NewGameModal';
import LobbyModal from './components/LobbyModal';
import HelpModal from './components/HelpModal';
import SelectionPanel from './components/SelectionPanel';
import InviteModal from './components/InviteModal';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, Database } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com", 
};

let db: Database | null = null;
const isConfigPlaceholder = !firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes("default-rtdb");

try {
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app);
} catch (e) {
  console.error("Relay Initialization Failed:", e);
}

export interface CombatEvent {
  id: string;
  attackerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  color: string;
}

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);
  const [viewMode, setViewMode] = useState<'HOST' | 'PLAYER'>('HOST');
  
  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(2, 0));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isNewGameOpen, setIsNewGameOpen] = useState(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingCourse, setIsSettingCourse] = useState(false);
  const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);

  // Deep Link Detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('gameId');
    const urlRole = params.get('role') as Owner | null;

    if (urlGameId && urlRole) {
      setGameId(urlGameId);
      setPlayerRole(urlRole);
      setViewMode('PLAYER');
      setHasStarted(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Sync state from Firebase
  useEffect(() => {
    if (!db || !gameId || isConfigPlaceholder) return;
    const stateRef = ref(db, `games/${gameId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
    return () => unsubscribe();
  }, [gameId]);

  // Sync combat events from Firebase (optional, let's keep it local to host/players turn logic)
  useEffect(() => {
    if (combatEvents.length > 0) {
      const timer = setTimeout(() => setCombatEvents([]), 3500);
      return () => clearTimeout(timer);
    }
  }, [combatEvents]);

  const handleIssueOrder = (type: string, payload?: any) => {
    if (!playerRole) return;
    
    if (type === 'SET_COURSE') {
      setIsSettingCourse(true);
      return;
    }

    setGameState(prev => {
      const readyPlayers = (prev.readyPlayers || []).filter(p => p !== playerRole);
      const nextState = { ...prev, readyPlayers };
      const selected = prev.planets.find(p => p.id === selectedId) || prev.ships.find(s => s.id === selectedId);
      
      if (type === 'BUILD_MINE' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 500) return prev;
        nextState.playerCredits[playerRole] -= 500;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, mines: p.mines + 1 } : p);
      } else if (type === 'BUILD_FACTORY' && selected && 'population' in selected) {
        if (nextState.playerCredits[playerRole] < 800) return prev;
        nextState.playerCredits[playerRole] -= 800;
        nextState.planets = prev.planets.map(p => p.id === selectedId ? { ...p, factories: p.factories + 1 } : p);
      } else if (type === 'BUILD_SHIP' && selected && 'population' in selected) {
         const shipType = payload.type as ShipType;
         const baseStats = SHIP_STATS[shipType];
         const bonuses = getEmpireBonuses(prev.planets, playerRole);
         const cost = Math.floor(baseStats.cost * (1 - bonuses.discount));

         if (nextState.playerCredits[playerRole] < cost) return prev;
         nextState.playerCredits[playerRole] -= cost;
         
         const boostedHp = Math.floor(baseStats.hp * bonuses.strength);
         const boostedAtk = Math.floor(baseStats.attack * bonuses.strength);
         const peopleCapacity = shipType === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people;

         const newShip: Ship = {
            id: `s-${playerRole}-${Date.now()}`,
            name: `${prev.playerNames[playerRole]} ${shipType}`,
            type: shipType,
            owner: playerRole,
            x: selected.x,
            y: selected.y,
            currentPlanetId: selected.id,
            cargo: 0,
            maxCargo: baseStats.cargo,
            cargoPeople: 0,
            maxPeopleCargo: peopleCapacity,
            hp: boostedHp,
            maxHp: boostedHp,
            attack: boostedAtk,
            speed: baseStats.speed,
            status: 'ORBITING'
         };
         nextState.ships = [...prev.ships, newShip];
      } else if (type === 'FORM_FLEET' && selected && 'population' in selected) {
        const fleetId = `f-${playerRole}-${Date.now()}`;
        nextState.ships = prev.ships.map(s => 
          (s.currentPlanetId === selected.id && s.owner === playerRole) ? { ...s, fleetId } : s
        );
      } else if (type === 'DISBAND_FLEET' && selected) {
        const targetId = 'population' in selected ? selected.id : null;
        const fleetToDisband = 'fleetId' in selected ? selected.fleetId : null;
        
        if (targetId) {
          nextState.ships = prev.ships.map(s => 
            (s.currentPlanetId === targetId && s.owner === playerRole) ? { ...s, fleetId: undefined } : s
          );
        } else if (fleetToDisband) {
          nextState.ships = prev.ships.map(s => 
            (s.fleetId === fleetToDisband) ? { ...s, fleetId: undefined } : s
          );
        }
      }

      if (db && gameId && !isConfigPlaceholder) {
        set(ref(db, `games/${gameId}/state`), nextState);
      }
      return nextState;
    });
  };

  const handleReadyToggle = () => {
    if (!playerRole) return;
    setGameState(prev => {
      const isReady = (prev.readyPlayers || []).includes(playerRole);
      const readyPlayers = isReady 
        ? (prev.readyPlayers || []).filter(p => p !== playerRole)
        : [...(prev.readyPlayers || []), playerRole];
      
      const nextState = { ...prev, readyPlayers };
      if (db && gameId && !isConfigPlaceholder) {
        set(ref(db, `games/${gameId}/state`), nextState);
      }
      return nextState;
    });
  };

  const handleSelect = (id: string) => {
    if (isSettingCourse && selectedId) {
      const ship = gameState.ships.find(s => s.id === selectedId);
      const target = gameState.planets.find(p => p.id === id);
      if (ship && target) {
        setGameState(prev => {
          const readyPlayers = (prev.readyPlayers || []).filter(p => p !== playerRole);
          const fleetId = ship.fleetId;
          const newState = {
            ...prev,
            readyPlayers,
            ships: prev.ships.map(s => {
              if (s.id === selectedId || (fleetId && s.fleetId === fleetId)) {
                return { ...s, targetPlanetId: id, status: 'MOVING' };
              }
              return s;
            })
          };
          if (db && gameId && !isConfigPlaceholder) {
             set(ref(db, `games/${gameId}/state`), newState);
          }
          return newState;
        });
        setIsSettingCourse(false);
        return;
      } else if (ship && !target) {
        setIsSettingCourse(false);
      }
    }
    setSelectedId(id);
  };

  const humanPlayers = useMemo(() => {
    const humans: Owner[] = [];
    for (let i = 1; i <= gameState.playerCount; i++) {
      const p = `P${i}` as Owner;
      if (!gameState.aiPlayers.includes(p)) {
        humans.push(p);
      }
    }
    return humans;
  }, [gameState.playerCount, gameState.aiPlayers]);

  const allPlayersReady = useMemo(() => {
    const others = humanPlayers.filter(p => p !== 'P1');
    return others.every(p => (gameState.readyPlayers || []).includes(p));
  }, [humanPlayers, gameState.readyPlayers]);

  const executeTurn = async () => {
    if (isProcessing || !allPlayersReady) return;
    setIsProcessing(true);
    const events: CombatEvent[] = [];
    
    try {
      let nextPlanets = gameState.planets.map(p => ({...p}));
      let nextShips = gameState.ships.map(s => ({...s}));
      let nextCredits = { ...gameState.playerCredits };

      // --- 1. AI Decision Layer ---
      const aiPlayers = gameState.aiPlayers || [];
      aiPlayers.forEach(aiId => {
        const aiPlanets = nextPlanets.filter(p => p.owner === aiId);
        const bonuses = getEmpireBonuses(nextPlanets, aiId);
        
        aiPlanets.forEach(p => {
          if (nextCredits[aiId] >= 500 && p.mines < 10) {
            nextCredits[aiId] -= 500;
            p.mines += 1;
          }
          if (nextCredits[aiId] >= 800 && p.factories < 5) {
            nextCredits[aiId] -= 800;
            p.factories += 1;
          }
          if (p.factories > 0) {
            const types: ShipType[] = ['WARSHIP', 'FREIGHTER'];
            const type = types[Math.floor(Math.random() * types.length)];
            const baseStats = SHIP_STATS[type];
            const cost = Math.floor(baseStats.cost * (1 - bonuses.discount));

            if (nextCredits[aiId] >= Math.max(1500, cost)) {
              nextCredits[aiId] -= cost;
              const boostedHp = Math.floor(baseStats.hp * bonuses.strength);
              const boostedAtk = Math.floor(baseStats.attack * bonuses.strength);
              const peopleCapacity = type === 'WARSHIP' ? bonuses.warshipCapacity : baseStats.people;

              nextShips.push({
                id: `s-${aiId}-${Date.now()}-${Math.random()}`,
                name: `AI ${type}`,
                type, owner: aiId, x: p.x, y: p.y,
                currentPlanetId: p.id,
                cargo: 0, maxCargo: baseStats.cargo, 
                cargoPeople: type === 'FREIGHTER' ? 1 : 0, 
                maxPeopleCargo: peopleCapacity,
                hp: boostedHp, maxHp: boostedHp, attack: boostedAtk, speed: baseStats.speed,
                status: 'ORBITING'
              });
            }
          }
        });

        nextShips.filter(s => s.owner === aiId && s.status !== 'MOVING').forEach(s => {
          let target: Planet | undefined;
          if (s.type === 'FREIGHTER' || (s.type === 'WARSHIP' && s.maxPeopleCargo > 0)) {
            const neutrals = nextPlanets.filter(p => p.owner === 'NEUTRAL');
            target = neutrals.sort((a, b) => {
              const dA = Math.sqrt((s.x - a.x)**2 + (s.y - a.y)**2);
              const dB = Math.sqrt((s.x - b.x)**2 + (s.y - b.y)**2);
              return dA - dB;
            })[0];
          } else if (s.type === 'WARSHIP') {
            const enemies = nextPlanets.filter(p => p.owner !== aiId && p.owner !== 'NEUTRAL');
            target = enemies.sort((a, b) => {
              const dA = Math.sqrt((s.x - a.x)**2 + (s.y - a.y)**2);
              const dB = Math.sqrt((s.x - b.x)**2 + (s.y - b.y)**2);
              return dA - dB;
            })[0];
          } else if (s.type === 'SCOUT') {
            const nonOwned = nextPlanets.filter(p => p.owner !== aiId);
            target = nonOwned[Math.floor(Math.random() * nonOwned.length)];
          }

          if (target && target.id !== s.currentPlanetId) {
            s.targetPlanetId = target.id;
            s.status = 'MOVING';
          }
        });
      });

      // --- 2. Resolution Layer: Movement ---
      const fleetTargets = new Map<string, string>();
      nextShips.forEach(s => {
        if (s.fleetId && s.targetPlanetId) fleetTargets.set(s.fleetId, s.targetPlanetId);
      });

      nextShips = nextShips.map(ship => {
        const targetId = ship.targetPlanetId || (ship.fleetId ? fleetTargets.get(ship.fleetId) : null);
        if (targetId) {
          const target = nextPlanets.find(p => p.id === targetId);
          if (target) {
            const dx = target.x - ship.x;
            const dy = target.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const actualSpeed = ship.fleetId ? 80 : ship.speed;

            if (dist <= actualSpeed) {
              return { ...ship, x: target.x, y: target.y, status: 'ORBITING', currentPlanetId: target.id, targetPlanetId: undefined };
            } else {
              return { ...ship, x: ship.x + (dx/dist) * actualSpeed, y: ship.y + (dy/dist) * actualSpeed, status: 'MOVING', targetPlanetId: targetId };
            }
          }
        }
        return ship;
      });

      // --- 3. Combat & Healing Logic ---
      const damageMap: Record<string, number> = {};
      const shipBattled: Set<string> = new Set();

      nextPlanets.forEach(planet => {
        const shipsAtPlanet = nextShips.filter(s => s.currentPlanetId === planet.id && s.status === 'ORBITING');
        const owners = Array.from(new Set(shipsAtPlanet.map(s => s.owner)));
        
        if (owners.length > 1) {
          shipsAtPlanet.forEach(attacker => {
            // Only ships with attack values can damage others
            if (attacker.attack > 0) {
              const enemies = shipsAtPlanet.filter(s => s.owner !== attacker.owner);
              if (enemies.length > 0) {
                const target = enemies[0];
                const bonuses = getEmpireBonuses(nextPlanets, attacker.owner);
                // Combat now uses ship base attack + factory bonus
                const damage = attacker.attack + bonuses.firepowerBonus;
                damageMap[target.id] = (damageMap[target.id] || 0) + damage;
                
                // Track visual combat event
                events.push({
                   id: `ev-${attacker.id}-${target.id}-${Date.now()}`,
                   attackerPos: { x: attacker.x, y: attacker.y },
                   targetPos: { x: target.x, y: target.y },
                   color: PLAYER_COLORS[attacker.owner]
                });

                shipBattled.add(attacker.id);
                shipBattled.add(target.id);
              }
            }
          });
        }

        shipsAtPlanet.forEach(ship => {
          if (planet.owner === ship.owner && !shipBattled.has(ship.id)) {
            const healAmount = Math.floor(ship.maxHp * 0.25);
            ship.hp = Math.min(ship.maxHp, ship.hp + healAmount);
          }
        });
      });

      nextShips = nextShips.map(s => {
        if (damageMap[s.id]) s.hp -= damageMap[s.id];
        return s;
      }).filter(s => s.hp > 0);

      // --- 4. Planet Updates ---
      nextPlanets = nextPlanets.map(p => {
        if (p.owner === 'NEUTRAL') {
           const colonist = nextShips.find(s => s.currentPlanetId === p.id && (s.type === 'FREIGHTER' || s.maxPeopleCargo > 0));
           if (colonist) return { ...p, owner: colonist.owner, population: 1 };
           return p;
        }

        const invaders = nextShips.filter(s => s.currentPlanetId === p.id && s.owner !== p.owner && s.type === 'WARSHIP');
        const spies = nextShips.filter(s => s.currentPlanetId === p.id && s.owner !== p.owner && s.type === 'SCOUT' && s.status === 'ORBITING');

        const hasDefensiveShield = p.factories >= MAX_FACTORIES;
        const hasIndustrialBoom = p.factories >= MAX_FACTORIES && p.mines >= MAX_MINES;

        let nextPop = p.population;
        if (invaders.length > 0) {
           let popLoss = invaders.length;
           
           // Combat events for orbital bombardment
           invaders.forEach(inv => {
             events.push({
               id: `ev-bombard-${inv.id}-${p.id}-${Date.now()}`,
               attackerPos: { x: inv.x, y: inv.y },
               targetPos: { x: p.x, y: p.y },
               color: PLAYER_COLORS[inv.owner]
             });
           });

           if (hasDefensiveShield) {
              let saved = 0;
              for(let i=0; i<popLoss; i++) {
                if (Math.random() < 0.10) saved++;
              }
              popLoss -= saved;
           }
           nextPop = Math.max(0, p.population - popLoss);
        } else {
           const growthRate = hasIndustrialBoom ? 1.0 : 0.2;
           nextPop = Math.min(MAX_PLANET_POPULATION, p.population + growthRate); 
        }

        let maxSabotage = 0;
        spies.forEach(spy => {
           const spyBonuses = getEmpireBonuses(nextPlanets, spy.owner);
           const currentSabotage = 0.25 + spyBonuses.scoutBonus;
           if (currentSabotage > maxSabotage) maxSabotage = currentSabotage;
        });

        const mineModifier = 1.0 - maxSabotage;
        const income = (p.mines * 50 * mineModifier) + (p.factories * 20) + (Math.floor(nextPop) * 50);
        nextCredits[p.owner] = (nextCredits[p.owner] || 0) + income;

        return { 
          ...p, 
          population: nextPop, 
          owner: nextPop <= 0 && invaders.length > 0 ? invaders[0].owner : p.owner 
        };
      });

      const finalState: GameState = {
        ...gameState,
        round: gameState.round + 1,
        planets: nextPlanets,
        ships: nextShips,
        playerCredits: nextCredits,
        readyPlayers: [] 
      };

      setCombatEvents(events);

      if (db && gameId && !isConfigPlaceholder) {
        await set(ref(db, `games/${gameId}/state`), finalState);
      } else {
        setGameState(finalState);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const selectedObject = useMemo(() => {
    return gameState.planets.find(p => p.id === selectedId) || gameState.ships.find(s => s.id === selectedId) || null;
  }, [selectedId, gameState]);

  const isSpiedByMe = useMemo(() => {
    if (!selectedId || !selectedObject || !('population' in selectedObject)) return false;
    return gameState.ships.some(s => s.owner === playerRole && s.type === 'SCOUT' && s.currentPlanetId === selectedId && s.status === 'ORBITING');
  }, [selectedId, selectedObject, gameState.ships, playerRole]);

  const handleStartNewGame = async (playerCount: number, aiCount: number, names: Record<string, string>, difficulty: AiDifficulty) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialState = generateInitialState(playerCount, aiCount, undefined, names, difficulty);
    
    setGameId(id);
    setPlayerRole('P1');
    setViewMode('HOST');
    setGameState(initialState);
    setHasStarted(true);

    if (db && !isConfigPlaceholder) {
      try {
        await set(ref(db, `games/${id}/state`), initialState);
        await set(ref(db, `lobby/${id}`), {
          name: `${names['P1']}'s Sector`,
          round: 1,
          playerCount
        });
      } catch (e) { console.error(e); }
    }
  };

  const isSelfReady = (gameState.readyPlayers || []).includes(playerRole || 'P1');

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 z-[500] star-bg safe-pt safe-pb">
        <div className="w-full max-w-sm glass-card rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl border-cyan-500/20">
          <h1 className="text-5xl font-black text-white italic tracking-tighter mb-1">STELLAR</h1>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-10">Sector Command</p>
          <div className="space-y-4">
            <button onClick={() => setIsNewGameOpen(true)} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-cyan-800">
              Initialize New Sector
            </button>
            <button onClick={() => setIsLobbyOpen(true)} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/5 transition-all active:scale-95">
              Scan Signatures
            </button>
          </div>
        </div>
        <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} onConfirm={handleStartNewGame} />
        <LobbyModal isOpen={isLobbyOpen} onClose={() => setIsLobbyOpen(false)} db={db} onJoin={(id, role) => {
            setGameId(id); setPlayerRole(role); setViewMode('PLAYER'); setHasStarted(true);
        }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] text-slate-100 overflow-hidden font-['Space_Grotesk'] safe-pt safe-pb">
      <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 bg-slate-950/80 border-b border-white/5 backdrop-blur-2xl z-[100]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-black text-cyan-500 uppercase tracking-widest italic leading-none truncate max-w-[100px] md:max-w-none">
              {viewMode === 'HOST' ? 'HQ (P1)' : `CMD (${playerRole})`}
            </span>
            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase">RND {gameState.round}</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-1 ml-4 bg-black/20 px-3 py-1 rounded-full border border-white/5">
             {humanPlayers.map(p => (
               <div key={p} className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PLAYER_COLORS[p] }} />
                 <span className={`text-[8px] font-black uppercase tracking-tighter ${(gameState.readyPlayers || []).includes(p) ? 'text-emerald-400' : 'text-slate-600'}`}>
                   {(gameState.readyPlayers || []).includes(p) ? 'READY' : 'WAITING'}
                 </span>
                 <span className="mx-1 text-slate-800 text-[8px]">/</span>
               </div>
             ))}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end">
          {viewMode === 'HOST' ? (
            <button 
              onClick={executeTurn} 
              disabled={isProcessing || !allPlayersReady} 
              className={`px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 border-b-2 flex items-center gap-2 ${!allPlayersReady ? 'bg-slate-800 border-slate-900 text-slate-500' : isProcessing ? 'bg-slate-800 border-slate-900 text-slate-500' : 'bg-emerald-600 border-emerald-800 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'}`}
            >
              {isProcessing ? (
                <div className="w-3 h-3 border-2 border-slate-500/20 border-t-slate-500 rounded-full animate-spin" />
              ) : !allPlayersReady ? (
                <span>⏳ WAITING ({(gameState.readyPlayers || []).filter(p => p !== 'P1').length}/{humanPlayers.length - 1})</span>
              ) : (
                <>
                  <span className="hidden md:inline">📡</span>
                  <span>EXECUTE</span>
                </>
              )}
            </button>
          ) : (
            <button 
              onClick={handleReadyToggle}
              className={`px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border-b-2 flex items-center gap-2 ${isSelfReady ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-cyan-600 border-cyan-800 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'}`}
            >
              {isSelfReady ? '✓ SUBMITTED' : '🚀 SUBMIT ORDERS'}
            </button>
          )}

          <div className="flex flex-col items-end px-2 md:px-3 py-1 bg-slate-900/60 rounded-xl border border-white/5 min-w-[70px] md:min-w-[90px]">
            <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase leading-none mb-1">Credits</span>
            <span className="text-[10px] md:text-xs font-bold text-amber-500">💰 {gameState.playerCredits[playerRole || 'P1'] || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <button onClick={() => setIsAdvisorOpen(true)} className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-cyan-600/20 flex items-center justify-center text-sm border border-cyan-500/20 hover:bg-cyan-600/30 transition-colors">🤖</button>
            <button onClick={() => setIsHelpOpen(true)} className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sm border border-white/5 hover:bg-slate-700 transition-colors">?</button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView 
          planets={gameState.planets} 
          ships={gameState.ships} 
          selectedId={selectedId} 
          onSelect={handleSelect}
          isSettingCourse={isSettingCourse}
          combatEvents={combatEvents}
        />
        
        <SelectionPanel 
          selection={selectedObject} 
          onClose={() => setSelectedId(null)}
          playerRole={playerRole}
          credits={gameState.playerCredits[playerRole || 'P1'] || 0}
          onIssueOrder={handleIssueOrder}
          isSettingCourse={isSettingCourse}
          isSpied={isSpiedByMe}
          ships={gameState.ships}
          planets={gameState.planets}
        />
      </main>

      <AdvisorPanel isOpen={isAdvisorOpen} onClose={() => setIsAdvisorOpen(false)} gameState={gameState} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} onOpenInvite={() => setIsInviteOpen(true)} gameState={gameState} playerRole={playerRole} />
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} frequency={gameId || 'OFFLINE'} gameState={gameState} />
    </div>
  );
};

export default App;
