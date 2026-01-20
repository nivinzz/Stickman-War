
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GameEngine } from '../services/GameEngine';
import { Unit, Faction, UnitType, UnitState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, MINING_DISTANCE, getTheme } from '../constants';

interface GameCanvasProps {
  engine: GameEngine;
  targetingSkill: string | null;
  onSkillUsed: () => void;
}

// Data structures for static background elements
interface MountainPoint { x: number; h: number; }
// Removed Vine interface
interface Star { x: number; y: number; size: number; alpha: number; }
interface Crack { x: number; y: number; path: {x: number, y: number}[] }

const GameCanvas: React.FC<GameCanvasProps> = ({ engine, targetingSkill, onSkillUsed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera State
  const [cameraX, setCameraX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastMouseX, setLastMouseX] = useState<number>(0);
  const [hoverX, setHoverX] = useState<number>(0); 
  
  const cameraXRef = useRef(0);
  useEffect(() => { cameraXRef.current = cameraX; }, [cameraX]);

  const theme = getTheme(engine.level.level);
  const biome = Math.floor((engine.level.level - 1) / 5) % 12;

  // --- PRE-CALCULATE STATIC BACKGROUND DATA (Memoized) ---
  const staticBg = useMemo(() => {
      const levelSeed = engine.level.level * 100;
      const mountainPoints: MountainPoint[] = [];
      const stars: Star[] = [];
      const cracks: Crack[] = [];
      
      const isJagged = (biome === 3 || biome === 5 || biome === 11);
      const isMesa = (biome === 2 || biome === 9); 
      const isNight = biome === 4 || biome === 7 || biome === 8 || biome === 11;

      // 1. Generate Mountain Shape
      for(let x = 0; x <= WORLD_WIDTH; x += 40) {
          let h = 0;
          if (isMesa) {
               const cycle = (x + levelSeed) % 800;
               if (cycle < 100) h = cycle * 2; 
               else if (cycle < 500) h = 200 + Math.sin(x * 0.05) * 10;
               else if (cycle < 600) h = 200 - (cycle - 500) * 2; 
               else h = 0; 
          } else {
               const wave1 = Math.sin((x + levelSeed) * 0.005);
               const wave2 = Math.sin((x + levelSeed) * 0.02) * 0.5;
               const noise = Math.sin((x * levelSeed) % 100) * (isJagged ? 0.4 : 0.1);
               h = 150 + (Math.abs(wave1 + wave2 + noise) * (isJagged ? 250 : 200));
          }
          mountainPoints.push({ x, h });
      }

      // 2. Generate Stars (Night biomes)
      if (isNight) {
          for(let i=0; i<60; i++) {
               stars.push({
                   x: Math.random() * WORLD_WIDTH,
                   y: Math.random() * (GROUND_Y - 150),
                   size: 0.5 + Math.random() * 2,
                   alpha: 0.3 + Math.random() * 0.7
               });
          }
      }

      // 3. Generate Cracks (Desert/Volcano)
      if (biome === 2 || biome === 5 || biome === 11) {
          for(let i=0; i<25; i++) {
              const cx = Math.random() * WORLD_WIDTH;
              const cy = GROUND_Y + Math.random() * 80;
              cracks.push({
                  x: cx,
                  y: cy,
                  path: [
                      {x: 10 + Math.random() * 10, y: 5 + Math.random() * 5},
                      {x: 20 + Math.random() * 10, y: -5 + Math.random() * 5}
                  ]
              });
          }
      }

      return { mountainPoints, stars, cracks };
  }, [engine.level.level, biome]); 

  // --- DRAWING HELPERS ---
  
  const drawGoldMine = (ctx: CanvasRenderingContext2D, x: number, isPlayer: boolean) => {
      ctx.save();
      ctx.translate(x, GROUND_Y);
      if (!isPlayer) ctx.scale(-1, 1);

      // Cave Mound
      ctx.fillStyle = '#57534e'; // Stone color
      ctx.beginPath();
      ctx.arc(0, 0, 40, Math.PI, 0); // Semi-circle
      ctx.fill();

      // Entrance
      ctx.fillStyle = '#292524'; // Darker cave
      ctx.beginPath();
      ctx.arc(0, 0, 25, Math.PI, 0);
      ctx.fill();

      // Gold Nuggests (Sparkles)
      ctx.fillStyle = '#facc15'; // Yellow
      ctx.beginPath(); ctx.arc(-15, -10, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -25, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(20, -5, 2, 0, Math.PI*2); ctx.fill();

      // Wooden Supports
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-30, -35, 5, 35);
      ctx.fillRect(25, -35, 5, 35);
      ctx.fillRect(-30, -35, 60, 5);

      ctx.restore();
  };

  const drawCastleHP = (ctx: CanvasRenderingContext2D, x: number, hp: number, maxHp: number) => {
      const width = 100;
      const height = 8;
      const y = GROUND_Y - 160; 

      ctx.fillStyle = '#000';
      ctx.fillRect(x - width/2 - 1, y - 1, width + 2, height + 2);

      const pct = Math.max(0, hp / maxHp);
      ctx.fillStyle = '#ef4444'; 
      ctx.fillRect(x - width/2, y, width, height);
      
      ctx.fillStyle = '#22c55e'; 
      ctx.fillRect(x - width/2, y, width * pct, height);
  };

  // Tree Drawing Functions 
  const drawTreeStandard = (ctx: CanvasRenderingContext2D, scale: number, variant: number) => {
      ctx.fillStyle = theme.treeTrunk;
      ctx.fillRect(-5, -40, 10, 40);
      ctx.fillStyle = variant === 0 ? theme.treeLeaf1 : theme.treeLeaf2;
      ctx.beginPath();
      ctx.arc(0, -50, 25, 0, Math.PI * 2);
      ctx.arc(-15, -40, 20, 0, Math.PI * 2);
      ctx.arc(15, -40, 20, 0, Math.PI * 2);
      ctx.fill();
  };
  const drawTreePine = (ctx: CanvasRenderingContext2D, scale: number, variant: number) => {
      ctx.fillStyle = theme.treeTrunk;
      ctx.fillRect(-4, -20, 8, 20);
      ctx.fillStyle = variant === 0 ? theme.treeLeaf1 : theme.treeLeaf2;
      ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(25, -20); ctx.lineTo(-25, -20); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(20, -40); ctx.lineTo(-20, -40); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -85); ctx.lineTo(15, -60); ctx.lineTo(-15, -60); ctx.fill();
  };
  const drawCactus = (ctx: CanvasRenderingContext2D, scale: number, variant: number) => {
      ctx.fillStyle = theme.treeLeaf1; 
      ctx.beginPath(); ctx.roundRect(-8, -60, 16, 60, 8); ctx.fill();
      ctx.beginPath(); ctx.roundRect(8, -45, 15, 10, 5); ctx.roundRect(18, -65, 10, 25, 5); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-23, -35, 15, 10, 5); ctx.roundRect(-28, -50, 10, 20, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for(let i=0; i<5; i++) ctx.fillRect(-2, -55 + (i*10), 4, 2);
  };
  const drawDeadTree = (ctx: CanvasRenderingContext2D, scale: number, variant: number) => {
      ctx.strokeStyle = theme.treeTrunk;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.lineTo(-15, -60); 
      ctx.moveTo(0, -40); ctx.lineTo(10, -55); ctx.moveTo(10, -55); ctx.lineTo(20, -70); 
      ctx.moveTo(0, -20); ctx.lineTo(15, -30); ctx.stroke();
  };

  const drawEnvironment = (ctx: CanvasRenderingContext2D) => {
      engine.envElements.forEach(e => {
          if (e.type === 'TREE') {
              ctx.save();
              // Adjust Y for Hills/Swamp visual offset
              let yOffset = 0;
              if (e.x > 800 && e.x < 1600) yOffset = -25; // Hill tree higher
              if (e.x > 1600 && e.x < 2400) yOffset = 10; // Swamp tree lower
              
              ctx.translate(e.x, e.y + yOffset);
              ctx.scale(e.scale, e.scale);
              if (biome === 2 || biome === 9) drawCactus(ctx, e.scale, e.variant);
              else if (biome === 3 || biome === 10) drawTreePine(ctx, e.scale, e.variant);
              else if (biome === 5 || biome === 7 || biome === 8 || biome === 11) drawDeadTree(ctx, e.scale, e.variant);
              else drawTreeStandard(ctx, e.scale, e.variant);
              ctx.restore();
          }
      });
  };

  const drawSkyElements = (ctx: CanvasRenderingContext2D) => {
       const isNight = biome === 4 || biome === 7 || biome === 8 || biome === 11;
       
       // Draw Static Stars
       if (isNight) {
           ctx.fillStyle = '#fff';
           staticBg.stars.forEach(star => {
               ctx.globalAlpha = star.alpha;
               ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
           });
           ctx.globalAlpha = 1;

           // Moon (Static position)
           ctx.fillStyle = '#fef3c7';
           ctx.shadowBlur = 20; ctx.shadowColor = '#fef3c7';
           ctx.beginPath(); ctx.arc(WORLD_WIDTH - 200, 100, 40, 0, Math.PI*2); ctx.fill();
           ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
           ctx.fillStyle = 'rgba(0,0,0,0.1)';
           ctx.beginPath(); ctx.arc(WORLD_WIDTH - 190, 110, 10, 0, Math.PI*2); ctx.fill();
           ctx.beginPath(); ctx.arc(WORLD_WIDTH - 210, 90, 8, 0, Math.PI*2); ctx.fill();
       } else {
           // Sun (Static position)
           ctx.fillStyle = '#fcd34d';
           ctx.shadowBlur = 40; ctx.shadowColor = '#f59e0b';
           ctx.beginPath(); ctx.arc(200, 100, 50, 0, Math.PI*2); ctx.fill();
           ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
       }

       // Animated Clouds & Birds
       engine.envElements.forEach(e => {
          if (e.type === 'CLOUD') {
              const cloudColor = (biome === 5 || biome === 7 || biome === 11) ? 'rgba(50, 50, 50, 0.4)' : 'rgba(255, 255, 255, 0.4)';
              ctx.fillStyle = cloudColor;
              ctx.beginPath();
              ctx.arc(e.x, e.y, 30 * e.scale, 0, Math.PI * 2);
              ctx.arc(e.x + 40 * e.scale, e.y, 40 * e.scale, 0, Math.PI * 2);
              ctx.arc(e.x + 80 * e.scale, e.y, 30 * e.scale, 0, Math.PI * 2);
              ctx.fill();
          }
          if (e.type === 'BIRD') {
              ctx.fillStyle = (biome === 4 || biome === 7) ? '#fff' : '#000'; 
              ctx.beginPath();
              ctx.moveTo(e.x, e.y);
              ctx.lineTo(e.x + 5, e.y + 2);
              ctx.lineTo(e.x + 10, e.y);
              ctx.lineTo(e.x + 5, e.y + 1);
              ctx.fill();
          }
       });
  };

  const drawFlag = (ctx: CanvasRenderingContext2D, x: number, color: 'RED' | 'BLUE' | 'GREEN') => {
      // Adjust flag height based on terrain
      let yOffset = 0;
      if (x > 800 && x < 1600) yOffset = -30; // Hill
      if (x > 1600 && x < 2400) yOffset = 10; // Swamp

      ctx.save();
      ctx.translate(x, GROUND_Y + yOffset);
      const strokeColor = color === 'RED' ? 'rgba(239, 68, 68, 0.5)' : (color === 'BLUE' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(34, 197, 94, 0.5)');
      const fillColor = color === 'RED' ? '#ef4444' : (color === 'BLUE' ? '#3b82f6' : '#22c55e');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -60); ctx.stroke();
      ctx.fillStyle = fillColor; 
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(25, -45); ctx.lineTo(0, -30); ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
  };
  
  const drawHazards = (ctx: CanvasRenderingContext2D) => {
      engine.hazards.forEach(h => {
          if (h.type === 'FREEZE_ZONE') {
              const isPlayer = h.faction === Faction.PLAYER;
              // Player = Blueish, Enemy = Reddish
              const baseColorTop = isPlayer ? 'rgba(224, 242, 254, 0.9)' : 'rgba(254, 202, 202, 0.9)'; 
              const baseColorBot = isPlayer ? 'rgba(125, 211, 252, 0.6)' : 'rgba(248, 113, 113, 0.6)';
              const fallbackColor = isPlayer ? 'rgba(186, 230, 253, 0.5)' : 'rgba(252, 165, 165, 0.5)';
              
              ctx.save();
              ctx.translate(h.x, GROUND_Y);
              if (h.visuals) {
                  h.visuals.forEach(shard => {
                      ctx.save();
                      ctx.translate(shard.x, 0);
                      ctx.rotate(shard.tilt);
                      const grad = ctx.createLinearGradient(0, -shard.height, 0, 0);
                      grad.addColorStop(0, baseColorTop); 
                      grad.addColorStop(1, baseColorBot); 
                      ctx.fillStyle = grad;
                      ctx.strokeStyle = isPlayer ? 'rgba(186, 230, 253, 0.8)' : 'rgba(254, 202, 202, 0.8)';
                      ctx.lineWidth = 1;
                      ctx.beginPath(); ctx.moveTo(0, -shard.height); ctx.lineTo(shard.width/2, 0); ctx.lineTo(-shard.width/2, 0);
                      ctx.closePath(); ctx.fill(); ctx.stroke();
                      ctx.restore();
                  });
              } else {
                  ctx.fillStyle = fallbackColor; ctx.fillRect(0, -20, h.width, 20);
              }
              ctx.fillStyle = '#fff';
              if (Math.random() > 0.8) { const spX = Math.random() * h.width; ctx.fillRect(spX, -Math.random()*10, 2, 2); }
              ctx.restore();
          }
      });
  };

  const getUnitTier = (type: UnitType, faction: Faction) => {
      const upgrades = faction === Faction.PLAYER ? engine.upgrades : engine.enemyUpgrades;
      let level = 0;
      if (type === UnitType.SWORDMAN) level = upgrades.swordDamage;
      if (type === UnitType.ARCHER) level = upgrades.archerDamage;
      if (type === UnitType.CAVALRY) level = upgrades.cavalryDamage;
      if (type === UnitType.HERO) level = upgrades.heroPower;
      return Math.floor(level / 10);
  };

  const drawStickman = (ctx: CanvasRenderingContext2D, unit: Unit) => {
    if (unit.faction === Faction.ENEMY && unit.x > engine.playerVisibleX) return; 
    const isPlayer = unit.faction === Faction.PLAYER;
    const tier = getUnitTier(unit.type, unit.faction);
    const color = isPlayer ? '#4ade80' : '#f87171';
    const height = unit.height;
    
    // VISUAL TERRAIN OFFSET FOR UNITS
    let yOffset = 0;
    // Hill Zone (800-1600): Bump up units
    if (unit.x > 800 && unit.x < 1600) {
        // Create a fake hill shape curve
        const relX = unit.x - 800; // 0 to 800
        const sineH = Math.sin((relX / 800) * Math.PI) * 30; // Max height 30px
        yOffset = -sineH;
    }
    // Swamp Zone (1600-2400): Sink units slightly
    if (unit.x > 1600 && unit.x < 2400) {
        yOffset = 5; // Sink into mud
    }

    ctx.save();
    ctx.translate(unit.x, unit.y + yOffset);
    const baseHeight = unit.type === UnitType.HERO ? 60 : 40;
    const scale = unit.height / baseHeight;
    const xFlip = !isPlayer ? -1 : 1;
    ctx.scale(xFlip * scale, scale);
    ctx.rotate(isPlayer ? -unit.rotation : unit.rotation);
    ctx.globalAlpha = unit.opacity;
    if (unit.isVanguard) { ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; ctx.beginPath(); ctx.arc(0, -height/2, 20, 0, Math.PI*2); ctx.fill(); }

    const isAttacking = unit.state === UnitState.ATTACK;
    const attackPhase = Math.sin(unit.animationFrame * 0.5); 
    const walkCycle = Math.sin(unit.animationFrame * 0.3) * 8;
    const legSwing = (unit.state === UnitState.MOVE || unit.state === UnitState.MINE_WALK_TO_MINE || unit.state === UnitState.MINE_RETURN) ? walkCycle : 0;

    if (unit.type === UnitType.CAVALRY) {
        const horseColor = tier === 0 ? '#78350f' : (tier === 1 ? '#57534e' : '#fefce8');
        const horseArmor = tier === 0 ? null : (tier === 1 ? '#94a3b8' : '#fbbf24');
        ctx.fillStyle = horseColor;
        ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-15 + legSwing, 0); ctx.lineTo(-10 + legSwing, 0); ctx.lineTo(-5, -20); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -30, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
        if (tier >= 1) { ctx.fillStyle = isPlayer ? '#1e40af' : '#991b1b'; ctx.fillRect(-10, -35, 20, 10); }
        ctx.fillStyle = horseColor;
        ctx.beginPath(); ctx.moveTo(10, -25); ctx.lineTo(15 - legSwing, 0); ctx.lineTo(20 - legSwing, 0); ctx.lineTo(15, -25); ctx.fill();
        ctx.save(); ctx.translate(15, -35); ctx.rotate(-Math.PI / 4); ctx.fillStyle = horseColor; ctx.fillRect(0, -15, 12, 25); ctx.restore();
        ctx.save(); ctx.translate(25, -50); ctx.fillStyle = horseColor; ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI*2); ctx.fill();
        if (horseArmor) { ctx.fillStyle = horseArmor; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.fill(); }
        ctx.restore(); ctx.translate(-5, -20);
    }
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; if (unit.type === UnitType.HERO) ctx.lineWidth = 3;

    if (unit.type !== UnitType.CAVALRY) {
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-5 + legSwing, 0); ctx.moveTo(0, -15); ctx.lineTo(5 - legSwing, 0); ctx.stroke();
    } else {
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, -5); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, -height + 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -height, 8, 0, Math.PI * 2); ctx.fill();

    if ((tier >= 2 || unit.type === UnitType.HERO) && unit.type !== UnitType.MINER) {
        ctx.save(); ctx.fillStyle = isPlayer ? '#1d4ed8' : '#b91c1c'; ctx.beginPath();
        ctx.moveTo(-2, -height + 5); ctx.quadraticCurveTo(-15, -height + 15, -15 + (Math.sin(unit.animationFrame * 0.2) * 3), -5);
        ctx.lineTo(2, -height + 5); ctx.fill(); ctx.restore();
    }

    let armAngle = Math.PI/6; let shoulderY = -height + 15; 
    if (unit.type === UnitType.ARCHER) { shoulderY = -height + 6; armAngle = Math.PI / 2; } 
    else if (isAttacking) {
        if (unit.type === UnitType.SWORDMAN || unit.type === UnitType.HERO) { const phaseNormalized = (attackPhase + 1) / 2; armAngle = -Math.PI * 0.8 + (phaseNormalized * Math.PI); } 
        else if (unit.type === UnitType.CAVALRY) { armAngle = 0; }
    }
    ctx.beginPath(); ctx.moveTo(0, shoulderY);
    const handX = Math.sin(armAngle) * 15; const handY = Math.cos(armAngle) * 15;
    let thrustX = 0; if (unit.type === UnitType.CAVALRY && isAttacking) { thrustX = Math.abs(attackPhase) * 15; }
    ctx.lineTo(handX + thrustX, shoulderY + handY); ctx.stroke();

    const weaponX = handX + thrustX; const weaponY = shoulderY + handY;
    if (unit.type === UnitType.MINER) {
        ctx.save(); ctx.translate(weaponX, weaponY); const chop = Math.abs(Math.sin(unit.animationFrame * 0.2));
        ctx.rotate(unit.state === UnitState.MINE_GATHERING ? -chop : 0);
        ctx.strokeStyle = '#9ca3af'; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -10); ctx.stroke(); 
        ctx.strokeStyle = tier > 0 ? '#3b82f6' : '#eab308'; ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(5, -8); ctx.stroke(); 
        ctx.restore(); ctx.fillStyle = tier > 0 ? '#3b82f6' : '#facc15'; ctx.beginPath(); ctx.arc(0, -height - 2, 9, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(4, -height - 2, 3, 0, Math.PI*2); ctx.fill();
    } 
    else if (unit.type === UnitType.SWORDMAN || unit.type === UnitType.HERO) {
        ctx.save(); ctx.translate(5, -height + 25);
        ctx.fillStyle = isPlayer ? '#1e293b' : '#450a0a'; ctx.strokeStyle = tier >= 1 ? '#cbd5e1' : '#94a3b8';
        if (tier >= 2 || unit.type === UnitType.HERO) ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2; ctx.beginPath();
        if (tier === 0) ctx.arc(0, 0, 8, 0, Math.PI*2);
        else { ctx.moveTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(6, 0); ctx.quadraticCurveTo(0, 12, -6, 0); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.translate(weaponX, weaponY); ctx.rotate(armAngle); 
        ctx.fillStyle = tier === 0 ? '#94a3b8' : (tier === 1 ? '#e2e8f0' : '#facc15'); if (unit.type === UnitType.HERO) ctx.fillStyle = '#facc15';
        const swordLen = (tier >= 2 || unit.type === UnitType.HERO) ? 1.4 : 1;
        ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(-2, -35 * swordLen); ctx.lineTo(0, -40 * swordLen); ctx.lineTo(2, -35 * swordLen); ctx.lineTo(2, -5);
        ctx.fill(); ctx.fillStyle = '#78350f'; ctx.fillRect(-6, -5, 12, 3); ctx.restore();
        const helmColor = tier === 0 ? '#64748b' : (tier === 1 ? '#94a3b8' : '#facc15');
        ctx.fillStyle = helmColor; ctx.beginPath();
        if (tier === 0) ctx.fillRect(-6, -height-4, 12, 4);
        else { ctx.moveTo(-7, -height); ctx.lineTo(-7, -height-10); ctx.quadraticCurveTo(0, -height-14, 7, -height-10); ctx.lineTo(7, -height); ctx.fill(); }
        if (tier >= 2 || unit.type === UnitType.HERO) { ctx.fillStyle = isPlayer ? '#2563eb' : '#dc2626'; ctx.beginPath(); ctx.moveTo(0, -height-14); ctx.quadraticCurveTo(8, -height-22, 12, -height-8); ctx.fill(); }
    }
    // --- CAVALRY SPEAR DRAWING LOGIC ---
    else if (unit.type === UnitType.CAVALRY) {
        // Draw Spear
        ctx.save();
        ctx.translate(5, shoulderY - 15); // Adjust relative to rider shoulder (approx)
        
        // Attack Animation: Thrust forward
        const thrust = isAttacking ? Math.sin(unit.animationFrame * 0.5) * 15 : 0;
        
        // Idle Animation: Slightly angled up. Attack: Level.
        const angle = isAttacking ? 0 : -Math.PI / 10;
        
        ctx.rotate(angle);
        
        // Shaft
        ctx.strokeStyle = '#57534e'; // Wood
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(50 + thrust, 0); // Long spear
        ctx.stroke();
        
        // Spear Tip
        ctx.fillStyle = tier >= 1 ? '#e2e8f0' : '#94a3b8'; // Metal
        if (tier >= 2) ctx.fillStyle = '#facc15'; // Gold tip for elite
        
        ctx.beginPath();
        ctx.moveTo(50 + thrust, -3);
        ctx.lineTo(65 + thrust, 0);
        ctx.lineTo(50 + thrust, 3);
        ctx.fill();
        
        // Hand holding it
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
        
        ctx.restore();
    }
    // -----------------------------------
    
    else if (unit.type === UnitType.ARCHER) {
        const timeSinceAttack = engine.frame - unit.lastAttackFrame; const attackDuration = unit.stats.attackSpeed;
        const progress = Math.min(1, timeSinceAttack / attackDuration);
        ctx.save(); ctx.translate(weaponX + 5, weaponY); 
        const woodColor = tier >= 2 ? '#facc15' : '#a16207'; ctx.strokeStyle = woodColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(8, -20); ctx.quadraticCurveTo(15, 0, 8, 20); ctx.stroke();
        let stringX = 8; let showArrow = false; let arrowX = 0;
        if (isAttacking) {
            if (progress < 0.15) { stringX = 8 + (Math.sin(progress * Math.PI * 15) * 3); showArrow = false; } 
            else if (progress < 0.4) { stringX = 8; showArrow = true; arrowX = 8; } 
            else { const drawProgress = (progress - 0.4) / 0.6; const tension = Math.pow(drawProgress, 1.2); stringX = 8 - (tension * 13); showArrow = true; arrowX = stringX; }
        } else { stringX = 8; showArrow = true; arrowX = 8; }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, -20); ctx.lineTo(stringX, 0); ctx.lineTo(8, 20); ctx.stroke();
        if (showArrow) {
            const arrowColor = isPlayer ? '#4ade80' : '#ef4444'; ctx.strokeStyle = arrowColor; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(arrowX, 0); ctx.lineTo(arrowX + 25, 0); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(arrowX + 25, 0); ctx.lineTo(arrowX + 22, -3); ctx.lineTo(arrowX + 22, 3); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#78350f'; ctx.fillRect(-8, -height+5, 4, 15);
        if (tier >= 1) { ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.moveTo(0, -height-10); ctx.lineTo(10, -height+2); ctx.lineTo(-10, -height+2); ctx.fill(); } else { ctx.fillStyle = '#3f6212'; ctx.fillRect(-6, -height - 2, 12, 2); }
    }
    if (unit.state !== UnitState.DIE) {
        if (unit.stats.hp < unit.stats.maxHp) {
            const hpPct = Math.max(0, unit.stats.hp / unit.stats.maxHp);
            ctx.fillStyle = 'red'; ctx.fillRect(-10, -height - 25, 20, 3);
            ctx.fillStyle = '#4ade80'; ctx.fillRect(-10, -height - 25, 20 * hpPct, 3);
        }
    }
    ctx.restore();
  };

  const drawCastle = (ctx: CanvasRenderingContext2D, x: number, y: number, isPlayer: boolean, towerCount: number) => {
      ctx.save(); ctx.translate(x, y); if (!isPlayer) ctx.scale(-1, 1);
      
      // 1. Castle Base (Foundation) - Reduced Height slightly to make room for towers
      const baseHeight = 100;
      ctx.fillStyle = '#334155'; ctx.fillRect(-60, -baseHeight, 120, baseHeight);
      
      // Base Battlements
      ctx.fillStyle = '#1e293b'; 
      ctx.fillRect(-70, -baseHeight - 20, 30, 20); // Left battlement
      ctx.fillRect(-20, -baseHeight - 20, 40, 20); // Center gate arch top
      ctx.fillRect(40, -baseHeight - 20, 30, 20); // Right battlement
      
      // Gate (Entrance)
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(0, 0, 30, Math.PI, 0); ctx.fill();

      // 2. Tower Stacking System
      // Towers are drawn on top of the base
      const towerFloorHeight = 30; // Height of each tower level
      const towerWidth = 70; // Width of the tower structure
      
      let currentY = -baseHeight - 20; // Start drawing from top of base battlements

      if (towerCount > 0) {
          // Draw Tower Base Connector
          ctx.fillStyle = '#475569';
          ctx.fillRect(-towerWidth/2, currentY - 5, towerWidth, 5);
          currentY -= 5;

          for (let i = 0; i < towerCount; i++) {
              // Tower Floor Body
              ctx.fillStyle = (i % 2 === 0) ? '#64748b' : '#475569'; // Alternating colors for floors
              ctx.fillRect(-towerWidth/2, currentY - towerFloorHeight, towerWidth, towerFloorHeight);
              
              // Tower Window (Arrow Slit)
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(-5, currentY - towerFloorHeight + 10, 10, 15);

              // Floor Separator / Mini Battlements
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(-(towerWidth/2) - 5, currentY - towerFloorHeight - 5, towerWidth + 10, 5);
              
              currentY -= towerFloorHeight;
          }
      }

      // 3. Top Roof / Flag Pole
      // Draw a pointed roof or final battlement on the very top
      if (towerCount > 0) {
          // Top Battlements
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-35, currentY - 10, 15, 10);
          ctx.fillRect(-5, currentY - 10, 10, 10);
          ctx.fillRect(20, currentY - 10, 15, 10);
          currentY -= 10;
      }

      // Flag Pole
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4; 
      ctx.beginPath(); ctx.moveTo(0, currentY); ctx.lineTo(0, currentY - 40); ctx.stroke();
      
      // Flag
      ctx.fillStyle = isPlayer ? '#3b82f6' : '#ef4444'; 
      ctx.beginPath(); ctx.moveTo(0, currentY - 40); ctx.lineTo(40, currentY - 25); ctx.lineTo(0, currentY - 10); ctx.fill();
      
      ctx.restore();
  };

  const drawProjectiles = (ctx: CanvasRenderingContext2D) => {
      engine.projectiles.forEach(p => {
          if (!p.active) return;
          const isPlayer = p.faction === Faction.PLAYER;
          const factionColor = isPlayer ? '#3b82f6' : '#ef4444'; // Blue vs Red

          if (p.type === 'ARROW' || p.type === 'TOWER_SHOT') {
              ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
              if (p.type === 'TOWER_SHOT') {
                   ctx.fillStyle = isPlayer ? '#60a5fa' : '#f87171';
                   ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
                   ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;
              } else if (p.type === 'ARROW') {
                  // --- COLORED ARROW ---
                  ctx.fillStyle = factionColor; 
                  // Make it longer: -15 to +15 (30px total)
                  ctx.fillRect(-15, -1.5, 30, 3); 
                  
                  // Arrow Head
                  ctx.beginPath();
                  ctx.moveTo(15, -4);
                  ctx.lineTo(22, 0); 
                  ctx.lineTo(15, 4);
                  ctx.fill();
              }
              ctx.restore();
          } else if (p.type === 'LIGHTNING_BOLT' && p.points) {
               ctx.save(); 
               ctx.strokeStyle = isPlayer ? '#e0f2fe' : '#fecaca';
               ctx.lineWidth = 3; 
               ctx.shadowBlur = 10; 
               ctx.shadowColor = factionColor; 
               ctx.globalAlpha = p.opacity || 1;
               ctx.beginPath();
               if (p.points.length > 0) { ctx.moveTo(p.points[0].x, p.points[0].y); for(let i=1; i<p.points.length; i++) { ctx.lineTo(p.points[i].x, p.points[i].y); } }
               ctx.stroke(); ctx.restore();
          }
      });
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
      engine.particles.forEach(p => {
          ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0;
      });
  };

  const drawFireworks = (ctx: CanvasRenderingContext2D) => {
       engine.fireworks.forEach(fw => {
           if (!fw.exploded) { ctx.fillStyle = fw.color; ctx.fillRect(fw.x - 2, fw.y - 2, 4, 4); } else {
               fw.particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
               ctx.globalAlpha = 1;
           }
       });
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // 1. Static Sky
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);
    
    drawSkyElements(ctx);
    
    // 2. Static Mountains (from useMemo data)
    ctx.fillStyle = theme.mountainColor;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    staticBg.mountainPoints.forEach(pt => ctx.lineTo(pt.x, GROUND_Y - pt.h));
    ctx.lineTo(WORLD_WIDTH, GROUND_Y);
    ctx.closePath();
    ctx.save(); ctx.fill(); ctx.clip(); 

    // 3. Static Details (Clipped to Mountain)
    // Snow Caps
    if (biome === 3 || biome === 10) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, WORLD_WIDTH, GROUND_Y - 250); }

    // Desert Strata
    if (biome === 2 || biome === 9) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for(let y=GROUND_Y - 300; y<GROUND_Y; y+=20) { ctx.fillRect(0, y, WORLD_WIDTH, 5); }
    }
    ctx.restore(); 
    
    // 4. TERRAIN GROUND (Draw ground in segments)
    
    // -- Zone 1: Player Plains (0 - 800)
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
    groundGrad.addColorStop(0, theme.groundColor);
    groundGrad.addColorStop(1, '#0f172a'); 
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, 800, CANVAS_HEIGHT - GROUND_Y);
    
    // -- Zone 2: Hills (800 - 1600) (Bump Up)
    // Draw a big sine wave hill shape
    ctx.beginPath();
    ctx.moveTo(800, GROUND_Y);
    for(let x=800; x<=1600; x+=10) {
        const relX = x - 800; // 0 to 800
        const sineH = Math.sin((relX / 800) * Math.PI) * 30; // Max height 30px
        ctx.lineTo(x, GROUND_Y - sineH);
    }
    ctx.lineTo(1600, CANVAS_HEIGHT);
    ctx.lineTo(800, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = '#57534e'; // Rocky Hill Color
    ctx.fill();
    // Fill bottom
    ctx.fillRect(800, GROUND_Y, 800, CANVAS_HEIGHT-GROUND_Y);

    // -- Zone 3: Swamp (1600 - 2400) (Dip/Flat)
    ctx.fillStyle = '#27272a'; // Muddy dark color
    ctx.fillRect(1600, GROUND_Y, 800, CANVAS_HEIGHT - GROUND_Y);
    // Draw bubbles
    ctx.fillStyle = '#10b981'; // Green slime bubbles
    if (engine.frame % 60 === 0) { // Static for performance, but randomized
       for(let i=0; i<5; i++) {
           const bx = 1600 + Math.random() * 800;
           const by = GROUND_Y + Math.random() * 20;
           ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
       }
    }

    // -- Zone 4: Enemy Plains (2400 - 3200)
    ctx.fillStyle = groundGrad;
    ctx.fillRect(2400, GROUND_Y, 800, CANVAS_HEIGHT - GROUND_Y);

    // Cracks (Static Lines) - Only in Plains
    if (biome === 2 || biome === 5 || biome === 11) {
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
        staticBg.cracks.forEach(crack => {
            if (crack.x < 800 || crack.x > 2400) {
                ctx.beginPath(); ctx.moveTo(crack.x, crack.y);
                crack.path.forEach(p => ctx.lineTo(crack.x + p.x, crack.y + p.y));
                ctx.stroke();
            }
        });
    }
    
    // Static Ground Texture
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for(let i=0; i<WORLD_WIDTH; i+=50) { if (i % 100 === 0) ctx.fillRect(i, GROUND_Y, 50, CANVAS_HEIGHT - GROUND_Y); }
    
    drawEnvironment(ctx); // Animated Clouds/Birds
    
    drawGoldMine(ctx, PLAYER_BASE_X + MINING_DISTANCE, true);
    drawGoldMine(ctx, ENEMY_BASE_X - MINING_DISTANCE, false);

    // Pass tower counts to the updated drawCastle function
    drawCastle(ctx, PLAYER_BASE_X, GROUND_Y, true, engine.playerTowers);
    drawCastleHP(ctx, PLAYER_BASE_X, engine.playerBaseHp, engine.playerMaxBaseHp);

    drawCastle(ctx, ENEMY_BASE_X, GROUND_Y, false, engine.enemyTowers);
    drawCastleHP(ctx, ENEMY_BASE_X, engine.enemyBaseHp, engine.enemyMaxBaseHp);
  };
  
  const drawFogOfWar = (ctx: CanvasRenderingContext2D) => {
      const visX = engine.playerVisibleX;
      if (visX >= WORLD_WIDTH) return;
      
      const fade = 300;
      const grad = ctx.createLinearGradient(visX, 0, visX + fade, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)'); // Semi-transparent black for Fog

      ctx.fillStyle = grad;
      ctx.fillRect(visX, 0, fade, CANVAS_HEIGHT);
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(visX + fade, 0, WORLD_WIDTH - (visX + fade), CANVAS_HEIGHT);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;

    const render = () => {
      engine.update();
      ctx.save();
      let shakeX = 0, shakeY = 0;
      if (engine.screenShake > 0) { shakeX = (Math.random() - 0.5) * engine.screenShake; shakeY = (Math.random() - 0.5) * engine.screenShake; }
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.translate(-cameraXRef.current + shakeX, shakeY);

      drawBackground(ctx);
      
      const sortedUnits = [...engine.units].sort((a,b) => {
          if (a.state === UnitState.DIE && b.state !== UnitState.DIE) return -1;
          if (a.state !== UnitState.DIE && b.state === UnitState.DIE) return 1;
          return a.y - b.y;
      });

      sortedUnits.forEach(unit => drawStickman(ctx, unit));
      drawHazards(ctx); 
      drawProjectiles(ctx);
      drawParticles(ctx);
      drawFireworks(ctx);
      drawFogOfWar(ctx);

      if (targetingSkill === 'ARROW_RAIN') { ctx.strokeStyle = '#fbbf24'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(hoverX, GROUND_Y, 150, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(251, 191, 36, 0.2)'; ctx.fill(); ctx.setLineDash([]); }
      if (targetingSkill === 'LIGHTNING') { ctx.strokeStyle = '#ffff00'; ctx.setLineDash([2, 8]); ctx.beginPath(); ctx.arc(hoverX, GROUND_Y, 150, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'; ctx.fill(); ctx.setLineDash([]); }
      if (targetingSkill === 'FREEZE') { ctx.strokeStyle = '#3b82f6'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(hoverX, GROUND_Y, 200, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; ctx.fill(); ctx.setLineDash([]); }
      if (targetingSkill === 'SET_PATROL') drawFlag(ctx, hoverX, 'RED'); 
      if (targetingSkill === 'SET_RALLY') drawFlag(ctx, hoverX, 'BLUE');
      if (engine.rallyPoint !== null) drawFlag(ctx, engine.rallyPoint, 'BLUE');
      if (engine.patrolPoint !== null) drawFlag(ctx, engine.patrolPoint, 'RED');
      ctx.restore(); 
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [engine, targetingSkill, hoverX, theme, staticBg]); 

  // Input Handling...
  const handleStart = (clientX: number) => { setIsDragging(true); setLastMouseX(clientX); };
  const handleMove = (clientX: number, rect: DOMRect) => {
    const scaleX = CANVAS_WIDTH / rect.width;
    const mouseCanvasX = (clientX - rect.left) * scaleX;
    setHoverX(mouseCanvasX + cameraX);
    if (isDragging) {
        const delta = (clientX - lastMouseX) * scaleX;
        setCameraX(prev => Math.max(0, Math.min(prev - delta, WORLD_WIDTH - CANVAS_WIDTH)));
        setLastMouseX(clientX);
    }
  };
  const handleEnd = (clientX: number, clientY: number, rect: DOMRect) => {
    const wasDragging = Math.abs(clientX - lastMouseX) > 5 && isDragging;
    setIsDragging(false);
    if (wasDragging) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const mouseCanvasX = (clientX - rect.left) * scaleX;
    const mouseCanvasY = (clientY - rect.top) * scaleY;
    if (!targetingSkill && mouseCanvasY < GROUND_Y - 50) return;
    const clickX = mouseCanvasX + cameraX;
    
    if (targetingSkill === 'ARROW_RAIN') { engine.useSkillArrowRain(clickX); onSkillUsed(); } 
    else if (targetingSkill === 'LIGHTNING') { engine.useSkillLightning(clickX); onSkillUsed(); } 
    else if (targetingSkill === 'FREEZE') { engine.useSkillFreeze(clickX); onSkillUsed(); } 
    else if (targetingSkill === 'SET_PATROL') { engine.setPatrolPoint(clickX); onSkillUsed(); } 
    else if (targetingSkill === 'SET_RALLY') { engine.setRallyPoint(clickX); onSkillUsed(); } 
    else { engine.setRallyPoint(clickX); onSkillUsed(); }
  };

  return (
    <div className="relative group overflow-hidden touch-none w-full flex justify-center">
        <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`w-full border-4 border-slate-700 shadow-2xl bg-black ${targetingSkill ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => { const r = canvasRef.current?.getBoundingClientRect(); if(r) handleMove(e.clientX, r); }}
        onMouseUp={(e) => { const r = canvasRef.current?.getBoundingClientRect(); if(r) handleEnd(e.clientX, e.clientY, r); }}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => { const r = canvasRef.current?.getBoundingClientRect(); if(r) handleMove(e.touches[0].clientX, r); }}
        onTouchEnd={(e) => { const r = canvasRef.current?.getBoundingClientRect(); if(r && e.changedTouches.length) handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY, r); }}
        />
        <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded pointer-events-none">
            {theme.nameVn} - Tap Ground to Flag / Drag Sky to Scroll
        </div>
    </div>
  );
};

export default GameCanvas;
