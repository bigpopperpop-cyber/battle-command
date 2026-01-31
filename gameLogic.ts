
import { Planet, Ship, GameState, Owner, ShipType, AiDifficulty } from './types';

export const GRID_SIZE = 1200;
export const PLANET_COUNT = 24;
export const MIN_PLANET_DISTANCE = 180;
export const MAX_PLANET_POPULATION = 5;
export const MAX_FACTORIES = 5;
export const MAX_MINES = 10;
export const MAX_BATTERIES = 5; // New: Planetary defense limit

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

export const SHIP_STATS = {
  SCOUT: { speed: 180, hp: 100, attack: 0, cargo: 20, people: 0, cost: 300 },
  FREIGHTER: { speed: 60, hp: 500, attack: 15, cargo: 1000, people: 2, cost: 600 },
  WARSHIP: { speed: 100, hp: 1000, attack: 125, cargo: 80, people: 0, cost: 1500 }
};

export const SHIP_SPEEDS = { 
  SCOUT: SHIP_STATS.SCOUT.speed, 
  FREIGHTER: SHIP_STATS.FREIGHTER.speed, 
  WARSHIP: SHIP_STATS.WARSHIP.speed 
};
export const SHIP_COSTS = { 
  SCOUT: SHIP_STATS.SCOUT.cost, 
  FREIGHTER: SHIP_STATS.FREIGHTER.cost, 
  WARSHIP: SHIP_STATS.WARSHIP.cost 
};

export const getEmpireBonuses = (planets: Planet[], owner: Owner) => {
  const factoryCount = planets
    .filter(p => p.owner === owner)
    .reduce((sum, p) => sum + p.factories, 0);
  
  return {
    discount: Math.min(0.75, factoryCount * 0.01),
    strength: 1 + (factoryCount * 0.01),
    firepowerBonus: factoryCount * 0.5,
    scoutBonus: factoryCount >= 15 ? 0.05 : 0,
    warshipCapacity: factoryCount >= 30 ? 4 : (factoryCount >= 25 ? 2 : (factoryCount >= 20 ? 1 : 0)),
    factoryCount
  };
};

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
  customNames?: Record<string, string>,
  aiDifficulty: AiDifficulty = 'EASY'
): GameState => {
  const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
  const rnd = seededRandom(actualSeed);

  const planets: Planet[] = [];
  
  for (let i = 0; i < PLANET_COUNT; i++) {
    let owner: Owner = 'NEUTRAL';
    if (i < playerCount) owner = `P${i + 1}` as Owner;

    let x = 0, y = 0, attempts = 0, isTooClose = true;
    while (isTooClose && attempts < 100) {
      x = Math.floor(rnd() * (GRID_SIZE - 200) + 100);
      y = Math.floor(rnd() * (GRID_SIZE - 200) + 100);
      isTooClose = planets.some(p => Math.sqrt((p.x-x)**2 + (p.y-y)**2) < MIN_PLANET_DISTANCE);
      attempts++;
    }

    const maxDef = owner !== 'NEUTRAL' ? 500 : 100;

    planets.push({
      id: `p-${i}`,
      name: PLANET_NAMES[i],
      x, y,
      owner,
      population: owner !== 'NEUTRAL' ? 3 : 0,
      resources: 500,
      factories: owner !== 'NEUTRAL' ? 2 : 0,
      mines: owner !== 'NEUTRAL' ? 2 : 0,
      batteries: owner !== 'NEUTRAL' ? 1 : 0,
      defense: maxDef,
      maxDefense: maxDef,
    });
  }

  const ships: Ship[] = [];
  const playerCredits: Record<string, number> = {};
  const playerNames: Record<string, string> = customNames || {};
  const aiPlayers: Owner[] = [];
  const humanCount = playerCount - aiCount;

  for (let i = 1; i <= playerCount; i++) {
    const pId = `P${i}` as Owner;
    playerCredits[pId] = 2000;
    if (!playerNames[pId]) playerNames[pId] = `Empire ${pId}`;

    const home = planets.find(p => p.owner === pId)!;
    if (i > humanCount) aiPlayers.push(pId);

    const stats = SHIP_STATS.SCOUT;
    ships.push({
      id: `s-${pId}-0`,
      name: `${playerNames[pId]} Vanguard`,
      type: 'SCOUT',
      owner: pId,
      x: home.x,
      y: home.y,
      currentPlanetId: home.id,
      cargo: 0,
      maxCargo: stats.cargo,
      cargoPeople: 0,
      maxPeopleCargo: stats.people,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      speed: stats.speed,
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
    logs: ["Commander, colonies initialized. Protect your population to maintain sector control."],
    playerCount,
    aiPlayers,
    aiDifficulty,
    isHost: true,
    activePlayer: 'P1',
    readyPlayers: [],
    winner: null
  };
};
