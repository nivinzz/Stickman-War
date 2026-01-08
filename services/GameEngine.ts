
import { Unit, UnitType, Faction, UnitState, Projectile, Particle, GameLevel, UpgradeState, SpawnQueueItem, EnvElement, Firework, Hazard } from '../types';
import { CANVAS_WIDTH, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, UNIT_CONFIG, MINING_TIME, MINING_DISTANCE, GOLD_PER_TRIP, BASE_HP, GRAVITY, MAX_POPULATION, MAX_HEROES, SKILL_COOLDOWNS_FRAMES, INITIAL_GOLD, MAX_PASSIVE_GOLD_LEVEL, POP_UPGRADE_COST, MAX_POP_UPGRADES, FOG_OF_WAR_RANGE, REWARD_MELEE, REWARD_ARCHER, REWARD_HERO, MAX_UPGRADE_LEVELS, MAX_TOWERS, TOWER_COST_BASE, TOWER_COST_INC, TOWER_RANGE, TOWER_DAMAGE_BASE, TOWER_COOLDOWN, calculateUnitStats } from '../constants';
import { soundManager } from './SoundManager';

export class GameEngine {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  envElements: EnvElement[] = [];
  fireworks: Firework[] = [];
  hazards: Hazard[] = []; 
  
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
  aiState: 'ATTACK' | 'DEFEND' | 'MASSING' | 'PROBE' | 'RETREAT' = 'ATTACK';
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
    
    // --- BUFFED AI HP SCALING ---
    let hpMultiplier = 1 + (level.level * 0.5);
    if (level.level > 20) hpMultiplier += (level.level - 20) * 0.2; 
    if (level.isBoss) hpMultiplier *= 2.5;
    
    this.enemyMaxBaseHp = BASE_HP * hpMultiplier;
    this.enemyBaseHp = this.enemyMaxBaseHp;
    
    // --- BUFFED AI STARTING GOLD ---
    this.enemyGold = 300 + (level.level * 100); 
    
    // --- FREE TOWER FOR AI LEVEL 5+ ---
    if (level.level >= 5) {
        this.enemyTowers = 1;
        // Higher levels get more towers pre-built
        if (level.level >= 20) this.enemyTowers = 2;
        if (level.level >= 40) this.enemyTowers = 3;
    }

    // --- BUFFED AI UPGRADE LEVELS ---
    const baseAILevel = Math.max(0, Math.floor(level.level * 0.9));
    const bonusDmg = Math.floor(level.level / 3);

    this.enemyUpgrades = {
        baseHp: baseAILevel,
        swordDamage: baseAILevel + bonusDmg,
        archerDamage: baseAILevel + bonusDmg,
        cavalryDamage: baseAILevel + bonusDmg,
        spawnSpeed: Math.min(20, baseAILevel + 5), 
        arrowRainPower: baseAILevel,
        lightningPower: baseAILevel,
        freezePower: baseAILevel,
        heroPower: baseAILevel,
        minerSpeed: Math.min(30, baseAILevel),
        maxPopUpgrade: Math.floor(level.level / 5), 
        passiveGold: Math.min(5, Math.floor(level.level / 5)), 
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
              scale: 0.8 + Math.random() * 0.5,
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
      this.vanguardPercentage = pct;
      this.onStateChange(this);
  }

