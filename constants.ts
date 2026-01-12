
import { UnitType, UnitStats, LevelTheme, Language, UpgradeState } from './types';

// Widescreen & Expanded World
export const CANVAS_WIDTH = 1600; // Wider view
export const CANVAS_HEIGHT = 600;
export const WORLD_WIDTH = 3200;  // Longer battlefield
export const GROUND_Y = 500;

export const MAX_POPULATION = 30; // Increased base max to 30 (Total 35 with upgrades)
export const MAX_HEROES = 5;      
export const MAX_LEVEL = 60; // Increased to 60

export const POP_UPGRADE_COST = 2000;
export const MAX_POP_UPGRADES = 10; // Increased to 10 (Total Max Pop = 40)

export const PASSIVE_GOLD_UPGRADE_COST = 3000;
export const MAX_PASSIVE_GOLD_LEVEL = 5; // Max 5 upgrades (Base 5 + 25 = 30G/s)

// Tower Constants
export const MAX_TOWERS = 5;
export const TOWER_COST_BASE = 1500;
export const TOWER_COST_INC = 500; 
export const TOWER_RANGE = 550;    // Increased range due to wider map
export const TOWER_DAMAGE_BASE = 25; 
export const TOWER_COOLDOWN = 60; 

export const BASE_HP = 2000;
// Push bases further apart
export const PLAYER_BASE_X = 200;
export const ENEMY_BASE_X = 3000; 
export const MINING_DISTANCE = 350; 
export const FOG_OF_WAR_RANGE = 600; // Increased fog range for wider screen

// Kill Rewards
export const REWARD_MELEE = 20;   
export const REWARD_ARCHER = 40;
export const REWARD_HERO = 200;

export const GRAVITY = 0.5;
export const FPS = 60;

// Unit configuration
export const UNIT_CONFIG: Record<UnitType, UnitStats> = {
  [UnitType.MINER]: { hp: 60, maxHp: 60, damage: 5, range: 10, speed: 2, attackSpeed: 60, cost: 50, spawnTime: 120 }, 
  [UnitType.SWORDMAN]: { hp: 150, maxHp: 150, damage: 20, range: 40, speed: 1.5, attackSpeed: 50, cost: 100, spawnTime: 180 },
  // Archer: Attack speed reduced to 180 (Slower fire rate), Range 475
  [UnitType.ARCHER]: { hp: 80, maxHp: 80, damage: 15, range: 475, minRange: 200, speed: 1.2, attackSpeed: 180, cost: 200, spawnTime: 240 }, 
  [UnitType.CAVALRY]: { hp: 300, maxHp: 300, damage: 35, range: 70, speed: 3.5, attackSpeed: 60, cost: 350, spawnTime: 360 },
  // Hero: Speed decreased from 2.0 to 1.0 (Slowest unit)
  [UnitType.HERO]: { hp: 1200, maxHp: 1200, damage: 80, range: 70, speed: 1.0, attackSpeed: 40, cost: 1000, spawnTime: 600 },
};

// Max Levels for Upgrade Menu (Aligned with new Gating System)
// Units: Max 90
// Others: Max 20
export const MAX_UPGRADE_LEVELS: Partial<Record<keyof UpgradeState, number>> = {
    baseHp: 20,
    towerPower: 20,
    heroPower: 20,  
    minerSpeed: 20, 
    spawnSpeed: 20, 
    arrowRainPower: 20, 
    lightningPower: 20,
    freezePower: 20,
    swordDamage: 90, 
    archerDamage: 90,
    cavalryDamage: 90,
};

export const SKILL_COOLDOWNS_FRAMES = {
  ARROW_RAIN: 20 * 60, // 20s
  LIGHTNING: 27 * 60,  // 27s
  FREEZE: 20 * 60,     // 20s
};

export const MINING_TIME = 60; 
export const GOLD_PER_TRIP = 25;
export const INITIAL_GOLD = 200; 

// --- STAT CALCULATION HELPER ---
export const calculateUnitStats = (type: UnitType, upgradeLevel: number): UnitStats => {
    const base = UNIT_CONFIG[type];
    const stats = { ...base };

    // Common Scaling: 5% per level for HP and Damage
    const commonScale = 1 + (upgradeLevel * 0.05);

    // Apply Common Scaling
    stats.maxHp = Math.floor(base.maxHp * commonScale);
    stats.hp = stats.maxHp;
    stats.damage = Math.floor(base.damage * commonScale);

    // Specific Logic
    if (type === UnitType.ARCHER) {
        // Archers gain 2% Attack Speed (Cooldown reduction) per level (Reduced from 3%)
        // Cap at 20% of original cooldown (0.2 multiplier)
        const speedScale = Math.max(0.2, 1 - (upgradeLevel * 0.02));
        stats.attackSpeed = Math.floor(base.attackSpeed * speedScale);
    } else if (type === UnitType.MINER) {
        // Miners gain Movement Speed
        stats.speed = base.speed + (upgradeLevel * 0.1);
    } else if (type === UnitType.HERO) {
        // Hero gains EVERYTHING 5%
        stats.speed = base.speed * commonScale;
    }

    return stats;
};

