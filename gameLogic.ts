
import { Planet, Ship, GameState } from './types';

export const GRID_SIZE = 1000;
export const PLANET_COUNT = 15;

const PLANET_NAMES = [
  "Star-Hollow", "Rose Garden", "Crystal Cove", "Silver Moon", "Sunset Isle", 
  "Emerald Peak", "Cloud City", "Sapphire Shore", "Ruby Ridge", "Pearl Oasis", 
  "Amber Fields", "Topaz Town", "Opal Orbit", "Jade Junction", "Quartz Quay"
];

export const generateInitialState = (): GameState => {
  const planets: Planet[] = PLANET_NAMES.slice(0, PLANET_COUNT).map((name, i) => ({
    id: `p-${i}`,
    name,
    x: Math.random() * (GRID_SIZE - 100) + 50,
    y: Math.random() * (GRID_SIZE - 100) + 50,
    owner: i === 0 ? 'PLAYER' : (i < 4 ? 'ENEMY_A' : (i < 7 ? 'ENEMY_B' : 'NEUTRAL')),
    population: i < 7 ? 1000 : 0,
    goldIncome: i === 0 ? 5 : 0,
    supplies: i === 0 ? 5 : 0,
    defense: i < 7 ? 10 : 0,
  }));

  const ships: Ship[] = [
    {
      id: 's-0',
      name: 'The Explorer',
      type: 'SCOUT',
      owner: 'PLAYER',
      x: planets[0].x,
      y: planets[0].y,
      currentPlanetId: planets[0].id,
      cargo: 0,
      maxCargo: 50,
      hp: 100,
      maxHp: 100,
      status: 'ORBITING'
    },
    {
      id: 's-1',
      name: 'Big Hauler',
      type: 'FREIGHTER',
      owner: 'PLAYER',
      x: planets[0].x,
      y: planets[0].y,
      currentPlanetId: planets[0].id,
      cargo: 100,
      maxCargo: 500,
      hp: 150,
      maxHp: 150,
      status: 'ORBITING'
    }
  ];

  return {
    round: 1,
    planets,
    ships,
    gold: 500,
    logs: ["Hi Commander! I'm Jarvis. We've settled on Star-Hollow. Let's explore the neighborhood!"]
  };
};

export const SHIP_SPEEDS = {
  SCOUT: 80,
  FREIGHTER: 40,
  WARSHIP: 60,
};

export const SHIP_COSTS = {
  SCOUT: 200,
  FREIGHTER: 400,
  WARSHIP: 800,
};
