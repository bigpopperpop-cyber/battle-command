
import { Planet, Ship, GameState, Owner } from './types';

export const GRID_SIZE = 1200;
export const PLANET_COUNT = 24;
export const MIN_PLANET_DISTANCE = 180; // Ensuring planets don't touch or crowd each other

const PLANET_NAMES = [
  "Rigel VII", "Betelgeuse Prime", "Delta Pavonis", "Alpha Centauri", "Sol", 
  "Procyon", "Sirius B", "Vega", "Altair", "Deneb", "Castor", "Pollux", 
  "Antares", "Spica", "Arcturus", "Fomalhaut", "Capella", "Aldebaran",
  "Regulus", "Bellatrix", "Alcor", "Mizar", "Thuban", "Denebola"
];

export const PLAYER_COLORS: Record<Owner, string> = {
  P1: '#22d3ee', // Cyan
  P2: '#f87171', // Red
  P3: '#c084fc', // Purple
  P4: '#4ade80', // Green
  P5: '#fbbf24', // Yellow
  P6: '#f472b6', // Pink
  P7: '#fb923c', // Orange
  P8: '#2dd4bf', // Teal
  NEUTRAL: '#94a3b8' // Gray
};

export const SHIP_SPEEDS = { SCOUT: 120, FREIGHTER: 60, WARSHIP: 80 };
export const SHIP_COSTS = { SCOUT: 200, FREIGHTER: 400, WARSHIP: 800 };

const seededRandom = (a: number) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export const generateInitialState = (
  playerCount: number = 2, 
  aiCount: number = 0, 
  seed?: number,
  customNames?: Record<string, string>
): GameState => {
  const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
  const rnd = seededRandom(actualSeed);

  const planets: Planet[] = [];
  
  for (let i = 0; i < PLANET_COUNT; i++) {
    let owner: Owner = 'NEUTRAL';
    if (i < playerCount) {
      owner = `P${i + 1}` as Owner;
    }

    let x = 0, y = 0;
    let attempts = 0;
    let isTooClose = true;

    // Keep generating coordinates until we find a spot far enough from others
    while (isTooClose && attempts < 100) {
      x = Math.floor(rnd() * (GRID_SIZE - 200) + 100);
      y = Math.floor(rnd() * (GRID_SIZE - 200) + 100);
      
      isTooClose = planets.some(p => {
        const dx = p.x - x;
        const dy = p.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < MIN_PLANET_DISTANCE;
      });
      
      attempts++;
    }

    planets.push({
      id: `p-${i}`,
      name: PLANET_NAMES[i],
      x,
      y,
      owner,
      population: owner !== 'NEUTRAL' ? 1000 : 0,
      resources: 500,
      factories: owner !== 'NEUTRAL' ? 5 : 0,
      mines: owner !== 'NEUTRAL' ? 5 : 0,
      defense: owner !== 'NEUTRAL' ? 10 : 0,
    });
  }

  const ships: Ship[] = [];
  const playerCredits: Record<string, number> = {};
  const playerNames: Record<string, string> = customNames || {};
  const aiPlayers: Owner[] = [];
  const humanCount = playerCount - aiCount;

  for (let i = 1; i <= playerCount; i++) {
    const pId = `P${i}` as Owner;
    playerCredits[pId] = 1000;
    if (!playerNames[pId]) {
      playerNames[pId] = `Empire of ${pId}`;
    }

    const home = planets.find(p => p.owner === pId)!;
    
    if (i > humanCount) {
      aiPlayers.push(pId);
    }

    ships.push({
      id: `s-${pId}-0`,
      name: `${playerNames[pId]} Explorer`,
      type: 'SCOUT',
      owner: pId,
      x: home.x,
      y: home.y,
      currentPlanetId: home.id,
      cargo: 0,
      maxCargo: 50,
      hp: 100,
      maxHp: 100,
      status: 'ORBITING'
    });
  }

  return {
    seed: actualSeed,
    round: 1,
    planets,
    ships,
    playerCredits,
    playerNames,
    logs: ["Commander, Galactic chart generated. No sector overlaps detected."],
    playerCount,
    aiPlayers,
    isHost: true,
    activePlayer: 'P1',
    readyPlayers: []
  };
};
