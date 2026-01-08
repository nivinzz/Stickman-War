
import { UnitType, UnitStats, LevelTheme, Language, UpgradeState } from './types';

// Widescreen & Expanded World
export const CANVAS_WIDTH = 1600; // Wider view
export const CANVAS_HEIGHT = 600;
export const WORLD_WIDTH = 3200;  // Longer battlefield
export const GROUND_Y = 500;

export const MAX_POPULATION = 25; // Base max is 25
export const MAX_HEROES = 5;      
export const MAX_LEVEL = 50;

export const POP_UPGRADE_COST = 2000;
export const MAX_POP_UPGRADES = 5; // Buy 5 times -> Total 30

export const PASSIVE_GOLD_UPGRADE_COST = 3000;
export const MAX_PASSIVE_GOLD_LEVEL = 5; // Max 5 upgrades (Base 1 + 10 = 11G/s)

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
  [UnitType.ARCHER]: { hp: 80, maxHp: 80, damage: 15, range: 450, minRange: 200, speed: 1.2, attackSpeed: 90, cost: 200, spawnTime: 240 }, 
  [UnitType.CAVALRY]: { hp: 300, maxHp: 300, damage: 35, range: 70, speed: 3.5, attackSpeed: 60, cost: 350, spawnTime: 360 },
  [UnitType.HERO]: { hp: 1200, maxHp: 1200, damage: 80, range: 70, speed: 2.0, attackSpeed: 40, cost: 1000, spawnTime: 600 },
};

// Max Levels for Upgrade Menu
export const MAX_UPGRADE_LEVELS: Partial<Record<keyof UpgradeState, number>> = {
    baseHp: 20,
    towerPower: 20,
    heroPower: 10,  
    minerSpeed: 15, 
    spawnSpeed: 10, 
    arrowRainPower: 15, 
    lightningPower: 15,
    freezePower: 15,
    swordDamage: 50, 
    archerDamage: 50,
    cavalryDamage: 50,
};

export const SKILL_COOLDOWNS_FRAMES = {
  ARROW_RAIN: 20 * 60, // 20s
  LIGHTNING: 27 * 60,  // 27s
  FREEZE: 20 * 60,     // 20s
};

export const MINING_TIME = 60; 
export const GOLD_PER_TRIP = 25;
export const INITIAL_GOLD = 200; 

// Loop themes for 50 levels
export const LEVEL_THEMES: LevelTheme[] = [
  { skyTop: '#38bdf8', skyBottom: '#bae6fd', mountainColor: '#64748b', groundColor: '#166534', nameEn: "Green Valley", nameVn: "Thung Lũng Xanh" },
  { skyTop: '#7dd3fc', skyBottom: '#e0f2fe', mountainColor: '#94a3b8', groundColor: '#15803d', nameEn: "River Crossing", nameVn: "Bến Sông" },
  { skyTop: '#c026d3', skyBottom: '#f97316', mountainColor: '#475569', groundColor: '#3f6212', nameEn: "Sunset Hills", nameVn: "Đồi Hoàng Hôn" },
  { skyTop: '#db2777', skyBottom: '#fb923c', mountainColor: '#57534e', groundColor: '#4d7c0f', nameEn: "Autumn Forest", nameVn: "Rừng Thu" },
  { skyTop: '#0f172a', skyBottom: '#312e81', mountainColor: '#1e293b', groundColor: '#0f172a', nameEn: "Midnight Peak", nameVn: "Đỉnh Núi Đêm" },
  { skyTop: '#1e1b4b', skyBottom: '#4338ca', mountainColor: '#334155', groundColor: '#1e293b', nameEn: "Moonlight Path", nameVn: "Đường Trăng" },
  { skyTop: '#78350f', skyBottom: '#fcd34d', mountainColor: '#713f12', groundColor: '#451a03', nameEn: "Dusty Canyon", nameVn: "Hẻm Núi Bụi" },
  { skyTop: '#a16207', skyBottom: '#fef08a', mountainColor: '#854d0e', groundColor: '#713f12', nameEn: "Sandstorm Desert", nameVn: "Sa Mạc Bão Cát" },
  { skyTop: '#3f3f46', skyBottom: '#a1a1aa', mountainColor: '#27272a', groundColor: '#52525b', nameEn: "Iron Wasteland", nameVn: "Vùng Đất Sắt" },
  { skyTop: '#18181b', skyBottom: '#52525b', mountainColor: '#09090b', groundColor: '#3f3f46', nameEn: "Dark Fortress", nameVn: "Pháo Đài Đen" },
  { skyTop: '#450a0a', skyBottom: '#ef4444', mountainColor: '#000000', groundColor: '#280505', nameEn: "Inferno Gate", nameVn: "Cổng Địa Ngục" },
  { skyTop: '#7f1d1d', skyBottom: '#f87171', mountainColor: '#450a0a', groundColor: '#450a0a', nameEn: "Blood Plains", nameVn: "Cánh Đồng Máu" },
  { skyTop: '#312e81', skyBottom: '#4c1d95', mountainColor: '#1e1b4b', groundColor: '#2e1065', nameEn: "Void Dimension", nameVn: "Hư Không" },
  { skyTop: '#111827', skyBottom: '#000000', mountainColor: '#1f2937', groundColor: '#000000', nameEn: "The Abyss", nameVn: "Vực Thẳm" },
  { skyTop: '#ffffff', skyBottom: '#d1d5db', mountainColor: '#9ca3af', groundColor: '#f3f4f6', nameEn: "Heaven's End", nameVn: "Tận Cùng Thiên Giới" },
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
    upBaseHp: "Máu Nhà (+10%)",
    upTower: "Sức Mạnh Tháp (+10%)",
    upSword: "Sức Mạnh Kiếm (+10%)",
    upArcher: "Sức Mạnh Nỏ (+10%)",
    upCav: "Sức Mạnh Ngựa (+10%)",
    upSpawn: "Tốc Độ Mua (-10%)",
    upRain: "Sức Mạnh Mưa Tên",
    upBolt: "Sức Mạnh Sấm Sét",
    upFreeze: "Sức Mạnh Băng",
    upHero: "Sức Mạnh Tướng (+5%)",
    upMiner: "Kinh Tế (Đào/Vàng/Tốc)",

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
    upBaseHp: "Base HP (+10%)",
    upTower: "Tower Power (+10%)",
    upSword: "Sword Power (+10%)",
    upArcher: "Crossbow Power (+10%)",
    upCav: "Cavalry Power (+10%)",
    upSpawn: "Spawn Speed (-10%)",
    upRain: "Arrow Rain DMG",
    upBolt: "Lightning DMG",
    upFreeze: "Freeze Power",
    upHero: "Hero Power (+5%)",
    upMiner: "Economy (Mine/Gold/Spd)",

    tip: "Tip: Use 'Patrol' to spread your units and avoid enemy Arrow Rain!",
    exit: "Exit"
  }
};
