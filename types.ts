
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
    DIE = 'DIE',
    DEAD = 'DEAD',
    MINE_WALK_TO_MINE = 'MINE_WALK_TO_MINE',
    MINE_GATHERING = 'MINE_GATHERING',
    MINE_RETURN = 'MINE_RETURN'
}

export enum TerrainType {
    PLAINS = 'PLAINS',
    HILLS = 'HILLS',
    SWAMP = 'SWAMP'
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

export type Language = 'VN' | 'EN';

export interface UnitStats {
    hp: number;
    maxHp: number;
    damage: number;
    range: number;
    speed: number;
    attackSpeed: number;
    cost: number;
    spawnTime: number;
    minRange?: number;
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
    rotation: number;
    deathTimer: number;
    opacity: number;
    freezeTimer: number;
    isSlowed: boolean;
    patrolHeading?: 'A' | 'B';
    isVanguard?: boolean;
    miningTimer?: number;
    goldCarrying?: number;
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
    type: 'ARROW' | 'TOWER_SHOT' | 'LIGHTNING_BOLT';
    rotation: number;
    targetId?: string | null;
    fromSkill?: boolean;
    points?: {x: number, y: number}[];
    opacity?: number;
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
    duration: number;
    damagePercent: number;
    explosionDamagePercent?: number;
    slowFactor: number;
    faction: Faction;
    visuals?: IceShard[];
}

export interface EnvElement {
    id: string;
    type: 'CLOUD' | 'TREE' | 'BIRD';
    x: number;
    y: number;
    speed: number;
    scale: number;
    variant: number;
}

export interface GameLevel {
    level: number;
    enemySpawnRate: number;
    enemyStatMultiplier: number;
    enemySmartAI: boolean;
    enemyGoldDrip: number;
    isBoss: boolean;
    isMultiplayer: boolean;
    isSpectator: boolean;
    opponentName?: string;
    opponentElo?: number;
    mapThemeIndex: number;
    teammates?: PlayerProfile[];
}

export interface LevelTheme {
    skyTop: string;
    skyBottom: string;
    mountainColor: string;
    groundColor: string;
    treeTrunk: string;
    treeLeaf1: string;
    treeLeaf2: string;
    nameEn: string;
    nameVn: string;
}

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
    minerSpeed: number;
    maxPopUpgrade: number;
    passiveGold: number;
    towerPower: number;
}

export interface SpawnQueueItem {
    id: string;
    type: UnitType;
    totalTime: number;
    remainingTime: number;
    faction: Faction;
}

export interface PlayerStats {
    wins: number;
    losses: number;
    streak: number;
    elo: number;
}

export interface CasualStats {
    wins: number;
    losses: number;
    streak: number;
}

export interface PlayerProfile {
    name: string;
    avatarSeed: string;
    rankedStats: PlayerStats;
    casualStats: CasualStats;
    rankTier: RankTier;
    status: 'IDLE' | 'WAITING' | 'PLAYING' | 'OFFLINE';
}

export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    rank: RankTier;
    timestamp: number;
    topRank?: number;
    isSystem?: boolean;
}

export interface LobbyRoom {
    id: string;
    name: string;
    host: string;
    hostElo: number;
    status: 'WAITING' | 'PLAYING';
    players: number;
    mapIndex: number;
    guestName?: string;
    guestElo?: number;
}

export interface AllianceMember {
    name: string;
    role: 'LEADER' | 'MEMBER';
    contribution: number;
    elo: number;
    avatarSeed: string;
}

export interface Alliance {
    id: string;
    name: string;
    tag: string;
    level: number;
    members: AllianceMember[];
    requests: PlayerProfile[]; 
    funds: number;
    elo: number;
}

export interface TickerNotification {
    id: string;
    text: string;
    type: 'SYSTEM' | 'PERSONAL' | 'ALLIANCE';
    color?: string;
}