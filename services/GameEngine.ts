
import { Unit, UnitType, Faction, UnitState, Projectile, Particle, GameLevel, UpgradeState, SpawnQueueItem, EnvElement, Firework, Hazard, IceShard } from '../types';
import { CANVAS_WIDTH, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, UNIT_CONFIG, MINING_TIME, MINING_DISTANCE, GOLD_PER_TRIP, BASE_HP, GRAVITY, MAX_POPULATION, MAX_HEROES, SKILL_COOLDOWNS_FRAMES, INITIAL_GOLD, MAX_PASSIVE_GOLD_LEVEL, POP_UPGRADE_COST, MAX_POP_UPGRADES, FOG_OF_WAR_RANGE, REWARD_MELEE, REWARD_ARCHER, REWARD_HERO, MAX_UPGRADE_LEVELS, MAX_TOWERS, TOWER_COST_BASE, TOWER_COST_INC, TOWER_RANGE, TOWER_DAMAGE_BASE, TOWER_COOLDOWN, calculateUnitStats, getRankTier, TIER_DIFFICULTY_MAP, RANK_THRESHOLDS } from '../constants';
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
    
    // --- DIFFICULTY & ONLINE SCALING ---
    if (level.isMultiplayer) {
        // ONLINE: ELO BASED SCALING
        this.playerMaxBaseHp = BASE_HP; // Reset player HP bonus for fair play base (upgrades handled in App)
        this.playerBaseHp = BASE_HP;
        this.enemyMaxBaseHp = BASE_HP;
        this.enemyBaseHp = BASE_HP;
        
        const elo = level.opponentElo || 1000;
        const tier = getRankTier(elo);
        const mapping = TIER_DIFFICULTY_MAP[tier];
        
        // Calculate where in the tier range this Elo sits (0.0 to 1.0)
        let tierRange = 1000; 
        let baseTierElo = 0;
        switch(tier) {
            case 'BRONZE': baseTierElo = 0; break;
            case 'SILVER': baseTierElo = 1000; break;
            case 'GOLD': baseTierElo = 2000; break;
            case 'PLATINUM': baseTierElo = 3000; break;
            case 'DIAMOND': baseTierElo = 4000; break;
            case 'CHALLENGER': baseTierElo = 5000; break;
            case 'LEGEND': baseTierElo = 6000; tierRange = 2000; break; 
        }
        
        const progress = Math.min(1, Math.max(0, (elo - baseTierElo) / tierRange));
        
        // Calculate effective "Offline Level" equivalent
        const levelRange = mapping.maxLvl - mapping.minLvl;
        const effectiveLevel = Math.floor(mapping.minLvl + (levelRange * progress));
        
        // Give higher Elo bots a gold advantage instead of just stats
        this.enemyGold = INITIAL_GOLD + Math.floor(elo / 10); 
        
        // UPDATED TOWER LOGIC for condensed 1-20 Scale
        this.enemyTowers = 0;
        if (effectiveLevel >= 5) this.enemyTowers = 1;  // Matches Campaign Lvl 5 (Gold)
        if (effectiveLevel >= 12) this.enemyTowers = 2; // Matches mid-Diamond
        if (effectiveLevel >= 18) this.enemyTowers = 3; // Matches Challenger/Legend

        // Base upgrades on effective level
        const baseAILevel = Math.max(0, Math.floor((effectiveLevel - 3) * 0.5)); 
        const bonusDmg = Math.max(0, Math.floor((effectiveLevel - 5) / 4));

        this.enemyUpgrades = {
            baseHp: Math.floor(baseAILevel * 0.5), 
            swordDamage: baseAILevel + bonusDmg, 
            archerDamage: baseAILevel + bonusDmg, 
            cavalryDamage: baseAILevel + bonusDmg, 
            spawnSpeed: Math.floor(baseAILevel * 0.8),
            arrowRainPower: Math.floor(baseAILevel * 0.5), 
            lightningPower: Math.floor(baseAILevel * 0.5), 
            freezePower: Math.floor(baseAILevel * 0.5), 
            heroPower: Math.floor(baseAILevel * 0.5),
            minerSpeed: Math.floor(baseAILevel * 0.8), 
            maxPopUpgrade: Math.floor(effectiveLevel / 4), // Scaled for 20 max level
            passiveGold: Math.floor(effectiveLevel / 5), // Scaled for 20 max level
            towerPower: Math.floor(baseAILevel * 0.5)
        };

        // If Spectator, Player side is ALSO AI (Simulated)
        if (level.isSpectator) {
            this.upgrades = { ...this.enemyUpgrades }; 
        }
    } else {
        // OFFLINE: Campaign Scaling
        let hpMultiplier = 0.8 + (level.level * 0.05); // Level 1: 0.85x HP (Weak)
        if (level.level > 10) hpMultiplier = 1.3 + ((level.level - 10) * 0.08);
        if (level.isBoss) hpMultiplier *= 2.0;
        
        this.enemyMaxBaseHp = BASE_HP * hpMultiplier;
        this.enemyBaseHp = this.enemyMaxBaseHp;
        
        this.enemyGold = 40 + (level.level * 10); 
        
        this.enemyTowers = 0;
        if (level.level >= 5) {
            this.enemyTowers = 1;
            if (level.level >= 20) this.enemyTowers = 2;
            if (level.level >= 40) this.enemyTowers = 3;
        }

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
    }

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

  triggerScreenShake(amount: number) {
      this.screenShake = amount;
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
                  // Strict check: Must be within Tower Range from Base X
                  u.x < PLAYER_BASE_X + TOWER_RANGE 
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
                  // Strict check
                  u.x > ENEMY_BASE_X - TOWER_RANGE
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
      soundManager.playTowerShot(); 
  }

  queueUnit(type: UnitType, faction: Faction) {
      if (faction === Faction.PLAYER) {
          // In Spectator Mode, AI calls queueUnit for Player, so we allow it.
          // In normal mode, UI calls it, and paused check is valid.
          // To be safe, just check paused.
          if (!this.started || this.paused) return;
      }
      
      const isPlayer = faction === Faction.PLAYER;
      const activeUnits = this.units.filter(u => u.faction === faction && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
      const queueItems = isPlayer ? this.playerQueue : this.enemyQueue;
      const upgrades = isPlayer ? this.upgrades : this.enemyUpgrades;
      
      if (type === UnitType.HERO) {
          const heroCount = activeUnits.filter(u => u.type === UnitType.HERO).length + queueItems.filter(q => q.type === UnitType.HERO).length;
          if (heroCount >= MAX_HEROES) return;
      } else {
          const normalCount = activeUnits.filter(u => u.type !== UnitType.HERO).length + queueItems.filter(q => q.type !== UnitType.HERO).length;
          let maxPop = MAX_POPULATION + upgrades.maxPopUpgrade;
          if (normalCount >= maxPop) return;
      }

      const statsConfig = UNIT_CONFIG[type];
      const cost = statsConfig.cost;
      
      if (isPlayer) {
          if (this.gold < cost) return;
          this.gold -= cost;
          // Only play sound if NOT spectator, to avoid noise chaos
          if (!this.level.isSpectator) soundManager.playGold(); 
      } else {
          if (this.enemyGold < cost) return;
          this.enemyGold -= cost;
      }

      let spawnTime = statsConfig.spawnTime;
      // Apply upgrades
      spawnTime = Math.max(30, spawnTime * (1 - upgrades.spawnSpeed * 0.1)); 

      // Campaign AI Logic overrides
      if (!isPlayer && !this.level.isMultiplayer) {
           const baseSpeedBuff = this.level.level * 0.02;
           spawnTime = Math.max(30, spawnTime * (1 - baseSpeedBuff));
           
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
              // Only play spawn sound if NOT spectator
              if (!this.level.isSpectator) soundManager.playSpawn();
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
    // Campaign Boss Scaling Logic (Only applies to Enemy in Offline)
    if (!isPlayer && !this.level.isMultiplayer) {
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
          if(faction === Faction.PLAYER && !this.level.isSpectator) soundManager.playDie(); 
          this.onStateChange(this);
      }
  }

  rewardKill(unit: Unit) {
      let amount = REWARD_MELEE;
      if (unit.type === UnitType.ARCHER) amount = REWARD_ARCHER;
      if (unit.type === UnitType.HERO) amount = REWARD_HERO;
      
      if (unit.faction === Faction.ENEMY) {
          this.gold += amount;
          // If spectator, don't play money sound
          if (!this.level.isSpectator) soundManager.playGold();
      } else {
          this.enemyGold += amount;
      }
  }

  useSkillArrowRain(x: number) {
    if (this.skillCooldowns.ARROW_RAIN > 0 || !this.started || this.paused) return;
    if (x > this.playerVisibleX) return;

    this.spawnArrowRain(x, Faction.PLAYER, this.upgrades.arrowRainPower);
    soundManager.playSkill('Arrow Rain');
    this.skillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
    this.onStateChange(this);
  }

  useSkillLightning(x: number) {
    if (this.skillCooldowns.LIGHTNING > 0 || !this.started || this.paused) return;
    if (x > this.playerVisibleX) return;

    this.spawnLightning(x, Faction.PLAYER, this.upgrades.lightningPower);
    soundManager.playSkill('Lightning');
    this.skillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING;
    this.onStateChange(this);
  }

  useSkillFreeze(x: number) {
      if (this.skillCooldowns.FREEZE > 0 || !this.started || this.paused) return;
      if (x > this.playerVisibleX) return;

      this.spawnFreeze(x, Faction.PLAYER, this.upgrades.freezePower);
      soundManager.playSkill('Freeze'); 
      this.skillCooldowns.FREEZE = SKILL_COOLDOWNS_FRAMES.FREEZE;
      this.onStateChange(this);
  }
  
  spawnArrowRain(x: number, faction: Faction, powerLevel: number) {
    const isPlayer = faction === Faction.PLAYER;
    const durationMultiplier = 1 + (powerLevel * 0.1);
    const durationFrames = 300 * durationMultiplier; 
    
    if (isPlayer) {
        this.skillActiveTimers.ARROW_RAIN = durationFrames;
        this.skillMaxDurations.ARROW_RAIN = durationFrames;
    }

    const arrowCount = Math.floor(durationFrames / 5);
    const damage = 55 * (1 + (powerLevel * 0.2));

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
          rotation: Math.PI / 2,
          fromSkill: true // Flag to identify skill origin
        });
      }, i * (3000 * durationMultiplier / arrowCount)); 
    }
  }

  spawnLightning(x: number, faction: Faction, powerLevel: number) {
    const isPlayer = faction === Faction.PLAYER;
    this.activeStorms.push({
        id: Math.random().toString(),
        faction,
        x,
        duration: 300, 
        level: powerLevel
    });

    if (isPlayer) {
        this.skillActiveTimers.LIGHTNING = 300; 
        this.skillMaxDurations.LIGHTNING = 300;
    }
    
    soundManager.playSkill('Lightning');
  }

  updateLightning() {
      // 1. Process Active Storms
      this.activeStorms.forEach(storm => {
          storm.duration--;
          
          if (this.frame % 12 === 0) {
              const offsetX = (Math.random() - 0.5) * 200; 
              const boltX = storm.x + offsetX;
              
              const damage = 44 * (1 + (storm.level * 0.2));
              
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
              points[points.length-1].y = GROUND_Y;

              this.projectiles.push({
                  id: `bolt_${Math.random()}`,
                  x: boltX,
                  y: GROUND_Y,
                  vx: 0, vy: 0, startX: 0, damage: 0, faction: storm.faction, active: true,
                  type: 'LIGHTNING_BOLT', 
                  rotation: 0,
                  points: points,
                  opacity: 1 
              });
              
              const targets = this.units.filter(u => 
                  u.faction !== storm.faction && 
                  u.state !== UnitState.DIE &&
                  Math.abs(u.x - boltX) < 60 
              );
              
              if (targets.length > 0) {
                  targets.forEach(t => {
                      t.stats.hp -= damage;
                      this.createParticles(t.x, t.y, 5, storm.faction === Faction.PLAYER ? '#0ea5e9' : '#f87171'); 
                      if (t.stats.hp <= 0) {
                          t.state = UnitState.DIE;
                          this.rewardKill(t);
                      }
                  });
                  this.triggerScreenShake(2); 
              }
          }
      });
      
      this.activeStorms = this.activeStorms.filter(s => s.duration > 0);

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
      
      this.projectiles = this.projectiles.filter(p => p.active);
  }

  spawnFreeze(x: number, faction: Faction, powerLevel: number) {
      const isPlayer = faction === Faction.PLAYER;
      const range = 200; 
      const freezeDurationFrames = (8 * (1 + (powerLevel * 0.05))) * 60;
      const scaledSlow = Math.max(0.1, 0.5 - (powerLevel * 0.02)); 
      const dotPercentage = 0.02; 
      const explosionPercentage = 0.05 * (1 + (powerLevel * 0.2));

      if (isPlayer) {
          this.skillActiveTimers.FREEZE = freezeDurationFrames;
          this.skillMaxDurations.FREEZE = freezeDurationFrames;
      }

      const shards: IceShard[] = [];
      const width = range * 2;
      const numShards = 20;
      const step = width / numShards;

      for(let i=0; i<numShards; i++) {
          shards.push({
              x: (i * step) + (Math.random() * 10), 
              height: 15 + Math.random() * 25, 
              width: step + 5,
              tilt: (Math.random() - 0.5) * 0.2 
          });
      }
      
      for(let i=0; i<5; i++) {
           shards.push({
              x: (Math.random() * width), 
              height: 40 + Math.random() * 30, 
              width: 15 + Math.random() * 10,
              tilt: (Math.random() - 0.5) * 0.4
          });
      }

      this.hazards.push({
          id: Math.random().toString(),
          type: 'FREEZE_ZONE',
          x: x - range, 
          y: GROUND_Y - 10,
          width: range * 2,
          height: 20,
          duration: freezeDurationFrames,
          damagePercent: dotPercentage, 
          explosionDamagePercent: explosionPercentage, 
          slowFactor: scaledSlow,
          faction: faction,
          visuals: shards
      });

      soundManager.playSkill('Freeze'); 
  }

  updateHazards() {
      for (let i = this.hazards.length - 1; i >= 0; i--) {
          const h = this.hazards[i];
          h.duration--;
          
          if (this.frame % 30 === 0) {
               const px = h.x + Math.random() * h.width;
               this.createParticles(px, GROUND_Y, 1, '#bae6fd', false);
          }

          if (h.type === 'FREEZE_ZONE') {
              const centerX = h.x + (h.width / 2);
              const range = h.width / 2;
              
              const targets = this.units.filter(u => 
                  u.faction !== h.faction &&
                  u.state !== UnitState.DIE &&
                  u.state !== UnitState.DEAD &&
                  Math.abs(u.x - centerX) < range
              );

              targets.forEach(t => {
                  t.isSlowed = true; 
                  const dotDamage = (t.stats.maxHp * h.damagePercent) / 60;
                  t.stats.hp -= dotDamage;
                  
                  if (t.stats.hp <= 0) {
                      t.state = UnitState.DIE;
                      this.rewardKill(t);
                  }
              });

              if (h.duration <= 0) {
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
                  
                  const boomDmgPct = h.explosionDamagePercent || 0.05;

                  targets.forEach(t => {
                      const explosionDmg = t.stats.maxHp * boomDmgPct; 
                      t.stats.hp -= explosionDmg;
                      this.createParticles(t.x, t.y - 20, 10, '#ffffff'); 
                      if (t.stats.hp <= 0) {
                          t.state = UnitState.DIE;
                          this.rewardKill(t);
                      }
                  });
                  
                  this.triggerScreenShake(5);
                  soundManager.playAttack('CAVALRY'); 
                  
                  this.hazards.splice(i, 1);
              }
          } else {
               if (h.duration <= 0) this.hazards.splice(i, 1);
          }
      }
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

      const army = this.units.filter(u => 
          u.faction === Faction.PLAYER && 
          u.type !== UnitType.MINER && 
          u.state !== UnitState.DEAD && 
          u.state !== UnitState.DIE
      );

      if (army.length < 5) {
          army.forEach(u => u.isVanguard = false);
          return;
      }

      const targetVanguardCount = Math.floor(army.length * this.vanguardPercentage);
      let currentVanguard = army.filter(u => u.isVanguard);

      if (currentVanguard.length < targetVanguardCount) {
          const nonVanguard = army.filter(u => !u.isVanguard).sort((a,b) => b.x - a.x);
          const needed = targetVanguardCount - currentVanguard.length;
          for(let i=0; i<needed && i<nonVanguard.length; i++) {
              nonVanguard[i].isVanguard = true;
          }
      } else if (currentVanguard.length > targetVanguardCount) {
          const surplus = currentVanguard.length - targetVanguardCount;
          currentVanguard.sort((a,b) => a.x - b.x); 
          for(let i=0; i<surplus; i++) {
              currentVanguard[i].isVanguard = false;
          }
      }
  }

  fireArrow(unit: Unit, target: Unit) {
    const dx = target.x - unit.x;
    const startY = unit.y - (unit.height * 0.75);
    const speed = 20; 

    const ty = target.y - (target.height * 0.6); 
    
    const directDist = Math.sqrt(dx*dx + (ty - startY)*(ty - startY));
    const flightTime = directDist / speed;
    const gravityDrop = 0.5 * GRAVITY * flightTime * flightTime;
    
    const targetY = ty - gravityDrop;
    const angle = Math.atan2(targetY - startY, dx);

    this.projectiles.push({
      id: Math.random().toString(),
      x: unit.x,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      startX: unit.x,
      damage: unit.stats.damage,
      faction: unit.faction,
      active: true,
      type: 'ARROW',
      rotation: angle,
      targetId: target.id 
    });
    
    soundManager.playAttack('ARCHER');
  }

  fireArrowAtBase(unit: Unit, baseX: number) {
    const dx = baseX - unit.x;
    const startY = unit.y - (unit.height * 0.75);
    const speed = 20; 

    const ty = GROUND_Y - 130;
    
    const dist = Math.abs(dx); 
    const flightTime = dist / speed;
    const gravityDrop = 0.5 * GRAVITY * flightTime * flightTime;
    
    const targetY = ty - gravityDrop;
    const angle = Math.atan2(targetY - startY, dx);

    this.projectiles.push({
      id: Math.random().toString(),
      x: unit.x,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      startX: unit.x,
      damage: unit.stats.damage,
      faction: unit.faction,
      active: true,
      type: 'ARROW',
      rotation: angle
    });
    
    soundManager.playAttack('ARCHER');
  }

  updateCombatUnit(unit: Unit, speedMult: number) {
      const isPlayer = unit.faction === Faction.PLAYER;
      const enemyBaseX = isPlayer ? ENEMY_BASE_X : PLAYER_BASE_X;

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
      
      const engageDistance = unit.type === UnitType.ARCHER ? range * 0.85 : 250;
      
      let movingToFlag = false;
      let moveDir = isPlayer ? 1 : -1;
      let targetPos = unit.x; 

      // PLAYER TACTICS
      if (isPlayer) {
          // If Spectator Mode, AI drives tactics for player too
          if (this.level.isSpectator) {
               targetPos = ENEMY_BASE_X;
               movingToFlag = true;
          } else {
              if (unit.isVanguard) {
                  targetPos = ENEMY_BASE_X - 100;
                  movingToFlag = false; 
              } else if (this.rallyPoint !== null) {
                  let formationOffset = 0;
                  if (unit.type === UnitType.ARCHER) {
                      formationOffset = -140 - (parseInt(unit.id.substr(0, 3), 36) % 40);
                  } else {
                      formationOffset = (parseInt(unit.id.substr(0, 3), 36) % 80) - 30;
                  }
                  targetPos = this.rallyPoint + formationOffset;
                  
                  if (isLowHp && this.frame % 30 === 0 && Math.random() < 0.3) {
                      targetPos -= 100; 
                  }

                  if ((target && distToTarget <= engageDistance) || (Math.abs(unit.x - enemyBaseX) <= range)) {
                      movingToFlag = false; 
                  } else {
                      movingToFlag = true;
                  }
              }
              else if (this.patrolPoint !== null) {
                   targetPos = this.patrolPoint;
                   if (target && distToTarget <= engageDistance) movingToFlag = false;
                   else movingToFlag = true;
              }
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
              movingToFlag = true; 
          } else if (this.aiState === 'MASSING') {
              const massPoint = ENEMY_BASE_X - TOWER_RANGE - 100;
              targetPos = massPoint;
              if (target && distToTarget <= engageDistance) movingToFlag = false;
              else movingToFlag = true;
          } else {
              targetPos = PLAYER_BASE_X;
              movingToFlag = false; 
          }
      }

      if (unit.type === UnitType.ARCHER && target && distToTarget < 150) {
          const kiteDir = isPlayer ? -1 : 1; 
          const canRetreat = isPlayer ? unit.x > 20 : unit.x < WORLD_WIDTH - 20; 
          
          if (canRetreat) {
              unit.x += kiteDir * (unit.stats.speed * 0.8) * speedMult;
              movingToFlag = false; 
          }
      }

      const canAttackUnit = target && distToTarget <= range;
      const canAttackBase = Math.abs(unit.x - enemyBaseX) <= range;

      if (!movingToFlag && (canAttackUnit || canAttackBase)) {
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
                      if (unit.type === UnitType.CAVALRY) soundManager.playSpearThrust();
                      else soundManager.playMetalClash();
                      
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
                      
                      soundManager.playCastleHit(); 
                      this.triggerScreenShake(1);
                  }
              }
          }
      } else {
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
              unit.state = UnitState.MOVE;
              moveDir = isPlayer ? 1 : -1;
              unit.x += moveDir * unit.stats.speed * speedMult;
          }
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

          if (unit.freezeTimer > 0) {
              speedMult = 0; // Hard Stun
          } else if (unit.isSlowed) {
              const opponentPower = unit.faction === Faction.ENEMY ? this.upgrades.freezePower : this.enemyUpgrades.freezePower;
              const slowPercent = 0.5 + (opponentPower * 0.02);
              speedMult = Math.max(0.1, 1 - slowPercent);
          }

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

          if (p.type === 'ARROW' && p.targetId) {
                const target = this.units.find(u => u.id === p.targetId);
                if (target && target.state !== UnitState.DEAD && target.state !== UnitState.DIE) {
                    const tx = target.x;
                    const ty = target.y - target.height / 2;
                    const dx = tx - p.x;
                    const dy = ty - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const speed = 15;

                    if (dist < 20) {
                        p.x = tx;
                        p.y = ty;
                    } else {
                        p.vx = (dx / dist) * speed;
                        p.vy = (dy / dist) * speed;
                        p.x += p.vx;
                        p.y += p.vy;
                        p.rotation = Math.atan2(p.vy, p.vx);
                    }
                } else {
                    p.targetId = undefined;
                    p.vy += GRAVITY;
                    p.x += p.vx;
                    p.y += p.vy;
                }
          } else if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += GRAVITY; 
              p.rotation = Math.atan2(p.vy, p.vx);
          }

          if (p.type === 'ARROW') {
               const isPlayerShot = p.faction === Faction.PLAYER;
               const targetBaseX = isPlayerShot ? ENEMY_BASE_X : PLAYER_BASE_X;
               
               // Logic Update: If arrow is from Skill, it ignores Castle collision
               if (!p.fromSkill && Math.abs(p.x - targetBaseX) < 120 && p.y > (GROUND_Y - 250) && p.y < GROUND_Y) {
                   if (isPlayerShot) {
                       this.enemyBaseHp -= p.damage;
                   } else {
                       this.playerBaseHp -= p.damage;
                   }
                   p.active = false;
                   this.createParticles(p.x, p.y, 3, '#94a3b8'); 
                   soundManager.playCastleHit(); 
                   continue;
               }
          }

          if ((p.type === 'ARROW' || p.type === 'TOWER_SHOT') && p.y >= GROUND_Y) {
              p.active = false;
              continue;
          }

          if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
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

  updatePlayerAI() {
      // Simulates the player side when in Spectator Mode
      // Very similar to updateAI but target Faction.PLAYER
      const playerUnits = this.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
      const playerMiners = playerUnits.filter(u => u.type === UnitType.MINER).length;
      
      const targetMiners = 12;
      const queueMiners = this.playerQueue.filter(q => q.type === UnitType.MINER).length;

      if (playerMiners + queueMiners < targetMiners) {
           this.queueUnit(UnitType.MINER, Faction.PLAYER);
      } else {
           if (this.gold >= 100) { 
                const r = Math.random();
                let type = UnitType.SWORDMAN;
                if (r < 0.3) type = UnitType.ARCHER;
                if (r < 0.1) type = UnitType.CAVALRY;
                if (this.gold > 1000 && r < 0.05) type = UnitType.HERO;
                this.queueUnit(type, Faction.PLAYER);
           }
      }

      if (this.gold > 2000 && this.playerTowers < MAX_TOWERS) {
           this.buyTower(Faction.PLAYER);
      }

      // Upgrade simulation
      if (this.frame % 300 === 0 && this.gold > 500) {
          const keys: (keyof UpgradeState)[] = ['swordDamage', 'archerDamage', 'spawnSpeed', 'minerSpeed'];
          const pick = keys[Math.floor(Math.random() * keys.length)];
          if (this.gold > 300) {
              this.gold -= 300;
              this.upgrades[pick]++;
          }
      }
  }

  updateAI() {
      // 1. AI State Machine
      if (this.aiStateTimer > 0) {
          this.aiStateTimer--;
      } else {
          const r = Math.random();
          if (this.aiState === 'ATTACK') {
              if (r < 0.4) { this.aiState = 'DEFEND'; this.aiStateTimer = 600; }
              else if (r < 0.6) { this.aiState = 'MASSING'; this.aiStateTimer = 400; }
              else { this.aiStateTimer = 600; } 
          } else if (this.aiState === 'DEFEND') {
              if (r < 0.5) { this.aiState = 'ATTACK'; this.aiStateTimer = 900; }
              else { this.aiState = 'MASSING'; this.aiStateTimer = 300; }
          } else if (this.aiState === 'MASSING') {
              this.aiState = 'ATTACK';
              this.aiStateTimer = 1200;
          } else { 
              this.aiState = 'DEFEND';
              this.aiStateTimer = 300;
          }
      }

      // 2. Spawn Logic (SIMULATING A PLAYER)
      // In Multiplayer, AI behaves more aggressively and upgrades dynamically
      const enemyUnits = this.units.filter(u => u.faction === Faction.ENEMY && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
      const enemyMiners = enemyUnits.filter(u => u.type === UnitType.MINER).length;
      
      const targetMiners = Math.min(15, 3 + Math.floor(this.level.level / 2));
      const queueMiners = this.enemyQueue.filter(q => q.type === UnitType.MINER).length;

      // Online AI: Prioritizes miners early, then balanced army
      if (enemyMiners + queueMiners < targetMiners) {
           this.queueUnit(UnitType.MINER, Faction.ENEMY);
      } else {
           if (this.enemyGold >= 100) { 
                const r = Math.random();
                let type = UnitType.SWORDMAN;
                // Smarter unit composition for Online
                if (this.level.isMultiplayer) {
                     if (r < 0.3) type = UnitType.ARCHER;
                     if (r < 0.1) type = UnitType.CAVALRY;
                     if (this.enemyGold > 1000 && r < 0.05) type = UnitType.HERO;
                } else {
                    if (this.level.level >= 3 && r < 0.4) type = UnitType.ARCHER;
                    if (this.level.level >= 6 && r < 0.15) type = UnitType.CAVALRY;
                    if (this.level.level >= 10 && r < 0.05) type = UnitType.HERO;
                }
                
                this.queueUnit(type, Faction.ENEMY);
           }
      }
      
      // 3. Tower Buying
      if (this.enemyGold > 2000 && this.enemyTowers < MAX_TOWERS && (this.level.level >= 5 || this.level.isMultiplayer)) {
           this.buyTower(Faction.ENEMY);
      }
      
      // 4. Skills Usage (Smart AI)
      if (this.level.enemySmartAI || this.level.isMultiplayer) {
           const playerUnits = this.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
           if (playerUnits.length >= 4) {
               let sumX = 0;
               playerUnits.forEach(u => sumX += u.x);
               const avgX = sumX / playerUnits.length;
               
               if (avgX > this.enemyVisibleX) {
                    if (this.enemySkillCooldowns.ARROW_RAIN <= 0 && (this.level.level >= 4 || this.level.isMultiplayer)) {
                        this.spawnArrowRain(avgX, Faction.ENEMY, this.enemyUpgrades.arrowRainPower);
                        this.enemySkillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
                    } 
                    else if (this.enemySkillCooldowns.LIGHTNING <= 0 && (this.level.level >= 8 || this.level.isMultiplayer)) {
                        this.spawnLightning(avgX, Faction.ENEMY, this.enemyUpgrades.lightningPower);
                        this.enemySkillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING;
                    }
                    else if (this.enemySkillCooldowns.FREEZE <= 0 && (this.level.level >= 12 || this.level.isMultiplayer) && playerUnits.length > 8) {
                         this.spawnFreeze(avgX, Faction.ENEMY, this.enemyUpgrades.freezePower);
                         this.enemySkillCooldowns.FREEZE = SKILL_COOLDOWNS_FRAMES.FREEZE;
                    }
               }
           }
      }
      
      // 5. Online AI: Self Upgrade (Simulation)
      if (this.level.isMultiplayer && this.frame % 300 === 0 && this.enemyGold > 500) {
          // AI randomly upgrades stuff
          const keys: (keyof UpgradeState)[] = ['swordDamage', 'archerDamage', 'spawnSpeed', 'minerSpeed'];
          const pick = keys[Math.floor(Math.random() * keys.length)];
          // Just cheat slightly and bump stats without cost for "Simulation" feel, or deduce gold
          if (this.enemyGold > 300) {
              this.enemyGold -= 300;
              this.enemyUpgrades[pick]++;
          }
      }
  }

  update() {
    if (this.paused) return; 
    
    this.units.forEach(u => u.isSlowed = false);

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
    if (this.level.isSpectator) {
        // SPECTATOR MODE: FULL MAP VISIBILITY
        this.playerVisibleX = WORLD_WIDTH;
        this.enemyVisibleX = 0;
        
        // Also run Player AI
        this.updatePlayerAI();
    } else {
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
    }

    const passiveIncome = 5 + ((this.upgrades.passiveGold || 0) * 5); 
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
