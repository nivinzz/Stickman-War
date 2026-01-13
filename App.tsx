
import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import ControlPanel from './components/ControlPanel';
import UpgradeMenu from './components/UpgradeMenu';
import OnlineLobby from './components/OnlineLobby'; // New Component
import { GameEngine } from './services/GameEngine';
import { soundManager } from './services/SoundManager';
import { UnitType, UpgradeState, GameLevel, Faction, UnitState, SpawnQueueItem, Language, PlayerProfile } from './types';
import { INITIAL_GOLD, TRANS, MAX_HEROES, LEVEL_THEMES, MAX_LEVEL, MAX_POPULATION, POP_UPGRADE_COST, MAX_POP_UPGRADES, PASSIVE_GOLD_UPGRADE_COST, MAX_PASSIVE_GOLD_LEVEL, MAX_TOWERS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'MENU' | 'LEVEL_SELECT' | 'ONLINE_LOBBY' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>('MENU');
  
  // --- ROBUST SAVE SYSTEM (LAZY INIT) ---
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
  const [isMuted, setIsMuted] = useState(soundManager.isMuted());
  
  const [isOnlineMatch, setIsOnlineMatch] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [opponentName, setOpponentName] = useState<string>('');
  // New State for Online UI
  const [opponentElo, setOpponentElo] = useState<number>(1000);
  const [mapThemeIndex, setMapThemeIndex] = useState<number>(0);

  // React state mirrors for UI
  const [gold, setGold] = useState(INITIAL_GOLD);
  const [population, setPopulation] = useState(0);
  const [maxPopulation, setMaxPopulation] = useState(MAX_POPULATION);
  const [heroPopulation, setHeroPopulation] = useState(0);
  const [unitCounts, setUnitCounts] = useState({ miner: 0, sword: 0, archer: 0, cav: 0, hero: 0 });
  const [towerCount, setTowerCount] = useState(0);
  
  const [spawnQueue, setSpawnQueue] = useState<SpawnQueueItem[]>([]);
  
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  
  // Strategy States
  const [rallyPointSet, setRallyPointSet] = useState(false);
  const [patrolPointSet, setPatrolPointSet] = useState(false);
  const [vanguardPointSet, setVanguardPointSet] = useState(false);
  const [vanguardPercentage, setVanguardPercentage] = useState(0.2);
  
  const [cooldowns, setCooldowns] = useState({ ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 });
  const [activeTimers, setActiveTimers] = useState({ ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 });
  const [maxDurations, setMaxDurations] = useState({ ARROW_RAIN: 0, LIGHTNING: 0, FREEZE: 0 });
  const [timeElapsed, setTimeElapsed] = useState(0); 

  const [paused, setPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // MUSIC & AMBIENCE EFFECT
  useEffect(() => {
    if (gameState === 'MENU' || gameState === 'LEVEL_SELECT' || gameState === 'ONLINE_LOBBY') {
        soundManager.playMenuMusic();
    } else if (gameState === 'PLAYING') {
        // Use mapThemeIndex for online, or level logic for offline
        const themeIdx = isOnlineMatch ? mapThemeIndex : ((level - 1) % LEVEL_THEMES.length);
        const theme = LEVEL_THEMES[themeIdx];
        soundManager.playGameAmbience(theme.nameEn);
    } else {
        soundManager.stopAmbience();
    }
  }, [gameState, level, isOnlineMatch, mapThemeIndex]);

  const saveProgress = (newMaxLevel: number, currentUpgrades: UpgradeState, records: Record<number, number>) => {
      localStorage.setItem('stickman_max_level', newMaxLevel.toString());
      localStorage.setItem('stickman_level_records', JSON.stringify(records));
      saveUpgradesOnly(currentUpgrades);
  };

  const saveUpgradesOnly = (currentUpgrades: UpgradeState) => {
      const storageUpgrades = {
          ...currentUpgrades,
          maxPopUpgrade: 0,
          passiveGold: 0
      };
      localStorage.setItem('stickman_upgrades', JSON.stringify(storageUpgrades));
  };

  const updateLeaderboard = (win: boolean) => {
      if (isSpectator) return; // Spectators don't affect rank
      const savedLb = localStorage.getItem('stickman_leaderboard_v3');
      const myName = localStorage.getItem('stickman_player_name') || 'You';
      let lb: PlayerProfile[] = savedLb ? JSON.parse(savedLb) : [];
      
      let profile = lb.find(p => p.name === myName);
      if (!profile) {
          profile = { name: myName, wins: 0, matches: 0, elo: 1000 };
          lb.push(profile);
      }
      
      profile.matches++;
      if (win) {
          profile.wins++;
          profile.elo += 25;
      } else {
          profile.elo = Math.max(0, profile.elo - 20); // Harder punishment
      }
      
      localStorage.setItem('stickman_leaderboard_v3', JSON.stringify(lb));
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  const toggleMute = () => {
      const muted = soundManager.toggleMute();
      setIsMuted(muted);
      
      // Refresh ambience state based on mute
      if (muted) {
          soundManager.stopAmbience();
      } else {
          // Restart context dependent sound
          if (gameState === 'MENU' || gameState === 'LEVEL_SELECT') soundManager.playMenuMusic();
          else if (gameState === 'PLAYING') {
              const themeIdx = isOnlineMatch ? mapThemeIndex : ((level - 1) % LEVEL_THEMES.length);
              const theme = LEVEL_THEMES[themeIdx];
              soundManager.playGameAmbience(theme.nameEn);
          }
      }
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
      setMaxPopulation(MAX_POPULATION + eng.upgrades.maxPopUpgrade);

      setSpawnQueue([...eng.playerQueue]); 

      setRallyPointSet(eng.rallyPoint !== null);
      setPatrolPointSet(eng.patrolPoint !== null); 
      setVanguardPointSet(eng.vanguardPoint !== null);
      
      setCooldowns({...eng.skillCooldowns});
      setActiveTimers({...eng.skillActiveTimers});
      setMaxDurations({...eng.skillMaxDurations});

      const currentSeconds = Math.floor(eng.levelTimer / 60);
      setTimeElapsed(currentSeconds);

      setPaused(eng.paused);
      setGameStarted(eng.started);

      if (eng.victory) {
          setGameState('VICTORY');
          soundManager.stopAmbience();
          if (isOnlineMatch) {
              updateLeaderboard(true);
          } else {
              let newRecords = { ...levelRecords };
              if (!newRecords[level] || currentSeconds < newRecords[level]) {
                  newRecords[level] = currentSeconds;
                  setLevelRecords(newRecords);
              }
              if (level >= maxReachedLevel) {
                  const next = Math.min(MAX_LEVEL, level + 1);
                  setMaxReachedLevel(next);
                  saveProgress(next, eng.upgrades, newRecords);
              } else {
                  localStorage.setItem('stickman_level_records', JSON.stringify(newRecords));
                  saveUpgradesOnly(eng.upgrades);
              }
          }
      }
      if (eng.gameOver) {
          setGameState('DEFEAT');
          soundManager.stopAmbience();
          if (isOnlineMatch) {
              updateLeaderboard(false);
          }
      }
  };

  // UPDATED START GAME FUNCTION
  const startGame = (lvl: number, isMultiplayer: boolean = false, oppName: string = '', oppElo: number = 1000, mapId: number = 0, isSpec: boolean = false) => {
    setPaused(false);
    setGameStarted(false); 
    setGameState('PLAYING');
    setTimeElapsed(0);
    setIsOnlineMatch(isMultiplayer);
    setIsSpectator(isSpec);
    setOpponentName(oppName);
    setOpponentElo(oppElo);
    
    // For Campaign, mapId is derived from level. For Online, it's passed.
    const finalMapId = isMultiplayer ? mapId : ((lvl - 1) % LEVEL_THEMES.length);
    setMapThemeIndex(finalMapId);
    
    // Create Level Config
    const isBoss = lvl % 10 === 0;
    const gameLevel: GameLevel = {
      level: isMultiplayer ? (finalMapId * 5) + 1 : lvl, // Hack to trick getTheme if used elsewhere, but mainly for engine
      enemySpawnRate: Math.max(30, 200 - (lvl * 10)), 
      enemyStatMultiplier: 1 + (lvl * 0.15),
      enemySmartAI: lvl > 3,
      enemyGoldDrip: lvl * 2,
      isBoss,
      isMultiplayer,
      isSpectator: isSpec,
      opponentName: oppName,
      opponentElo: oppElo,
      mapThemeIndex: finalMapId
    };

    // If Online, RESET upgrades for the session (Fair Play)
    // If Offline, use current upgrades
    let sessionUpgrades: UpgradeState;
    if (isMultiplayer) {
         sessionUpgrades = { 
            baseHp: 0, swordDamage: 0, archerDamage: 0, cavalryDamage: 0, spawnSpeed: 0,
            arrowRainPower: 0, lightningPower: 0, freezePower: 0, heroPower: 0,
            minerSpeed: 0, maxPopUpgrade: 0, passiveGold: 0, towerPower: 0
        };
    } else {
        sessionUpgrades = {
            ...upgrades,
            maxPopUpgrade: 0,
            passiveGold: 0
        };
    }
    
    if (!isMultiplayer) setUpgrades(sessionUpgrades);

    const newEngine = new GameEngine(gameLevel, sessionUpgrades, syncState);
    newEngine.gold = INITIAL_GOLD; 
    newEngine.setVanguardPercentage(0.2); // Default 20%
    setVanguardPercentage(0.2);

    setEngine(newEngine);
    
    setGold(INITIAL_GOLD);
    setPopulation(0);
    setHeroPopulation(0);
    setActiveSkill(null);
    setRallyPointSet(false);
    setPatrolPointSet(false);
    setVanguardPointSet(false);
    setTowerCount(0);
  };

  const handleBuyUnit = (type: UnitType) => {
    if (isSpectator) return;
    if (engine) engine.queueUnit(type, Faction.PLAYER);
  };

  const handleDismissUnit = (type: UnitType) => {
      if (isSpectator) return;
      if (engine) engine.dismissUnit(type);
  };

  const handleUpgrade = (type: keyof UpgradeState, cost: number) => {
    if (isSpectator) return;
    if (engine && engine.gold >= cost) {
      engine.gold -= cost;
      // In online mode, we modify engine upgrades directly but don't persist to global state
      if (engine.level.isMultiplayer) {
           const next = { ...engine.upgrades, [type]: engine.upgrades[type] + 1 };
           engine.upgrades = next;
           if (type === 'baseHp') {
              const oldMax = engine.playerMaxBaseHp;
              engine.playerMaxBaseHp = 2000 * (1 + (next.baseHp * 0.1));
              engine.playerBaseHp += (engine.playerMaxBaseHp - oldMax);
           }
      } else {
          // Offline mode - update React state and persist
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
      }
      if (engine) syncState(engine);
    }
  };

  const handleBuyPopUpgrade = () => {
      if (isSpectator) return;
      if (engine && engine.gold >= POP_UPGRADE_COST && upgrades.maxPopUpgrade < MAX_POP_UPGRADES) {
          engine.gold -= POP_UPGRADE_COST;
          // Local engine update only if online
          const nextVal = engine.upgrades.maxPopUpgrade + 1;
          const nextUpgrades = { ...engine.upgrades, maxPopUpgrade: nextVal };
          engine.upgrades = nextUpgrades;
          
          if (!isOnlineMatch) {
             setUpgrades(nextUpgrades); // Update visual state for offline persistence logic
          }
          syncState(engine);
      }
  };

  const handleBuyPassiveGoldUpgrade = () => {
      if (isSpectator) return;
      if (engine && engine.gold >= PASSIVE_GOLD_UPGRADE_COST && (engine.upgrades.passiveGold || 0) < MAX_PASSIVE_GOLD_LEVEL) { 
          engine.gold -= PASSIVE_GOLD_UPGRADE_COST;
           const nextVal = (engine.upgrades.passiveGold || 0) + 1;
           const nextUpgrades = { ...engine.upgrades, passiveGold: nextVal };
           engine.upgrades = nextUpgrades;
           
           if (!isOnlineMatch) {
               setUpgrades(nextUpgrades);
           }
          syncState(engine);
      }
  };
  
  const handleBuyTower = () => {
      if (isSpectator) return;
      if (engine) {
          engine.buyTower(Faction.PLAYER);
      }
  };

  const handleSetStrategy = (strategy: 'CHARGE' | 'DEFEND' | 'PATROL' | 'VANGUARD') => {
      if (isSpectator || !engine) return;
      if (strategy === 'CHARGE') {
          engine.clearRallyPoint();
          setActiveSkill(null); 
      } else if (strategy === 'DEFEND') {
          setActiveSkill('SET_RALLY'); 
      } else if (strategy === 'PATROL') {
          if (activeSkill === 'SET_PATROL') setActiveSkill(null);
          else if (patrolPointSet) engine.cancelPatrol();
          else setActiveSkill('SET_PATROL');
      } else if (strategy === 'VANGUARD') {
          if (activeSkill === 'SET_VANGUARD') setActiveSkill(null);
          else if (vanguardPointSet) engine.setVanguardPoint(0); // clear
          else setActiveSkill('SET_VANGUARD');
      }
  };
  
  const handleSetVanguardPct = (pct: number) => {
      if (isSpectator || !engine) return;
      engine.setVanguardPercentage(pct);
      setVanguardPercentage(pct);
  };

  const handleNextLevel = () => {
    if (isOnlineMatch) {
        setGameState('ONLINE_LOBBY');
        setEngine(null);
        return;
    }
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
    // Restart with same config
    startGame(level, isOnlineMatch, opponentName, opponentElo, mapThemeIndex, isSpectator); 
  };

  const handleStartMatch = () => {
      if(engine) engine.startGame();
  };
  
  const handleTogglePause = () => {
      if(engine && engine.started) engine.togglePause();
  };

  const handleBackToMenu = () => {
      setEngine(null);
      if (isOnlineMatch) setGameState('ONLINE_LOBBY');
      else setGameState('LEVEL_SELECT');
  };

  const handleSkillUsed = () => {
      // Only clear selection for instant-cast skills.
      if (activeSkill && ['ARROW_RAIN', 'LIGHTNING', 'FREEZE'].includes(activeSkill)) {
          setActiveSkill(null);
      }
  };

  const t = TRANS[lang];

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100 select-none overflow-hidden">
      
      {/* GLOBAL SETTINGS (TOP LEFT) */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
          <button 
             onClick={() => setLang(prev => prev === 'VN' ? 'EN' : 'VN')}
             className="px-2 py-1 bg-slate-700 text-xs rounded border border-slate-500 hover:bg-slate-600 font-bold"
          >
             {lang === 'VN' ? '🇬🇧 EN' : '🇻🇳 VN'}
          </button>
          
          <button 
             onClick={toggleMute}
             className={`px-2 py-1 rounded border hover:bg-slate-600 text-xs font-bold ${isMuted ? 'bg-red-800 border-red-600 text-red-200' : 'bg-slate-700 border-slate-500 text-white'}`}
          >
             {isMuted ? '🔇 MUTED' : '🔊 SOUND'}
          </button>
      </div>

      {gameState === 'MENU' && (
        <div className="text-center space-y-6 animate-fade-in">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-8">
            STICKMAN WAR
            <span className="block text-2xl text-slate-400 font-normal mt-2">
                Mountain Defense 
                <span className="text-sm text-slate-500 bg-slate-800 px-2 py-1 rounded-full ml-2 align-middle">v1.4 Online Sim</span>
            </span>
          </h1>
          <div className="flex flex-col gap-4">
            <button 
                onClick={() => setGameState('LEVEL_SELECT')}
                className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-2xl shadow-lg transform transition hover:scale-105"
            >
                {t.start}
            </button>
            <button 
                onClick={() => setGameState('ONLINE_LOBBY')}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xl shadow-lg transform transition hover:scale-105"
            >
                🌐 CHƠI ONLINE (PvP)
            </button>
          </div>
          <div className="text-slate-500 mt-8">
            <p>{t.tip}</p>
          </div>
        </div>
      )}
      
      {gameState === 'ONLINE_LOBBY' && (
          <OnlineLobby 
            lang={lang}
            onBack={() => setGameState('MENU')}
            onStartMatch={(oppName, oppElo, mapId, isSpec) => startGame(30, true, oppName, oppElo, mapId, isSpec)} 
          />
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
          <div className="w-full max-w-[95vw] flex justify-between items-center mb-1 px-2 md:px-4">
             <div className="flex items-center gap-2 md:gap-4 flex-1">
                {/* Gold Display */}
                <div className="text-lg md:text-xl font-bold text-yellow-400 flex items-center gap-2 w-24">
                    <span className="text-xl md:text-2xl">🪙</span> {gold}
                </div>

                {/* --- ONLINE MATCH INFO (CENTER) --- */}
                {isOnlineMatch ? (
                    <div className="flex-1 flex justify-center items-center">
                        <div className="bg-slate-800/90 border border-slate-600 px-6 py-2 rounded-lg flex items-center gap-4 shadow-lg backdrop-blur-sm">
                            {/* Player Left */}
                            <div className="flex flex-col items-end">
                                <span className={`font-bold text-sm ${isSpectator ? 'text-blue-400' : 'text-green-400'}`}>
                                    {isSpectator ? opponentName.split(' vs ')[0] : 'YOU'}
                                </span>
                                <span className="text-[10px] text-yellow-500 font-mono">
                                    Elo: ???
                                </span>
                            </div>

                            {/* VS Badge */}
                            <div className="bg-red-600 text-white font-black text-xs px-2 py-1 rounded skew-x-[-10deg]">
                                VS
                            </div>

                            {/* Player Right */}
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-sm text-red-400">
                                    {isSpectator ? opponentName.split(' vs ')[1] : opponentName}
                                </span>
                                <span className="text-[10px] text-yellow-500 font-mono">
                                    Elo: {isSpectator ? opponentElo : opponentElo}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Offline Info
                    <div className="bg-slate-800 px-3 py-1 rounded text-xs md:text-sm text-slate-300 flex items-center gap-2">
                        <span>{level % 10 === 0 ? <span className="text-red-400 font-bold">{t.bossLevel} {level}</span> : `Level ${level}`}</span>
                    </div>
                )}

                {/* Timer */}
                <div className={`font-mono font-bold w-16 text-right ${timeElapsed > 900 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                    ⏱️ {formatTime(timeElapsed)}
                </div>
             </div>

             <div className="flex gap-2">
                 <button onClick={handleTogglePause} className="px-3 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">
                     {paused && gameStarted ? t.resume : t.paused}
                 </button>
                 <button onClick={handleBackToMenu} className="px-3 py-1 bg-slate-800 rounded text-xs hover:bg-red-900 text-slate-400">
                     {isOnlineMatch ? t.exit : t.menu}
                 </button>
             </div>
          </div>

          <div className="relative">
            <GameCanvas 
                engine={engine} 
                targetingSkill={activeSkill}
                onSkillUsed={handleSkillUsed}
            />
            {/* Hide Upgrade Menu in Spectator Mode */}
            {!isSpectator && (
                <UpgradeMenu 
                    upgrades={isOnlineMatch ? engine.upgrades : upgrades} 
                    gold={gold} 
                    onUpgrade={handleUpgrade} 
                    lang={lang} 
                    maxReachedLevel={isOnlineMatch ? 60 : maxReachedLevel} 
                />
            )}
            
            {/* Start / Pause Overlay */}
            {(!gameStarted || paused) && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 backdrop-blur-sm">
                    {!gameStarted ? (
                        <div className="text-center animate-bounce">
                            <h2 className="text-4xl font-black text-white mb-4">
                                {isSpectator ? 'WATCH MATCH' : (isOnlineMatch ? 'PVP MATCH' : t.ready)}
                            </h2>
                             {isOnlineMatch && (
                                <div className="text-xl text-blue-400 font-bold mb-4">
                                    {isSpectator ? opponentName : `YOU vs ${opponentName}`}
                                </div>
                             )}
                            <button onClick={handleStartMatch} className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-lg text-2xl font-bold shadow-lg text-white">
                                {isSpectator ? 'Start Watching' : t.go}
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

          {/* HIDE CONTROLS IN SPECTATOR MODE, BUT SHOW STATS */}
          <div className={`w-full max-w-[85vw] flex flex-col items-center ${isSpectator ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
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
                onSetVanguardPct={handleSetVanguardPct}
                vanguardPointSet={vanguardPointSet}
                vanguardPercentage={vanguardPercentage}
                onBuyPopUpgrade={handleBuyPopUpgrade}
                onBuyPassiveGoldUpgrade={handleBuyPassiveGoldUpgrade}
                onBuyTower={handleBuyTower}
                towerCount={towerCount}
                passiveGoldLevel={isOnlineMatch ? engine.upgrades.passiveGold : (upgrades.passiveGold || 0)}
                rallyPointSet={rallyPointSet}
                patrolPointSet={patrolPointSet} 
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
             <h2 className={`text-5xl font-black mb-4 ${gameState === 'VICTORY' ? 'text-green-500' : 'text-red-500'}`}>
                {isSpectator ? 'GAME OVER' : (gameState === 'VICTORY' ? t.victory : t.defeat)}
             </h2>
             {gameState === 'VICTORY' && (
                 <div className="text-yellow-400 font-mono text-xl mb-2">
                     {isSpectator ? 'Blue Team Wins!' : t.victoryDesc} <br/>
                     ⏱️ {formatTime(timeElapsed)}
                 </div>
             )}
             <p className="text-slate-300 mb-8">
                {gameState === 'DEFEAT' ? (isSpectator ? 'Red Team Wins!' : t.defeatDesc) : ''}
                {gameState === 'VICTORY' && level === MAX_LEVEL && !isOnlineMatch && (
                    <div className="mt-4 text-yellow-400 font-bold text-xl animate-pulse">
                        {t.finalWin}
                    </div>
                )}
             </p>
             
             <div className="flex gap-4 justify-center flex-wrap">
                {gameState === 'VICTORY' && level < MAX_LEVEL && !isOnlineMatch ? (
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
                        {isOnlineMatch ? (isSpectator ? 'Replay' : 'Đấu Lại') : t.restart}
                     </button>
                )}
                <button 
                    onClick={() => {
                        setEngine(null);
                        if (isOnlineMatch) setGameState('ONLINE_LOBBY');
                        else setGameState('LEVEL_SELECT');
                    }}
                    className="px-6 py-3 border border-slate-500 text-slate-400 hover:text-white rounded-lg font-bold"
                >
                    {isOnlineMatch ? 'Về Sảnh' : t.menu}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