// Loop themes for 60 levels
// treeTrunk, treeLeaf1, treeLeaf2 allow for varied environments
export const LEVEL_THEMES: LevelTheme[] = [
  // 1-5: Classic Green
  { skyTop: '#38bdf8', skyBottom: '#bae6fd', mountainColor: '#64748b', groundColor: '#166534', treeTrunk: '#451a03', treeLeaf1: '#166534', treeLeaf2: '#15803d', nameEn: "Green Valley", nameVn: "Thung Lũng Xanh" },
  // 6-10: Autumn
  { skyTop: '#db2777', skyBottom: '#fb923c', mountainColor: '#57534e', groundColor: '#4d7c0f', treeTrunk: '#3f2c22', treeLeaf1: '#d97706', treeLeaf2: '#b45309', nameEn: "Autumn Forest", nameVn: "Rừng Thu" },
  // 11-15: Desert
  { skyTop: '#78350f', skyBottom: '#fcd34d', mountainColor: '#713f12', groundColor: '#ca8a04', treeTrunk: '#9a3412', treeLeaf1: '#65a30d', treeLeaf2: '#3f6212', nameEn: "Dusty Canyon", nameVn: "Hẻm Núi Bụi" },
  // 16-20: Snow/Winter
  { skyTop: '#bae6fd', skyBottom: '#f0f9ff', mountainColor: '#cbd5e1', groundColor: '#e2e8f0', treeTrunk: '#475569', treeLeaf1: '#f1f5f9', treeLeaf2: '#94a3b8', nameEn: "Frozen Peaks", nameVn: "Đỉnh Tuyết" },
  // 21-25: Night/Mystic
  { skyTop: '#1e1b4b', skyBottom: '#4338ca', mountainColor: '#334155', groundColor: '#1e293b', treeTrunk: '#0f172a', treeLeaf1: '#312e81', treeLeaf2: '#4f46e5', nameEn: "Moonlight Path", nameVn: "Đường Trăng" },
  // 26-30: Volcanic
  { skyTop: '#450a0a', skyBottom: '#ef4444', mountainColor: '#1c1917', groundColor: '#280505', treeTrunk: '#292524', treeLeaf1: '#7f1d1d', treeLeaf2: '#b91c1c', nameEn: "Inferno Gate", nameVn: "Cổng Địa Ngục" },
  // 31-35: Cherry Blossom
  { skyTop: '#fbcfe8', skyBottom: '#fff1f2', mountainColor: '#f472b6', groundColor: '#16a34a', treeTrunk: '#5b21b6', treeLeaf1: '#f9a8d4', treeLeaf2: '#f472b6', nameEn: "Sakura Hills", nameVn: "Đồi Hoa Anh Đào" },
  // 36-40: Dark/Dead
  { skyTop: '#18181b', skyBottom: '#52525b', mountainColor: '#09090b', groundColor: '#3f3f46', treeTrunk: '#000000', treeLeaf1: '#27272a', treeLeaf2: '#3f3f46', nameEn: "Dead Lands", nameVn: "Vùng Đất Chết" },
  // 41-45: Alien/Void
  { skyTop: '#312e81', skyBottom: '#4c1d95', mountainColor: '#1e1b4b', groundColor: '#2e1065', treeTrunk: '#c026d3', treeLeaf1: '#a855f7', treeLeaf2: '#7e22ce', nameEn: "Void Dimension", nameVn: "Hư Không" },
  // 46-50: Golden
  { skyTop: '#fef9c3', skyBottom: '#facc15', mountainColor: '#854d0e', groundColor: '#713f12', treeTrunk: '#78350f', treeLeaf1: '#facc15', treeLeaf2: '#ca8a04', nameEn: "Golden Realm", nameVn: "Vùng Đất Vàng" },
  // 51-55: Sky/Heaven
  { skyTop: '#ffffff', skyBottom: '#d1d5db', mountainColor: '#9ca3af', groundColor: '#f3f4f6', treeTrunk: '#e5e7eb', treeLeaf1: '#38bdf8', treeLeaf2: '#0ea5e9', nameEn: "Heaven's End", nameVn: "Thiên Giới" },
  // 56-60: Chaos
  { skyTop: '#000000', skyBottom: '#dc2626', mountainColor: '#2d0a0a', groundColor: '#450a0a', treeTrunk: '#000000', treeLeaf1: '#991b1b', treeLeaf2: '#ef4444', nameEn: "Chaos Origin", nameVn: "Cội Nguồn Hỗn Mang" },
];

