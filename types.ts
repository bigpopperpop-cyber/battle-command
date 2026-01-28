
export type Owner = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'NEUTRAL';
export type AiDifficulty = 'EASY' | 'ADVANCED';

export interface Planet {
  id: string;
  name: string;
  x: number;
  y: number;
  owner: Owner;
  population: number; // Current people (0-5)
  resources: number; 
  factories: number;
  mines: number;
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
  cargo: number;
  maxCargo: number;
  cargoPeople: number; // Current people being transported
  maxPeopleCargo: number; // Max people capacity
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  status: 'IDLE' | 'MOVING' | 'ORBITING';
}

export interface PlayerOrders {
  playerId: Owner;
  shipOrders: { shipId: string; targetPlanetId: string }[];
  planetOrders: { planetId: string; builds: ('MINE' | 'FACTORY')[] }[];
}

export interface GameState {
  seed: number;
  round: number;
  planets: Planet[];
  ships: Ship[];
  playerCredits: Record<string, number>;
  playerNames: Record<string, string>;
  logs: string[];
  playerCount: number;
  aiPlayers: Owner[];
  aiDifficulty: AiDifficulty;
  isHost: boolean;
  activePlayer: Owner;
  readyPlayers: Owner[]; 
}

export interface AdvisorMessage {
  role: 'assistant' | 'user';
  content: string;
}
