
export enum UnitType {
  MINER = 'MINER',
  SWORDMAN = 'SWORDMAN',
  ARCHER = 'ARCHER',
  CAVALRY = 'CAVALRY',
  HERO = 'HERO'
}

export enum Faction {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY'
}

export enum UnitState {
  IDLE = 'IDLE',
  MOVE = 'MOVE',
  ATTACK = 'ATTACK',
  MINE_WALK_TO_MINE = 'MINE_WALK_TO_MINE',
  MINE_GATHERING = 'MINE_GATHERING',
  MINE_RETURN = 'MINE_RETURN',
  DIE = 'DIE',     
  DEAD = 'DEAD'    
}

export interface UnitStats {
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  minRange?: number; // New property for minimum firing distance
  speed: number;
  attackSpeed: number; 
  cost: number;
  spawnTime: number; // Frames to produce
}

export interface Unit {
  id: string;
  type: UnitType;
  faction: Faction;
  x: number;
  y: number;
  state: UnitState;
  stats: UnitStats;
  lastAttackFrame: number;
  targetId: string | null;
  width: number;
  height: number;
  animationFrame: number;
  
  miningTimer?: number;
  goldCarrying?: number;
  
  // Patrol State
  patrolHeading?: 'A' | 'B'; // A = Rally Point (Blue), B = Patrol Point (Red)

  // Status Effects
  freezeTimer: number; // Keep for lingering slow if needed
  isSlowed?: boolean; // New flag for "Shatter" damage bonus

  rotation: number; 
  deathTimer: number; 
  opacity: number;
}

export interface Hazard {
    id: string;
    type: 'FREEZE_ZONE';
    x: number;
    y: number;
    width: number;
    height: number;
    duration: number; // Frames
    damagePercent: number; // % Max HP per second
    slowFactor: number; // Speed multiplier (e.g., 0.5)
    faction: Faction; // Added to check for friendly fire
}

export interface SpawnQueueItem {
  id: string;
  type: UnitType;
  totalTime: number;
  remainingTime: number;
  faction: Faction;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number; 
  vy: number; 
  startX: number; 
  damage: number;
  faction: Faction;
  active: boolean;
  type: 'ARROW' | 'LIGHTNING_BOLT' | 'TOWER_SHOT'; 
  rotation: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: boolean;
}

export interface Firework {
  id: string;
  x: number;
  y: number;
  color: string;
  particles: Particle[];
  exploded: boolean;
  timer: number;
}

export interface EnvElement {
  id: string;
  type: 'CLOUD' | 'BIRD' | 'TREE' | 'GRASS';
  x: number;
  y: number;
  speed: number;
  scale: number;
  variant: number; 
}

export interface LevelTheme {
  skyTop: string;
  skyBottom: string;
  mountainColor: string;
  groundColor: string;
  nameEn: string;
  nameVn: string;
}

export interface GameLevel {
  level: number;
  enemySpawnRate: number;      
  enemyStatMultiplier: number; 
  enemySmartAI: boolean;       
  enemyGoldDrip: number;
  isBoss: boolean; 
}

// Granular Upgrades
export interface UpgradeState {
  baseHp: number;
  swordDamage: number;
  archerDamage: number;
  cavalryDamage: number;
  spawnSpeed: number;
  arrowRainPower: number;
  lightningPower: number;
  freezePower: number; 
  heroPower: number; 
  minerSpeed: number; // Acts as "Economy" level
  maxPopUpgrade: number; // Number of extra slots purchased
  passiveGold: number; // Extra passive gold level (0 to 4, resulting in 1 to 5 total)
  towerPower: number; // New: Tower Damage Upgrade
}

export type Language = 'VN' | 'EN';
