
import { Unit, UnitType, Faction, UnitState, Projectile, Particle, GameLevel, UpgradeState, SpawnQueueItem, EnvElement, Firework, Hazard, IceShard } from '../types';
import { CANVAS_WIDTH, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, UNIT_CONFIG, MINING_TIME, MINING_DISTANCE, GOLD_PER_TRIP, BASE_HP, GRAVITY, MAX_POPULATION, MAX_HEROES, SKILL_COOLDOWNS_FRAMES, INITIAL_GOLD, MAX_PASSIVE_GOLD_LEVEL, POP_UPGRADE_COST, MAX_POP_UPGRADES, FOG_OF_WAR_RANGE, REWARD_MELEE, REWARD_ARCHER, REWARD_HERO, MAX_UPGRADE_LEVELS, MAX_TOWERS, TOWER_COST_BASE, TOWER_COST_INC, TOWER_RANGE, TOWER_DAMAGE_BASE, TOWER_COOLDOWN, calculateUnitStats } from '../constants';
import { soundManager } from './SoundManager';

export class GameEngine {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  envElements: EnvElement[] = [];
  fireworks: Firework[] = [];
  hazards: Hazard[] = []; 
  
  // Track active continuous skills
  activeStorms: { id: string, faction: Faction, x: number, duration: number, level: number }[] = [];

  // Production Queues
  playerQueue: SpawnQueueItem[] = [];
  enemyQueue: SpawnQueueItem[] = [];

  playerBaseHp: number = BASE_HP;
  playerMaxBaseHp: number = BASE_HP;
  enemyBaseHp: number = BASE_HP;
  enemyMaxBaseHp: number = BASE_HP;
  
  gold: number = 0;
  enemyGold: number = 0;
  
  frame: number = 0;
  levelTimer: number = 0; // Tracks frames elapsed in the level
  screenShake: number = 0;
  
  level: GameLevel;
  upgrades: UpgradeState;
  
  // AI State
  enemyUpgrades: UpgradeState; 
  
  // Towers
  playerTowers: number = 0;
  enemyTowers: number = 0;
  playerTowerCooldown: number = 0;
  enemyTowerCooldown: number = 0;

  gameOver: boolean = false;
  victory: boolean = false;
  paused: boolean = true; 
  started: boolean = false;
  
  // Player Strategy Flags
  rallyPoint: number | null = null; // Blue (Main)
  patrolPoint: number | null = null; // Red (Patrol End)
  vanguardPoint: number | null = null; // Green (Vanguard/Shield)
  vanguardPercentage: number = 0; // 0, 0.2, 0.3, 0.5
  
