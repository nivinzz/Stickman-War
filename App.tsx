
import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import ControlPanel from './components/ControlPanel';
import UpgradeMenu from './components/UpgradeMenu';
import { GameEngine } from './services/GameEngine';
import { UnitType, UpgradeState, GameLevel, Faction, UnitState, SpawnQueueItem, Language } from './types';
import { INITIAL_GOLD, TRANS, MAX_HEROES, LEVEL_THEMES, MAX_LEVEL, MAX_POPULATION, POP_UPGRADE_COST, MAX_POP_UPGRADES, PASSIVE_GOLD_UPGRADE_COST, MAX_PASSIVE_GOLD_LEVEL, MAX_TOWERS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'MENU' | 'LEVEL_SELECT' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>('MENU');
  
  // --- ROBUST SAVE SYSTEM (LAZY INIT) ---
  // Read LocalStorage IMMEDIATELY upon state creation to prevent overwrite bugs
  
  const [maxReachedLevel, setMaxReachedLevel] = useState<number>(() => {
      try {
          const saved = localStorage.getItem('stickman_max_level');
          return saved ? parseInt(saved, 10) : 1;
      } catch (e) { return 1; }
  });

  const [levelRecords, setLevelRecords] = useState<Record<number, number>>(() => {
      try {
          const saved = localStorage.getItem('stickman_level_records');
          return saved ? JSON.parse(saved) : {};
      } catch (e) { return {}; }
  });

  const [upgrades, setUpgrades] = useState<UpgradeState>(() => {
      const defaultUpgrades: UpgradeState = { 
        baseHp: 0, swordDamage: 0, archerDamage: 0, cavalryDamage: 0, spawnSpeed: 0,
        arrowRainPower: 0, lightningPower: 0, freezePower: 0, heroPower: 0,
        minerSpeed: 0, maxPopUpgrade: 0, passiveGold: 0, towerPower: 0
      };
      try {
          const saved = localStorage.getItem('stickman_upgrades');
          if (saved) {
              return { ...defaultUpgrades, ...JSON.parse(saved) };
          }
          return defaultUpgrades;
      } catch (e) { return defaultUpgrades; }
  });

  const [level, setLevel] = useState<number>(1);
  const [lang, setLang] = useState<Language>('VN');
  const [engine, setEngine] = useState<GameEngine | null>(null);
  
  // React state mirrors for UI
  const [gold, setGold] = useState(INITIAL_GOLD);
  const [population, setPopulation] = useState(0);
  const [maxPopulation, setMaxPopulation] = useState(MAX_POPULATION);
  const [heroPopulation, setHeroPopulation] = useState(0);
  const [unitCounts, setUnitCounts] = useState({ miner: 0, sword: 0, archer: 0, cav: 0, hero: 0 });
  const [towerCount, setTowerCount] = useState(0);
  
  const [spawnQueue, setSpawnQueue] = useState<SpawnQueueItem[]>([]);
  
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [rallyPointSet, setRallyPointSet] = useState(false);
  const [patrolPointSet, setPatrolPointSet] = useState(false); // New State
  
  const [cooldowns, setCooldowns] = useState({ ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 });
  const [activeTimers, setActiveTimers] = useState({ ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 });
  const [maxDurations, setMaxDurations] = useState({ ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 });
  const [timeElapsed, setTimeElapsed] = useState(0); // For UI display

  const [paused, setPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const saveProgress = (newMaxLevel: number, currentUpgrades: UpgradeState, records: Record<number, number>) => {
      localStorage.setItem('stickman_max_level', newMaxLevel.toString());
      localStorage.setItem('stickman_level_records', JSON.stringify(records));
      saveUpgradesOnly(currentUpgrades);
  };

  const saveUpgradesOnly = (currentUpgrades: UpgradeState) => {
      // Do not save session-based upgrades (MaxPop and PassiveGold)
      // This ensures we only keep PERMANENT upgrades in the save file
      const storageUpgrades = {
          ...currentUpgrades,
          maxPopUpgrade: 0,
          passiveGold: 0
      };
      localStorage.setItem('stickman_upgrades', JSON.stringify(storageUpgrades));
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync engine state to React
  const syncState = (eng: GameEngine) => {
      setGold(Math.floor(eng.gold));
      
      const activeUnits = eng.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
      
      const miners = activeUnits.filter(u => u.type === UnitType.MINER).length;
      const heroes = activeUnits.filter(u => u.type === UnitType.HERO).length;
      const sword = activeUnits.filter(u => u.type === UnitType.SWORDMAN).length;
      const archer = activeUnits.filter(u => u.type === UnitType.ARCHER).length;
      const cav = activeUnits.filter(u => u.type === UnitType.CAVALRY).length;
      
      const normalArmy = sword + archer + cav;
      
      const queuedHeroes = eng.playerQueue.filter(q => q.type === UnitType.HERO).length;
      const queuedNormals = eng.playerQueue.length - queuedHeroes;
      
      setUnitCounts({ miner: miners, sword, archer, cav, hero: heroes });
      setPopulation(miners + normalArmy + queuedNormals);
      setHeroPopulation(heroes + queuedHeroes);
      setTowerCount(eng.playerTowers);
      
      // Update max population display based on current engine state (which mirrors upgrades)
      setMaxPopulation(MAX_POPULATION + eng.upgrades.maxPopUpgrade);

      setSpawnQueue([...eng.playerQueue]); 

      setRallyPointSet(eng.rallyPoint !== null);
      setPatrolPointSet(eng.patrolPoint !== null); // Sync patrol
      setCooldowns({...eng.skillCooldowns});
      setActiveTimers({...eng.skillActiveTimers});
      setMaxDurations({...eng.skillMaxDurations});

      const currentSeconds = Math.floor(eng.levelTimer / 60);
      setTimeElapsed(currentSeconds);

      setPaused(eng.paused);
      setGameStarted(eng.started);

      if (eng.victory) {
          setGameState('VICTORY');
          
          // Update Record
          let newRecords = { ...levelRecords };
          if (!newRecords[level] || currentSeconds < newRecords[level]) {
              newRecords[level] = currentSeconds;
              setLevelRecords(newRecords);
          }

          if (level >= maxReachedLevel) {
              const next = Math.min(MAX_LEVEL, level + 1);
              setMaxReachedLevel(next);
              // CRITICAL FIX: Use eng.upgrades instead of upgrades state to ensure we save the latest data
              saveProgress(next, eng.upgrades, newRecords);
          } else {
              // Just save records/upgrades if replaying old levels
              localStorage.setItem('stickman_level_records', JSON.stringify(newRecords));
              // CRITICAL FIX: Use eng.upgrades
              saveUpgradesOnly(eng.upgrades);
          }
      }
      if (eng.gameOver) setGameState('DEFEAT');
  };

  const startGame = (lvl: number) => {
    // RESET UI STATES TO AVOID HANGS
    setPaused(false);
    setGameStarted(false); 
    setGameState('PLAYING');
    setTimeElapsed(0);
    
    const isBoss = lvl % 10 === 0;
    const gameLevel: GameLevel = {
      level: lvl,
      enemySpawnRate: Math.max(30, 200 - (lvl * 10)), 
      enemyStatMultiplier: 1 + (lvl * 0.15),
      enemySmartAI: lvl > 3,
      enemyGoldDrip: lvl * 2,
      isBoss
    };

    // Reset session-based upgrades (Pop Limit & Income) for the new match
    // BUT keep permanent upgrades
    const sessionUpgrades: UpgradeState = {
        ...upgrades,
        maxPopUpgrade: 0,
        passiveGold: 0
    };
    setUpgrades(sessionUpgrades);

    // Pass reset upgrades to engine
    const newEngine = new GameEngine(gameLevel, sessionUpgrades, syncState);
    newEngine.gold = INITIAL_GOLD; 
    setEngine(newEngine);
    
    setGold(INITIAL_GOLD);
    setPopulation(0);
    setHeroPopulation(0);
    setActiveSkill(null);
    setRallyPointSet(false);
    setPatrolPointSet(false);
    setTowerCount(0);
  };

  const handleBuyUnit = (type: UnitType) => {
    if (engine) engine.queueUnit(type, Faction.PLAYER);
  };

  const handleDismissUnit = (type: UnitType) => {
      if (engine) engine.dismissUnit(type);
  };

  const handleUpgrade = (type: keyof UpgradeState, cost: number) => {
    if (engine && engine.gold >= cost) {
      engine.gold -= cost;
      setUpgrades(prev => {
          const next = { ...prev, [type]: prev[type] + 1 };
          if (engine) engine.upgrades = next; 
          
          if (type === 'baseHp' && engine) {
              const oldMax = engine.playerMaxBaseHp;
              engine.playerMaxBaseHp = 2000 * (1 + (next.baseHp * 0.1));
              engine.playerBaseHp += (engine.playerMaxBaseHp - oldMax);
          }
          
          saveUpgradesOnly(next);
          return next;
      });
      if (engine) syncState(engine);
    }
  };

  const handleBuyPopUpgrade = () => {
      if (engine && engine.gold >= POP_UPGRADE_COST && upgrades.maxPopUpgrade < MAX_POP_UPGRADES) {
          engine.gold -= POP_UPGRADE_COST;
          setUpgrades(prev => {
             const next = { ...prev, maxPopUpgrade: prev.maxPopUpgrade + 1 };
             engine.upgrades = next;
             // Don't save permanent pop upgrades here, they are session based
             return next;
          });
          syncState(engine);
      }
  };

  const handleBuyPassiveGoldUpgrade = () => {
      if (engine && engine.gold >= PASSIVE_GOLD_UPGRADE_COST && (upgrades.passiveGold || 0) < MAX_PASSIVE_GOLD_LEVEL) { 
          engine.gold -= PASSIVE_GOLD_UPGRADE_COST;
          setUpgrades(prev => {
              const next = { ...prev, passiveGold: (prev.passiveGold || 0) + 1 };
              engine.upgrades = next;
              // Session based, don't save to LS
              return next;
          });
          syncState(engine);
      }
  };
  
  const handleBuyTower = () => {
      if (engine) {
          engine.buyTower(Faction.PLAYER);
      }
  };

  const handleSetStrategy = (strategy: 'CHARGE' | 'DEFEND' | 'PATROL') => {
      if (!engine) return;
      if (strategy === 'CHARGE') {
          engine.clearRallyPoint();
          setActiveSkill(null); 
      } else if (strategy === 'DEFEND') {
          setActiveSkill('SET_RALLY'); 
      } else if (strategy === 'PATROL') {
          if (activeSkill === 'SET_PATROL') {
              setActiveSkill(null); 
          } else if (patrolPointSet) {
              engine.cancelPatrol();
          } else {
              setActiveSkill('SET_PATROL');
          }
      }
  };

  const handleNextLevel = () => {
    const nextLvl = level + 1;
    if (nextLvl <= MAX_LEVEL) {
        if (engine) {
            engine.victory = false;
            engine.gameOver = false;
        }
        setLevel(nextLvl);
        startGame(nextLvl);
    }
  };

  const handleRestart = () => {
    startGame(level); 
  };

  const handleStartMatch = () => {
      if(engine) engine.startGame();
  };
  
  const handleTogglePause = () => {
      if(engine && engine.started) engine.togglePause();
  };

  const handleBackToMenu = () => {
      setEngine(null);
      setGameState('LEVEL_SELECT');
  };

  const t = TRANS[lang];

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100 select-none overflow-hidden">
      
      <div className="absolute top-4 left-4 z-50">
          <button 
             onClick={() => setLang(prev => prev === 'VN' ? 'EN' : 'VN')}
             className="px-2 py-1 bg-slate-700 text-xs rounded border border-slate-500 hover:bg-slate-600"
          >
             {lang === 'VN' ? '🇬🇧 EN' : '🇻🇳 VN'}
          </button>
      </div>

      {gameState === 'MENU' && (
        <div className="text-center space-y-6 animate-fade-in">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-8">
            STICKMAN WAR
            <span className="block text-2xl text-slate-400 font-normal mt-2">
                Mountain Defense 
                <span className="text-sm text-slate-500 bg-slate-800 px-2 py-1 rounded-full ml-2 align-middle">v1.1</span>
            </span>
          </h1>
          <button 
            onClick={() => setGameState('LEVEL_SELECT')}
            className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-2xl shadow-lg transform transition hover:scale-105"
          >
            {t.start}
          </button>
          <div className="text-slate-500 mt-8">
            <p>{t.tip}</p>
          </div>
        </div>
      )}

      {gameState === 'LEVEL_SELECT' && (
          <div className="w-full max-w-5xl animate-fade-in text-center h-[80vh] flex flex-col">
              <h2 className="text-4xl font-bold mb-4 text-white">{t.selectLevel}</h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="grid grid-cols-5 gap-3 md:gap-4">
                    {Array.from({length: MAX_LEVEL}).map((_, idx) => {
                        const lvl = idx + 1;
                        const locked = lvl > maxReachedLevel;
                        const theme = LEVEL_THEMES[(lvl - 1) % LEVEL_THEMES.length];
                        const isBoss = lvl % 10 === 0;
                        const record = levelRecords[lvl];
                        
                        return (
                            <button
                                key={lvl}
                                onClick={() => {
                                    if (!locked) {
                                        setLevel(lvl);
                                        startGame(lvl);
                                    }
                                }}
                                disabled={locked}
                                className={`rounded-lg flex flex-col items-center justify-center border-2 transition-all relative overflow-hidden group
                                    ${isBoss ? 'h-32 md:h-32 border-red-500 shadow-red-900/40' : 'h-20 md:h-24'}
                                    ${locked 
                                        ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' 
                                        : 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:scale-105 cursor-pointer shadow-lg'}`}
                            >
                                {/* Background color hint */}
                                {!locked && (
                                    <div className="absolute inset-0 opacity-20" style={{background: `linear-gradient(to bottom, ${theme.skyTop}, ${theme.groundColor})`}} />
                                )}
                                
                                <span className={`${isBoss ? 'text-4xl text-red-400' : 'text-xl'} font-black z-10`}>{lvl}</span>
                                {isBoss && <span className="text-[10px] text-red-500 font-bold z-10 animate-pulse">BOSS</span>}
                                {locked ? (
                                    <span className="text-xs text-slate-500 mt-1 z-10">🔒</span>
                                ) : (
                                    <div className="z-10 flex flex-col items-center">
                                         {!isBoss && <span className="text-[10px] text-slate-300 mt-1 uppercase font-bold hidden md:block">{lang === 'VN' ? theme.nameVn : theme.nameEn}</span>}
                                         {record && (
                                             <span className="text-[10px] text-yellow-400 font-mono bg-black/40 px-1 rounded mt-1">
                                                 ⏱️ {formatTime(record)}
                                             </span>
                                         )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
              </div>
              <button 
                onClick={() => setGameState('MENU')}
                className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 w-fit mx-auto"
              >
                  {t.menu}
              </button>
          </div>
      )}

      {gameState === 'PLAYING' && engine && (
        <>
          <div className="w-full max-w-[85vw] flex justify-between items-center mb-1 px-2 md:px-4">
             <div className="flex items-center gap-2 md:gap-4">
                <div className="text-lg md:text-xl font-bold text-yellow-400 flex items-center gap-2">
                    <span className="text-xl md:text-2xl">🪙</span> {gold}
                </div>
                <div className="bg-slate-800 px-3 py-1 rounded text-xs md:text-sm text-slate-300 flex items-center gap-2">
                    <span>{level % 10 === 0 ? <span className="text-red-400 font-bold">{t.bossLevel} {level}</span> : `Level ${level}`}</span>
                    <span className={`font-mono font-bold ${timeElapsed > 900 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                        ⏱️ {formatTime(timeElapsed)}
                    </span>
                </div>
             </div>
             <div className="flex gap-2">
                 <button onClick={handleTogglePause} className="px-3 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">
                     {paused && gameStarted ? t.resume : t.paused}
                 </button>
                 <button onClick={handleBackToMenu} className="px-3 py-1 bg-slate-800 rounded text-xs hover:bg-red-900 text-slate-400">
                     {t.menu}
                 </button>
             </div>
          </div>

          <div className="relative">
            <GameCanvas 
                engine={engine} 
                targetingSkill={activeSkill}
                onSkillUsed={() => setActiveSkill(null)}
            />
            <UpgradeMenu upgrades={upgrades} gold={gold} onUpgrade={handleUpgrade} lang={lang} />
            
            {/* Start / Pause Overlay */}
            {(!gameStarted || paused) && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 backdrop-blur-sm">
                    {!gameStarted ? (
                        <div className="text-center animate-bounce">
                            <h2 className="text-4xl font-black text-white mb-4">{t.ready}</h2>
                            <button onClick={handleStartMatch} className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-lg text-2xl font-bold shadow-lg text-white">
                                {t.go}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <h2 className="text-4xl font-black text-white mb-4">{t.paused}</h2>
                            <button onClick={handleTogglePause} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-2xl font-bold shadow-lg text-white">
                                {t.resume}
                            </button>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="w-full max-w-[85vw] flex flex-col items-center">
             <ControlPanel 
                gold={gold} 
                population={population}
                maxPopulation={maxPopulation}
                heroPopulation={heroPopulation}
                unitCounts={unitCounts}
                spawnQueue={spawnQueue}
                onBuyUnit={handleBuyUnit}
                onDismissUnit={handleDismissUnit} 
                activeSkill={activeSkill}
                onUseSkill={(skill) => setActiveSkill(skill === activeSkill ? null : skill)}
                onSetStrategy={handleSetStrategy}
                onBuyPopUpgrade={handleBuyPopUpgrade}
                onBuyPassiveGoldUpgrade={handleBuyPassiveGoldUpgrade}
                onBuyTower={handleBuyTower}
                towerCount={towerCount}
                passiveGoldLevel={upgrades.passiveGold || 0}
                rallyPointSet={rallyPointSet}
                patrolPointSet={patrolPointSet} // Pass prop
                cooldowns={cooldowns}
                activeTimers={activeTimers}
                maxDurations={maxDurations}
                lang={lang}
             />
          </div>
        </>
      )}

      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-600 text-center max-w-md shadow-2xl animate-fade-in relative overflow-hidden">
             
             {/* Victory Particles/Fireworks container implied in GameCanvas, but text here */}
             <h2 className={`text-5xl font-black mb-4 ${gameState === 'VICTORY' ? 'text-green-500' : 'text-red-500'}`}>
                {gameState === 'VICTORY' ? t.victory : t.defeat}
             </h2>
             {gameState === 'VICTORY' && (
                 <div className="text-yellow-400 font-mono text-xl mb-2">
                     {t.victoryDesc} <br/>
                     ⏱️ {formatTime(timeElapsed)}
                 </div>
             )}
             <p className="text-slate-300 mb-8">
                {gameState === 'DEFEAT' ? t.defeatDesc : ''}
                {gameState === 'VICTORY' && level === MAX_LEVEL && (
                    <div className="mt-4 text-yellow-400 font-bold text-xl animate-pulse">
                        {t.finalWin}
                    </div>
                )}
             </p>
             
             <div className="flex gap-4 justify-center flex-wrap">
                {gameState === 'VICTORY' && level < MAX_LEVEL ? (
                     <button 
                        onClick={handleNextLevel}
                        className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg text-white"
                     >
                        {t.next}
                     </button>
                ) : (
                    <button 
                        onClick={handleRestart}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold shadow-lg text-white"
                    >
                        {t.restart}
                     </button>
                )}
                <button 
                    onClick={() => setGameState('LEVEL_SELECT')}
                    className="px-6 py-3 border border-slate-500 text-slate-400 hover:text-white rounded-lg font-bold"
                >
                    {t.menu}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
