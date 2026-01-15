
import { Unit, UnitType, Faction, UnitState, Projectile, Particle, GameLevel, UpgradeState, SpawnQueueItem, EnvElement, Firework, Hazard, IceShard } from '../types';
import { CANVAS_WIDTH, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, UNIT_CONFIG, MINING_TIME, MINING_DISTANCE, GOLD_PER_TRIP, BASE_HP, GRAVITY, MAX_POPULATION, MAX_HEROES, SKILL_COOLDOWNS_FRAMES, INITIAL_GOLD, MAX_PASSIVE_GOLD_LEVEL, POP_UPGRADE_COST, MAX_POP_UPGRADES, FOG_OF_WAR_RANGE, REWARD_MELEE, REWARD_ARCHER, REWARD_HERO, MAX_UPGRADE_LEVELS, MAX_TOWERS, TOWER_COST_BASE, TOWER_COST_INC, TOWER_RANGE, TOWER_DAMAGE_BASE, TOWER_COOLDOWN, calculateUnitStats, getRankTier, TIER_DIFFICULTY_MAP, RANK_THRESHOLDS } from '../constants';
import { soundManager } from './SoundManager';
import { GameAction } from './FirebaseService';

export class GameEngine {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  envElements: EnvElement[] = [];
  fireworks: Firework[] = [];
  hazards: Hazard[] = []; 
  
  activeStorms: { id: string, faction: Faction, x: number, duration: number, level: number }[] = [];

  playerQueue: SpawnQueueItem[] = [];
  enemyQueue: SpawnQueueItem[] = [];

  playerBaseHp: number = BASE_HP;
  playerMaxBaseHp: number = BASE_HP;
  enemyBaseHp: number = BASE_HP;
  enemyMaxBaseHp: number = BASE_HP;
  
  gold: number = 0;
  enemyGold: number = 0;
  
  frame: number = 0;
  levelTimer: number = 0; 
  screenShake: number = 0;
  
  level: GameLevel;
  upgrades: UpgradeState;
  
  enemyUpgrades: UpgradeState; 
  
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
  vanguardPoint: number | null = null; 
  vanguardPercentage: number = 0; 
  
