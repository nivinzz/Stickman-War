
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
  DEAD = 'DEAD',
  RETREAT = 'RETREAT' // AI Specific state
}

export enum RankTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
  CHALLENGER = 'CHALLENGER',
  LEGEND = 'LEGEND'
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
  
  // Vanguard State
  isVanguard?: boolean; // If true, follows Green Flag

  // Status Effects
  freezeTimer: number; // Keep for lingering slow if needed
  isSlowed?: boolean; // New flag for "Shatter" damage bonus

  rotation: number; 
  deathTimer: number; 
  opacity: number;
}

export interface IceShard {
    x: number;
    height: number;
    width: number;
    tilt: number;
}

export interface Hazard {
    id: string;
    type: 'FREEZE_ZONE';
    x: number;
    y: number;
    width: number;
    height: number;
    duration: number; // Frames
    damagePercent: number; // % Max HP per second (DoT)
    explosionDamagePercent?: number; // % Max HP on explode
    slowFactor: number; // Speed multiplier (e.g., 0.5)
    faction: Faction; // Added to check for friendly fire
    visuals?: IceShard[]; // Visual data for ice spikes
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
  points?: {x: number, y: number}[]; // For Lightning zigzag
  opacity?: number; // For fading effects
  targetId?: string; // NEW: For homing arrows
  fromSkill?: boolean; // NEW: If true, does not damage castle
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
  treeTrunk: string;
  treeLeaf1: string; // Primary leaf color
  treeLeaf2: string; // Secondary/highlight leaf color
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
  isMultiplayer?: boolean; // New flag for online matches
  isSpectator?: boolean;   // New flag: Watch mode
  opponentName?: string;   // Name of the enemy player
  opponentElo?: number;    // Elo of the enemy (controls AI difficulty)
  mapThemeIndex?: number;  // Specific visual theme (0-11)
  isRanked?: boolean;      // True if Ranked match
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

export interface PlayerStats {
    wins: number;
    losses: number;
}

export interface PlayerProfile {
    name: string;
    // Ranked Stats (Competitive)
    rankedStats: PlayerStats & { 
        elo: number; 
        streak: number; // Winning streak for bonus points
    };
    // Casual/Friendly Stats
    casualStats: PlayerStats;
    
    rankTier: RankTier;
    status?: 'IDLE' | 'WAITING' | 'PLAYING'; 
}

export interface GameRoom {
    id: string;
    name: string;
    host: string;
    hostElo: number;
    guest?: string;
    guestElo?: number;
    mapThemeIndex: number; // 0-11
}

export type Language = 'VN' | 'EN';
