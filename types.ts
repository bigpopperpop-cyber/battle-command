
export type Owner = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'NEUTRAL';
export type AiDifficulty = 'EASY' | 'ADVANCED';
export type PlanetSpecialization = 'NONE' | 'SHIPYARD' | 'FORTRESS' | 'INDUSTRIAL';

export interface Planet {
  id: string;
  name: string;
  customName?: string;
  x: number;
  y: number;
  owner: Owner;
  population: number; 
  resources: number; 
  factories: number;
  mines: number;
  batteries: number;
  defense: number; 
  maxDefense: number;
  specialization: PlanetSpecialization;
  autoDefense: boolean;
}

export type ShipType = 'SCOUT' | 'FREIGHTER' | 'WARSHIP';

export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  owner: Owner;
  x: number;
  y: number;
  targetPlanetId: string | null;
  currentPlanetId: string | null;
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
  isScrambled?: boolean;
}

export interface CombatScrap {
  id: string;
  x: number;
  y: number;
  color: string;
  timestamp: number;
}

export interface GalacticEvent {
  type: 'COMET' | 'SUPERNOVA';
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  roundStart: number;
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
  winner?: Owner | null;
  emotes?: Record<string, { text: string, timestamp: number }>;
  techs?: Record<string, { engine: number, shields: number, scanners: number }>;
  activeEvents?: GalacticEvent[];
  combatScraps?: CombatScrap[];
}