  aiState: 'ATTACK' | 'DEFEND' | 'MASSING' | 'RETREAT' = 'ATTACK';
  aiStateTimer: number = 0;
  enemySkillCooldowns: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };

  playerVisibleX: number = PLAYER_BASE_X + FOG_OF_WAR_RANGE; 
  enemyVisibleX: number = ENEMY_BASE_X - FOG_OF_WAR_RANGE;   

  skillCooldowns: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };
  skillActiveTimers: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };
  skillMaxDurations: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number } = { ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 };

  lightningTargetX: number = 0;

  onStateChange: (engine: GameEngine) => void;
  // NEW: Callback to send actions to Firebase
  onGameAction?: (type: string, payload: string) => void;

  constructor(level: GameLevel, upgrades: UpgradeState, onStateChange: (engine: GameEngine) => void, onGameAction?: (type: string, payload: string) => void) {
    this.level = level;
    this.upgrades = upgrades;
    this.onStateChange = onStateChange;
    this.onGameAction = onGameAction; // Initialize
    
    this.playerMaxBaseHp = BASE_HP * (1 + (upgrades.baseHp * 0.1));
    this.playerBaseHp = this.playerMaxBaseHp;
    
    // Default Enemy Upgrades (will be synced or AI generated)
    this.enemyUpgrades = {
        baseHp: 0, swordDamage: 0, archerDamage: 0, cavalryDamage: 0, spawnSpeed: 0,
        arrowRainPower: 0, lightningPower: 0, freezePower: 0, heroPower: 0,
        minerSpeed: 0, maxPopUpgrade: 0, passiveGold: 0, towerPower: 0
    };

    if (level.isMultiplayer) {
        this.playerMaxBaseHp = BASE_HP; 
        this.playerBaseHp = BASE_HP;
        this.enemyMaxBaseHp = BASE_HP;
        this.enemyBaseHp = BASE_HP;
    } else {
        // Offline scaling logic (Keep existing campaign logic)
        let hpMultiplier = 0.8 + (level.level * 0.05); 
        if (level.level > 10) hpMultiplier = 1.3 + ((level.level - 10) * 0.08);
        if (level.isBoss) hpMultiplier *= 2.0;
        
        this.enemyMaxBaseHp = BASE_HP * hpMultiplier;
        this.enemyBaseHp = this.enemyMaxBaseHp;
        
        this.enemyGold = 40 + (level.level * 10); 
    }

    this.initEnvironment();
  }

  // --- NEW: Apply actions received from Firebase ---
  applyRemoteAction(action: GameAction) {
      // Ignore my own actions (already handled locally)
      if (action.who === this.level.myUserId) return;

      const payload = action.payload;
      
      switch (action.type) {
          case 'SPAWN':
              // Opponent spawned unit -> Add to Enemy Queue
              this.queueUnit(payload as UnitType, Faction.ENEMY);
              break;
          case 'TOWER':
              this.buyTower(Faction.ENEMY);
              break;
          case 'SKILL':
              // For skills, we need a target. In simple sync, we can randomize or target center.
              // Better: Target based on player unit concentration
              const targetX = this.findClusterCenter(Faction.PLAYER);
              if (payload === 'ARROW_RAIN') this.spawnArrowRain(targetX, Faction.ENEMY, this.enemyUpgrades.arrowRainPower);
              if (payload === 'LIGHTNING') this.spawnLightning(targetX, Faction.ENEMY, this.enemyUpgrades.lightningPower);
              if (payload === 'FREEZE') this.spawnFreeze(targetX, Faction.ENEMY, this.enemyUpgrades.freezePower);
              break;
      }
  }

  // Helper for AI targeting
  findClusterCenter(faction: Faction): number {
      const targets = this.units.filter(u => u.faction === faction);
      if (targets.length === 0) return faction === Faction.PLAYER ? PLAYER_BASE_X : ENEMY_BASE_X;
      const sum = targets.reduce((acc, u) => acc + u.x, 0);
      return sum / targets.length;
  }

  // Modified: queueUnit
  queueUnit(type: UnitType, faction: Faction) {
      if (faction === Faction.PLAYER) {
          if (!this.started || this.paused) return;
      }
      
      const isPlayer = faction === Faction.PLAYER;
      const upgrades = isPlayer ? this.upgrades : this.enemyUpgrades;
      
      const statsConfig = UNIT_CONFIG[type];
      const cost = statsConfig.cost;
      
      if (isPlayer) {
          if (this.gold < cost) return;
          this.gold -= cost;
          if (!this.level.isSpectator) soundManager.playGold();
          
          // SEND ACTION TO FIREBASE
          if (this.level.isMultiplayer && this.onGameAction) {
              this.onGameAction('SPAWN', type);
          }

      } else {
          // In multiplayer, enemy gold is virtual/ignored for sync simplicity, 
          // or we assume they had enough if they sent the action.
          if (!this.level.isMultiplayer) {
              if (this.enemyGold < cost) return;
              this.enemyGold -= cost;
          }
      }

      let spawnTime = statsConfig.spawnTime;
      spawnTime = Math.max(30, spawnTime * (1 - upgrades.spawnSpeed * 0.1)); 

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

  // Dismiss a unit from the queue to get a refund
  dismissUnit(type: UnitType) {
      // Find the last item of this type in the queue to cancel
      for (let i = this.playerQueue.length - 1; i >= 0; i--) {
          if (this.playerQueue[i].type === type) {
               const cost = UNIT_CONFIG[type].cost;
               this.gold += cost;
               this.playerQueue.splice(i, 1);
               this.onStateChange(this);
               return;
          }
      }
  }

  // Modified: buyTower
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
              
              // SEND ACTION
              if (this.level.isMultiplayer && this.onGameAction) {
                  this.onGameAction('TOWER', 'TOWER');
              }
              this.onStateChange(this);
          }
      } else {
          // If multiplayer, accept action blindly (trust opponent validation)
          if (this.level.isMultiplayer || this.enemyGold >= cost) {
              if (!this.level.isMultiplayer) this.enemyGold -= cost;
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
              // Find target
              let target: Unit | null = null;
              // Filter enemies in range (PLAYER_BASE_X to PLAYER_BASE_X + TOWER_RANGE)
              const enemiesInRange = this.units.filter(u => 
                  u.faction === Faction.ENEMY && 
                  u.state !== UnitState.DIE && 
                  u.state !== UnitState.DEAD &&
                  u.x <= PLAYER_BASE_X + TOWER_RANGE
              );
              
              if (enemiesInRange.length > 0) {
                  // Sort by x ascending (closest to base/tower)
                  enemiesInRange.sort((a, b) => a.x - b.x);
                  target = enemiesInRange[0];
              }

              if (target) {
                  const damage = TOWER_DAMAGE_BASE * (1 + (this.upgrades.towerPower * 0.1));
                  // Fire from tower top
                  const startY = GROUND_Y - 100;
                  const dx = target.x - PLAYER_BASE_X;
                  const dy = (target.y - 20) - startY;
                  const angle = Math.atan2(dy, dx);
                  const speed = 15;
                  
                  this.projectiles.push({
                      id: Math.random().toString(),
                      x: PLAYER_BASE_X,
                      y: startY,
                      vx: Math.cos(angle) * speed,
                      vy: Math.sin(angle) * speed,
                      startX: PLAYER_BASE_X,
                      damage: damage,
                      faction: Faction.PLAYER,
                      active: true,
                      type: 'TOWER_SHOT',
                      rotation: angle,
                      targetId: target.id
                  });
                  this.playerTowerCooldown = TOWER_COOLDOWN;
                  soundManager.playTowerShot();
              }
          }
      }

      // Enemy Towers
      if (this.enemyTowers > 0) {
          if (this.enemyTowerCooldown > 0) {
              this.enemyTowerCooldown--;
          } else {
              let target: Unit | null = null;
              // Target player unit closest to enemy base
              const playersInRange = this.units.filter(u => 
                  u.faction === Faction.PLAYER && 
                  u.state !== UnitState.DIE && 
                  u.state !== UnitState.DEAD &&
                  u.x >= ENEMY_BASE_X - TOWER_RANGE
              );

              if (playersInRange.length > 0) {
                  playersInRange.sort((a, b) => b.x - a.x); // Closest to ENEMY_BASE_X (largest X)
                  target = playersInRange[0];
              }

              if (target) {
                  const damage = TOWER_DAMAGE_BASE * (1 + (this.enemyUpgrades.towerPower * 0.1));
                  const startY = GROUND_Y - 100;
                  const dx = target.x - ENEMY_BASE_X;
                  const dy = (target.y - 20) - startY;
                  const angle = Math.atan2(dy, dx);
                  const speed = 15;

                  this.projectiles.push({
                      id: Math.random().toString(),
                      x: ENEMY_BASE_X,
                      y: startY,
                      vx: Math.cos(angle) * speed,
                      vy: Math.sin(angle) * speed,
                      startX: ENEMY_BASE_X,
                      damage: damage,
                      faction: Faction.ENEMY,
                      active: true,
                      type: 'TOWER_SHOT',
                      rotation: angle,
                      targetId: target.id
                  });
                  this.enemyTowerCooldown = TOWER_COOLDOWN;
              }
          }
      }
  }

  // Modified: useSkill (Only showing one as example, update others similarly)
  useSkillArrowRain(x: number) {
    if (this.skillCooldowns.ARROW_RAIN > 0 || !this.started || this.paused) return;
    if (x > this.playerVisibleX) return; // Fog check

    this.spawnArrowRain(x, Faction.PLAYER, this.upgrades.arrowRainPower);
    soundManager.playSkill('Arrow Rain');
    this.skillCooldowns.ARROW_RAIN = SKILL_COOLDOWNS_FRAMES.ARROW_RAIN;
    
    // SEND ACTION
    if (this.level.isMultiplayer && this.onGameAction) {
        this.onGameAction('SKILL', 'ARROW_RAIN');
    }

    this.onStateChange(this);
  }

  useSkillLightning(x: number) {
    if (this.skillCooldowns.LIGHTNING > 0 || !this.started || this.paused) return;
    if (x > this.playerVisibleX) return;

    this.spawnLightning(x, Faction.PLAYER, this.upgrades.lightningPower);
    soundManager.playSkill('Lightning');
    this.skillCooldowns.LIGHTNING = SKILL_COOLDOWNS_FRAMES.LIGHTNING;
    
    if (this.level.isMultiplayer && this.onGameAction) {
        this.onGameAction('SKILL', 'LIGHTNING');
    }
    this.onStateChange(this);
  }

  useSkillFreeze(x: number) {
      if (this.skillCooldowns.FREEZE > 0 || !this.started || this.paused) return;
      if (x > this.playerVisibleX) return;

      this.spawnFreeze(x, Faction.PLAYER, this.upgrades.freezePower);
      soundManager.playSkill('Freeze'); 
      this.skillCooldowns.FREEZE = SKILL_COOLDOWNS_FRAMES.FREEZE;
      
      if (this.level.isMultiplayer && this.onGameAction) {
        this.onGameAction('SKILL', 'FREEZE');
      }
      this.onStateChange(this);
  }

  startGame() {
      this.started = true;
      this.paused = false;
      this.onStateChange(this);
  }

  togglePause() {
      // In multiplayer, pause is disabled or requests pause (for now disabled)
      if (this.level.isMultiplayer) return;
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

  setRallyPoint(x: number) { if (!this.started || this.paused) return; this.rallyPoint = x; this.onStateChange(this); }
  setPatrolPoint(x: number) { if (!this.started || this.paused) return; if (this.rallyPoint === null) this.rallyPoint = PLAYER_BASE_X + 200; this.patrolPoint = x; this.onStateChange(this); }
  setVanguardPoint(x: number) { if (!this.started || this.paused) return; this.vanguardPoint = x; this.onStateChange(this); }
  setVanguardPercentage(pct: number) { this.vanguardPercentage = Math.max(0, Math.min(1, pct)); this.onStateChange(this); }
  clearRallyPoint() { if (!this.started || this.paused) return; this.rallyPoint = null; this.patrolPoint = null; this.onStateChange(this); }
  cancelPatrol() { if (!this.started || this.paused) return; this.patrolPoint = null; this.onStateChange(this); }
  
  spawnArrowRain(x: number, faction: Faction, powerLevel: number) {
    const isPlayer = faction === Faction.PLAYER;
    const durationMultiplier = 1 + (powerLevel * 0.1);
    const durationFrames = 300 * durationMultiplier; 
    if (isPlayer) { this.skillActiveTimers.ARROW_RAIN = durationFrames; this.skillMaxDurations.ARROW_RAIN = durationFrames; }
    const arrowCount = Math.floor(durationFrames / 5);
    const damage = 55 * (1 + (powerLevel * 0.2));
    for (let i = 0; i < arrowCount; i++) {
      setTimeout(() => {
        if(this.gameOver || this.victory || this.paused) return; 
        this.projectiles.push({
          id: Math.random().toString(), x: x + (Math.random() * 400 - 200), y: -50,
          vx: (Math.random() - 0.5) * 4, vy: 12 + Math.random() * 5, startX: x, damage: damage,
          faction: faction, active: true, type: 'ARROW', rotation: Math.PI / 2, fromSkill: true 
        });
      }, i * (3000 * durationMultiplier / arrowCount)); 
    }
  }
  
  spawnLightning(x: number, faction: Faction, powerLevel: number) {
    const isPlayer = faction === Faction.PLAYER;
    this.activeStorms.push({ id: Math.random().toString(), faction, x, duration: 300, level: powerLevel });
    if (isPlayer) { this.skillActiveTimers.LIGHTNING = 300; this.skillMaxDurations.LIGHTNING = 300; }
    soundManager.playSkill('Lightning');
  }
  
  spawnFreeze(x: number, faction: Faction, powerLevel: number) {
      const isPlayer = faction === Faction.PLAYER;
      const freezeDurationFrames = (8 * (1 + (powerLevel * 0.05))) * 60;
      if (isPlayer) { this.skillActiveTimers.FREEZE = freezeDurationFrames; this.skillMaxDurations.FREEZE = freezeDurationFrames; }
      const shards: IceShard[] = [];
      for(let i=0; i<20; i++) { shards.push({ x: (i * 20) + (Math.random() * 10), height: 15 + Math.random() * 25, width: 25, tilt: (Math.random() - 0.5) * 0.2 }); }
      this.hazards.push({ id: Math.random().toString(), type: 'FREEZE_ZONE', x: x - 200, y: GROUND_Y - 10, width: 400, height: 20, duration: freezeDurationFrames, damagePercent: 0.02, slowFactor: 0.5, faction: faction, visuals: shards });
      soundManager.playSkill('Freeze'); 
  }

  update() {
    if (this.paused) return;
    this.units.forEach(u => u.isSlowed = false);
    if (this.victory && this.frame % 30 === 0) this.createFirework();
    this.updateFireworks();
    if (this.gameOver || this.victory) return;
    this.frame++; this.levelTimer++;
    if (this.screenShake > 0) this.screenShake *= 0.9;
    
    // Cooldowns
    Object.keys(this.skillCooldowns).forEach(k => { if (this.skillCooldowns[k as keyof typeof this.skillCooldowns] > 0) this.skillCooldowns[k as keyof typeof this.skillCooldowns]--; });
    Object.keys(this.skillActiveTimers).forEach(k => { if (this.skillActiveTimers[k as keyof typeof this.skillActiveTimers] > 0) this.skillActiveTimers[k as keyof typeof this.skillActiveTimers]--; });
    
    // Updates
    if (!this.level.isMultiplayer) this.updateAI();
    this.manageVanguard(); this.updateQueues(); this.updateHazards(); this.updateUnits(); this.updateProjectiles(); this.updateParticles(); this.updateLightning(); this.updateTowers(); this.updateEnvironment(); this.checkGameStatus();
    
    if (this.frame % 60 === 0) this.gold += (5 + (this.upgrades.passiveGold * 5));
    if (this.frame % 5 === 0) this.onStateChange(this);
  }
  
  updateAI() { /* Standard AI logic */ }
  manageVanguard() { /* Standard logic */ }
  updateQueues() { 
      if (this.playerQueue.length > 0) {
          this.playerQueue[0].remainingTime--;
          if (this.playerQueue[0].remainingTime <= 0) { this.spawnUnitNow(this.playerQueue[0].type, Faction.PLAYER); this.playerQueue.shift(); if (!this.level.isSpectator) soundManager.playSpawn(); }
      }
      if (this.enemyQueue.length > 0) {
          this.enemyQueue[0].remainingTime--;
          if (this.enemyQueue[0].remainingTime <= 0) { this.spawnUnitNow(this.enemyQueue[0].type, Faction.ENEMY); this.enemyQueue.shift(); }
      }
  }
  updateHazards() { /* Standard logic */ }
  updateUnits() { this.units.forEach(u => u.animationFrame++); /* Simplify movement logic here */ }
  updateProjectiles() { /* Standard logic */ }
  updateParticles() { /* Standard logic */ }
  updateLightning() { /* Standard logic */ }
  updateEnvironment() { /* Standard logic */ }
  createFirework() { /* Standard logic */ }
  updateFireworks() { /* Standard logic */ }
  spawnUnitNow(type: UnitType, faction: Faction) {
      const isPlayer = faction === Faction.PLAYER;
      const upgrades = isPlayer ? this.upgrades : this.enemyUpgrades;
      // ... logic to create unit
      let stats = calculateUnitStats(type, 0); // Simplified call
      const unit: Unit = { id: Math.random().toString(), type, faction, x: isPlayer ? PLAYER_BASE_X : ENEMY_BASE_X, y: GROUND_Y, state: UnitState.MOVE, stats, lastAttackFrame: 0, targetId: null, width: 40, height: 40, animationFrame: 0, rotation: 0, deathTimer: 60, opacity: 1, freezeTimer: 0 };
      this.units.push(unit);
  }
  createParticles(x: number, y: number, count: number, color: string, gravity?: boolean) {}
  checkGameStatus() {
      if (this.playerBaseHp <= 0) { this.gameOver = true; soundManager.playDefeat(); this.onStateChange(this); }
      if (this.enemyBaseHp <= 0) { this.victory = true; soundManager.playVictory(); this.onStateChange(this); }
  }
}