  clearRallyPoint() {
      if (!this.started || this.paused) return;
      this.rallyPoint = null;
      this.patrolPoint = null; 
      this.vanguardPoint = null;
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
          const baseSpeedBuff = this.level.level * 0.05;
          const upgradeBuff = this.enemyUpgrades.spawnSpeed * 0.1;
          spawnTime = Math.max(30, spawnTime * (1 - (baseSpeedBuff + upgradeBuff))); 
          
          if (this.level.level > 40 && type !== UnitType.HERO) spawnTime = 30; 
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
        const levelScaling = 1 + (this.level.level * 0.05);
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
      isVanguard: false // Default to Main Army
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
    const durationSeconds = 3 * (1 + (powerLevel * 0.1)); 
    const durationFrames = durationSeconds * 60;

    if (isPlayer) {
        this.skillActiveTimers.LIGHTNING = durationFrames;
        this.skillMaxDurations.LIGHTNING = durationFrames;
        this.lightningTargetX = x; 
    }
    
    const damage = 30 + (powerLevel * 15);
    
    for(let i=0; i<3; i++) {
        setTimeout(() => {
            if(this.gameOver || this.victory || this.paused) return;
             const radius = 150;
             const targets = this.units.filter(u => 
                u.faction !== faction && 
                u.state !== UnitState.DIE &&
                Math.abs(u.x - x) < radius
            );
            
            this.projectiles.push({
                id: `bolt_${Math.random()}`,
                x: x + (Math.random()*radius*2 - radius),
                y: GROUND_Y,
                vx: 0, vy: 0, startX: 0, damage: 0, faction: faction, active: true,
                type: 'LIGHTNING_BOLT', rotation: 0
            });
            
            targets.forEach(t => {
                t.stats.hp -= damage;
                this.createParticles(t.x, t.y, 5, '#FFFF00');
            });
            this.triggerScreenShake(3);
        }, i * 300);
    }
  }

  spawnFreeze(x: number, faction: Faction, powerLevel: number) {
      const isPlayer = faction === Faction.PLAYER;
      const range = 200; 
      const freezeDurationFrames = (3 * (1 + (powerLevel * 0.1))) * 60;
      
      if (isPlayer) {
          this.skillActiveTimers.FREEZE = freezeDurationFrames;
          this.skillMaxDurations.FREEZE = freezeDurationFrames;
      }

      this.hazards.push({
          id: Math.random().toString(),
          type: 'FREEZE_ZONE',
          x: x - range,
          y: GROUND_Y - 10,
          width: range * 2,
          height: 20,
          duration: freezeDurationFrames,
          damagePercent: 0.05 + (powerLevel * 0.01), 
          slowFactor: 0.5,
          faction: faction 
      });
      this.createParticles(x, GROUND_Y - 50, 50, '#bae6fd', false);
  }

  updateLightning() {
      if (this.skillActiveTimers.LIGHTNING > 0) {
          if (this.frame % 10 === 0) {
              const radius = 150;
              const targets = this.units.filter(u => 
                  u.faction === Faction.ENEMY && 
                  u.state !== UnitState.DIE &&
                  Math.abs(u.x - this.lightningTargetX) < radius
              );
              
              if (targets.length > 0 || Math.random() > 0.5) {
                   this.projectiles.push({
                       id: `bolt_${Math.random()}`,
                       x: this.lightningTargetX + (Math.random()*radius*2 - radius),
                       y: GROUND_Y,
                       vx: 0, vy: 0, startX: 0, damage: 0, faction: Faction.PLAYER, active: true,
                       type: 'LIGHTNING_BOLT', rotation: 0
                   });

                   targets.forEach(t => {
                       t.stats.hp -= 30 + (this.upgrades.lightningPower * 15); 
                       this.createParticles(t.x, t.y, 5, '#FFFF00');
                   });
              }
              this.triggerScreenShake(3);
          }
      }
  }

