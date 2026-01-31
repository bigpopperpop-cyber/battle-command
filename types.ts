
export type Owner = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'NEUTRAL';
export type AiDifficulty = 'EASY' | 'ADVANCED';

export interface Planet {
  id: string;
  name: string;
  x: number;
  y: number;
  owner: Owner;
  population: number; 
  resources: number; 
  factories: number;
  mines: number;
  batteries: number; // New: Defense system
  defense: number; 
  maxDefense: number;
}

export type ShipType = 'SCOUT' | 'FREIGHTER' | 'WARSHIP';

export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  owner: Owner;
  x: number;
  y: number;
  targetPlanetId?: string;
  currentPlanetId?: string;
  fleetId?: string;
  cargo: number;
  maxCargo: number;
  cargoPeople: number;
  maxPeopleCargo: number;
  attack: number;
  hp: number;
  maxHp: number;
  speed: number;
  status: 'IDLE' | 'MOVING' | 'ORBITING';
}

export interface GameState {
  seed: number;
  round: number;
  planets: Planet[];
  ships: Ship[];
  playerCredits: Record<string, number>;
  playerNames: Record<string, string>;
  playerCount: number;
  aiPlayers: Owner[];
  aiDifficulty: AiDifficulty;
  activePlayer: Owner;
  readyPlayers: Owner[]; 
  logs: string[];
  isHost?: boolean;
  winner?: Owner | null; // New: Victory tracking
}
