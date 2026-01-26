
export type Owner = 'PLAYER' | 'ENEMY_A' | 'ENEMY_B' | 'NEUTRAL';

export interface Planet {
  id: string;
  name: string;
  x: number;
  y: number;
  owner: Owner;
  population: number;
  resources: number; // Gold/Credits
  factories: number;
  mines: number;
  defense: number;
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
  hp: number;
  maxHp: number;
  status: 'IDLE' | 'MOVING' | 'ORBITING';
}

export interface GameState {
  round: number;
  planets: Planet[];
  ships: Ship[];
  credits: number;
  logs: string[];
}

export interface AdvisorMessage {
  role: 'assistant' | 'user';
  content: string;
}