  updateHazards() {
      this.hazards = this.hazards.filter(h => h.duration > 0);
      this.hazards.forEach(hazard => {
          hazard.duration--;
          if (this.frame % 10 === 0) {
              const px = hazard.x + Math.random() * hazard.width;
              this.createParticles(px, GROUND_Y, 1, '#bae6fd', false);
          }
      });
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

  // --- VANGUARD MANAGEMENT ---
  manageVanguard() {
      if (this.frame % 30 !== 0) return; // Check twice per second

      // 1. Get pool of potential recruits (Player non-miner, non-hero, alive)
      const army = this.units.filter(u => 
          u.faction === Faction.PLAYER && 
          u.type !== UnitType.MINER && 
          u.type !== UnitType.HERO && // Heroes stick to main army
          u.state !== UnitState.DEAD && 
          u.state !== UnitState.DIE
      );

      const targetVanguardCount = Math.floor(army.length * this.vanguardPercentage);
      let currentVanguard = army.filter(u => u.isVanguard);

      if (currentVanguard.length < targetVanguardCount) {
          // NEED MORE: Recruit from the army (pick those closest to enemy or just random)
          // Sort by X (closest to enemy) to simulate frontline troops staying there
          const nonVanguard = army.filter(u => !u.isVanguard).sort((a,b) => b.x - a.x);
          const needed = targetVanguardCount - currentVanguard.length;
          
          for(let i=0; i<needed && i<nonVanguard.length; i++) {
              nonVanguard[i].isVanguard = true;
          }
      } else if (currentVanguard.length > targetVanguardCount) {
          // TOO MANY: Dismiss from vanguard (send back to main force)
          // Sort by X (closest to base) to retreat the rear-guard of the vanguard first
          const surplus = currentVanguard.length - targetVanguardCount;
          currentVanguard.sort((a,b) => a.x - b.x); // Low X first
          
          for(let i=0; i<surplus; i++) {
              currentVanguard[i].isVanguard = false;
          }
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

    // Passive Gold
    const passiveIncome = 1 + ((this.upgrades.passiveGold || 0) * 2); 
    if (this.frame % 60 === 0) {
        this.gold += passiveIncome;
    }

    this.manageVanguard(); // Process Vanguard assignments
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
  
  updateEnvironment() {
      this.envElements.forEach(e => {
          if (e.type === 'CLOUD') {
              e.x += e.speed;
              if (e.x > WORLD_WIDTH + 100) e.x = -200;
          }
          if (e.type === 'BIRD') {
              e.x += e.speed;
              if (e.x > WORLD_WIDTH + 50) e.x = -50;
              e.y += Math.sin(this.frame * 0.05) * 0.5;
          }
      });
  }

  updateUnits() {
    this.units = this.units.filter(u => u.state !== UnitState.DEAD);

    this.units.forEach(unit => {
      if (unit.state === UnitState.DIE) {
        unit.deathTimer--;
        if (unit.rotation < Math.PI / 2) unit.rotation += 0.1;
        unit.opacity = unit.deathTimer / 60;
        if (unit.deathTimer <= 0) unit.state = UnitState.DEAD;
        return;
      }

      // Status Effects
      let speedMult = 1;
      if (unit.freezeTimer > 0) {
        unit.freezeTimer--;
        speedMult = 0.5; // Slowed
        unit.isSlowed = true;
      } else {
        unit.isSlowed = false;
      }
      
      const inHazard = this.hazards.find(h => 
        h.faction !== unit.faction && 
        unit.x >= h.x && unit.x <= h.x + h.width &&
        Math.abs(unit.y - h.y) < 50 
      );

      if (inHazard) {
          speedMult *= inHazard.slowFactor;
          if (this.frame % 60 === 0) {
              unit.stats.hp -= unit.stats.maxHp * inHazard.damagePercent;
              if (unit.stats.hp <= 0) {
                  unit.state = UnitState.DIE;
                  soundManager.playDie();
              }
          }
      }

      if (unit.type === UnitType.MINER) {
          this.updateMiner(unit, speedMult);
      } else {
          this.updateCombatUnit(unit, speedMult);
      }
      
      unit.animationFrame++;
    });
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

  updateCombatUnit(unit: Unit, speedMult: number) {
      const isPlayer = unit.faction === Faction.PLAYER;
      const enemyBaseX = isPlayer ? ENEMY_BASE_X : PLAYER_BASE_X;
      
      // Find Target
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

      // State Logic
      if (target && distToTarget <= range) {
          unit.state = UnitState.ATTACK;
          unit.targetId = target.id;
          
          if (this.frame - unit.lastAttackFrame >= attackSpeed) {
              unit.lastAttackFrame = this.frame;
              if (unit.type === UnitType.ARCHER) {
                  this.fireArrow(unit, target);
              } else {
                  target.stats.hp -= unit.stats.damage;
                  soundManager.playHit();
                  this.createParticles(target.x, target.y - 20, 3, '#ef4444');
                  if (target.stats.hp <= 0) {
                      unit.targetId = null;
                      target.state = UnitState.DIE;
                      this.rewardKill(target);
                  }
              }
          }
      } else if (Math.abs(unit.x - enemyBaseX) <= range) {
          unit.state = UnitState.ATTACK;
           if (this.frame - unit.lastAttackFrame >= attackSpeed) {
              unit.lastAttackFrame = this.frame;
              if (unit.type === UnitType.ARCHER) {
                  this.fireArrowAtBase(unit, enemyBaseX);
              } else {
                  if (isPlayer) this.enemyBaseHp -= unit.stats.damage;
                  else this.playerBaseHp -= unit.stats.damage;
                  soundManager.playHit();
                  this.triggerScreenShake(1);
              }
           }
      } else {
          // --- MOVEMENT LOGIC ---
          let moveDir = 0;
          
          // Player Logic
          if (isPlayer) {
              unit.state = UnitState.MOVE; // Default player state to MOVE unless overridden
              
              // Priority 1: Vanguard Logic (Green Flag)
              if (unit.isVanguard && this.vanguardPoint !== null) {
                  if (Math.abs(unit.x - this.vanguardPoint) > 5) {
                      moveDir = this.vanguardPoint > unit.x ? 1 : -1;
                  } else {
                      unit.state = UnitState.IDLE;
                  }
              }
              // Priority 2: Rally Point (Blue Flag) - Default Main Force
              else if (this.rallyPoint !== null) {
                  if (Math.abs(unit.x - this.rallyPoint) > 5) {
                      moveDir = this.rallyPoint > unit.x ? 1 : -1;
                  } else {
                      unit.state = UnitState.IDLE;
                  }
                  
                  // Priority 3: Patrol (Red Flag)
                  if (this.patrolPoint !== null && !unit.isVanguard) {
                       const ptA = this.rallyPoint;
                       const ptB = this.patrolPoint;
                       if (unit.patrolHeading === 'A') {
                           if (Math.abs(unit.x - ptA) < 10) unit.patrolHeading = 'B';
                           else moveDir = ptA > unit.x ? 1 : -1;
                       } else {
                           if (Math.abs(unit.x - ptB) < 10) unit.patrolHeading = 'A';
                           else moveDir = ptB > unit.x ? 1 : -1;
                       }
                       unit.state = UnitState.MOVE;
                  }
              } else {
                  // Default Charge
                  moveDir = 1;
              }
          } 
          // AI Logic
          else {
              if (unit.state === UnitState.RETREAT) {
                  // Retreating to towers
                  const retreatTarget = ENEMY_BASE_X - TOWER_RANGE + 50; 
                  if (unit.x > retreatTarget) moveDir = -1; // Move left (back to base)
                  else unit.state = UnitState.IDLE; // Reached safety
              } else {
                  unit.state = UnitState.MOVE; // Default move if not retreating
                  
                  if (this.aiState === 'PROBE') {
                      // Only specific units probe, others hold
                      const isProbe = unit.type === UnitType.CAVALRY || unit.type === UnitType.SWORDMAN;
                      if (isProbe && this.frame % 600 < 300) { // Probe periodically
                           moveDir = -1; // Attack
                      } else {
                           // Hold near base/towers
                           if (unit.x < ENEMY_BASE_X - 600) moveDir = 1; // Return
                           else if (unit.x > ENEMY_BASE_X - 400) moveDir = -1; // Patrol out
                           else unit.state = UnitState.IDLE;
                      }
                  } else {
                      // Normal Attack
                      moveDir = -1;
                  }
              }
          }

          if (unit.state === UnitState.MOVE || unit.state === UnitState.RETREAT) {
              unit.x += moveDir * unit.stats.speed * speedMult;
          }
      }
  }

  fireArrow(unit: Unit, target: Unit) {
      const dx = target.x - unit.x;
      const dy = (target.y - target.height/2) - (unit.y - unit.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      const speed = 12;
      
      this.projectiles.push({
          id: Math.random().toString(),
          x: unit.x,
          y: unit.y - 20,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed - 2, // Slight arc
          startX: unit.x,
          damage: unit.stats.damage,
          faction: unit.faction,
          active: true,
          type: 'ARROW',
          rotation: Math.atan2(dy, dx)
      });
      soundManager.playAttack('ARCHER');
  }

  fireArrowAtBase(unit: Unit, targetX: number) {
      const targetY = GROUND_Y - 50; // Aim at castle center roughly
      const dx = targetX - unit.x;
      const dy = targetY - (unit.y - unit.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      const speed = 12;

      this.projectiles.push({
          id: Math.random().toString(),
          x: unit.x,
          y: unit.y - 20,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed - 2,
          startX: unit.x,
          damage: unit.stats.damage,
          faction: unit.faction,
          active: true,
          type: 'ARROW',
          rotation: Math.atan2(dy, dx)
      });
      soundManager.playAttack('ARCHER');
  }

  updateProjectiles() {
      this.projectiles.forEach(p => {
          if (!p.active) return;
          
          p.x += p.vx;
          p.y += p.vy;
          
          if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
             p.vy += GRAVITY * 0.5; // Less gravity for arrows for better range feel
             p.rotation = Math.atan2(p.vy, p.vx);
          }

          // Ground collision
          if (p.y > GROUND_Y) {
              p.active = false;
              return;
          }

          // Unit collision
          // Optimization: Only check units of opposite faction
          const targets = this.units.filter(u => u.faction !== p.faction && u.state !== UnitState.DIE && u.state !== UnitState.DEAD);
          for (const u of targets) {
              if (Math.abs(u.x - p.x) < u.width && Math.abs(u.y - u.height/2 - p.y) < u.height) {
                  u.stats.hp -= p.damage;
                  p.active = false;
                  soundManager.playHit();
                  this.createParticles(u.x, u.y - 20, 3, '#ef4444');
                  
                  if (u.stats.hp <= 0) {
                      u.state = UnitState.DIE;
                      this.rewardKill(u);
                  }
                  return;
              }
          }
          
          // Base Collision
          const isPlayer = p.faction === Faction.PLAYER;
          const enemyBaseX = isPlayer ? ENEMY_BASE_X : PLAYER_BASE_X;
          // Simple base collision: if projectile crosses base line
          if ((isPlayer && p.x > enemyBaseX - 50) || (!isPlayer && p.x < enemyBaseX + 50)) {
              p.active = false;
              if (isPlayer) this.enemyBaseHp -= p.damage;
              else this.playerBaseHp -= p.damage;
              soundManager.playHit();
              return;
          }
      });
      
      this.projectiles = this.projectiles.filter(p => p.active);
  }

  updateParticles() {
      this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.gravity) p.vy += GRAVITY;
          p.life--;
      });
      this.particles = this.particles.filter(p => p.life > 0);
  }

  checkGameStatus() {
      if (this.playerBaseHp <= 0) {
          this.gameOver = true;
          soundManager.playDefeat();
          this.onStateChange(this);
      } else if (this.enemyBaseHp <= 0) {
          this.victory = true;
          soundManager.playVictory();
          this.onStateChange(this);
      }
  }

  updateAI() {
     if (this.frame % 60 !== 0) return; // Tick once per second

     const activeUnits = this.units.filter(u => u.faction === Faction.ENEMY && u.state !== UnitState.DEAD);
     const miners = activeUnits.filter(u => u.type === UnitType.MINER).length;
     const fighters = activeUnits.length - miners;
     const targetMiners = Math.min(6, 2 + Math.floor(this.level.level / 3));
     const timeSeconds = this.levelTimer / 60;

     // --- 1. CHEAT MECHANICS (Rubber Banding) ---
     if (timeSeconds < 180 && this.enemyGold < 200 && miners < 4) {
         this.enemyGold += 100; 
     }

     if (timeSeconds < 180) {
         if (this.enemyBaseHp < this.enemyMaxBaseHp * 0.95 && this.enemyTowers < 2) {
             if (this.enemyGold >= TOWER_COST_BASE) this.buyTower(Faction.ENEMY);
             else this.enemyTowers++;
         }
     } else if (timeSeconds > 300) {
         if (this.enemyTowers < 3 && this.enemyGold >= TOWER_COST_BASE) {
             this.buyTower(Faction.ENEMY);
         }
     }

     // --- 2. INTELLIGENCE (Counter-Play & Retreat) ---
     const playerUnits = this.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD);
     const pSwords = playerUnits.filter(u => u.type === UnitType.SWORDMAN).length;
     const pArchers = playerUnits.filter(u => u.type === UnitType.ARCHER).length;
     const pCavs = playerUnits.filter(u => u.type === UnitType.CAVALRY).length;
     const pHeroes = playerUnits.filter(u => u.type === UnitType.HERO).length;
     
     // 2a. RETREAT LOGIC (Hit & Run)
     // If army is weak and far from base, retreat to towers
     const isArmyWeak = fighters < playerUnits.length * 0.5;
     const isFarFromBase = activeUnits.some(u => u.x < ENEMY_BASE_X - 1000);
     
     if (isArmyWeak && isFarFromBase) {
         this.aiState = 'RETREAT';
         activeUnits.forEach(u => {
             if (u.type !== UnitType.MINER && u.x < ENEMY_BASE_X - TOWER_RANGE) {
                 u.state = UnitState.RETREAT;
             }
         });
     } else if (this.aiState === 'RETREAT' && activeUnits.every(u => u.x >= ENEMY_BASE_X - TOWER_RANGE)) {
         this.aiState = 'DEFEND'; // Reached safety
     } else if (this.aiState === 'DEFEND' && fighters > playerUnits.length * 0.8) {
         this.aiState = 'ATTACK'; // Counter attack
     }

     // 2b. PROBING (Instead of Force Attack)
     // If no combat for a long time, send probing units
     const lastEnemyAttack = Math.max(...activeUnits.map(u => u.lastAttackFrame), 0);
     const timeSinceCombat = this.frame - lastEnemyAttack;
     if (timeSinceCombat > 900 && this.aiState !== 'RETREAT') { // 15s no combat
         this.aiState = 'PROBE';
     }

     // --- 3. SKILL USAGE (Defensive & Aggressive - STRICT VISION CHECK) ---
     const visiblePlayerUnits = playerUnits.filter(u => u.x >= this.enemyVisibleX);

     if (visiblePlayerUnits.length > 0) {
         const avgX = visiblePlayerUnits.reduce((sum, u) => sum + u.x, 0) / visiblePlayerUnits.length;
         
         // Arrow Rain on Vanguard
         if (this.enemySkillCooldowns.ARROW_RAIN <= 0 && visiblePlayerUnits.length >= 3) {
             this.spawnArrowRain(avgX, Faction.ENEMY, this.enemyUpgrades.arrowRainPower);
             this.enemySkillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
         }
         
         // Lightning on Heroes
         if (this.enemySkillCooldowns.LIGHTNING <= 0) {
             const target = visiblePlayerUnits.find(u => u.type === UnitType.HERO) || visiblePlayerUnits[0];
             if (target) {
                 this.spawnLightning(target.x, Faction.ENEMY, this.enemyUpgrades.lightningPower);
                 this.enemySkillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING;
             }
         }

         // Freeze if visible and threatening
         if (this.enemySkillCooldowns.FREEZE <= 0 && avgX > ENEMY_BASE_X - 600) {
             this.spawnFreeze(avgX, Faction.ENEMY, this.enemyUpgrades.freezePower);
             this.enemySkillCooldowns.FREEZE = SKILL_COOLDOWNS_FRAMES.FREEZE;
         }
     }

     // --- 4. ECONOMY ---
     if (miners < targetMiners && this.enemyGold >= UNIT_CONFIG[UnitType.MINER].cost) {
         this.queueUnit(UnitType.MINER, Faction.ENEMY);
         return;
     }

     if (this.level.level >= 20 && pHeroes > 0) {
         const enemyHeroes = activeUnits.filter(u => u.type === UnitType.HERO).length;
         if (enemyHeroes < pHeroes && this.enemyGold >= UNIT_CONFIG[UnitType.HERO].cost) {
             this.queueUnit(UnitType.HERO, Faction.ENEMY);
             return; 
         }
     }

     if (this.enemyGold > 100) {
         let buyType = UnitType.SWORDMAN;
         if (pArchers > 3) buyType = UnitType.CAVALRY;
         else if (pCavs > 3) buyType = UnitType.SWORDMAN; 
         else if (pSwords > 3) buyType = UnitType.ARCHER;
         else {
             const roll = Math.random();
             if (roll < 0.4) buyType = UnitType.SWORDMAN;
             else if (roll < 0.7) buyType = UnitType.ARCHER;
             else buyType = UnitType.CAVALRY;
         }
         if (this.enemyGold >= UNIT_CONFIG[buyType].cost) this.queueUnit(buyType, Faction.ENEMY);
         else if (this.enemyGold >= UNIT_CONFIG[UnitType.SWORDMAN].cost) this.queueUnit(UnitType.SWORDMAN, Faction.ENEMY);
     }
  }

}
