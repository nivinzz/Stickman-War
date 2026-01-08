
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
  
  rallyPoint: number | null = null; 
  patrolPoint: number | null = null; 
  
  // --- AI LOGIC PROPERTIES ---
  aiState: 'ATTACK' | 'DEFEND' | 'MASSING' = 'ATTACK';
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

  clearRallyPoint() {
      if (!this.started || this.paused) return;
      this.rallyPoint = null;
      this.patrolPoint = null; 
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

    // 1. Determine Upgrade Level
    let unitUpgradeLevel = 0;
    if (type === UnitType.SWORDMAN) unitUpgradeLevel = upgrades.swordDamage;
    else if (type === UnitType.ARCHER) unitUpgradeLevel = upgrades.archerDamage;
    else if (type === UnitType.CAVALRY) unitUpgradeLevel = upgrades.cavalryDamage;
    else if (type === UnitType.HERO) unitUpgradeLevel = upgrades.heroPower;
    else if (type === UnitType.MINER) unitUpgradeLevel = upgrades.minerSpeed;

    // 2. Calculate Base Stats based on Upgrades
    let stats = calculateUnitStats(type, unitUpgradeLevel);

    // 3. AI Extra Scaling
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
      stats: stats, // Use the calculated stats
      lastAttackFrame: 0,
      targetId: null,
      width: 20 * sizeMultiplier,
      height: (type === UnitType.HERO ? 60 : 40) * sizeMultiplier,
      animationFrame: 0,
      rotation: 0,
      deathTimer: 60, // 1 Second linger
      opacity: 1,
      freezeTimer: 0,
      isSlowed: false,
      patrolHeading: 'A'
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

  update() {
    if (this.paused) return; 
    
    if (this.victory && this.frame % 30 === 0) {
        this.createFirework();
    }
    this.updateFireworks();

    if (this.gameOver || this.victory) return;
    
    this.frame++;
    this.levelTimer++; // Increment elapsed time for level

    if (this.screenShake > 0) this.screenShake *= 0.9;
    
    if (this.skillCooldowns.ARROW_RAIN > 0) this.skillCooldowns.ARROW_RAIN--;
    if (this.skillCooldowns.LIGHTNING > 0) this.skillCooldowns.LIGHTNING--;
    if (this.skillCooldowns.FREEZE > 0) this.skillCooldowns.FREEZE--;

    if (this.skillActiveTimers.ARROW_RAIN > 0) this.skillActiveTimers.ARROW_RAIN--;
    if (this.skillActiveTimers.LIGHTNING > 0) this.skillActiveTimers.LIGHTNING--;
    if (this.skillActiveTimers.FREEZE > 0) this.skillActiveTimers.FREEZE--;
    
    if (this.enemySkillCooldowns.ARROW_RAIN > 0) this.enemySkillCooldowns.ARROW_RAIN--;
    if (this.enemySkillCooldowns.LIGHTNING > 0) this.enemySkillCooldowns.LIGHTNING--;
    if (this.enemySkillCooldowns.FREEZE > 0) this.enemySkillCooldowns.FREEZE--;

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

    // --- GOLD INCOME ---
    const passiveIncome = 1 + ((this.upgrades.passiveGold || 0) * 2); 
    if (this.frame % 60 === 0) {
        this.gold += passiveIncome;
    }

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
    // 1. Filter out dead/decayed units
    this.units = this.units.filter(u => u.state !== UnitState.DEAD);

    // 2. Process each unit
    this.units.forEach(unit => {
      if (unit.state === UnitState.DIE) {
        unit.deathTimer--;
        
        // --- DEATH ANIMATION: FALL BACKWARDS ---
        // Rotate up to 90 degrees (PI/2)
        if (unit.rotation < Math.PI / 2) {
             unit.rotation += 0.1;
        }

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
      
      // Check for Hazards (Freeze Zones)
      const inHazard = this.hazards.find(h => 
        h.faction !== unit.faction && 
        unit.x >= h.x && unit.x <= h.x + h.width &&
        Math.abs(unit.y - h.y) < 50 // Rough Y check
      );

      if (inHazard) {
          speedMult *= inHazard.slowFactor;
          if (this.frame % 60 === 0) {
              // DOT
              unit.stats.hp -= unit.stats.maxHp * inHazard.damagePercent;
              if (unit.stats.hp <= 0) {
                  unit.state = UnitState.DIE;
                  soundManager.playDie();
              }
          }
      }

      // Logic per type
      if (unit.type === UnitType.MINER) {
          this.updateMiner(unit, speedMult);
      } else {
          this.updateCombatUnit(unit, speedMult);
      }
      
      // Animation
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
              // Face direction
              unit.rotation = 0; // Upright
          }
      } else if (unit.state === UnitState.MINE_GATHERING) {
          if (unit.miningTimer && unit.miningTimer > 0) {
              unit.miningTimer--;
          } else {
              unit.state = UnitState.MINE_RETURN;
              unit.goldCarrying = GOLD_PER_TRIP + (this.upgrades.minerSpeed * 1); // scaling gold
          }
      } else if (unit.state === UnitState.MINE_RETURN) {
           if (Math.abs(unit.x - base) < 5) {
              // Deposit
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
      const attackSpeed = Math.max(10, unit.stats.attackSpeed); // Frames per attack

      // State Logic
      if (target && distToTarget <= range) {
          unit.state = UnitState.ATTACK;
          unit.targetId = target.id;
          
          // Attack Logic
          if (this.frame - unit.lastAttackFrame >= attackSpeed) {
              // Trigger Attack
              unit.lastAttackFrame = this.frame;
              
              if (unit.type === UnitType.ARCHER) {
                  this.fireArrow(unit, target);
              } else {
                  // Melee Hit
                  target.stats.hp -= unit.stats.damage;
                  soundManager.playHit();
                  this.createParticles(target.x, target.y - 20, 3, '#ef4444');
                  if (target.stats.hp <= 0) {
                      unit.targetId = null; // Clear target
                      target.state = UnitState.DIE;
                      this.rewardKill(target);
                  }
              }
          }
      } else if (Math.abs(unit.x - enemyBaseX) <= range) {
          // Attack Base
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
          // Move
          unit.state = UnitState.MOVE;
          let moveDir = 0;
          
          // Patrol / Rally Logic (Player only for now)
          if (isPlayer && this.rallyPoint !== null) {
              // If outside combat, move to rally point
              if (Math.abs(unit.x - this.rallyPoint) > 5) {
                  moveDir = this.rallyPoint > unit.x ? 1 : -1;
              } else {
                  unit.state = UnitState.IDLE;
              }
              
              // If Patrol Point Set
              if (this.patrolPoint !== null) {
                   // Patrol between rallyPoint (A) and patrolPoint (B)
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
              moveDir = isPlayer ? 1 : -1;
          }

          unit.x += moveDir * unit.stats.speed * speedMult;
      }
  }

  fireArrow(shooter: Unit, target: Unit) {
      const dx = target.x - shooter.x;
      const dy = (target.y - 30) - (shooter.y - 30);
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      const speed = 12;
      const time = dist / speed;
      
      const vx = (dx / time);
      const vy = (dy - 0.5 * GRAVITY * time * time) / time; // Solve for initial vy

      this.projectiles.push({
          id: Math.random().toString(),
          x: shooter.x,
          y: shooter.y - 30,
          vx: vx,
          vy: vy,
          startX: shooter.x,
          damage: shooter.stats.damage,
          faction: shooter.faction,
          active: true,
          type: 'ARROW',
          rotation: Math.atan2(vy, vx)
      });
      soundManager.playAttack('ARCHER');
  }

  fireArrowAtBase(shooter: Unit, baseX: number) {
       const dx = baseX - shooter.x;
       const dy = 0; 
       const speed = 12;
       const time = Math.abs(dx) / speed;
       const vx = dx / time;
       const vy = (dy - 0.5 * GRAVITY * time * time) / time;
       
       this.projectiles.push({
          id: Math.random().toString(),
          x: shooter.x,
          y: shooter.y - 30,
          vx: vx,
          vy: vy,
          startX: shooter.x,
          damage: shooter.stats.damage,
          faction: shooter.faction,
          active: true,
          type: 'ARROW',
          rotation: Math.atan2(vy, vx)
      });
      soundManager.playAttack('ARCHER');
  }

  updateProjectiles() {
      this.projectiles = this.projectiles.filter(p => p.active);
      
      this.projectiles.forEach(p => {
          if (p.type === 'LIGHTNING_BOLT') {
              if (!p['timer']) p['timer'] = 5;
              p['timer']--;
              if (p['timer'] <= 0) p.active = false;
              return;
          }

          p.x += p.vx;
          p.y += p.vy;
          
          if (p.type === 'ARROW') {
              p.vy += GRAVITY;
              p.rotation = Math.atan2(p.vy, p.vx);
          }

          // Ground Hit
          if (p.y >= GROUND_Y) {
              p.active = false;
              this.createParticles(p.x, p.y, 2, '#9ca3af', false);
              return;
          }

          // Out of bounds
          if (p.x < 0 || p.x > WORLD_WIDTH) {
              p.active = false;
              return;
          }

          // Unit Hit Collision
          const isPlayerProj = p.faction === Faction.PLAYER;
          const targets = this.units.filter(u => 
              u.faction !== p.faction && 
              u.state !== UnitState.DIE && 
              u.state !== UnitState.DEAD &&
              Math.abs(u.x - p.x) < (u.width + 10) && 
              Math.abs((u.y - u.height/2) - p.y) < u.height
          );

          if (targets.length > 0) {
              const target = targets[0]; 
              target.stats.hp -= p.damage;
              soundManager.playHit();
              this.createParticles(p.x, p.y, 3, '#ef4444');
              p.active = false;
              
              if (target.stats.hp <= 0) {
                  target.state = UnitState.DIE;
                  this.rewardKill(target);
              }
              return;
          }
          
          // Base Collision
          const enemyBaseX = isPlayerProj ? ENEMY_BASE_X : PLAYER_BASE_X;
          if (Math.abs(p.x - enemyBaseX) < 50 && p.y > GROUND_Y - 100) {
              if (isPlayerProj) this.enemyBaseHp -= p.damage;
              else this.playerBaseHp -= p.damage;
              
              p.active = false;
              soundManager.playHit();
              return;
          }
      });
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
      if (this.gameOver || this.victory) return;

      if (this.playerBaseHp <= 0) {
          this.playerBaseHp = 0;
          this.gameOver = true;
          this.started = false;
          soundManager.playDefeat();
          this.onStateChange(this);
      } else if (this.enemyBaseHp <= 0) {
          this.enemyBaseHp = 0;
          this.victory = true;
          this.started = false;
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

     // --- 1. INTELLIGENT DEFENSE (Anti-Cheese) ---
     // If Player has units close to base OR base HP is low -> FORCE TOWER
     const playerUnitsNear = this.units.some(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD && u.x > ENEMY_BASE_X - 600);
     const baseLow = this.enemyBaseHp < this.enemyMaxBaseHp * 0.75;
     
     if ((playerUnitsNear || baseLow) && this.enemyTowers < MAX_TOWERS) {
         if (this.enemyGold >= TOWER_COST_BASE) {
             this.buyTower(Faction.ENEMY);
         }
     }

     // --- 2. ECONOMY PRIORITY ---
     // AI must have at least 2 miners before thinking about attacking, unless absolutely desperate
     if (miners < 2 && this.enemyGold >= UNIT_CONFIG[UnitType.MINER].cost) {
         this.queueUnit(UnitType.MINER, Faction.ENEMY);
         return;
     }

     // --- 3. MASSING LOGIC (The "Blob" Strategy) ---
     // If the player has a small army (likely blocking), AI should save up to overwhelm
     const playerArmyCount = this.units.filter(u => u.faction === Faction.PLAYER && u.type !== UnitType.MINER && u.state !== UnitState.DEAD).length;
     
     // Transition to MASSING if player is turtling with few units
     if (this.aiState === 'ATTACK' && playerArmyCount < 3 && fighters < 2) {
         this.aiState = 'MASSING';
     }

     // Transition back to ATTACK if rich enough or player army grows
     if (this.aiState === 'MASSING') {
         // Tier 1 Mass: 600G (Enough for ~3 Archers or Cavalry mix)
         // Tier 2 Mass (Level 20+): 1500G
         const massThreshold = this.level.level > 20 ? 1500 : 600;
         
         if (this.enemyGold >= massThreshold || playerArmyCount > 5 || playerUnitsNear) {
             this.aiState = 'ATTACK';
         } else {
             // While massing, keep buying miners if needed
             if (miners < targetMiners && this.enemyGold >= UNIT_CONFIG[UnitType.MINER].cost) {
                 this.queueUnit(UnitType.MINER, Faction.ENEMY);
             }
             return; // Don't spend gold on units yet
         }
     }

     // --- 4. ATTACK PHASE ---
     if (this.aiState === 'ATTACK') {
         // Economy Check: Maintain miners
         if (miners < targetMiners && this.enemyGold >= UNIT_CONFIG[UnitType.MINER].cost) {
             this.queueUnit(UnitType.MINER, Faction.ENEMY);
             return;
         }

         // Unit Composition Logic
         if (this.enemyGold > 100) {
             const roll = Math.random();
             // Adjust composition based on what the player is doing? (Future improvement)
             // For now, balanced mix
             
             if (roll < 0.35 && this.enemyGold >= UNIT_CONFIG[UnitType.SWORDMAN].cost) {
                 this.queueUnit(UnitType.SWORDMAN, Faction.ENEMY);
             } else if (roll < 0.65 && this.enemyGold >= UNIT_CONFIG[UnitType.ARCHER].cost) {
                 this.queueUnit(UnitType.ARCHER, Faction.ENEMY);
             } else if (roll < 0.9 && this.enemyGold >= UNIT_CONFIG[UnitType.CAVALRY].cost) {
                 this.queueUnit(UnitType.CAVALRY, Faction.ENEMY);
             } else if (this.enemyGold >= UNIT_CONFIG[UnitType.HERO].cost) {
                 const heroCount = activeUnits.filter(u => u.type === UnitType.HERO).length;
                 if (heroCount < 3) this.queueUnit(UnitType.HERO, Faction.ENEMY);
             }
         }
     }
  }

}