  // --- AI LOGIC PROPERTIES ---
  aiState: 'ATTACK' | 'DEFEND' | 'MASSING' | 'RETREAT' = 'ATTACK';
  aiStateTimer: number = 0;
  enemySkillCooldowns: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };

  // --- FOG OF WAR ---
  playerVisibleX: number = PLAYER_BASE_X + FOG_OF_WAR_RANGE; 
  enemyVisibleX: number = ENEMY_BASE_X - FOG_OF_WAR_RANGE;   

  skillCooldowns: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };
  skillActiveTimers: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };
  skillMaxDurations: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };

  lightningTargetX: number = 0;

  onStateChange: (engine: GameEngine) => void;

  constructor(level: GameLevel, upgrades: UpgradeState, onStateChange: (engine: GameEngine) => void) {
    this.level = level;
    this.upgrades = upgrades;
    this.onStateChange = onStateChange;
    this.playerMaxBaseHp = BASE_HP * (1 + (upgrades.baseHp * 0.1));
    this.playerBaseHp = this.playerMaxBaseHp;
    
    // --- DIFFICULTY SCALING ---
    // Start VERY weak, scale gently.
    let hpMultiplier = 0.8 + (level.level * 0.05); // Level 1: 0.85x HP (Weak)
    if (level.level > 10) hpMultiplier = 1.3 + ((level.level - 10) * 0.08);
    if (level.isBoss) hpMultiplier *= 2.0;
    
    this.enemyMaxBaseHp = BASE_HP * hpMultiplier;
    this.enemyBaseHp = this.enemyMaxBaseHp;
    
    // --- AI STARTING GOLD ---
    // Level 1: 50 Gold (Just enough for a miner/sword)
    // Level 50: 550 Gold
    this.enemyGold = 40 + (level.level * 10); 
    
    // --- FREE TOWER FOR AI LEVEL 5+ ---
    this.enemyTowers = 0;
    if (level.level >= 5) {
        this.enemyTowers = 1;
        if (level.level >= 20) this.enemyTowers = 2;
        if (level.level >= 40) this.enemyTowers = 3;
    }

    // --- AI UPGRADE LEVELS (Reduced Scaling) ---
    // Level 1: 0 upgrades.
    // Level 5: 1 upgrade.
    const baseAILevel = Math.max(0, Math.floor((level.level - 3) * 0.5)); 
    const bonusDmg = Math.max(0, Math.floor((level.level - 5) / 4));

    this.enemyUpgrades = {
        baseHp: baseAILevel,
        swordDamage: baseAILevel + bonusDmg,
        archerDamage: baseAILevel + bonusDmg,
        cavalryDamage: baseAILevel + bonusDmg,
        spawnSpeed: Math.min(20, Math.floor(level.level / 2)), 
        arrowRainPower: baseAILevel,
        lightningPower: baseAILevel,
        freezePower: baseAILevel,
        heroPower: baseAILevel,
        minerSpeed: Math.min(30, baseAILevel),
        maxPopUpgrade: Math.floor(level.level / 5), 
        passiveGold: Math.min(5, Math.floor(level.level / 10)), 
        towerPower: baseAILevel
    };

    this.initEnvironment();
  }

  startGame() {
      this.started = true;
      this.paused = false;
      this.onStateChange(this);
  }

  togglePause() {
      this.paused = !this.paused;
      this.onStateChange(this);
  }

  initEnvironment() {
      const elementCount = 15;
      for(let i=0; i<elementCount; i++) {
          this.envElements.push({
              id: `cloud_${i}`,
              type: 'CLOUD',
              x: Math.random() * WORLD_WIDTH,
              y: Math.random() * 200,
              speed: 0.2 + Math.random() * 0.3,
              scale: 0.5 + Math.random() * 1.5,
              variant: 0
          });
      }
      
      const treeCount = 40; 
      for(let i=0; i<treeCount; i++) {
          this.envElements.push({
              id: `tree_${i}`,
              type: 'TREE',
              x: Math.random() * WORLD_WIDTH,
              y: GROUND_Y, 
              speed: 0,
              scale: 0.8 + Math.random() * 0.4,
              variant: Math.floor(Math.random() * 3)
          });
      }

      const birdCount = 5;
      for(let i=0; i<birdCount; i++) {
        this.envElements.push({
            id: `bird_${i}`,
            type: 'BIRD',
            x: Math.random() * WORLD_WIDTH,
            y: 50 + Math.random() * 150,
            speed: 1 + Math.random(),
            scale: 0.5,
            variant: 0
        });
      }
  }

  setRallyPoint(x: number) {
      if (!this.started || this.paused) return;
      this.rallyPoint = x;
      this.onStateChange(this);
  }

  setPatrolPoint(x: number) {
      if (!this.started || this.paused) return;
      if (this.rallyPoint === null) {
          this.rallyPoint = PLAYER_BASE_X + 200;
      }
      this.patrolPoint = x;
      this.onStateChange(this);
  }

  setVanguardPoint(x: number) {
      if (!this.started || this.paused) return;
      this.vanguardPoint = x;
      this.onStateChange(this);
  }

  setVanguardPercentage(pct: number) {
      this.vanguardPercentage = Math.max(0, Math.min(1, pct));
      this.onStateChange(this);
  }

  clearRallyPoint() {
      if (!this.started || this.paused) return;
      this.rallyPoint = null;
      this.patrolPoint = null; 
      // Vanguard point persists as it's a pressure tactic
      this.onStateChange(this);
  }
  
  cancelPatrol() {
      if (!this.started || this.paused) return;
      this.patrolPoint = null;
      this.onStateChange(this);
  }

  buyTower(faction: Faction) {
      const isPlayer = faction === Faction.PLAYER;
      const currentCount = isPlayer ? this.playerTowers : this.enemyTowers;
      if (currentCount >= MAX_TOWERS) return;

      const cost = TOWER_COST_BASE + (currentCount * TOWER_COST_INC);
      
      if (isPlayer) {
          if (this.gold >= cost) {
              this.gold -= cost;
              this.playerTowers++;
              soundManager.playSpawn(); 
              this.onStateChange(this);
          }
      } else {
          if (this.enemyGold >= cost) {
              this.enemyGold -= cost;
              this.enemyTowers++;
          }
      }
  }

  updateTowers() {
      if (this.playerTowers > 0) {
          if (this.playerTowerCooldown > 0) {
              this.playerTowerCooldown--;
          } else {
              const target = this.units.find(u => 
                  u.faction === Faction.ENEMY && 
                  u.state !== UnitState.DIE && 
                  u.state !== UnitState.DEAD &&
                  u.x < PLAYER_BASE_X + TOWER_RANGE + 100 
              );
              
              if (target) {
                  const power = TOWER_DAMAGE_BASE * (1 + (this.upgrades.towerPower * 0.1)) * this.playerTowers; 
                  this.fireTowerShot(PLAYER_BASE_X, target, power, Faction.PLAYER);
                  this.playerTowerCooldown = TOWER_COOLDOWN;
              }
          }
      }

      if (this.enemyTowers > 0) {
          if (this.enemyTowerCooldown > 0) {
              this.enemyTowerCooldown--;
          } else {
              const target = this.units.find(u => 
                  u.faction === Faction.PLAYER && 
                  u.state !== UnitState.DIE && 
                  u.state !== UnitState.DEAD &&
                  u.x > ENEMY_BASE_X - TOWER_RANGE - 100
              );
              
              if (target) {
                  const power = TOWER_DAMAGE_BASE * (1 + (this.enemyUpgrades.towerPower * 0.1)) * this.enemyTowers;
                  this.fireTowerShot(ENEMY_BASE_X, target, power, Faction.ENEMY);
                  this.enemyTowerCooldown = TOWER_COOLDOWN;
              }
          }
      }
  }

  fireTowerShot(startX: number, target: Unit, damage: number, faction: Faction) {
      const dx = target.x - startX;
      const dy = (target.y - target.height/2) - (GROUND_Y - 150); 
      const dist = Math.sqrt(dx*dx + dy*dy);
      const speed = 15;
      
      this.projectiles.push({
          id: `tower_${Math.random()}`,
          x: startX,
          y: GROUND_Y - 150,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          startX: startX,
          damage: damage,
          faction: faction,
          active: true,
          type: 'TOWER_SHOT',
          rotation: Math.atan2(dy, dx)
      });
      soundManager.playAttack('ARCHER'); 
  }

  queueUnit(type: UnitType, faction: Faction) {
      if (faction === Faction.PLAYER) {
          if (!this.started || this.paused) return;
      }
      
      const isPlayer = faction === Faction.PLAYER;
      const activeUnits = this.units.filter(u => u.faction === faction && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
      const queueItems = isPlayer ? this.playerQueue : this.enemyQueue;
      
      if (type === UnitType.HERO) {
          const heroCount = activeUnits.filter(u => u.type === UnitType.HERO).length + queueItems.filter(q => q.type === UnitType.HERO).length;
          if (heroCount >= MAX_HEROES) return;
      } else {
          const normalCount = activeUnits.filter(u => u.type !== UnitType.HERO).length + queueItems.filter(q => q.type !== UnitType.HERO).length;
          let maxPop = MAX_POPULATION;
          if (isPlayer) maxPop += this.upgrades.maxPopUpgrade;
          else maxPop += this.enemyUpgrades.maxPopUpgrade;
          
          if (normalCount >= maxPop) return;
      }

      const statsConfig = UNIT_CONFIG[type];
      
      if (isPlayer) {
          if (this.gold < statsConfig.cost) return;
          this.gold -= statsConfig.cost;
          soundManager.playGold(); 
      } else {
          if (this.enemyGold < statsConfig.cost) return;
          this.enemyGold -= statsConfig.cost;
      }

      let spawnTime = statsConfig.spawnTime;
      if (isPlayer) {
          spawnTime = Math.max(30, spawnTime * (1 - this.upgrades.spawnSpeed * 0.1)); 
      } else {
          // AI Spawn Speed Scaling
          const baseSpeedBuff = this.level.level * 0.02;
          const upgradeBuff = this.enemyUpgrades.spawnSpeed * 0.1;
          spawnTime = Math.max(30, spawnTime * (1 - (baseSpeedBuff + upgradeBuff))); 
          
          // --- AI DIFFICULTY SPAWN RATES ---
          // Updated based on user feedback: Regular but moderate
          if (this.level.level === 1) spawnTime *= 1.8; 
          else if (this.level.level < 5) spawnTime *= 1.4; 
          
          if (this.level.level > 45 && type !== UnitType.HERO) spawnTime = 30; 
          if (this.level.isBoss) spawnTime *= 0.8; 
      }

      const item: SpawnQueueItem = {
          id: Math.random().toString(),
          type,
          totalTime: spawnTime,
          remainingTime: spawnTime,
          faction
      };

      if (isPlayer) this.playerQueue.push(item);
      else this.enemyQueue.push(item);
      this.onStateChange(this);
  }

  updateQueues() {
      if (this.playerQueue.length > 0) {
          const item = this.playerQueue[0];
          item.remainingTime--;
          if (item.remainingTime <= 0) {
              this.spawnUnitNow(item.type, item.faction);
              this.playerQueue.shift();
              soundManager.playSpawn();
          }
      }
      
      if (this.enemyQueue.length > 0) {
          const item = this.enemyQueue[0];
          item.remainingTime--;
          if (item.remainingTime <= 0) {
              this.spawnUnitNow(item.type, item.faction);
              this.enemyQueue.shift();
          }
      }
  }

  spawnUnitNow(type: UnitType, faction: Faction) {
    const isPlayer = faction === Faction.PLAYER;
    const upgrades = isPlayer ? this.upgrades : this.enemyUpgrades;

    let unitUpgradeLevel = 0;
    if (type === UnitType.SWORDMAN) unitUpgradeLevel = upgrades.swordDamage;
    else if (type === UnitType.ARCHER) unitUpgradeLevel = upgrades.archerDamage;
    else if (type === UnitType.CAVALRY) unitUpgradeLevel = upgrades.cavalryDamage;
    else if (type === UnitType.HERO) unitUpgradeLevel = upgrades.heroPower;
    else if (type === UnitType.MINER) unitUpgradeLevel = upgrades.minerSpeed;

    let stats = calculateUnitStats(type, unitUpgradeLevel);

    let sizeMultiplier = 1;
    if (!isPlayer) {
        // Reduced stat scaling for AI units
        const levelScaling = 1 + (this.level.level * 0.03); 
        stats.hp = Math.floor(stats.hp * levelScaling);
        stats.maxHp = Math.floor(stats.maxHp * levelScaling);
        stats.damage = Math.floor(stats.damage * levelScaling);

        if (this.level.level > 20) sizeMultiplier = 1.2; 
        if (this.level.isBoss) {
            stats.damage = Math.floor(stats.damage * 1.3);
            stats.hp = Math.floor(stats.hp * 1.5);
            stats.maxHp = stats.hp;
            sizeMultiplier *= 1.1;
        }
    }

    const unit: Unit = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      faction,
      x: isPlayer ? PLAYER_BASE_X : ENEMY_BASE_X,
      y: GROUND_Y,
      state: type === UnitType.MINER ? UnitState.MINE_WALK_TO_MINE : UnitState.MOVE,
      stats: stats,
      lastAttackFrame: 0,
      targetId: null,
      width: 20 * sizeMultiplier,
      height: (type === UnitType.HERO ? 60 : 40) * sizeMultiplier,
      animationFrame: 0,
      rotation: 0,
      deathTimer: 60,
      opacity: 1,
      freezeTimer: 0,
      isSlowed: false,
      patrolHeading: 'A',
      isVanguard: false 
    };

    unit.y += (Math.random() * 20 - 10);
    this.units.push(unit);
    this.onStateChange(this);
  }

  dismissUnit(type: UnitType, faction: Faction = Faction.PLAYER) {
      if (faction === Faction.PLAYER && (!this.started || this.paused)) return;
      const index = this.units.findIndex(u => 
          u.faction === faction && u.type === type && 
          u.state !== UnitState.DIE && u.state !== UnitState.DEAD
      );
      if (index !== -1) {
          const u = this.units[index];
          this.units.splice(index, 1);
          this.createParticles(u.x, GROUND_Y, 5, '#ffffff', true);
          if(faction === Faction.PLAYER) soundManager.playDie(); 
          this.onStateChange(this);
      }
  }

  rewardKill(unit: Unit) {
      let amount = REWARD_MELEE;
      if (unit.type === UnitType.ARCHER) amount = REWARD_ARCHER;
      if (unit.type === UnitType.HERO) amount = REWARD_HERO;
      
      if (unit.faction === Faction.ENEMY) {
          this.gold += amount;
          soundManager.playGold();
      } else {
          this.enemyGold += amount;
      }
  }

  useSkillArrowRain(x: number) {
    if (this.skillCooldowns.ARROW_RAIN > 0 || !this.started || this.paused) return;
    // --- VISIBILITY CHECK ---
    if (x > this.playerVisibleX) return;

    this.spawnArrowRain(x, Faction.PLAYER, this.upgrades.arrowRainPower);
    soundManager.playSkill('Arrow Rain');
    this.skillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
    this.onStateChange(this);
  }

  useSkillLightning(x: number) {
    if (this.skillCooldowns.LIGHTNING > 0 || !this.started || this.paused) return;
    // --- VISIBILITY CHECK ---
    if (x > this.playerVisibleX) return;

    this.spawnLightning(x, Faction.PLAYER, this.upgrades.lightningPower);
    soundManager.playSkill('Lightning');
    this.skillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING;
    this.onStateChange(this);
  }

  useSkillFreeze(x: number) {
      if (this.skillCooldowns.FREEZE > 0 || !this.started || this.paused) return;
      // --- VISIBILITY CHECK ---
      if (x > this.playerVisibleX) return;

      this.spawnFreeze(x, Faction.PLAYER, this.upgrades.freezePower);
      soundManager.playSkill('Arrow Rain'); 
      this.skillCooldowns.FREEZE = SKILL_COOLDOWNS_FRAMES.FREEZE;
      this.onStateChange(this);
  }
  
  spawnArrowRain(x: number, faction: Faction, powerLevel: number) {
    const isPlayer = faction === Faction.PLAYER;
    const durationMultiplier = 1 + (powerLevel * 0.1);
    const durationFrames = 180 * durationMultiplier;
    
    if (isPlayer) {
        this.skillActiveTimers.ARROW_RAIN = durationFrames;
        this.skillMaxDurations.ARROW_RAIN = durationFrames;
    }

    const arrowCount = Math.floor(durationFrames / 5);
    const damage = 50 + (powerLevel * 10);

    for (let i = 0; i < arrowCount; i++) {
      setTimeout(() => {
        if(this.gameOver || this.victory || this.paused) return; 
        this.projectiles.push({
          id: Math.random().toString(),
          x: x + (Math.random() * 400 - 200),
          y: -50,
          vx: (Math.random() - 0.5) * 4,
          vy: 12 + Math.random() * 5,
          startX: x,
          damage: damage,
          faction: faction,
          active: true,
          type: 'ARROW',
          rotation: Math.PI / 2
        });
      }, i * (3000 * durationMultiplier / arrowCount)); 
    }
  }

  spawnLightning(x: number, faction: Faction, powerLevel: number) {
    const isPlayer = faction === Faction.PLAYER;
    
    // Create a new active storm
    // Duration: 3 seconds (180 frames)
    this.activeStorms.push({
        id: Math.random().toString(),
        faction,
        x,
        duration: 180,
        level: powerLevel
    });

    if (isPlayer) {
        this.skillActiveTimers.LIGHTNING = 180; 
        this.skillMaxDurations.LIGHTNING = 180;
    }
    
    // Initial sound
    soundManager.playSkill('Lightning');
  }

  updateLightning() {
      // 1. Process Active Storms (Spawning continuous bolts)
      this.activeStorms.forEach(storm => {
          storm.duration--;
          
          // Spawn bolt every 15 frames (approx 4 times a second)
          if (this.frame % 15 === 0) {
              // Random spread around the target point
              const offsetX = (Math.random() - 0.5) * 200; 
              const boltX = storm.x + offsetX;
              
              // Damage per bolt (Lower than the previous single-hit nuke, but hits multiple times)
              const damage = 40 + (storm.level * 10); 
              
              // Create Visual Bolt (Zigzag lines)
              const points: {x:number, y:number}[] = [];
              let curX = boltX;
              let curY = -400; // Sky
              while(curY < GROUND_Y) {
                 const nextY = curY + 20 + Math.random() * 30;
                 const nextX = curX + (Math.random() - 0.5) * 60; // Wide Zigzag
                 points.push({x: nextX, y: nextY});
                 curX = nextX;
                 curY = nextY;
              }
              // Ensure anchor on ground
              points[points.length-1].y = GROUND_Y;

              // Add projectile for rendering
              this.projectiles.push({
                  id: `bolt_${Math.random()}`,
                  x: boltX,
                  y: GROUND_Y,
                  vx: 0, vy: 0, startX: 0, damage: 0, faction: storm.faction, active: true,
                  type: 'LIGHTNING_BOLT', 
                  rotation: 0,
                  points: points,
                  opacity: 1 // Start fully visible
              });
              
              // Apply Damage in small radius around this specific bolt
              const targets = this.units.filter(u => 
                  u.faction !== storm.faction && 
                  u.state !== UnitState.DIE &&
                  Math.abs(u.x - boltX) < 60 // 60px radius per bolt
              );
              
              if (targets.length > 0) {
                  targets.forEach(t => {
                      t.stats.hp -= damage;
                      this.createParticles(t.x, t.y, 5, storm.faction === Faction.PLAYER ? '#0ea5e9' : '#f87171'); // Colored Sparks
                      if (t.stats.hp <= 0) {
                          t.state = UnitState.DIE;
                          this.rewardKill(t);
                      }
                  });
                  this.triggerScreenShake(2); // Mini shake per bolt
              }
          }
      });
      
      // Cleanup finished storms
      this.activeStorms = this.activeStorms.filter(s => s.duration > 0);

      // 2. Process Projectile Visuals (Fading)
      this.projectiles.forEach(p => {
          if (p.type === 'LIGHTNING_BOLT') {
              if (p.opacity !== undefined) {
                  p.opacity -= 0.15; // Fast fade out
                  if (p.opacity <= 0) p.active = false;
              } else {
                  p.active = false; 
              }
          }
      });
      
      // Keep active projectiles
      this.projectiles = this.projectiles.filter(p => p.active);
  }

  spawnFreeze(x: number, faction: Faction, powerLevel: number) {
      const isPlayer = faction === Faction.PLAYER;
      const range = 200; 
      const freezeDurationFrames = (5 * (1 + (powerLevel * 0.05))) * 60; // Base 5s + upgrades
      
      if (isPlayer) {
          this.skillActiveTimers.FREEZE = freezeDurationFrames;
          this.skillMaxDurations.FREEZE = freezeDurationFrames;
      }

      // Generate "Jagged Ice Strip" Visuals
      const shards: IceShard[] = [];
      const width = range * 2;
      const numShards = 20;
      const step = width / numShards;

      // Fill the width with jagged teeth
      // Shard X is relative to the Left Edge (0 to width)
      for(let i=0; i<numShards; i++) {
          shards.push({
              x: (i * step) + (Math.random() * 10), // Relative to start of zone
              height: 15 + Math.random() * 25, 
              width: step + 5,
              tilt: (Math.random() - 0.5) * 0.2 
          });
      }
      
      // Add a few taller spikes
      for(let i=0; i<5; i++) {
           shards.push({
              x: (Math.random() * width), // Randomly placed within 0 to width
              height: 40 + Math.random() * 30, 
              width: 15 + Math.random() * 10,
              tilt: (Math.random() - 0.5) * 0.4
          });
      }

      this.hazards.push({
          id: Math.random().toString(),
          type: 'FREEZE_ZONE',
          x: x - range, // This is the Left Edge
          y: GROUND_Y - 10,
          width: range * 2,
          height: 20,
          duration: freezeDurationFrames,
          damagePercent: 0.02, 
          slowFactor: 0.5,
          faction: faction,
          visuals: shards
      });

      soundManager.playSkill('Arrow Rain'); 
  }

  updateHazards() {
      // Loop backwards to allow safe removal
      for (let i = this.hazards.length - 1; i >= 0; i--) {
          const h = this.hazards[i];
          h.duration--;
          
          // Visual: Rising cold particles
          if (this.frame % 30 === 0) {
               const px = h.x + Math.random() * h.width;
               this.createParticles(px, GROUND_Y, 1, '#bae6fd', false);
          }

          // EXPIRY LOGIC: EXPLOSION
          if (h.duration <= 0) {
              if (h.type === 'FREEZE_ZONE') {
                  const centerX = h.x + (h.width / 2);
                  const range = h.width / 2;
                  
                  // Shatter Visuals (Explode outward)
                  for(let k=0; k<20; k++) {
                      this.particles.push({
                          id: Math.random().toString(),
                          x: centerX + (Math.random() - 0.5) * range,
                          y: GROUND_Y - Math.random() * 30,
                          vx: (Math.random() - 0.5) * 15,
                          vy: -5 - Math.random() * 10,
                          life: 40,
                          maxLife: 40,
                          color: '#bae6fd',
                          size: 2 + Math.random() * 4,
                          gravity: true
                      });
                  }

                  // Find targets in zone
                  const targets = this.units.filter(u => 
                      u.faction !== h.faction &&
                      u.state !== UnitState.DIE &&
                      Math.abs(u.x - centerX) < range
                  );
                  
                  targets.forEach(t => {
                      const explosionDmg = t.stats.maxHp * 0.10; // 10% Max HP Explosion
                      t.stats.hp -= explosionDmg;
                      this.createParticles(t.x, t.y - 20, 10, '#ffffff'); // White explosion burst
                      if (t.stats.hp <= 0) {
                          t.state = UnitState.DIE;
                          this.rewardKill(t);
                      }
                  });
                  
                  this.triggerScreenShake(5);
                  soundManager.playAttack('CAVALRY'); // Heavy shatter sound
              }
              
              // Remove hazard
              this.hazards.splice(i, 1);
          }
      }
  }

  triggerScreenShake(amount: number) {
    this.screenShake = amount;
  }

  createParticles(x: number, y: number, count: number, color: string, gravity: boolean = true) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        id: Math.random().toString(),
        x,
        y: y - 20,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        size: Math.random() * 3 + 1,
        gravity
      });
    }
  }

  createFirework() {
      const colors = ['#ef4444', '#eab308', '#3b82f6', '#8b5cf6', '#10b981'];
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * 300;
      this.fireworks.push({
          id: Math.random().toString(),
          x,
          y,
          color: colors[Math.floor(Math.random() * colors.length)],
          particles: [],
          exploded: false,
          timer: 60
      });
      soundManager.playSkill('Lightning');
  }

  updateFireworks() {
      this.fireworks.forEach(fw => {
          if (!fw.exploded) {
              fw.timer--;
              if (fw.timer <= 0) {
                  fw.exploded = true;
                  for (let i = 0; i < 50; i++) {
                      const angle = Math.random() * Math.PI * 2;
                      const speed = Math.random() * 5 + 2;
                      fw.particles.push({
                          id: Math.random().toString(),
                          x: fw.x,
                          y: fw.y,
                          vx: Math.cos(angle) * speed,
                          vy: Math.sin(angle) * speed,
                          life: 60 + Math.random() * 30,
                          maxLife: 90,
                          color: fw.color,
                          size: Math.random() * 3 + 2,
                          gravity: true
                      });
                  }
              }
          } else {
              fw.particles.forEach(p => {
                  p.x += p.vx;
                  p.y += p.vy;
                  p.vy += 0.1; 
                  p.life--;
              });
              fw.particles = fw.particles.filter(p => p.life > 0);
          }
      });
      this.fireworks = this.fireworks.filter(fw => !fw.exploded || fw.particles.length > 0);
  }

  manageVanguard() {
      if (this.frame % 30 !== 0) return; 

      // 1. Get all combat-capable units (including Heroes now)
      // Miners are excluded as they are not combat units
      const army = this.units.filter(u => 
          u.faction === Faction.PLAYER && 
          u.type !== UnitType.MINER && 
          u.state !== UnitState.DEAD && 
          u.state !== UnitState.DIE
      );

      // 2. Threshold Check: Must have at least 5 units to split
      if (army.length < 5) {
          // If less than 5, Force everyone to stay at flag (Vanguard = false)
          army.forEach(u => u.isVanguard = false);
          return;
      }

      // 3. Calculate how many should attack based on percentage
      const targetVanguardCount = Math.floor(army.length * this.vanguardPercentage);

      // 4. Determine current Vanguard
      let currentVanguard = army.filter(u => u.isVanguard);

      if (currentVanguard.length < targetVanguardCount) {
          // Need more vanguard: Pick non-vanguard units closest to enemy (High X)
          const nonVanguard = army.filter(u => !u.isVanguard).sort((a,b) => b.x - a.x);
          const needed = targetVanguardCount - currentVanguard.length;
          
          for(let i=0; i<needed && i<nonVanguard.length; i++) {
              nonVanguard[i].isVanguard = true;
          }
      } else if (currentVanguard.length > targetVanguardCount) {
          // Too many vanguard: Recall units furthest BACK (Low X)
          // Sort by X ascending (Left to Right)
          const surplus = currentVanguard.length - targetVanguardCount;
          currentVanguard.sort((a,b) => a.x - b.x); 
          
          for(let i=0; i<surplus; i++) {
              currentVanguard[i].isVanguard = false;
          }
      }
  }

  updateCombatUnit(unit: Unit, speedMult: number) {
      const isPlayer = unit.faction === Faction.PLAYER;
      const enemyBaseX = isPlayer ? ENEMY_BASE_X : PLAYER_BASE_X;

      // --- TARGET ACQUISITION (Universal) ---
      let target: Unit | null = null;
      let distToTarget = Infinity;

      for (const other of this.units) {
          if (other.faction !== unit.faction && other.state !== UnitState.DIE && other.state !== UnitState.DEAD) {
              const d = Math.abs(unit.x - other.x);
              if (d < distToTarget) {
                  distToTarget = d;
                  target = other;
              }
          }
      }

      const range = unit.stats.range;
      const attackSpeed = Math.max(10, unit.stats.attackSpeed); 
      const isLowHp = unit.stats.hp < unit.stats.maxHp * 0.4;
      
      // Archer Engagement Logic: Stop moving if in range (0.85 * Max Range to be safe)
      const engageDistance = unit.type === UnitType.ARCHER ? range * 0.85 : 250;
      
      // --- TACTICAL MOVEMENT LOGIC ---
      let movingToFlag = false;
      let moveDir = isPlayer ? 1 : -1;
      let targetPos = unit.x; // Default to stay put

      // PLAYER TACTICS
      if (isPlayer) {
          if (unit.isVanguard) {
              // Vanguard: Always Charge to front
              targetPos = ENEMY_BASE_X - 100;
              movingToFlag = false; // Allow stopping to fight
          } else if (this.rallyPoint !== null) {
              // Rally Point Logic
              let formationOffset = 0;
              
              if (unit.type === UnitType.ARCHER) {
                  // Archers: Always behind (-140 to -180px) relative to flag
                  formationOffset = -140 - (parseInt(unit.id.substr(0, 3), 36) % 40);
              } else {
                  // Melee (Sword, Cav) + Hero: Around the flag (-30 to +50px)
                  formationOffset = (parseInt(unit.id.substr(0, 3), 36) % 80) - 30;
              }
              
              targetPos = this.rallyPoint + formationOffset;
              
              if (isLowHp && this.frame % 30 === 0 && Math.random() < 0.3) {
                  targetPos -= 100; // Retreat momentarily
              }

              // STOP if we have a target within our specific engagement distance
              if (target && distToTarget <= engageDistance) {
                  movingToFlag = false; // Engage!
              } else {
                  movingToFlag = true;
              }
          }
          // Patrol Logic (if active)
          else if (this.patrolPoint !== null) {
               targetPos = this.patrolPoint;
               if (target && distToTarget <= engageDistance) movingToFlag = false;
               else movingToFlag = true;
          }
      } 
      // AI TACTICS
      else {
          if (this.aiState === 'DEFEND') {
              const defendLine = ENEMY_BASE_X - TOWER_RANGE - 150;
              let formationOffset = 0;
              
              if (unit.type === UnitType.ARCHER) {
                  formationOffset = 140 + (parseInt(unit.id.substr(0, 3), 36) % 40);
              } else {
                  formationOffset = -((parseInt(unit.id.substr(0, 3), 36) % 80) - 30);
              }

              targetPos = defendLine + formationOffset;

              if (isLowHp && this.frame % 30 === 0 && Math.random() < 0.3) {
                  targetPos += 100;
              }

              if (target && distToTarget <= engageDistance) {
                  movingToFlag = false;
              } else {
                  movingToFlag = true;
              }
          } else if (this.aiState === 'RETREAT') {
              targetPos = ENEMY_BASE_X; 
              movingToFlag = true; // Force retreat
          } else if (this.aiState === 'MASSING') {
              const massPoint = ENEMY_BASE_X - TOWER_RANGE - 100;
              targetPos = massPoint;
              if (target && distToTarget <= engageDistance) movingToFlag = false;
              else movingToFlag = true;
          } else {
              // ATTACK Mode
              targetPos = PLAYER_BASE_X;
              movingToFlag = false; // Attack Move
          }
      }

      // --- ARCHER KITING (RETREAT WHILE SHOOTING) ---
      // If Archer is threatened by MELEE range (approx 150px)
      if (unit.type === UnitType.ARCHER && target && distToTarget < 150) {
          const kiteDir = isPlayer ? -1 : 1; // Player runs Left, Enemy runs Right
          const canRetreat = isPlayer ? unit.x > 20 : unit.x < WORLD_WIDTH - 20; // Bound check
          
          if (canRetreat) {
              // Move away from enemy
              unit.x += kiteDir * unit.stats.speed * speedMult;
              // Force combat mode check below so we can shoot
              movingToFlag = false; 
          }
      }

      // --- EXECUTE COMBAT OR MOVEMENT ---
      
      const canAttackUnit = target && distToTarget <= range;
      const canAttackBase = Math.abs(unit.x - enemyBaseX) <= range;

      if (!movingToFlag && (canAttackUnit || canAttackBase)) {
          // COMBAT MODE
          unit.state = UnitState.ATTACK;
          
          if (isLowHp && this.frame % 15 === 0 && Math.random() > 0.6) {
               unit.x += (isPlayer ? -1 : 1) * unit.stats.speed; 
          }

          if (canAttackUnit && target) {
              unit.targetId = target.id;
              if (this.frame - unit.lastAttackFrame >= attackSpeed) {
                  unit.lastAttackFrame = this.frame;
                  if (unit.type === UnitType.ARCHER) this.fireArrow(unit, target);
                  else {
                      target.stats.hp -= unit.stats.damage;
                      soundManager.playHit();
                      this.createParticles(target.x, target.y - 20, 3, '#ef4444');
                      if (target.stats.hp <= 0) {
                          unit.targetId = null;
                          unit.state = UnitState.IDLE;
                          target.state = UnitState.DIE;
                          this.rewardKill(target);
                      }
                  }
              }
          } else if (canAttackBase) {
              if (this.frame - unit.lastAttackFrame >= attackSpeed) {
                  unit.lastAttackFrame = this.frame;
                  if (unit.type === UnitType.ARCHER) this.fireArrowAtBase(unit, enemyBaseX);
                  else {
                      if (isPlayer) this.enemyBaseHp -= unit.stats.damage;
                      else this.playerBaseHp -= unit.stats.damage;
                      soundManager.playHit();
                      this.triggerScreenShake(1);
                  }
              }
          }
      } else {
          // MOVEMENT MODE
          if (movingToFlag && Math.abs(unit.x - targetPos) > 10) {
              unit.state = UnitState.MOVE;
              moveDir = targetPos > unit.x ? 1 : -1;
              unit.x += moveDir * unit.stats.speed * speedMult;
          } 
          else if (movingToFlag && Math.abs(unit.x - targetPos) <= 10) {
              unit.state = UnitState.IDLE;
              if (this.frame % 60 === 0 && Math.random() > 0.5) {
                  unit.x += (Math.random() - 0.5) * 20; 
              }
          }
          else {
              // Default Attack Move
              unit.state = UnitState.MOVE;
              moveDir = isPlayer ? 1 : -1;
              unit.x += moveDir * unit.stats.speed * speedMult;
          }
      }
  }

  fireArrow(unit: Unit, target: Unit) {
    const startX = unit.x;
    const startY = unit.y - unit.height / 2;
    const endX = target.x;
    const endY = target.y - target.height / 2;
    
    // Calculate distance and flight time
    const dist = Math.abs(endX - startX);
    const speed = 15;
    const time = Math.max(20, dist / speed);

    const vx = (endX - startX) / time;
    const vy = (endY - startY - 0.5 * GRAVITY * time * time) / time;

    this.projectiles.push({
      id: Math.random().toString(),
      x: startX,
      y: startY,
      vx: vx,
      vy: vy,
      startX: startX,
      damage: unit.stats.damage,
      faction: unit.faction,
      active: true,
      type: 'ARROW',
      rotation: Math.atan2(vy, vx)
    });
    
    soundManager.playAttack('ARCHER');
  }

  fireArrowAtBase(unit: Unit, targetX: number) {
    const startX = unit.x;
    const startY = unit.y - unit.height / 2;
    const endX = targetX;
    const endY = GROUND_Y - 100; // Hit roughly center of base

    const dist = Math.abs(endX - startX);
    const speed = 15;
    const time = Math.max(20, dist / speed);

    const vx = (endX - startX) / time;
    const vy = (endY - startY - 0.5 * GRAVITY * time * time) / time;

    this.projectiles.push({
      id: Math.random().toString(),
      x: startX,
      y: startY,
      vx: vx,
      vy: vy,
      startX: startX,
      damage: unit.stats.damage,
      faction: unit.faction,
      active: true,
      type: 'ARROW',
      rotation: Math.atan2(vy, vx)
    });
    
    soundManager.playAttack('ARCHER');
  }

  updateAI() {
      // 1. Gold Drip
      if (this.frame % 60 === 0) {
          const passive = 1 + (this.enemyUpgrades.passiveGold * 2) + this.level.enemyGoldDrip;
          this.enemyGold += passive;
      }

      // 2. Unit Spawning
      if (this.frame % this.level.enemySpawnRate === 0) {
          const enemyMiners = this.units.filter(u => u.faction === Faction.ENEMY && u.type === UnitType.MINER).length;
          const desiredMiners = 2 + Math.floor(this.level.level / 5);
          
          if (enemyMiners < desiredMiners && this.enemyGold >= UNIT_CONFIG[UnitType.MINER].cost) {
              this.queueUnit(UnitType.MINER, Faction.ENEMY);
          } else {
              const available = [UnitType.SWORDMAN];
              if (this.level.level >= 2) available.push(UnitType.ARCHER);
              if (this.level.level >= 5) available.push(UnitType.CAVALRY);
              if (this.level.level >= 10 && this.enemyGold > 1000) available.push(UnitType.HERO);

              const type = available[Math.floor(Math.random() * available.length)];
              if (this.enemyGold >= UNIT_CONFIG[type].cost) {
                  this.queueUnit(type, Faction.ENEMY);
              }
          }
      }

      // 3. Strategy
      if (this.level.enemySmartAI && this.frame % 300 === 0) {
          const pCount = this.units.filter(u => u.faction === Faction.PLAYER).length;
          const eCount = this.units.filter(u => u.faction === Faction.ENEMY).length;
          
          if (eCount < pCount * 0.5 && eCount < 5) {
              this.aiState = 'DEFEND';
          } else if (eCount > pCount + 2) {
              this.aiState = 'ATTACK';
          }
      }

      // 4. Skills
      if (this.level.enemySmartAI) {
          if (this.enemySkillCooldowns.ARROW_RAIN <= 0 && Math.random() < 0.005) {
              const targets = this.units.filter(u => u.faction === Faction.PLAYER);
              if (targets.length > 0) {
                  const t = targets[Math.floor(Math.random() * targets.length)];
                  this.spawnArrowRain(t.x, Faction.ENEMY, this.enemyUpgrades.arrowRainPower);
                  this.enemySkillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
              }
          }
      }
      
      if (this.enemyTowers < MAX_TOWERS && this.enemyGold > 3000 && this.level.level > 5) {
           this.buyTower(Faction.ENEMY);
      }
  }

  updateUnits() {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];

      if (unit.y < GROUND_Y) {
          unit.y = GROUND_Y;
      }

      if (unit.state === UnitState.DEAD) {
        this.units.splice(i, 1);
        continue;
      }

      if (unit.state === UnitState.DIE) {
        unit.deathTimer--;
        unit.opacity = unit.deathTimer / 60;
        if (unit.deathTimer <= 0) {
            unit.state = UnitState.DEAD;
        }
        continue;
      }
      
      if (unit.freezeTimer > 0) unit.freezeTimer--;

      if (unit.type === UnitType.MINER) {
          this.updateMiner(unit, 1);
      } else {
          let speedMult = 1;
          if (unit.freezeTimer > 0) speedMult = 0;
          else if (unit.isSlowed) speedMult = 0.5;

          this.updateCombatUnit(unit, speedMult);
      }
      
      unit.animationFrame++;
    }
  }

  updateMiner(unit: Unit, speedMult: number) {
      const isPlayer = unit.faction === Faction.PLAYER;
      const base = isPlayer ? PLAYER_BASE_X : ENEMY_BASE_X;
      const mineX = isPlayer ? PLAYER_BASE_X + MINING_DISTANCE : ENEMY_BASE_X - MINING_DISTANCE;
      const speed = unit.stats.speed * speedMult;

      if (unit.state === UnitState.MINE_WALK_TO_MINE) {
          if (Math.abs(unit.x - mineX) < 5) {
              unit.state = UnitState.MINE_GATHERING;
              unit.miningTimer = MINING_TIME;
          } else {
              unit.x += (mineX > unit.x ? 1 : -1) * speed;
              unit.rotation = 0;
          }
      } else if (unit.state === UnitState.MINE_GATHERING) {
          if (unit.miningTimer && unit.miningTimer > 0) {
              unit.miningTimer--;
          } else {
              unit.state = UnitState.MINE_RETURN;
              unit.goldCarrying = GOLD_PER_TRIP + (this.upgrades.minerSpeed * 1);
          }
      } else if (unit.state === UnitState.MINE_RETURN) {
           if (Math.abs(unit.x - base) < 5) {
              if (isPlayer) {
                  this.gold += (unit.goldCarrying || 0);
                  soundManager.playGold();
              } else {
                  this.enemyGold += (unit.goldCarrying || 0);
              }
              unit.goldCarrying = 0;
              unit.state = UnitState.MINE_WALK_TO_MINE;
          } else {
              unit.x += (base > unit.x ? 1 : -1) * speed;
          }
      }
  }

  updateProjectiles() {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const p = this.projectiles[i];
          if (!p.active) {
              this.projectiles.splice(i, 1);
              continue;
          }

          if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += GRAVITY;
              p.rotation = Math.atan2(p.vy, p.vx);

              if (p.y >= GROUND_Y) {
                  p.active = false;
                  continue;
              }

              const targets = this.units.filter(u => 
                  u.faction !== p.faction && 
                  u.state !== UnitState.DIE && 
                  u.state !== UnitState.DEAD &&
                  Math.abs(u.x - p.x) < (u.width / 2 + 10) &&
                  Math.abs((u.y - u.height/2) - p.y) < (u.height / 2 + 10)
              );

              if (targets.length > 0) {
                  const t = targets[0];
                  t.stats.hp -= p.damage;
                  p.active = false;
                  this.createParticles(p.x, p.y, 3, '#ffffff'); 
                  soundManager.playHit();
                  if (t.stats.hp <= 0) {
                      t.state = UnitState.DIE;
                      this.rewardKill(t);
                  }
              }
          }
      }
  }

  updateParticles() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.gravity) p.vy += GRAVITY;
          p.life--;
          
          if (p.life <= 0) {
              this.particles.splice(i, 1);
          }
      }
  }

  updateEnvironment() {
      this.envElements.forEach(e => {
         e.x += e.speed;
         if (e.x > WORLD_WIDTH + 100) e.x = -100;
      });
  }

  checkGameStatus() {
      if (this.gameOver || this.victory) return;

      if (this.playerBaseHp <= 0) {
          this.gameOver = true;
          this.playerBaseHp = 0;
          soundManager.playDefeat();
          this.onStateChange(this);
      } else if (this.enemyBaseHp <= 0) {
          this.victory = true;
          this.enemyBaseHp = 0;
          soundManager.playVictory();
          this.onStateChange(this);
      }
  }

  update() {
    if (this.paused) return; 
    
    if (this.victory && this.frame % 30 === 0) {
        this.createFirework();
    }
    this.updateFireworks();

    if (this.gameOver || this.victory) return;
    
    this.frame++;
    this.levelTimer++; 

    if (this.screenShake > 0) this.screenShake *= 0.9;
    
    // Cooldowns Management
    if (this.skillCooldowns.ARROW_RAIN > 0) this.skillCooldowns.ARROW_RAIN--;
    if (this.skillCooldowns.LIGHTNING > 0) this.skillCooldowns.LIGHTNING--;
    if (this.skillCooldowns.FREEZE > 0) this.skillCooldowns.FREEZE--;

    if (this.skillActiveTimers.ARROW_RAIN > 0) this.skillActiveTimers.ARROW_RAIN--;
    if (this.skillActiveTimers.LIGHTNING > 0) this.skillActiveTimers.LIGHTNING--;
    if (this.skillActiveTimers.FREEZE > 0) this.skillActiveTimers.FREEZE--;
    
    if (this.enemySkillCooldowns.ARROW_RAIN > 0) this.enemySkillCooldowns.ARROW_RAIN--;
    if (this.enemySkillCooldowns.LIGHTNING > 0) this.enemySkillCooldowns.LIGHTNING--;
    if (this.enemySkillCooldowns.FREEZE > 0) this.enemySkillCooldowns.FREEZE--;

    // Fog of War Calculation
    let pMaxVis = PLAYER_BASE_X + FOG_OF_WAR_RANGE;
    let eMinVis = ENEMY_BASE_X - FOG_OF_WAR_RANGE;

    this.units.forEach(u => {
        if (u.state === UnitState.DEAD) return;
        if (u.faction === Faction.PLAYER) {
            pMaxVis = Math.max(pMaxVis, u.x + FOG_OF_WAR_RANGE);
        } else {
            eMinVis = Math.min(eMinVis, u.x - FOG_OF_WAR_RANGE);
        }
    });

    this.playerVisibleX = Math.min(pMaxVis, WORLD_WIDTH);
    this.enemyVisibleX = Math.max(eMinVis, 0);

    const passiveIncome = 1 + ((this.upgrades.passiveGold || 0) * 2); 
    if (this.frame % 60 === 0) {
        this.gold += passiveIncome;
    }

    this.manageVanguard(); 
    this.updateQueues();
    this.updateAI();
    this.updateHazards(); 
    this.updateUnits();
    this.updateProjectiles();
    this.updateParticles();
    this.updateLightning();
    this.updateTowers();
    this.updateEnvironment();
    this.checkGameStatus();
    
    if (this.frame % 5 === 0) {
      this.onStateChange(this);
    }
  }

}
