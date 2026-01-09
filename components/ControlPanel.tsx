
import React from 'react';
import { UnitType, UnitStats, SpawnQueueItem, Language } from '../types';
import { UNIT_CONFIG, MAX_POPULATION, MAX_HEROES, SKILL_COOLDOWNS_FRAMES, TRANS, POP_UPGRADE_COST, MAX_POP_UPGRADES, PASSIVE_GOLD_UPGRADE_COST, MAX_PASSIVE_GOLD_LEVEL, MAX_TOWERS, TOWER_COST_BASE, TOWER_COST_INC } from '../constants';

interface ControlPanelProps {
  gold: number;
  population: number;
  heroPopulation: number;
  maxPopulation: number;
  unitCounts: {
      miner: number;
      sword: number;
      archer: number;
      cav: number;
      hero: number;
  };
  spawnQueue: SpawnQueueItem[];
  onBuyUnit: (type: UnitType) => void;
  onDismissUnit: (type: UnitType) => void;
  onUseSkill: (skill: string) => void;
  activeSkill: string | null;
  rallyPointSet: boolean;
  patrolPointSet: boolean;
  vanguardPointSet: boolean; 
  vanguardPercentage: number; 
  onSetVanguardPct: (pct: number) => void; 
  onSetStrategy: (strategy: 'CHARGE' | 'DEFEND' | 'PATROL' | 'VANGUARD') => void; 
  onBuyPopUpgrade: () => void;
  onBuyPassiveGoldUpgrade: () => void;
  onBuyTower: () => void; 
  towerCount: number; 
  passiveGoldLevel: number;
  cooldowns: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number };
  activeTimers: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number };
  maxDurations: { ARROW_RAIN: number; LIGHTNING: number; FREEZE: number };
  lang: Language;
}

const UNIT_LABELS: Record<UnitType, string> = {
  [UnitType.MINER]: 'miner',
  [UnitType.SWORDMAN]: 'sword',
  [UnitType.ARCHER]: 'archer',
  [UnitType.CAVALRY]: 'cav',
  [UnitType.HERO]: 'hero'
};

const UNIT_ICONS: Record<UnitType, string> = {
    [UnitType.MINER]: '⛏️',
    [UnitType.SWORDMAN]: '⚔️',
    [UnitType.ARCHER]: '🏹',
    [UnitType.CAVALRY]: '🏇',
    [UnitType.HERO]: '🦸'
};

