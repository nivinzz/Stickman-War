
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../services/GameEngine';
import { Unit, Faction, UnitType, UnitState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_WIDTH, GROUND_Y, PLAYER_BASE_X, ENEMY_BASE_X, MINING_DISTANCE, getTheme } from '../constants';

interface GameCanvasProps {
  engine: GameEngine;
  targetingSkill: string | null;
  onSkillUsed: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ engine, targetingSkill, onSkillUsed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera State
  const [cameraX, setCameraX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastMouseX, setLastMouseX] = useState<number>(0);
  const [hoverX, setHoverX] = useState<number>(0); 

  const theme = getTheme(engine.level.level);

  // --- DRAWING HELPERS ---
  
  const drawEnvironment = (ctx: CanvasRenderingContext2D) => {
      // Draw Trees (Background)
      engine.envElements.forEach(e => {
          if (e.type === 'TREE') {
              ctx.save();
              ctx.translate(e.x, e.y);
              ctx.scale(e.scale, e.scale);
              
              // Trunk
              ctx.fillStyle = '#451a03';
              ctx.fillRect(-5, -40, 10, 40);
              
              // Leaves (Improved)
              ctx.fillStyle = e.variant === 0 ? '#166534' : (e.variant === 1 ? '#15803d' : '#3f6212');
              ctx.beginPath();
              ctx.moveTo(0, -60);
              ctx.lineTo(25, -20);
              ctx.lineTo(-25, -20);
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(0, -45);
              ctx.lineTo(20, -10);
              ctx.lineTo(-20, -10);
              ctx.fill();
              
              ctx.restore();
          }
      });
  };

  const drawSkyElements = (ctx: CanvasRenderingContext2D) => {
       engine.envElements.forEach(e => {
          if (e.type === 'CLOUD') {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
              ctx.beginPath();
              ctx.arc(e.x, e.y, 30 * e.scale, 0, Math.PI * 2);
              ctx.arc(e.x + 40 * e.scale, e.y, 40 * e.scale, 0, Math.PI * 2);
              ctx.arc(e.x + 80 * e.scale, e.y, 30 * e.scale, 0, Math.PI * 2);
              ctx.fill();
          }
          if (e.type === 'BIRD') {
              ctx.fillStyle = '#000';
              ctx.beginPath();
              ctx.moveTo(e.x, e.y);
              ctx.lineTo(e.x + 5, e.y + 2);
              ctx.lineTo(e.x + 10, e.y);
              ctx.lineTo(e.x + 5, e.y + 1);
              ctx.fill();
          }
       });
  };

  const drawFlag = (ctx: CanvasRenderingContext2D, x: number, isRed: boolean = false) => {
      ctx.save();
      ctx.translate(x, GROUND_Y);
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -60); ctx.stroke();

      ctx.fillStyle = isRed ? '#ef4444' : '#3b82f6'; 
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(25, -45); ctx.lineTo(0, -30); ctx.fill();

