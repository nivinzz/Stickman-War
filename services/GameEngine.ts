
import { Unit, UnitType, Faction, UnitState, Projectile, Particle, GameLevel, UpgradeState, SpawnQueueItem, EnvElement, Firework, Hazard } from '../types';
import { CANVAS_WIDTH, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, UNIT_CONFIG, MINING_TIME, MINING_DISTANCE, GOLD_PER_TRIP, BASE_HP, GRAVITY, MAX_POPULATION, MAX_HEROES, SKILL_COOLDOWNS_FRAMES, INITIAL_GOLD, MAX_PASSIVE_GOLD_LEVEL, POP_UPGRADE_COST, MAX_POP_UPGRADES, FOG_OF_WAR_RANGE, REWARD_MELEE, REWARD_ARCHER, REWARD_HERO, MAX_UPGRADE_LEVELS, MAX_TOWERS, TOWER_COST_BASE, TOWER_COST_INC, TOWER_RANGE, TOWER_DAMAGE_BASE, TOWER_COOLDOWN } from '../constants';
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
  patrolPoint: number | null = null; // New Red Flag
  
  // --- AI LOGIC PROPERTIES ---
  enemyRallyPoint: number | null = null;
  enemyPatrolPoint: number | null = null; // AI Patrol
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
    // Old: 1 + level * 0.3
    // New: 1 + level * 0.5 (Base HP grows faster)
    let hpMultiplier = 1 + (level.level * 0.5);
    
    if (level.level > 20) {
        hpMultiplier += (level.level - 20) * 0.2; // Extra tanky late game
    }

    if (level.isBoss) hpMultiplier *= 2.5; // Boss levels are harder
    
    this.enemyMaxBaseHp = BASE_HP * hpMultiplier;
    this.enemyBaseHp = this.enemyMaxBaseHp;
    
    // --- BUFFED AI STARTING GOLD ---
    // Give AI a good head start so they aren't broke at second 1
    // Old: 50 + level * 20
    // New: 300 + level * 100
    this.enemyGold = 300 + (level.level * 100); 
    
    // --- BUFFED AI UPGRADE LEVELS ---
    // AI upgrades now scale much closer to player level
    // Old: (level - 1) * 0.5
    // New: (level * 0.9) -> At level 10, AI has lvl 9 upgrades.
    const baseAILevel = Math.max(0, Math.floor(level.level * 0.9));
    
    // Give AI some randomness/specialization based on level
    const bonusDmg = Math.floor(level.level / 3);

    this.enemyUpgrades = {
        baseHp: baseAILevel,
        swordDamage: baseAILevel + bonusDmg,
        archerDamage: baseAILevel + bonusDmg,
        cavalryDamage: baseAILevel + bonusDmg,
        spawnSpeed: Math.min(20, baseAILevel + 5), // Spawns faster
        arrowRainPower: baseAILevel,
        lightningPower: baseAILevel,
        freezePower: baseAILevel,
        heroPower: baseAILevel,
        minerSpeed: Math.min(30, baseAILevel),
        maxPopUpgrade: Math.floor(level.level / 5), // Pre-purchased pop upgrades
        passiveGold: Math.min(5, Math.floor(level.level / 5)), // Pre-purchased gold income
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
      
      const treeCount = 20;
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
      
      // If rally point doesn't exist, set it to unit mass center or near base
      if (this.rallyPoint === null) {
          this.rallyPoint = PLAYER_BASE_X + 200;
      }
      
      this.patrolPoint = x;
      this.onStateChange(this);
  }

  clearRallyPoint() {
      if (!this.started || this.paused) return;
      this.rallyPoint = null;
      this.patrolPoint = null; // Clear patrol if charge is called
      this.onStateChange(this);
  }
  
  cancelPatrol() {
      if (!this.started || this.paused) return;
      this.patrolPoint = null;
      this.onStateChange(this);
  }

  // --- TOWER LOGIC ---
  buyTower(faction: Faction) {
      const isPlayer = faction === Faction.PLAYER;
      const currentCount = isPlayer ? this.playerTowers : this.enemyTowers;
      if (currentCount >= MAX_TOWERS) return;

      const cost = TOWER_COST_BASE + (currentCount * TOWER_COST_INC);
      
      if (isPlayer) {
          if (this.gold >= cost) {
              this.gold -= cost;
              this.playerTowers++;
              soundManager.playSpawn(); // Building sound
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
      // Player Towers
      if (this.playerTowers > 0) {
          if (this.playerTowerCooldown > 0) {
              this.playerTowerCooldown--;
          } else {
              // Find enemy near base
              const target = this.units.find(u => 
                  u.faction === Faction.ENEMY && 
                  u.state !== UnitState.DIE && 
                  u.state !== UnitState.DEAD &&
                  u.x < PLAYER_BASE_X + TOWER_RANGE + 100 // +100 for safety buffer
              );
              
              if (target) {
                  // Fire!
                  const power = TOWER_DAMAGE_BASE * (1 + (this.upgrades.towerPower * 0.1)) * this.playerTowers; // More towers = more damage shot (simulated volley)
                  this.fireTowerShot(PLAYER_BASE_X, target, power, Faction.PLAYER);
                  this.playerTowerCooldown = TOWER_COOLDOWN;
              }
          }
      }

      // Enemy Towers
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
      const dy = (target.y - target.height/2) - (GROUND_Y - 150); // Shoot from tower top approx
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
      soundManager.playAttack('ARCHER'); // Reuse bow sound
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
          if (isPlayer) {
              maxPop += this.upgrades.maxPopUpgrade;
          } else {
              maxPop += this.enemyUpgrades.maxPopUpgrade;
          }
          
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
    const statsConfig = UNIT_CONFIG[type];

    let damageMultiplier = 1;
    let hpMultiplier = 1;
    let speedMultiplier = 1;
    let sizeMultiplier = 1;

    const upgrades = isPlayer ? this.upgrades : this.enemyUpgrades;

    if (type === UnitType.SWORDMAN) damageMultiplier += (upgrades.swordDamage * 0.1);
    if (type === UnitType.ARCHER) damageMultiplier += (upgrades.archerDamage * 0.1);
    if (type === UnitType.CAVALRY) damageMultiplier += (upgrades.cavalryDamage * 0.1);
    if (type === UnitType.HERO) {
            const heroBuff = upgrades.heroPower * 0.05;
            damageMultiplier += heroBuff;
            hpMultiplier += heroBuff;
            speedMultiplier += heroBuff;
    }
    if (type === UnitType.MINER) {
            speedMultiplier += (upgrades.minerSpeed * 0.1);
    }

    if (!isPlayer) {
        // --- BUFFED AI UNIT STATS SCALING ---
        // Add a base multiplier based on level to ensure units scale even without specific upgrades
        const levelScaling = this.level.level * 0.05; // +5% stats per level automatically
        damageMultiplier += levelScaling;
        hpMultiplier += levelScaling;

        if (this.level.level > 20) {
            sizeMultiplier = 1.2; 
        }
        if (this.level.isBoss) {
            damageMultiplier *= 1.3;
            hpMultiplier *= 1.5;
            sizeMultiplier *= 1.1;
        }
    }
    
    const stats = { ...statsConfig };
    stats.hp *= hpMultiplier;
    stats.maxHp *= hpMultiplier;
    stats.damage *= damageMultiplier;
    stats.speed *= speedMultiplier;

    const unit: Unit = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      faction,
      x: isPlayer ? PLAYER_BASE_X : ENEMY_BASE_X,
      y: GROUND_Y,
      state: type === UnitType.MINER ? UnitState.MINE_WALK_TO_MINE : UnitState.MOVE,
      stats,
      lastAttackFrame: 0,
      targetId: null,
      width: 20 * sizeMultiplier,
      height: (type === UnitType.HERO ? 60 : 40) * sizeMultiplier,
      animationFrame: 0,
      rotation: 0,
      deathTimer: 120,
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
          // Simple fade out or poof
          this.units.splice(index, 1);
          this.createParticles(u.x, GROUND_Y, 5, '#ffffff', true);
          // AI doesn't need sound for dismissal, Player does
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
    
    // FOG CHECK
    if (x > this.playerVisibleX) return;

    this.spawnArrowRain(x, Faction.PLAYER, this.upgrades.arrowRainPower);
    soundManager.playSkill('Arrow Rain');
    this.skillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
    this.onStateChange(this);
  }

  useSkillLightning(x: number) {
    if (this.skillCooldowns.LIGHTNING > 0 || !this.started || this.paused) return;
    
    // FOG CHECK
    if (x > this.playerVisibleX) return;

    this.spawnLightning(x, Faction.PLAYER, this.upgrades.lightningPower);
    soundManager.playSkill('Lightning');
    this.skillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING;
    this.onStateChange(this);
  }

  useSkillFreeze(x: number) {
      if (this.skillCooldowns.FREEZE > 0 || !this.started || this.paused) return;
      
      // FOG CHECK
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
          faction: faction // Set faction to prevent friendly fire
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

    // --- GOLD INCOME UPDATED LOGIC ---
    // Base 1G/s + 2G per Upgrade Level.
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
    this.updateTowers(); // Towers Shoot
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

  // --- INTELLIGENT AI ---
  updateAI() {
    // --- ENRAGE MODE (15 minutes = 900 seconds * 60 FPS = 54000) ---
    const isEnraged = this.levelTimer > 54000;

    // 1. Passive Income
    if (this.frame % 60 === 0) {
        // --- BUFFED AI PASSIVE INCOME ---
        // AI gets much more gold per second as levels increase to maintain army
        // Old: 2 + level * 0.5
        // New: 5 + level * 1.5
        const basePassive = 5 + (this.level.level * 1.5); 
        const upgradePassive = (this.enemyUpgrades.passiveGold || 0) * 2;
        let totalIncome = basePassive + upgradePassive;

        if (isEnraged) {
            totalIncome += 100; // HUGE INCOME BOOST
        }

        this.enemyGold += totalIncome;

        const isPanic = this.enemyBaseHp < this.enemyMaxBaseHp * 0.3;
        if (isPanic) this.enemyGold += 10;
        if (this.level.level > 40) this.enemyGold += 20;
    }

    // 2. Skill Usage (Fog Restricted for AI too to be fair? No, AI cheats vision usually, but let's be fair-ish)
    // Actually AI uses "visiblePlayerUnits" which already accounts for FOG
    if (this.level.level > 5 && this.frame % 30 === 0) {
        const playerUnits = this.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD);
        const visiblePlayerUnits = playerUnits.filter(u => u.x > this.enemyVisibleX);

        if (visiblePlayerUnits.length > 0) {
            if (this.enemySkillCooldowns.ARROW_RAIN <= 0 && visiblePlayerUnits.length >= 3) {
                const sumX = visiblePlayerUnits.reduce((a, b) => a + b.x, 0);
                const avgX = sumX / visiblePlayerUnits.length;
                this.spawnArrowRain(avgX, Faction.ENEMY, this.enemyUpgrades.arrowRainPower); 
                this.enemySkillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN * 1.5;
                soundManager.playSkill('Arrow Rain');
            }
            else if (this.enemySkillCooldowns.LIGHTNING <= 0) {
                const highValUnit = visiblePlayerUnits.find(u => u.type === UnitType.HERO || u.type === UnitType.CAVALRY);
                if (highValUnit) {
                    this.spawnLightning(highValUnit.x, Faction.ENEMY, this.enemyUpgrades.lightningPower);
                    this.enemySkillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING * 1.5;
                    soundManager.playSkill('Lightning');
                }
            }
            else if (this.enemySkillCooldowns.FREEZE <= 0) {
                const nearBase = visiblePlayerUnits.find(u => u.x > ENEMY_BASE_X - 400);
                if (nearBase) {
                     this.spawnFreeze(nearBase.x, Faction.ENEMY, this.enemyUpgrades.freezePower);
                     this.enemySkillCooldowns.FREEZE = SKILL_COOLDOWNS_FRAMES.FREEZE * 1.5;
                }
            }
        }
    }

    // 3. AI Upgrades & Towers
    // Priority Logic: If Population is low, skip upgrades to save money for units (unless very rich)
    const enemyPop = this.units.filter(u => u.faction === Faction.ENEMY).length;
    const popCap = MAX_POPULATION + this.enemyUpgrades.maxPopUpgrade;
    const isPopFullEnough = enemyPop >= (popCap * 0.9); // 90% full
    const isRich = this.enemyGold > 3000;
    
    // AI checks for upgrades more frequently now
    const upgradeCheckInterval = isEnraged ? 30 : Math.max(30, 100 - (this.level.level * 2));
    
    // Only attempt upgrades if we have a decent army or are overflowing with gold
    if (this.frame % upgradeCheckInterval === 0 && (isPopFullEnough || isRich)) {
         // --- TOWER LOGIC (SMARTER) ---
         const towerCost = TOWER_COST_BASE + (this.enemyTowers * TOWER_COST_INC);
         
         // AI buys tower if:
         // 1. Base under attack (<80% HP)
         // 2. OR lots of enemies near base (panic)
         // 3. OR very rich (>3000g)
         // 4. OR Enraged
         
         const baseUnderAttack = this.enemyBaseHp < this.enemyMaxBaseHp * 0.8;
         const enemiesNear = this.units.some(u => u.faction === Faction.PLAYER && u.x > ENEMY_BASE_X - 600);
         const canAffordTower = this.enemyGold > towerCost;
         
         if (this.enemyTowers < MAX_TOWERS && canAffordTower) {
             if (baseUnderAttack || (enemiesNear && this.enemyGold > 1000) || this.enemyGold > 3000 || isEnraged) {
                 this.buyTower(Faction.ENEMY);
             }
         }

         // --- UPGRADE LOGIC (UPDATED COST FORMULA) ---
         const getCost = (currentLvl: number) => {
             const targetLevel = currentLvl + 1;
             let cost = 0;
             for (let l = 1; l <= targetLevel; l++) {
                 const tier = Math.floor((l - 1) / 5);
                 const step = 300 + (tier * 200); 
                 if (l === 1) cost = 300;
                 else cost += step;
             }
             return cost;
         };
         
         const keys: (keyof UpgradeState)[] = [
             'minerSpeed', 'passiveGold', 
             'swordDamage', 'archerDamage', 'cavalryDamage', 'heroPower',
             'arrowRainPower', 'lightningPower', 'freezePower',
             'spawnSpeed', 'baseHp', 'towerPower'
         ];
         
         let target: keyof UpgradeState = 'swordDamage';
         const roll = Math.random();
         
         if (this.enemyUpgrades.passiveGold < 4 && roll < 0.3) target = 'passiveGold';
         else if (this.enemyTowers > 2 && roll < 0.5) target = 'towerPower';
         else target = keys[Math.floor(Math.random() * keys.length)];
         
         const currentLvl = this.enemyUpgrades[target] || 0;
         const cost = getCost(currentLvl);
         
         // Only upgrade if really rich or capped
         if (this.enemyGold >= cost) {
             this.enemyGold -= cost;
             (this.enemyUpgrades as any)[target] = currentLvl + 1;
         }
    }

    // 4. STRATEGY & ARMY MANAGEMENT
    if (this.frame % 30 === 0) {
        const enemyUnits = this.units.filter(u => u.faction === Faction.ENEMY && u.state !== UnitState.DIE);
        const enemyMiners = enemyUnits.filter(u => u.type === UnitType.MINER);
        const enemyArchers = enemyUnits.filter(u => u.type === UnitType.ARCHER);
        const currentPopCap = MAX_POPULATION + this.enemyUpgrades.maxPopUpgrade;
        
        const playerUnits = this.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DIE);
        let closestPlayerX = 0;
        if (playerUnits.length > 0) closestPlayerX = Math.max(...playerUnits.map(u => u.x));
        const threatX = closestPlayerX > this.enemyVisibleX ? closestPlayerX : 0;
        const distToBase = ENEMY_BASE_X - threatX;

        // --- INTELLIGENT DISMISSAL / COUNTER ---
        if (enemyPop >= currentPopCap) {
            if (this.level.level > 10 && this.enemyGold > 2000 && enemyMiners.length > 2) {
                this.dismissUnit(UnitType.MINER, Faction.ENEMY);
            }
            
            // If facing many Cavalry, dismiss Archers to build Swords
            const visiblePlayerCav = playerUnits.filter(u => u.type === UnitType.CAVALRY && u.x > this.enemyVisibleX).length;
            if (visiblePlayerCav > 3 && enemyArchers.length > 5) {
                this.dismissUnit(UnitType.ARCHER, Faction.ENEMY);
            }
        }

        // --- ECONOMY MANAGEMENT ---
        const idealMiners = Math.min(8, 2 + Math.floor(this.level.level / 4));
        if (distToBase > 400 && enemyMiners.length < idealMiners && enemyPop < currentPopCap) {
             if (this.enemyGold >= UNIT_CONFIG.MINER.cost) {
                 this.queueUnit(UnitType.MINER, Faction.ENEMY);
                 return; 
             }
        }

        // --- POPULATION UPGRADE ---
        if (enemyPop >= currentPopCap && this.enemyUpgrades.maxPopUpgrade < MAX_POP_UPGRADES) {
             if (this.enemyGold > POP_UPGRADE_COST && distToBase > 600) {
                 this.enemyGold -= POP_UPGRADE_COST;
                 this.enemyUpgrades.maxPopUpgrade++;
                 return; 
             }
        }

        let desiredState: 'ATTACK' | 'DEFEND' | 'MASSING' = 'ATTACK';
        if (isEnraged) {
            desiredState = 'ATTACK'; 
        } else if (distToBase < 500) {
            desiredState = 'DEFEND';
        } else if (this.enemyGold > 800 && enemyPop < (currentPopCap * 0.7) && this.level.level > 5) {
            desiredState = 'MASSING';
        } else {
            desiredState = 'ATTACK';
        }

        this.aiState = desiredState;
        
        if (this.aiState === 'DEFEND') {
            this.enemyRallyPoint = ENEMY_BASE_X - 150;
            // AI Patrol Logic: If defending and level > 15, trigger patrol to avoid clumping
            if (this.level.level > 15 && enemyPop > 5) {
                // Toggle patrol occasionally
                if (Math.random() > 0.95) {
                    this.enemyPatrolPoint = this.enemyPatrolPoint ? null : ENEMY_BASE_X - 350;
                }
            } else {
                this.enemyPatrolPoint = null;
            }
        } else if (this.aiState === 'MASSING') {
            this.enemyRallyPoint = ENEMY_BASE_X - 350;
            this.enemyPatrolPoint = null;
            if (enemyPop >= (currentPopCap * 0.9) || enemyUnits.some(u => u.type === UnitType.HERO)) {
                this.aiState = 'ATTACK';
                this.enemyRallyPoint = null;
                this.enemyPatrolPoint = null;
            }
        } else {
            this.enemyRallyPoint = null;
            this.enemyPatrolPoint = null;
        }
    }

    // 5. SPAWN LOGIC (COUNTER SYSTEM)
    // AI Spawn Logic: Attempt to spawn MORE OFTEN if we have gold and pop space
    // Faster spawn rate at higher levels to overwhelm player
    const baseSpawnRate = Math.max(15, 180 - (this.level.level * 10)); 
    let effectiveSpawnRate = isEnraged ? 5 : ((this.level.level > 40) ? 10 : baseSpawnRate);

    // Speed up spawning if we are under-populated
    const currentPopCap = MAX_POPULATION + this.enemyUpgrades.maxPopUpgrade;
    if (enemyPop < currentPopCap * 0.5) effectiveSpawnRate = Math.max(10, Math.floor(effectiveSpawnRate / 2));

    if (this.frame % effectiveSpawnRate === 0) {
        const enemyUnits = this.units.filter(u => u.faction === Faction.ENEMY && u.state !== UnitState.DIE);
        
        const enemyNormalPop = enemyUnits.filter(u => u.type !== UnitType.HERO).length + this.enemyQueue.filter(q => q.type !== UnitType.HERO).length;
        const enemyHeroPop = enemyUnits.filter(u => u.type === UnitType.HERO).length + this.enemyQueue.filter(q => q.type === UnitType.HERO).length;

        const maxPop = MAX_POPULATION + this.enemyUpgrades.maxPopUpgrade;
        const canSpawnNormal = enemyNormalPop < maxPop; 
        const canSpawnHero = enemyHeroPop < MAX_HEROES;

        if (!canSpawnNormal && !canSpawnHero) return;

        // ANALYZE PLAYER ARMY COMPOSITION (ROCK-PAPER-SCISSORS)
        const visiblePlayerUnits = this.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DIE && u.x > this.enemyVisibleX);
        const playerSwords = visiblePlayerUnits.filter(u => u.type === UnitType.SWORDMAN).length;
        const playerArchers = visiblePlayerUnits.filter(u => u.type === UnitType.ARCHER).length;
        const playerCav = visiblePlayerUnits.filter(u => u.type === UnitType.CAVALRY).length;
        const playerHeroes = visiblePlayerUnits.filter(u => u.type === UnitType.HERO).length;
        
        const totalVisible = playerSwords + playerArchers + playerCav;

        let unitToBuy = UnitType.SWORDMAN; 
        const roll = Math.random();
        const canBuyHero = canSpawnHero && this.enemyGold >= UNIT_CONFIG.HERO.cost;

        if (this.aiState === 'DEFEND' && !isEnraged) {
             if (canBuyHero) unitToBuy = UnitType.HERO;
             else if (Math.random() > 0.5) unitToBuy = UnitType.ARCHER; // Crossbow defend well
             else unitToBuy = UnitType.SWORDMAN; 
        } else if (this.aiState === 'MASSING' && !isEnraged) {
             if (canBuyHero) unitToBuy = UnitType.HERO;
             else if (this.enemyGold > 500) unitToBuy = UnitType.CAVALRY;
             else return; 
        } else {
             // --- SMART COUNTER LOGIC ---
             // Rule: 
             // Crossbow (Archer) counters Sword (>10% dmg)
             // Sword counters Cav (>10% dmg)
             // Cav counters Crossbow (>10% dmg)
             
             if (totalVisible > 0) {
                 const swordRatio = playerSwords / totalVisible;
                 const archerRatio = playerArchers / totalVisible;
                 const cavRatio = playerCav / totalVisible;

                 if (swordRatio > 0.4) {
                     // Player has many Swords -> Buy Crossbows (Archers)
                     unitToBuy = roll < 0.7 ? UnitType.ARCHER : UnitType.CAVALRY; 
                 } else if (archerRatio > 0.4) {
                     // Player has many Archers -> Buy Cavalry
                     unitToBuy = roll < 0.7 ? UnitType.CAVALRY : UnitType.SWORDMAN;
                 } else if (cavRatio > 0.4) {
                     // Player has many Cav -> Buy Swords
                     unitToBuy = roll < 0.7 ? UnitType.SWORDMAN : UnitType.ARCHER;
                 } else {
                     // Balanced
                     if (roll < 0.33) unitToBuy = UnitType.SWORDMAN;
                     else if (roll < 0.66) unitToBuy = UnitType.ARCHER;
                     else unitToBuy = UnitType.CAVALRY;
                 }
             } else {
                 // Blind guess or balanced
                 if (roll < 0.4) unitToBuy = UnitType.SWORDMAN;
                 else if (roll < 0.7) unitToBuy = UnitType.ARCHER;
                 else unitToBuy = UnitType.CAVALRY;
             }
             
             // Hero override
             if (canBuyHero && roll < 0.15) unitToBuy = UnitType.HERO;
        }

        // Fallbacks if broke
        if (unitToBuy === UnitType.HERO && !canBuyHero) unitToBuy = UnitType.CAVALRY;
        if (unitToBuy === UnitType.CAVALRY && this.enemyGold < UNIT_CONFIG.CAVALRY.cost) unitToBuy = UnitType.ARCHER;
        if (unitToBuy === UnitType.ARCHER && this.enemyGold < UNIT_CONFIG.ARCHER.cost) unitToBuy = UnitType.SWORDMAN;

        if (unitToBuy === UnitType.HERO && !canSpawnHero) unitToBuy = UnitType.CAVALRY;
        if (unitToBuy !== UnitType.HERO && !canSpawnNormal) return;

        if (this.enemyGold >= UNIT_CONFIG[unitToBuy].cost) {
             this.queueUnit(unitToBuy, Faction.ENEMY);
        }
    }
  }

  updateUnits() {
    this.units.forEach(unit => {
      let speedModifier = 1;
      let inHazard = false;
      
      this.hazards.forEach(h => {
          if (h.faction === unit.faction) return; 

          if (unit.x >= h.x && unit.x <= h.x + h.width) {
             speedModifier = h.slowFactor;
             inHazard = true;
             const dot = (unit.stats.maxHp * h.damagePercent) / 60;
             unit.stats.hp -= dot;
          }
      });
      
      unit.isSlowed = inHazard;

      if (inHazard && this.frame % 20 === 0) {
          this.createParticles(unit.x, unit.y - 10, 1, '#60a5fa', false); 
      }

      let currentSpeed = unit.stats.speed * speedModifier;

      if (unit.stats.hp <= 0 && unit.state !== UnitState.DIE && unit.state !== UnitState.DEAD) {
        unit.state = UnitState.DIE;
        this.rewardKill(unit); 
        soundManager.playDie();
      }

      if (unit.state === UnitState.DIE) {
        if (unit.faction === Faction.PLAYER) {
            if (unit.rotation > -Math.PI / 2) unit.rotation -= 0.1;
        } else {
            if (unit.rotation < Math.PI / 2) unit.rotation += 0.1;
        }
        
        unit.deathTimer--;
        unit.opacity = unit.deathTimer / 60;
        
        if (unit.deathTimer <= 0) unit.state = UnitState.DEAD;
        return;
      }
      
      if (unit.state === UnitState.DEAD) return;

      unit.animationFrame++;

      if (unit.type === UnitType.MINER) {
        this.updateMiner(unit, currentSpeed);
      } else {
        this.updateCombatUnit(unit, currentSpeed);
      }
    });

    this.units = this.units.filter(u => u.state !== UnitState.DEAD);
  }

  updateMiner(unit: Unit, speed: number) {
    const isPlayer = unit.faction === Faction.PLAYER;
    const basePos = isPlayer ? PLAYER_BASE_X : ENEMY_BASE_X;
    const minePos = isPlayer ? PLAYER_BASE_X + MINING_DISTANCE : ENEMY_BASE_X - MINING_DISTANCE;
    
    const upgrades = isPlayer ? this.upgrades : this.enemyUpgrades;

    if (unit.state === UnitState.MINE_WALK_TO_MINE) {
        const dist = minePos - unit.x;
        if (Math.abs(dist) <= speed + 1) {
             unit.x = minePos; 
             unit.state = UnitState.MINE_GATHERING;
             unit.miningTimer = Math.max(10, MINING_TIME - (upgrades.minerSpeed * 2)); 
        } else {
            unit.x += Math.sign(dist) * speed;
        }
    } else if (unit.state === UnitState.MINE_GATHERING) {
        if (unit.miningTimer && unit.miningTimer > 0) {
            unit.miningTimer--;
        } else {
            unit.state = UnitState.MINE_RETURN;
            const bonusGold = upgrades.minerSpeed; 
            unit.goldCarrying = GOLD_PER_TRIP + bonusGold;
        }
    } else if (unit.state === UnitState.MINE_RETURN) {
        const dist = basePos - unit.x;
         if (Math.abs(dist) <= speed + 1) {
             unit.x = basePos; 
             
             if (isPlayer) {
                 this.gold += (unit.goldCarrying || 0);
                 soundManager.playGold();
                 this.onStateChange(this);
             } else {
                 this.enemyGold += (unit.goldCarrying || 0);
             }
             
             unit.goldCarrying = 0;
             unit.state = UnitState.MINE_WALK_TO_MINE;
        } else {
            unit.x += Math.sign(dist) * speed;
        }
    }
  }

  updateCombatUnit(unit: Unit, speed: number) {
    const isPlayer = unit.faction === Faction.PLAYER;
    
    // --- PLAYER FLAG LOGIC ---
    if (isPlayer && unit.type !== UnitType.MINER) {
        // Patrol Logic
        if (this.patrolPoint !== null && this.rallyPoint !== null) {
            const targetX = (unit.patrolHeading === 'A' || !unit.patrolHeading) ? this.rallyPoint : this.patrolPoint;
            if (Math.abs(unit.x - targetX) < 10) {
                unit.patrolHeading = (unit.patrolHeading === 'A' || !unit.patrolHeading) ? 'B' : 'A';
            } else {
                const nearbyEnemy = this.units.find(u => 
                    u.faction !== Faction.PLAYER && 
                    u.state !== UnitState.DEAD && 
                    u.state !== UnitState.DIE &&
                    Math.abs(u.x - unit.x) < unit.stats.range + 50 
                );
                
                if (!nearbyEnemy) {
                    unit.state = UnitState.MOVE;
                    unit.x += Math.sign(targetX - unit.x) * speed;
                    return; 
                }
            }
        } 
        // Standard Rally Point Logic
        else if (this.rallyPoint !== null) {
            if (unit.x > this.rallyPoint + 20) {
                const nearbyEnemy = this.units.find(u => 
                    u.faction !== Faction.PLAYER && 
                    u.state !== UnitState.DEAD && 
                    u.state !== UnitState.DIE &&
                    Math.abs(u.x - unit.x) < 100
                );
                if (!nearbyEnemy) {
                    unit.state = UnitState.MOVE;
                    unit.x -= speed;
                    return;
                }
            }
        }
    }

    // --- ENEMY AI RALLY / PATROL LOGIC ---
    if (!isPlayer && unit.type !== UnitType.MINER) {
        const immediateThreat = this.units.find(u => 
            u.faction === Faction.PLAYER && 
            u.state !== UnitState.DEAD && 
            Math.abs(u.x - unit.x) < unit.stats.range + 50 
        );

        if (!immediateThreat) {
            if (this.enemyPatrolPoint !== null && this.enemyRallyPoint !== null) {
                const targetX = (unit.patrolHeading === 'A' || !unit.patrolHeading) ? this.enemyRallyPoint : this.enemyPatrolPoint;
                if (Math.abs(unit.x - targetX) < 10) {
                    unit.patrolHeading = (unit.patrolHeading === 'A' || !unit.patrolHeading) ? 'B' : 'A';
                } else {
                    unit.state = UnitState.MOVE;
                    unit.x += Math.sign(targetX - unit.x) * speed;
                    return;
                }
            } 
            else if (this.enemyRallyPoint !== null) {
                if (unit.x < this.enemyRallyPoint - 20) {
                     unit.state = UnitState.MOVE;
                     unit.x += speed; 
                     return;
                } 
                else if (unit.x > this.enemyRallyPoint + 20) {
                     unit.state = UnitState.MOVE;
                     unit.x -= speed;
                     return;
                }
                else {
                     unit.state = UnitState.IDLE;
                     return;
                }
            }
        }
    }

    // Find Target
    let target: Unit | null = null;
    let minRange = Infinity;

    for (const other of this.units) {
        if (other.faction !== unit.faction && other.state !== UnitState.DIE && other.state !== UnitState.DEAD) {
            const dist = Math.abs(other.x - unit.x);
            if (dist < minRange) {
                minRange = dist;
                target = other;
            }
        }
    }

    const enemyBaseX = isPlayer ? ENEMY_BASE_X : PLAYER_BASE_X;
    const baseHitboxRadius = 60;
    const distToBaseCenter = Math.abs(enemyBaseX - unit.x);
    const distToBaseEdge = Math.max(0, distToBaseCenter - baseHitboxRadius);

    if (distToBaseEdge < minRange) {
        minRange = distToBaseEdge;
        target = null;
    }

    // --- PLAYER RALLY POINT STOP LOGIC ---
    if (isPlayer && this.rallyPoint !== null && this.patrolPoint === null && unit.type !== UnitType.MINER) {
         if (Math.abs(unit.x - this.rallyPoint) < 10 && minRange > 300) { 
             unit.state = UnitState.IDLE;
             return;
         }
         if (unit.x < this.rallyPoint && !target && minRange > 300 && (this.rallyPoint - unit.x) < speed) {
             unit.x = this.rallyPoint;
             unit.state = UnitState.IDLE;
             return;
         }
    }

    // Attack or Move
    if (minRange <= unit.stats.range) {
        // PRIORITY: Check if ready to attack (Cooldown finished)
        // If ready, SHOOT immediately, ignoring minRange.
        if (this.frame - unit.lastAttackFrame >= unit.stats.attackSpeed) {
            unit.state = UnitState.ATTACK;
            unit.lastAttackFrame = this.frame;
            soundManager.playAttack(unit.type);

            if (unit.type === UnitType.ARCHER) {
                const speedX = isPlayer ? 15 : -15; 
                this.projectiles.push({
                    id: Math.random().toString(),
                    x: unit.x,
                    y: unit.y - 25, 
                    vx: speedX,
                    vy: 0,
                    startX: unit.x, // Important for range limit
                    damage: unit.stats.damage,
                    faction: unit.faction,
                    active: true,
                    type: 'ARROW',
                    rotation: 0
                });
            } else {
                if (target) {
                    let dmg = unit.stats.damage;
                    
                    // --- ROCK PAPER SCISSORS MELEE ---
                    // Sword vs Cav (+10%)
                    if (unit.type === UnitType.SWORDMAN && target.type === UnitType.CAVALRY) {
                        dmg *= 1.1; 
                    }
                    // Cav vs Crossbow(Archer) (+10%)
                    if (unit.type === UnitType.CAVALRY && target.type === UnitType.ARCHER) {
                        dmg *= 1.1;
                    }

                    if (target.isSlowed) {
                        dmg += target.stats.maxHp * 0.10;
                    }

                    target.stats.hp -= dmg;
                    this.createParticles(target.x, target.y - 20, 5, target.isSlowed ? '#60a5fa' : '#ef4444'); 
                    soundManager.playHit();
                } else {
                    if (isPlayer) this.enemyBaseHp -= unit.stats.damage;
                    else this.playerBaseHp -= unit.stats.damage;
                    this.triggerScreenShake(5);
                    soundManager.playHit();
                }
            }
        } 
        // SECONDARY: If reloading (Cooldown active) AND too close (minRange), THEN retreat (Hit & Run)
        else if (unit.stats.minRange && minRange < unit.stats.minRange) {
             unit.state = UnitState.MOVE;
             const retreatDir = isPlayer ? -1 : 1;
             unit.x += retreatDir * speed * 0.5; // Backpedal slower
        }
        // OTHERWISE: Just idle/reload
        else {
             unit.state = UnitState.IDLE;
        }

    } else {
        unit.state = UnitState.MOVE;
        const dir = isPlayer ? 1 : -1;
        unit.x += speed * dir;
    }
  }

  updateProjectiles() {
    this.projectiles.forEach(p => {
        if (!p.active) return;
        
        if (p.type === 'LIGHTNING_BOLT') {
             p.active = false; 
             return;
        }

        p.x += p.vx;
        p.y += p.vy;
        
        // --- ARROW FLIGHT LIMIT ---
        // Range Check: If arrow flies significantly further than max unit range, destroy it
        if (p.type === 'ARROW') {
            const distTraveled = Math.abs(p.x - p.startX);
            // 450 is base range, give it 100 buffer
            if (distTraveled > 550) { 
                p.active = false;
                return;
            }
        }

        if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
            if (p.y > GROUND_Y + 50 || p.y < -100) p.active = false;
        }

        if (p.vy > 0 && p.y >= GROUND_Y) {
            p.active = false;
            return;
        }

        const targets = this.units.filter(u => 
            u.faction !== p.faction && 
            u.state !== UnitState.DIE &&
            u.state !== UnitState.DEAD &&
            Math.abs(u.x - p.x) < 20 &&
            Math.abs((u.y - u.height/2) - p.y) < 30
        );

        if (targets.length > 0) {
            const t = targets[0];
            
            let dmg = p.damage;

            // --- ROCK PAPER SCISSORS RANGED ---
            // Crossbow (Archer) vs Sword (+10%)
            // We need to identify if projectile source was Archer. 
            // In this game, only Archers shoot 'ARROW' type.
            if (p.type === 'ARROW' && t.type === UnitType.SWORDMAN) {
                dmg *= 1.1;
            }

            if (t.isSlowed) {
                dmg += t.stats.maxHp * 0.10;
            }

            t.stats.hp -= dmg;
            this.createParticles(p.x, p.y, 3, t.isSlowed ? '#60a5fa' : '#ef4444');
            soundManager.playHit();
            p.active = false;
            
            if (t.stats.hp <= 0 && t.state !== UnitState.DIE && t.state !== UnitState.DEAD) {
                 t.state = UnitState.DIE;
                 this.rewardKill(t);
                 soundManager.playDie();
            }

        } else if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
            const isPlayer = p.faction === Faction.PLAYER;
            const targetBaseX = isPlayer ? ENEMY_BASE_X : PLAYER_BASE_X;
            const dist = Math.abs(p.x - targetBaseX);
            
            if (dist < 60 && p.y > GROUND_Y - 150) {
                 if (isPlayer) this.enemyBaseHp -= p.damage;
                 else this.playerBaseHp -= p.damage;
                 
                 this.createParticles(p.x, p.y, 3, '#9ca3af'); 
                 soundManager.playHit();
                 p.active = false;
                 this.triggerScreenShake(2);
            }
        }
    });
    this.projectiles = this.projectiles.filter(p => p.active);
  }
  
  updateParticles() {
      this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.gravity) {
              p.vy += GRAVITY;
          }
          p.life--;
      });
      this.particles = this.particles.filter(p => p.life > 0);
  }

  checkGameStatus() {
      if (this.gameOver || this.victory) return;

      if (this.playerBaseHp <= 0) {
          this.playerBaseHp = 0;
          this.gameOver = true;
          soundManager.playDefeat();
          this.onStateChange(this);
      } else if (this.enemyBaseHp <= 0) {
          this.enemyBaseHp = 0;
          this.victory = true;
          soundManager.playVictory();
          this.onStateChange(this);
      }
  }
}