const UnitButton: React.FC<{ 
    type: UnitType; 
    config: UnitStats; 
    gold: number; 
    popFull: boolean; 
    heroFull: boolean; 
    lang: Language; 
    onClick: () => void;
    onDismiss: () => void;
    unitCount: number;
}> = ({ type, config, gold, popFull, heroFull, lang, onClick, onDismiss, unitCount }) => {
  const isHero = type === UnitType.HERO;
  const isFull = isHero ? heroFull : popFull;
  const canAfford = gold >= config.cost;
  const disabled = !canAfford || isFull;
  const t = TRANS[lang];
  
  return (
    <div className="relative">
        <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center p-1 rounded border transition-all w-16 h-16 md:w-20 md:h-20
            ${!disabled
            ? 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:scale-105 text-white' 
            : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'}`}
        >
        <div className="text-xl mb-1">{UNIT_ICONS[type]}</div>
        <div className="font-bold text-[10px] whitespace-nowrap hidden md:block">{t[UNIT_LABELS[type] as keyof typeof t]}</div>
        <div className="text-yellow-400 font-mono text-xs">{config.cost}G</div>
        {isFull && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-red-500 font-bold text-xs rotate-45 uppercase">Full</div>}
        </button>
        
        {/* Unit Count Badge (Top Left) */}
        <div className="absolute -top-2 -left-2 min-w-[20px] h-5 bg-green-600 text-white text-[10px] font-bold rounded flex items-center justify-center border border-white shadow-sm z-10 px-1">
            {unitCount}
        </div>

        {/* Dismiss Button (Moved to Bottom Left) */}
        {unitCount > 0 && (
            <button 
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="absolute -bottom-2 -left-2 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full text-white text-[10px] font-bold border border-white flex items-center justify-center shadow-lg z-20"
                title="Dismiss Unit (-1)"
            >
                -1
            </button>
        )}
    </div>
  );
};

const SkillButton: React.FC<{ 
    icon: string; 
    label: string; 
    active: boolean; 
    cooldown: number; 
    maxCooldown: number; 
    activeTimer: number; 
    maxDuration: number;
    onClick: () => void 
}> = ({ icon, label, active, cooldown, maxCooldown, activeTimer, maxDuration, onClick }) => {
    const onCooldown = cooldown > 0;
    const cooldownPct = onCooldown ? (cooldown / maxCooldown) * 100 : 0;
    const isActive = activeTimer > 0;
    const activePct = isActive ? (activeTimer / maxDuration) * 100 : 0;

    return (
        <div className="flex flex-col items-center gap-1">
            <button
            onClick={onClick}
            disabled={onCooldown}
            className={`flex flex-col items-center justify-center p-1 rounded border transition-all relative overflow-hidden w-16 h-16 md:w-20 md:h-20
                ${active 
                    ? 'bg-yellow-600 border-yellow-400 text-white animate-pulse'
                    : onCooldown
                        ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-900 border-indigo-700 hover:bg-indigo-800 text-cyan-200'}`}
            >
                <div className="text-2xl z-10">{icon}</div>
                <div className="font-bold text-center text-[10px] z-10 hidden md:block">{label}</div>
                {onCooldown && (
                    <>
                    <div className="absolute inset-0 bg-black/50 z-0" />
                    <div 
                        className="absolute bottom-0 left-0 right-0 bg-blue-500/30 transition-all duration-100 ease-linear z-0" 
                        style={{ height: `${cooldownPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white z-20 text-xs">
                        {Math.ceil(cooldown / 60)}s
                    </div>
                    </>
                )}
            </button>
            <div className="w-16 md:w-20 h-3 bg-slate-900 rounded-full border border-slate-700 overflow-hidden relative">
                {isActive && (
                    <>
                        <div 
                            className="absolute top-0 left-0 bottom-0 bg-green-500 transition-all duration-75 ease-linear"
                            style={{ width: `${activePct}%` }}
                        />
                         <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white z-10 leading-none">
                            {(activeTimer / 60).toFixed(1)}s
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const ControlPanel: React.FC<ControlPanelProps> = ({ gold, population, maxPopulation, heroPopulation, unitCounts, spawnQueue, onBuyUnit, onDismissUnit, onUseSkill, activeSkill, rallyPointSet, patrolPointSet, vanguardPointSet, vanguardPercentage, onSetVanguardPct, onSetStrategy, onBuyPopUpgrade, onBuyPassiveGoldUpgrade, onBuyTower, towerCount, passiveGoldLevel, cooldowns, activeTimers, maxDurations, lang }) => {
  const isPopFull = population >= maxPopulation;
  const isHeroFull = heroPopulation >= MAX_HEROES;
  const maxPopReached = maxPopulation >= (MAX_POPULATION + MAX_POP_UPGRADES);
  
  const currentIncome = 1 + (passiveGoldLevel * 2);
  const isPassiveGoldMax = passiveGoldLevel >= MAX_PASSIVE_GOLD_LEVEL; 
  
  const towerCost = TOWER_COST_BASE + (towerCount * TOWER_COST_INC);
  const isTowerMax = towerCount >= MAX_TOWERS;

  const t = TRANS[lang];

  return (
    <div className="mt-2 w-full max-w-6xl flex flex-col gap-2">
      <div className="flex flex-col md:flex-row gap-2">
          {/* Unit Production */}
          <div className="bg-slate-800 p-2 rounded shadow border border-slate-600 flex-1">
            <div className="flex justify-between items-center mb-1">
                <h3 className="text-slate-300 font-bold uppercase text-xs tracking-wider">{t.recruit}</h3>
                <div className="flex flex-col items-end">
                    <div className="flex gap-2 items-center">
                         {/* Population Upgrade */}
                         <span className={`text-xs font-mono font-bold ${isPopFull ? 'text-red-500' : 'text-green-400'}`}>
                            {t.pop}: {population}/{maxPopulation} 
                        </span>
                        {!maxPopReached && (
                             <button 
                                onClick={onBuyPopUpgrade}
                                disabled={gold < POP_UPGRADE_COST}
                                className={`text-[10px] px-1 rounded border ml-1 ${gold >= POP_UPGRADE_COST ? 'bg-green-600 text-white border-green-400' : 'bg-slate-700 text-slate-500 border-slate-600'}`}
                                title={`${t.buyPop} (${POP_UPGRADE_COST}G)`}
                             >
                                +1 ({POP_UPGRADE_COST}G)
                             </button>
                        )}

                        {/* Passive Gold Upgrade */}
                        <span className="text-xs font-mono font-bold text-yellow-400 ml-2">
                            {t.income}: {currentIncome}G/s
                        </span>
                        {!isPassiveGoldMax ? (
                            <button
                                onClick={onBuyPassiveGoldUpgrade}
                                disabled={gold < PASSIVE_GOLD_UPGRADE_COST}
                                className={`text-[10px] px-1 rounded border ml-1 ${gold >= PASSIVE_GOLD_UPGRADE_COST ? 'bg-yellow-600 text-white border-yellow-400' : 'bg-slate-700 text-slate-500 border-slate-600'}`}
                                title={`Upgrade Income (${PASSIVE_GOLD_UPGRADE_COST}G) - Adds +2G/s`}
                            >
                                +2 ({PASSIVE_GOLD_UPGRADE_COST}G)
                            </button>
                        ) : (
                            <span className="text-[10px] px-1 ml-1 font-bold text-red-500 border border-red-500 rounded bg-red-900/20">
                                LIMITED
                            </span>
                        )}
                        
                        <span className={`text-xs font-mono font-bold ${isHeroFull ? 'text-red-500' : 'text-purple-400'} ml-2`}>
                            {t.heroPop}: {heroPopulation}/{MAX_HEROES}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex gap-1 justify-center md:justify-start pt-2">
              {Object.values(UnitType).map((type) => (
                <UnitButton 
                  key={type} 
                  type={type} 
                  config={UNIT_CONFIG[type]} 
                  gold={gold} 
                  popFull={isPopFull}
                  heroFull={isHeroFull}
                  lang={lang}
                  onClick={() => onBuyUnit(type)}
                  onDismiss={() => onDismissUnit(type)}
                  unitCount={unitCounts[type === UnitType.SWORDMAN ? 'sword' : type === UnitType.CAVALRY ? 'cav' : type.toLowerCase() as keyof typeof unitCounts] || 0}
                />
              ))}
              
              {/* TOWER BUTTON */}
              <div className="relative border-l border-slate-600 pl-1 ml-1">
                  <button
                    onClick={onBuyTower}
                    disabled={isTowerMax || gold < towerCost}
                    className={`flex flex-col items-center justify-center p-1 rounded border transition-all w-16 h-16 md:w-20 md:h-20
                        ${!isTowerMax && gold >= towerCost
                        ? 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:scale-105 text-white' 
                        : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                    <div className="text-xl mb-1">🏯</div>
                    <div className="font-bold text-[10px] whitespace-nowrap hidden md:block">{t.tower}</div>
                    <div className="text-yellow-400 font-mono text-xs">{isTowerMax ? 'MAX' : `${towerCost}G`}</div>
                    {isTowerMax && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-red-500 font-bold text-xs rotate-45 uppercase">Full</div>}
                  </button>
                  <div className="absolute -top-2 -left-1 min-w-[20px] h-5 bg-blue-600 text-white text-[10px] font-bold rounded flex items-center justify-center border border-white shadow-sm z-10 px-1">
                    {towerCount}/{MAX_TOWERS}
                  </div>
              </div>
            </div>
            
            {/* Spawn Queue Display */}
            <div className="mt-2 h-8 bg-slate-900 rounded flex items-center px-2 gap-2 overflow-hidden border border-slate-700">
                {spawnQueue.length === 0 && <span className="text-xs text-slate-600 italic">Queue empty</span>}
                {spawnQueue.map((item, idx) => {
                     const pct = idx === 0 ? ((item.totalTime - item.remainingTime) / item.totalTime) * 100 : 0;
                     return (
                         <div key={item.id} className="relative w-6 h-6 bg-slate-700 rounded flex items-center justify-center border border-slate-600" title="Training...">
                             <span className="text-xs">{UNIT_ICONS[item.type]}</span>
                             {idx === 0 && (
                                 <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-75" style={{width: `${pct}%`}}></div>
                             )}
                         </div>
                     )
                })}
            </div>
          </div>

          <div className="flex flex-row gap-2 w-full md:w-auto justify-between md:justify-start">
              {/* Strategy Control */}
              <div className="bg-slate-800 p-2 rounded shadow border border-slate-600 flex-1 md:flex-none">
                 <h3 className="text-slate-300 font-bold mb-1 uppercase text-xs tracking-wider">{t.tactics}</h3>
                 <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full w-full md:w-48">
                     
                     {/* 1. CHARGE (Attacks & CLEARS Flag) */}
                     <button
                        onClick={() => onSetStrategy('CHARGE')}
                        className={`py-1 px-1 text-sm rounded border font-bold transition-all
                            ${!rallyPointSet && !vanguardPointSet && activeSkill !== 'SET_PATROL'
                                ? 'bg-red-600 border-red-400 text-white shadow-red-900/50 shadow' 
                                : 'bg-slate-700 border-slate-500 text-slate-300 hover:bg-slate-600'}`}
                     >
                         <div className="text-sm">⚔️ {t.charge}</div>
                     </button>
                     
                     {/* 2. PATROL */}
                     <button
                        onClick={() => onSetStrategy('PATROL')}
                        className={`py-1 px-1 text-sm rounded border font-bold transition-all
                            ${patrolPointSet || activeSkill === 'SET_PATROL'
                                ? 'bg-orange-600 border-orange-400 text-white shadow-orange-900/50 shadow' 
                                : 'bg-slate-700 border-slate-500 text-slate-300 hover:bg-slate-600'}`}
                     >
                         <div className="text-sm">🚩 {t.patrol}</div>
                     </button>

                     {/* 3. VANGUARD / PRESSURE CONTROL */}
                     <div className={`col-span-2 rounded border flex flex-col items-center justify-center p-0.5 transition-all relative overflow-hidden
                         ${vanguardPercentage > 0 
                            ? 'bg-green-700 border-green-500 shadow-green-900/50 shadow' 
                            : 'bg-slate-700 border-slate-500'}`}
                     >
                         <div className="text-[8px] font-bold text-slate-200 uppercase tracking-tight mb-0.5">PRESSURE</div>
                         <div className="flex items-center justify-between w-full px-1">
                             <button 
                                onClick={() => onSetVanguardPct(Math.max(0, vanguardPercentage - 0.1))}
                                className="w-5 h-5 bg-black/30 hover:bg-black/50 rounded flex items-center justify-center text-xs text-white"
                             >
                                 -
                             </button>
                             <span className="font-mono text-sm font-bold text-white w-8 text-center">
                                 {Math.round(vanguardPercentage * 100)}%
                             </span>
                             <button 
                                onClick={() => onSetVanguardPct(Math.min(0.5, vanguardPercentage + 0.1))}
                                className="w-5 h-5 bg-black/30 hover:bg-black/50 rounded flex items-center justify-center text-xs text-white"
                             >
                                 +
                             </button>
                         </div>
                         {/* Visual bar at bottom */}
                         <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                             <div className="h-full bg-green-400 transition-all" style={{width: `${vanguardPercentage * 200}%`}}></div>
                         </div>
                     </div>

                 </div>
              </div>

              {/* Skills */}
              <div className="bg-slate-800 p-2 rounded shadow border border-slate-600">
                <h3 className="text-slate-300 font-bold mb-1 uppercase text-xs tracking-wider">{t.skills}</h3>
                <div className="flex gap-1 justify-center md:justify-start items-start">
                    <SkillButton 
                        icon="🌧️"
                        label={t.skillRain}
                        active={activeSkill === 'ARROW_RAIN'} 
                        cooldown={cooldowns.ARROW_RAIN}
                        maxCooldown={SKILL_COOLDOWNS_FRAMES.ARROW_RAIN}
                        activeTimer={activeTimers.ARROW_RAIN}
                        maxDuration={maxDurations.ARROW_RAIN}
                        onClick={() => onUseSkill('ARROW_RAIN')} 
                    />
                    <SkillButton 
                        icon="⚡"
                        label={t.skillBolt}
                        active={activeSkill === 'LIGHTNING'} 
                        cooldown={cooldowns.LIGHTNING}
                        maxCooldown={SKILL_COOLDOWNS_FRAMES.LIGHTNING}
                        activeTimer={activeTimers.LIGHTNING}
                        maxDuration={maxDurations.LIGHTNING}
                        onClick={() => onUseSkill('LIGHTNING')} 
                    />
                    <SkillButton 
                        icon="❄️"
                        label={t.skillFreeze}
                        active={activeSkill === 'FREEZE'} 
                        cooldown={cooldowns.FREEZE}
                        maxCooldown={SKILL_COOLDOWNS_FRAMES.FREEZE}
                        activeTimer={activeTimers.FREEZE}
                        maxDuration={maxDurations.FREEZE}
                        onClick={() => onUseSkill('FREEZE')} 
                    />
                </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ControlPanel;