export const getTheme = (level: number): LevelTheme => {
  return LEVEL_THEMES[(level - 1) % LEVEL_THEMES.length];
};

// Translations
export const TRANS = {
  VN: {
    selectLevel: "CHỌN MÀN CHƠI",
    locked: "Khóa",
    start: "BẮT ĐẦU",
    continue: "TIẾP TỤC",
    restart: "CHƠI LẠI",
    next: "Màn Tiếp Theo",
    menu: "Về Menu Map",
    paused: "TẠM DỪNG",
    resume: "Tiếp Tục",
    victory: "CHIẾN THẮNG!",
    defeat: "THẤT BẠI!",
    victoryDesc: "Quân địch đã bị tiêu diệt hoàn toàn.",
    defeatDesc: "Thành trì đã thất thủ.",
    pop: "Dân",
    heroPop: "Tướng",
    miner: "Dân",
    sword: "Kiếm",
    archer: "Nỏ",
    cav: "Ngựa",
    hero: "Tướng",
    tower: "Tháp",
    skillRain: "Mưa Tên",
    skillBolt: "Sấm Sét",
    skillFreeze: "Đóng Băng",
    tactics: "Chiến Thuật",
    defend: "Thủ/Cắm Cờ",
    patrol: "Tuần Tra",
    charge: "Tấn Công",
    holding: "Đang Giữ",
    placeFlag: "Cắm Cờ",
    skills: "Kỹ Năng",
    recruit: "Chiêu Mộ",
    baseUp: "Nâng Cấp",
    bossLevel: "Màn BOSS",
    ready: "SẴN SÀNG?",
    go: "CHIẾN!",
    finalWin: "CHÚC MỪNG! BẠN ĐÃ CHINH PHỤC TẤT CẢ!",
    buyPop: "Mua Slot",
    income: "Thu Nhập",
    
    // Upgrades
    upBaseHp: "Lâu Đài",
    upTower: "Tháp Canh",
    upSword: "Lính Kiếm",
    upArcher: "Cung Thủ",
    upCav: "Kỵ Binh",
    upSpawn: "Tốc Độ Mua",
    upRain: "Mưa Tên",
    upBolt: "Sấm Sét",
    upFreeze: "Đóng Băng",
    upHero: "Tướng Quân",
    upMiner: "Thợ Mỏ",

    tip: "Mẹo: Dùng 'Tuần Tra' để lính tản ra, tránh bị Mưa Tên của địch!",
    exit: "Thoát"
  },
  EN: {
    selectLevel: "SELECT LEVEL",
    locked: "Locked",
    start: "START",
    continue: "CONTINUE",
    restart: "RETRY",
    next: "Next Level",
    menu: "Back to Map",
    paused: "PAUSED",
    resume: "Resume",
    victory: "VICTORY!",
    defeat: "DEFEAT!",
    victoryDesc: "Enemy base destroyed.",
    defeatDesc: "Your base has fallen.",
    pop: "Pop",
    heroPop: "Heroes",
    miner: "Miner",
    sword: "Sword",
    archer: "Crossbow",
    cav: "Cav",
    hero: "Hero",
    tower: "Tower",
    skillRain: "Arrow Rain",
    skillBolt: "Thunder",
    skillFreeze: "Freeze",
    tactics: "Tactics",
    defend: "Defend",
    patrol: "Patrol",
    charge: "Charge",
    holding: "Holding",
    placeFlag: "Place Flag",
    skills: "Skills",
    recruit: "Recruit",
    baseUp: "Upgrades",
    bossLevel: "BOSS LEVEL",
    ready: "READY?",
    go: "FIGHT!",
    finalWin: "CONGRATULATIONS! YOU CONQUERED ALL!",
    buyPop: "Buy Slot",
    income: "Income",
    
    // Upgrades
    upBaseHp: "Castle",
    upTower: "Tower",
    upSword: "Swordman",
    upArcher: "Archer",
    upCav: "Cavalry",
    upSpawn: "Spawn Speed",
    upRain: "Arrow Rain",
    upBolt: "Lightning",
    upFreeze: "Freeze",
    upHero: "Champion",
    upMiner: "Miner",

    tip: "Tip: Use 'Patrol' to spread your units and avoid enemy Arrow Rain!",
    exit: "Exit"
  }
};