      ctx.strokeStyle = isRed ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2); ctx.stroke();
      
      ctx.restore();
  };
  
  const drawHazards = (ctx: CanvasRenderingContext2D) => {
      engine.hazards.forEach(h => {
          if (h.type === 'FREEZE_ZONE') {
              // Ice floor
              ctx.fillStyle = 'rgba(186, 230, 253, 0.6)';
              ctx.fillRect(h.x, h.y, h.width, h.height);
              
              // Sparkles
              ctx.fillStyle = '#fff';
              if (Math.random() > 0.8) {
                  const spX = h.x + Math.random() * h.width;
                  const spY = h.y + Math.random() * h.height;
                  ctx.fillRect(spX, spY, 2, 2);
              }
          }
      });
  };

  // --- VISUAL EVOLUTION LOGIC ---
  const getUnitTier = (type: UnitType, faction: Faction) => {
      const upgrades = faction === Faction.PLAYER ? engine.upgrades : engine.enemyUpgrades;
      let level = 0;
      if (type === UnitType.SWORDMAN) level = upgrades.swordDamage;
      if (type === UnitType.ARCHER) level = upgrades.archerDamage;
      if (type === UnitType.CAVALRY) level = upgrades.cavalryDamage;
      if (type === UnitType.HERO) level = upgrades.heroPower;
      
      return Math.floor(level / 10); // Tier 0 (0-9), Tier 1 (10-19), Tier 2 (20+)
  };

  const drawStickman = (ctx: CanvasRenderingContext2D, unit: Unit) => {
    // Fog of War Check
    if (unit.faction === Faction.ENEMY && unit.x > engine.playerVisibleX) {
        return; 
    }

    const isPlayer = unit.faction === Faction.PLAYER;
    const tier = getUnitTier(unit.type, unit.faction);
    const color = isPlayer ? '#4ade80' : '#f87171';
    const height = unit.height;
    
    ctx.save();
    ctx.translate(unit.x, unit.y);
    
    // Rotation (For Death Animation)
    // If unit is dying, rotation is applied in Engine. 
    // We pivot around the feet (0,0) so they fall backward
    ctx.rotate(isPlayer ? -unit.rotation : unit.rotation);

    ctx.globalAlpha = unit.opacity;

    if (!isPlayer) {
        ctx.scale(-1, 1);
    }

    const isAttacking = unit.state === UnitState.ATTACK;
    const attackPhase = Math.sin(unit.animationFrame * 0.5); 
    const walkCycle = Math.sin(unit.animationFrame * 0.3) * 8;
    const legSwing = (unit.state === UnitState.MOVE || unit.state === UnitState.MINE_WALK_TO_MINE || unit.state === UnitState.MINE_RETURN) ? walkCycle : 0;

    // --- CAVALRY RENDER (COMPLETELY REDONE) ---
    if (unit.type === UnitType.CAVALRY) {
        // Colors
        const horseColor = tier === 0 ? '#78350f' : (tier === 1 ? '#57534e' : '#fefce8'); // Brown -> Grey -> White/Goldish
        const horseArmor = tier === 0 ? null : (tier === 1 ? '#94a3b8' : '#fbbf24'); // None -> Iron -> Gold
        
        // 1. Back Legs
        ctx.fillStyle = horseColor;
        ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-15 + legSwing, 0); ctx.lineTo(-10 + legSwing, 0); ctx.lineTo(-5, -20); ctx.fill();

        // 2. Horse Body
        ctx.beginPath(); ctx.ellipse(0, -30, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
        
        // Armor Blanket
        if (tier >= 1) {
             ctx.fillStyle = isPlayer ? '#1e40af' : '#991b1b';
             ctx.fillRect(-10, -35, 20, 10);
        }

        // 3. Front Legs
        ctx.fillStyle = horseColor;
        ctx.beginPath(); ctx.moveTo(10, -25); ctx.lineTo(15 - legSwing, 0); ctx.lineTo(20 - legSwing, 0); ctx.lineTo(15, -25); ctx.fill();

        // 4. Neck & Head
        ctx.save();
        ctx.translate(15, -35);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = horseColor;
        ctx.fillRect(0, -15, 12, 25); // Neck
        ctx.restore();

        ctx.save();
        ctx.translate(25, -50);
        ctx.fillStyle = horseColor;
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI*2); ctx.fill(); // Head
        
        // Horse Helmet
        if (horseArmor) {
            ctx.fillStyle = horseArmor;
            ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.fill();
        }
        ctx.restore();

        // 5. Rider (Stickman sitting)
        ctx.translate(-5, -20); // Sit offset
        // Adjust height for visual balance
    }

    // --- COMMON STICKMAN BODY ---
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (unit.type === UnitType.HERO) ctx.lineWidth = 3;

    // Legs (If not cavalry)
    if (unit.type !== UnitType.CAVALRY) {
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-5 + legSwing, 0); 
        ctx.moveTo(0, -15); ctx.lineTo(5 - legSwing, 0); ctx.stroke();
    } else {
        // Rider Leg
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, -5); ctx.stroke();
    }

    // Body
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, -height + 8); ctx.stroke();
    
    // Head
    ctx.beginPath(); ctx.arc(0, -height, 8, 0, Math.PI * 2); ctx.fill();

    // Cape (Tier 2 or Hero)
    if ((tier >= 2 || unit.type === UnitType.HERO) && unit.type !== UnitType.MINER) {
        ctx.save();
        ctx.fillStyle = isPlayer ? '#1d4ed8' : '#b91c1c'; // Blue or Red Cape
        ctx.beginPath();
        ctx.moveTo(-2, -height + 5);
        ctx.quadraticCurveTo(-15, -height + 15, -15 + (Math.sin(unit.animationFrame * 0.2) * 3), -5);
        ctx.lineTo(2, -height + 5);
        ctx.fill();
        ctx.restore();
    }

    // --- ARMS & WEAPONS ---
    let armAngle = Math.PI/6; 
    let shoulderY = -height + 15; 

    if (unit.type === UnitType.ARCHER) {
        shoulderY = -height + 6; 
        armAngle = Math.PI / 2; 
    } 
    else if (isAttacking) {
        if (unit.type === UnitType.SWORDMAN || unit.type === UnitType.HERO) {
            const phaseNormalized = (attackPhase + 1) / 2; 
            armAngle = -Math.PI * 0.8 + (phaseNormalized * Math.PI); 
        } else if (unit.type === UnitType.CAVALRY) {
             // Lancing motion
             armAngle = 0; 
        }
    }

    ctx.beginPath();
    ctx.moveTo(0, shoulderY);

    const handX = Math.sin(armAngle) * 15;
    const handY = Math.cos(armAngle) * 15;
    
    let thrustX = 0;
    if (unit.type === UnitType.CAVALRY && isAttacking) {
        thrustX = Math.abs(attackPhase) * 15;
    }

    ctx.lineTo(handX + thrustX, shoulderY + handY);
    ctx.stroke();

    const weaponX = handX + thrustX;
    const weaponY = shoulderY + handY;

    // --- WEAPON & GEAR RENDERING BASED ON TIER ---

    // 1. MINER
    if (unit.type === UnitType.MINER) {
        ctx.save(); ctx.translate(weaponX, weaponY);
        const chop = Math.abs(Math.sin(unit.animationFrame * 0.2));
        ctx.rotate(unit.state === UnitState.MINE_GATHERING ? -chop : 0);
        ctx.strokeStyle = '#9ca3af'; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -10); ctx.stroke(); 
        ctx.strokeStyle = tier > 0 ? '#3b82f6' : '#eab308'; // Diamond vs Gold
        ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(5, -8); ctx.stroke(); 
        
        // Helmet
        ctx.restore();
        ctx.fillStyle = tier > 0 ? '#3b82f6' : '#facc15'; ctx.beginPath(); ctx.arc(0, -height - 2, 9, Math.PI, 0); ctx.fill();
        // Light
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(4, -height - 2, 3, 0, Math.PI*2); ctx.fill();
    } 
    
    // 2. SWORDMAN & HERO
    else if (unit.type === UnitType.SWORDMAN || unit.type === UnitType.HERO) {
        // Shield
        ctx.save();
        ctx.translate(5, -height + 25);
        ctx.fillStyle = isPlayer ? '#1e293b' : '#450a0a'; // Dark faction color
        ctx.strokeStyle = tier >= 1 ? '#cbd5e1' : '#94a3b8'; // Iron rim
        if (tier >= 2 || unit.type === UnitType.HERO) ctx.strokeStyle = '#facc15'; // Gold rim
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (tier === 0) {
            // Round buckler
            ctx.arc(0, 0, 8, 0, Math.PI*2);
        } else {
            // Kite shield
            ctx.moveTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(6, 0); ctx.quadraticCurveTo(0, 12, -6, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Sword
        ctx.save(); 
        ctx.translate(weaponX, weaponY); 
        ctx.rotate(armAngle); 
        
        ctx.fillStyle = tier === 0 ? '#94a3b8' : (tier === 1 ? '#e2e8f0' : '#facc15'); // Stone -> Steel -> Gold
        if (unit.type === UnitType.HERO) ctx.fillStyle = '#facc15';

        const swordLen = (tier >= 2 || unit.type === UnitType.HERO) ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(-2, -5); ctx.lineTo(-2, -35 * swordLen); ctx.lineTo(0, -40 * swordLen); ctx.lineTo(2, -35 * swordLen); ctx.lineTo(2, -5);
        ctx.fill();
        
        // Hilt
        ctx.fillStyle = '#78350f'; 
        ctx.fillRect(-6, -5, 12, 3); 
        ctx.restore();

        // Helmet
        const helmColor = tier === 0 ? '#64748b' : (tier === 1 ? '#94a3b8' : '#facc15');
        ctx.fillStyle = helmColor;
        ctx.beginPath();
        if (tier === 0) {
            ctx.fillRect(-6, -height-4, 12, 4); // Cap
        } else {
            // Full Helm
            ctx.moveTo(-7, -height); ctx.lineTo(-7, -height-10); ctx.quadraticCurveTo(0, -height-14, 7, -height-10); ctx.lineTo(7, -height);
            ctx.fill();
        }
        
        // Plume (Tier 2/Hero)
        if (tier >= 2 || unit.type === UnitType.HERO) {
            ctx.fillStyle = isPlayer ? '#2563eb' : '#dc2626';
            ctx.beginPath(); ctx.moveTo(0, -height-14); ctx.quadraticCurveTo(8, -height-22, 12, -height-8); ctx.fill();
        }
    } 

    // 3. CAVALRY (Rider Equipment)
    else if (unit.type === UnitType.CAVALRY) {
        // Lance
        ctx.save(); ctx.translate(weaponX, weaponY);
        ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(40, -2); ctx.stroke(); 
        
        // Lance Tip & Flag
        ctx.strokeStyle = tier >= 2 ? '#facc15' : '#991b1b'; 
        ctx.beginPath(); ctx.moveTo(35, -2); ctx.lineTo(45, -2); ctx.stroke(); 
        
        if (tier >= 2) {
            ctx.fillStyle = isPlayer ? '#2563eb' : '#dc2626';
            ctx.beginPath(); ctx.moveTo(30, -2); ctx.lineTo(40, -8); ctx.lineTo(40, -2); ctx.fill();
        }
        ctx.restore();

        // Helmet (Visor style)
        ctx.fillStyle = tier === 0 ? '#64748b' : (tier === 1 ? '#cbd5e1' : '#facc15');
        ctx.beginPath(); ctx.moveTo(-6, -height); ctx.lineTo(6, -height); ctx.lineTo(8, -height-8); ctx.lineTo(-8, -height-8); ctx.fill();
    } 

    // 4. ARCHER
    else if (unit.type === UnitType.ARCHER) {
        ctx.save(); 
        ctx.translate(weaponX + 5, weaponY); 
        
        // Bow
        ctx.strokeStyle = tier >= 2 ? '#facc15' : '#a16207'; // Gold or Wood
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -15);
        ctx.quadraticCurveTo(-5, 0, 10, 15); // Curved Bow
        ctx.stroke();
        
        // String
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (isAttacking) {
             ctx.moveTo(10, -15); ctx.lineTo(-5, 0); ctx.lineTo(10, 15);
             // Arrow
             ctx.strokeStyle = '#000'; ctx.moveTo(-5, 0); ctx.lineTo(15, 0);
        } else {
             ctx.moveTo(10, -15); ctx.lineTo(10, 15);
        }
        ctx.stroke();
        ctx.restore();

        // Quiver
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-8, -height+5, 4, 15);

        // Hat
        if (tier >= 1) {
            // Hood
            ctx.fillStyle = '#166534';
            ctx.beginPath(); ctx.moveTo(0, -height-10); ctx.lineTo(10, -height+2); ctx.lineTo(-10, -height+2); ctx.fill();
        } else {
            // Simple cap
            ctx.fillStyle = '#3f6212'; ctx.fillRect(-6, -height - 2, 12, 2);
        }
    }

    // Health Bar (Small)
    if (unit.state !== UnitState.DIE) {
        if (unit.stats.hp < unit.stats.maxHp) {
            const hpPct = Math.max(0, unit.stats.hp / unit.stats.maxHp);
            ctx.fillStyle = 'red'; ctx.fillRect(-10, -height - 25, 20, 3);
            ctx.fillStyle = '#4ade80'; ctx.fillRect(-10, -height - 25, 20 * hpPct, 3);
        }
    }

    ctx.restore();
  };

  // ... (Keep drawCastle and drawFogOfWar same) ...
  const drawCastle = (ctx: CanvasRenderingContext2D, x: number, y: number, isPlayer: boolean) => {
      // Fog of War Check
      if (!isPlayer && x > engine.playerVisibleX + 50) { 
           return;
      }
      
      const stoneColor = isPlayer ? '#334155' : '#450a0a'; // Slate vs Dark Red
      const stoneLight = isPlayer ? '#475569' : '#7f1d1d';
      const stoneDark = isPlayer ? '#1e293b' : '#2a0404';
      const doorColor = '#451a03'; // Dark Wood
      const flagColor = isPlayer ? '#166534' : '#b91c1c';

      ctx.save();
      ctx.translate(x, y);
      if (!isPlayer) ctx.scale(-1, 1); 

      // --- MAIN FORTRESS BODY ---
      // Base Block
      ctx.fillStyle = stoneColor;
      ctx.fillRect(-80, -120, 140, 120);
      
      // Side depth (3D effect)
      ctx.fillStyle = stoneDark;
      ctx.beginPath();
      ctx.moveTo(-80, -120); ctx.lineTo(-95, -110); ctx.lineTo(-95, 0); ctx.lineTo(-80, 0);
      ctx.fill();

      // Top Battlements (The "teeth")
      ctx.fillStyle = stoneLight;
      ctx.fillRect(-85, -135, 150, 15);
      
      ctx.fillStyle = stoneDark;
      // Merlons (The raised parts)
      for (let i=0; i<5; i++) {
          ctx.fillRect(-80 + (i * 30), -150, 20, 15);
      }

      // --- TEXTURE DETAILS (BRICKS) ---
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for(let r=0; r<5; r++) {
          for(let c=0; c<4; c++) {
              if ((r+c)%2===0) ctx.fillRect(-70 + (c * 35), -100 + (r * 20), 25, 10);
          }
      }

      // --- GATE ---
      // Arch
      ctx.fillStyle = stoneDark;
      ctx.beginPath();
      ctx.arc(-10, 0, 45, Math.PI, 0);
      ctx.fill();
      
      // Door
      ctx.fillStyle = doorColor;
      ctx.beginPath();
      ctx.arc(-10, 0, 40, Math.PI, 0);
      ctx.fill();
      
      // Iron Bars
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for(let i=-40; i<=20; i+=15) {
          ctx.moveTo(i, 0); ctx.lineTo(i, -35);
      }
      ctx.stroke();

      // --- STACKED TOWER SYSTEM ---
      // Visual: Each tower upgrade adds a floor to the central keep
      const towers = isPlayer ? engine.playerTowers : engine.enemyTowers;
      const floorHeight = 40;
      const startY = -120; // Top of base castle

      if (towers > 0) {
          for (let i = 0; i < towers; i++) {
               const currentY = startY - (i * floorHeight);
               
               // Tower Floor Body
               ctx.fillStyle = stoneColor;
               ctx.fillRect(-50, currentY - floorHeight, 80, floorHeight);
               
               // Floor Texture
               ctx.strokeStyle = stoneDark;
               ctx.lineWidth = 1;
               ctx.strokeRect(-50, currentY - floorHeight, 80, floorHeight);

               // Window / Arrow Slit
               ctx.fillStyle = '#000';
               ctx.fillRect(-20, currentY - floorHeight + 10, 20, 20);

               // Roof / Overhang for this floor
               ctx.fillStyle = stoneLight;
               ctx.beginPath();
               ctx.moveTo(-60, currentY - floorHeight);
               ctx.lineTo(40, currentY - floorHeight);
               ctx.lineTo(-10, currentY - floorHeight - 15); // Peak
               ctx.fill();
          }

          // Flag on very top
          const topY = startY - (towers * floorHeight) - 15;
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-10, topY); ctx.lineTo(-10, topY - 30); ctx.stroke();
          
          ctx.fillStyle = flagColor;
          ctx.beginPath(); 
          ctx.moveTo(-10, topY - 30);
          ctx.lineTo(15, topY - 20);
          ctx.lineTo(-10, topY - 10);
          ctx.fill();
      }

      ctx.restore();
  };
  
  const drawFogOfWar = (ctx: CanvasRenderingContext2D) => {
      // Draw a black gradient/rect from playerVisibleX to end of world
      // This represents what the PLAYER cannot see
      if (engine.playerVisibleX < WORLD_WIDTH) {
          const fadeWidth = 200;
          const startFog = engine.playerVisibleX;
          
          const grad = ctx.createLinearGradient(startFog, 0, startFog + fadeWidth, 0);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)'); // Almost pitch black
          
          // Fade In Zone
          ctx.fillStyle = grad;
          ctx.fillRect(startFog, 0, fadeWidth, CANVAS_HEIGHT);
          
          // Solid Black Zone
          ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
          ctx.fillRect(startFog + fadeWidth, 0, WORLD_WIDTH - (startFog + fadeWidth), CANVAS_HEIGHT);
      }
  };


  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, CANVAS_HEIGHT);

    drawSkyElements(ctx);

    // --- SMOOTH MOUNTAINS ---
    ctx.fillStyle = theme.mountainColor;
    ctx.beginPath(); 
    ctx.moveTo(0, GROUND_Y);
    
    // Draw curves for mountains
    // Control points randomly adjusted for variety but deterministic enough for "static" look per render
    ctx.bezierCurveTo(300, 100, 500, 300, 800, GROUND_Y);
    ctx.bezierCurveTo(1100, 50, 1300, 400, 1600, GROUND_Y);
    ctx.bezierCurveTo(1900, 150, 2200, 300, 2400, GROUND_Y);
    ctx.bezierCurveTo(2600, 200, 2800, 350, WORLD_WIDTH, GROUND_Y);
    
    ctx.lineTo(WORLD_WIDTH, CANVAS_HEIGHT);
    ctx.lineTo(0, CANVAS_HEIGHT);
    ctx.fill();

    // --- BETTER GROUND ---
    ctx.fillStyle = theme.groundColor;
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    
    // Grass Texture
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for(let i=0; i<WORLD_WIDTH; i+=20) {
        if(i % 60 === 0) ctx.fillRect(i, GROUND_Y, 2, 5); // Tall grass
        else ctx.fillRect(i, GROUND_Y, 2, 2); // Short grass
    }

    drawEnvironment(ctx);
    drawHazards(ctx); 

    drawCastle(ctx, PLAYER_BASE_X, GROUND_Y, true);
    drawCastle(ctx, ENEMY_BASE_X, GROUND_Y, false);

    const drawMine = (x: number, faction: Faction) => {
        // Fog Check
        if (faction === Faction.ENEMY && x > engine.playerVisibleX) return;

        ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(x, GROUND_Y, 25, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x - 10, GROUND_Y - 10, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5, GROUND_Y - 15, 4, 0, Math.PI*2); ctx.fill();
    };

    drawMine(PLAYER_BASE_X + MINING_DISTANCE, Faction.PLAYER);
    drawMine(ENEMY_BASE_X - MINING_DISTANCE, Faction.ENEMY);

    // Rally Point Flag (Blue)
    if (engine.rallyPoint !== null) {
        drawFlag(ctx, engine.rallyPoint, false);
    }
    
    // Patrol Point Flag (Red)
    if (engine.patrolPoint !== null) {
        drawFlag(ctx, engine.patrolPoint, true);
    }

    const pPct = Math.max(0, engine.playerBaseHp / engine.playerMaxBaseHp);
    const ePct = Math.max(0, engine.enemyBaseHp / engine.enemyMaxBaseHp);
    
    // Health Bars (Always visible for Player, check Fog for Enemy)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(PLAYER_BASE_X - 50, GROUND_Y - 180, 100, 10);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(PLAYER_BASE_X - 50, GROUND_Y - 180, 100 * pPct, 10);
    
    if (ENEMY_BASE_X < engine.playerVisibleX + 200) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ENEMY_BASE_X - 50, GROUND_Y - 180, 100, 10);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(ENEMY_BASE_X - 50, GROUND_Y - 180, 100 * ePct, 10);
    }
  };

  const drawProjectiles = (ctx: CanvasRenderingContext2D) => {
      engine.projectiles.forEach(p => {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          
          if (p.type === 'ARROW') {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(14, 0); ctx.lineTo(10, 2); ctx.fill(); 
            ctx.fillStyle = '#fca5a5'; ctx.fillRect(-12, -2, 3, 4); 
          } 
          else if (p.type === 'TOWER_SHOT') {
              ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
          }
          else if (p.type === 'LIGHTNING_BOLT') {
              ctx.strokeStyle = '#ffff00';
              ctx.lineWidth = 3;
              ctx.shadowColor = '#ffff00';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.moveTo(0, -400); // Sky
              ctx.lineTo(0, 0); // Ground
              ctx.stroke();
              ctx.shadowBlur = 0;
          }

          ctx.restore();
      });
      
      // Draw Storm Effect
      if (engine.skillActiveTimers.LIGHTNING > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(50, 50, 0, ${0.1 + Math.random() * 0.1})`;
          ctx.fillRect(0, 0, WORLD_WIDTH, CANVAS_HEIGHT); // Darken sky
          ctx.restore();
      }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
      engine.particles.forEach(p => {
          ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      });
  };
  
  const drawFireworks = (ctx: CanvasRenderingContext2D) => {
      engine.fireworks.forEach(fw => {
          if (!fw.exploded) {
              // Draw rising trail?
          } else {
              fw.particles.forEach(p => {
                  ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
                  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                  ctx.globalAlpha = 1;
              });
          }
      });
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
      if (engine.screenShake > 0) {
          shakeX = (Math.random() - 0.5) * engine.screenShake;
          shakeY = (Math.random() - 0.5) * engine.screenShake;
      }
      
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.translate(-cameraX + shakeX, shakeY);

      drawBackground(ctx);
      
      const sortedUnits = [...engine.units].sort((a,b) => {
          if (a.state === UnitState.DIE && b.state !== UnitState.DIE) return -1;
          if (a.state !== UnitState.DIE && b.state === UnitState.DIE) return 1;
          return a.y - b.y;
      });

      sortedUnits.forEach(unit => drawStickman(ctx, unit));
      drawProjectiles(ctx);
      drawParticles(ctx);
      drawFireworks(ctx);
      
      // Fog of War (Draw last to cover everything)
      drawFogOfWar(ctx);

      // Skill Reticles (World Coordinates)
      if (targetingSkill === 'ARROW_RAIN') {
        ctx.strokeStyle = '#fbbf24'; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(hoverX, GROUND_Y, 150, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.2)'; ctx.fill(); ctx.setLineDash([]);
      }
      if (targetingSkill === 'LIGHTNING') {
        ctx.strokeStyle = '#ffff00'; ctx.setLineDash([2, 8]);
        ctx.beginPath(); ctx.arc(hoverX, GROUND_Y, 150, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'; ctx.fill(); ctx.setLineDash([]);
      }
      if (targetingSkill === 'FREEZE') {
        ctx.strokeStyle = '#3b82f6'; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(hoverX, GROUND_Y, 200, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; ctx.fill(); ctx.setLineDash([]);
      }
      
      // Patrol Flag Reticle
      if (targetingSkill === 'SET_PATROL') {
          drawFlag(ctx, hoverX, true); // Ghost red flag
      }
      
      ctx.restore(); 

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [engine, targetingSkill, hoverX, theme, cameraX]);

  // --- CAMERA INPUT HANDLING ---

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    setLastMouseX(clientX);
  };

  const handleMove = (clientX: number, rect: DOMRect) => {
    // Correct mouse position for the wider aspect ratio
    const scaleX = CANVAS_WIDTH / rect.width;
    const mouseCanvasX = (clientX - rect.left) * scaleX;
    setHoverX(mouseCanvasX + cameraX);

    if (isDragging) {
        const delta = (clientX - lastMouseX) * scaleX;
        setCameraX(prev => {
            const next = prev - delta;
            return Math.max(0, Math.min(next, WORLD_WIDTH - CANVAS_WIDTH));
        });
        setLastMouseX(clientX);
    }
  };

  const handleEnd = (clientX: number, clientY: number, rect: DOMRect) => {
    setIsDragging(false);
    
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const mouseCanvasX = (clientX - rect.left) * scaleX;
    const mouseCanvasY = (clientY - rect.top) * scaleY;
    const clickX = mouseCanvasX + cameraX;
    
    // Skill usage logic
    if (targetingSkill === 'ARROW_RAIN') {
        engine.useSkillArrowRain(clickX);
        onSkillUsed();
    } else if (targetingSkill === 'LIGHTNING') {
        engine.useSkillLightning(clickX);
        onSkillUsed();
    } else if (targetingSkill === 'FREEZE') {
        engine.useSkillFreeze(clickX);
        onSkillUsed();
    } else if (targetingSkill === 'SET_PATROL') {
        engine.setPatrolPoint(clickX);
        onSkillUsed();
    } else {
        if (mouseCanvasY > 350) {
            engine.setRallyPoint(clickX);
        }
    }
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if(rect) handleMove(e.clientX, rect);
  };
  const handleMouseUp = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if(rect) handleEnd(e.clientX, e.clientY, rect);
  };
  const handleMouseLeave = () => setIsDragging(false);

  // Touch Handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if(rect) handleMove(e.touches[0].clientX, rect);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if(rect && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          handleEnd(t.clientX, t.clientY, rect);
      }
  };

  return (
    <div className="relative group overflow-hidden touch-none w-full flex justify-center">
        <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`w-full border-4 border-slate-700 shadow-2xl bg-black ${targetingSkill ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        />
        <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded pointer-events-none">
            {theme.nameVn} - Tap Ground to Flag / Drag Sky to Scroll
        </div>
    </div>
  );
};

export default GameCanvas;
