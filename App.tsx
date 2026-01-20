
import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import ControlPanel from './components/ControlPanel';
import UpgradeMenu from './components/UpgradeMenu';
import OnlineLobby, { RankIcon } from './components/OnlineLobby'; // Import RankIcon
import { GameEngine } from './services/GameEngine';
import { soundManager } from './services/SoundManager';
import { UnitType, UpgradeState, GameLevel, Faction, UnitState, SpawnQueueItem, Language, PlayerProfile, RankTier } from './types';
import { INITIAL_GOLD, TRANS, MAX_HEROES, LEVEL_THEMES, MAX_LEVEL, MAX_POPULATION, POP_UPGRADE_COST, MAX_POP_UPGRADES, PASSIVE_GOLD_UPGRADE_COST, MAX_PASSIVE_GOLD_LEVEL, MAX_TOWERS, getRankTier, getAvatarUrl } from './constants';

// Match Result Interface
interface MatchResult {
    oldElo: number;
    newElo: number;
    eloChange: number;
    currentRank: RankTier;
    isRankUp: boolean;
    streak: number; 
}

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
  const [isRankedMatch, setIsRankedMatch] = useState(false); 
  const [isSpectator, setIsSpectator] = useState(false);
  const [opponentName, setOpponentName] = useState<string>('');
  const [opponentElo, setOpponentElo] = useState<number>(1000);
  const [mapThemeIndex, setMapThemeIndex] = useState<number>(0);
  
  // New: Teammates for 3v3
  const [teammates, setTeammates] = useState<PlayerProfile[]>([]);

  // Refs to solve closure staleness in syncState
  const isOnlineMatchRef = useRef(false);
  const isRankedMatchRef = useRef(false);
  const isSpectatorRef = useRef(false);

  // Sync refs with state
  useEffect(() => { isOnlineMatchRef.current = isOnlineMatch; }, [isOnlineMatch]);
  useEffect(() => { isRankedMatchRef.current = isRankedMatch; }, [isRankedMatch]);
  useEffect(() => { isSpectatorRef.current = isSpectator; }, [isSpectator]);

  // Match Result State
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const resultProcessedRef = useRef(false);
  
  // New: Viewing Profile in Match
  const [viewingProfile, setViewingProfile] = useState<PlayerProfile | null>(null);
  const [myProfile, setMyProfile] = useState<PlayerProfile | null>(null);

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
        const themeIdx = isOnlineMatch ? mapThemeIndex : ((level - 1) % LEVEL_THEMES.length);
        const theme = LEVEL_THEMES[themeIdx];
        soundManager.playGameAmbience(theme.nameEn);
    } else {
        soundManager.stopAmbience();
    }
  }, [gameState, level, isOnlineMatch, mapThemeIndex]);

  // Load My Profile for PvP Header
  useEffect(() => {
      if (isOnlineMatch && gameState === 'PLAYING') {
          const savedLb = localStorage.getItem('stickman_bots_v6'); 
          const myName = localStorage.getItem('stickman_player_name');
          if (savedLb && myName) {
              const lb: PlayerProfile[] = JSON.parse(savedLb);
              const me = lb.find(p => p.name === myName);
              if (me) setMyProfile(me);
          }
      }
  }, [isOnlineMatch, gameState]);

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
      if (isSpectatorRef.current || resultProcessedRef.current) return; 
      resultProcessedRef.current = true; // Ensure runs once per match

      const savedLb = localStorage.getItem('stickman_bots_v6'); 
      const myName = localStorage.getItem('stickman_player_name') || 'You';
      let lb: PlayerProfile[] = savedLb ? JSON.parse(savedLb) : [];
      
      let profile = lb.find(p => p.name === myName);
      if (!profile) {
          profile = { 
              name: myName, 
              avatarSeed: myName,
              rankedStats: { wins: 0, losses: 0, elo: 100, streak: 0 },
              casualStats: { wins: 0, losses: 0, streak: 0 },
              rankTier: RankTier.BRONZE,
              status: 'IDLE' 
          };
          lb.push(profile);
      }
      
      if (isRankedMatchRef.current) {
          const oldElo = profile.rankedStats.elo;
          const oldRank = profile.rankTier;
          let eloChange = 0;

          if (win) {
              profile.rankedStats.wins++;
              profile.rankedStats.streak++;
              let gain = 25;
              if (profile.rankedStats.streak >= 3) gain += 10; 
              if (profile.rankedStats.streak >= 5) gain += 15; 
              eloChange = gain;
              profile.rankedStats.elo += eloChange;

              // Alliance Logic (Funds & Elo)
              if (teammates.length > 0) {
                  const savedAl = localStorage.getItem('stickman_alliance_v2');
                  if (savedAl) {
                      const al = JSON.parse(savedAl);
                      
                      // 1. Add Funds
                      al.funds += 1000;
                      
                      // 2. Update Alliance Elo
                      const alEloChange = 25;
                      al.elo += alEloChange;

                      // 3. Update Personal Contribution
                      const meInAl = al.members.find((m: any) => m.name === myName);
                      if (meInAl) {
                          meInAl.contribution += 1000;
                          meInAl.elo = profile.rankedStats.elo; // Sync Elo
                      }
                      
                      localStorage.setItem('stickman_alliance_v2', JSON.stringify(al));
                  }
              }

          } else {
              profile.rankedStats.losses++;
              profile.rankedStats.streak = 0;
              eloChange = -20;
              profile.rankedStats.elo = Math.max(0, profile.rankedStats.elo + eloChange);

              // Alliance Elo Penalty on Loss
              if (teammates.length > 0) {
                  const savedAl = localStorage.getItem('stickman_alliance_v2');
                  if (savedAl) {
                      const al = JSON.parse(savedAl);
                      const alEloChange = -20;
                      al.elo = Math.max(0, al.elo + alEloChange);
                      
                      // Sync Elo only
                      const meInAl = al.members.find((m: any) => m.name === myName);
                      if (meInAl) {
                          meInAl.elo = profile.rankedStats.elo;
                      }
                      
                      localStorage.setItem('stickman_alliance_v2', JSON.stringify(al));
                  }
              }
          }
          
          profile.rankTier = getRankTier(profile.rankedStats.elo);
          
          setMatchResult({
              oldElo,
              newElo: profile.rankedStats.elo,
              eloChange: win ? eloChange : (profile.rankedStats.elo - oldElo), 
              currentRank: profile.rankTier,
              isRankUp: profile.rankTier !== oldRank && win,
              streak: profile.rankedStats.streak
          });

      } else {
          if (win) {
              profile.casualStats.wins++;
              profile.casualStats.streak = (profile.casualStats.streak || 0) + 1;
          } else {
              profile.casualStats.losses++;
              profile.casualStats.streak = 0;
          }
          setMatchResult(null); 
      }
      
      localStorage.setItem('stickman_bots_v6', JSON.stringify(lb));
      setMyProfile(profile); 
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  const toggleMute = () => {
      const muted = soundManager.toggleMute();
      setIsMuted(muted);
      
      if (muted) {
          soundManager.stopAmbience();
      } else {
          if (gameState === 'MENU' || gameState === 'LEVEL_SELECT') soundManager.playMenuMusic();
          else if (gameState === 'PLAYING') {
              const themeIdx = isOnlineMatch ? mapThemeIndex : ((level - 1) % LEVEL_THEMES.length);
              const theme = LEVEL_THEMES[themeIdx];
              soundManager.playGameAmbience(theme.nameEn);
          }
      }
  };

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
          if (isOnlineMatchRef.current) {
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
          if (isOnlineMatchRef.current) {
              updateLeaderboard(false);
          }
      }
  };

  // UPDATED START GAME FUNCTION
  const startGame = (lvl: number, isMultiplayer: boolean = false, oppName: string = '', oppElo: number = 1000, mapId: number = 0, isSpec: boolean = false, isRanked: boolean = false, team: PlayerProfile[] = []) => {
    setPaused(false);
    setGameStarted(false); 
    setGameState('PLAYING');
    setTimeElapsed(0);
    setIsOnlineMatch(isMultiplayer);
    isOnlineMatchRef.current = isMultiplayer;
    
    setIsRankedMatch(isRanked); 
    isRankedMatchRef.current = isRanked;

    setIsSpectator(isSpec);
    isSpectatorRef.current = isSpec;

    setOpponentName(oppName);
    setOpponentElo(oppElo);
    setTeammates(team); // Set teammates state

    setMatchResult(null); 
    resultProcessedRef.current = false; 
    
    const finalMapId = isMultiplayer ? mapId : ((lvl - 1) % LEVEL_THEMES.length);
    setMapThemeIndex(finalMapId);
    
    const isBoss = lvl % 10 === 0;
    const gameLevel: GameLevel = {
      level: isMultiplayer ? (finalMapId * 5) + 1 : lvl, 
      enemySpawnRate: Math.max(30, 200 - (lvl * 10)), 
      enemyStatMultiplier: 1 + (lvl * 0.15),
      enemySmartAI: lvl > 3,
      enemyGoldDrip: lvl * 2,
      isBoss,
      isMultiplayer,
      isSpectator: isSpec,
      opponentName: oppName,
      opponentElo: oppElo,
      mapThemeIndex: finalMapId,
      teammates: team // Pass to GameLevel config
    };

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
    newEngine.setVanguardPercentage(0.2); 
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
      if (engine.level.isMultiplayer) {
           const next = { ...engine.upgrades, [type]: engine.upgrades[type] + 1 };
           engine.upgrades = next;
           if (type === 'baseHp') {
              const oldMax = engine.playerMaxBaseHp;
              engine.playerMaxBaseHp = 2000 * (1 + (next.baseHp * 0.1));
              engine.playerBaseHp += (engine.playerMaxBaseHp - oldMax);
           }
      } else {
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
          const nextVal = engine.upgrades.maxPopUpgrade + 1;
          const nextUpgrades = { ...engine.upgrades, maxPopUpgrade: nextVal };
          engine.upgrades = nextUpgrades;
          if (!isOnlineMatch) setUpgrades(nextUpgrades);
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
           if (!isOnlineMatch) setUpgrades(nextUpgrades);
          syncState(engine);
      }
  };
  
  const handleBuyTower = () => {
      if (isSpectator) return;
      if (engine) engine.buyTower(Faction.PLAYER);
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
    startGame(level, isOnlineMatch, opponentName, opponentElo, mapThemeIndex, isSpectator, isRankedMatch, teammates); 
  };

  const handleStartMatch = () => {
      if(engine) engine.startGame();
  };
  
  const handleTogglePause = () => {
      if(engine && engine.started) engine.togglePause();
  };

  const handleBackToMenu = () => {
      if (gameState === 'PLAYING' && isOnlineMatch && !engine?.victory && !engine?.gameOver && !isSpectator) {
          const msg = isRankedMatch 
            ? "Thoát trận sẽ bị tính là THUA và trừ Elo. Bạn chắc chắn?" 
            : "Thoát trận sẽ bị ghi nhận là THUA. Bạn chắc chắn?";
            
          if (window.confirm(msg)) {
              updateLeaderboard(false);
              setEngine(null);
              setGameState('ONLINE_LOBBY');
          }
      } else {
          setEngine(null);
          if (isOnlineMatch) setGameState('ONLINE_LOBBY');
          else setGameState('LEVEL_SELECT');
      }
  };

  const handleSkillUsed = () => {
      if (activeSkill && ['ARROW_RAIN', 'LIGHTNING', 'FREEZE'].includes(activeSkill)) {
          setActiveSkill(null);
      }
  };

  const handleViewProfile = (isMe: boolean) => {
      if (isMe) {
          setViewingProfile(myProfile);
      } else {
          const oppTier = getRankTier(opponentElo);
          const totalGames = Math.floor(Math.random() * 200) + 50;
          const winRate = 0.4 + (opponentElo / 2500) * 0.3; 
          const wins = Math.floor(totalGames * winRate);
          
          const mockProfile: PlayerProfile = {
              name: opponentName,
              avatarSeed: opponentName,
              rankedStats: {
                  wins: wins,
                  losses: totalGames - wins,
                  elo: opponentElo,
                  streak: Math.floor(Math.random() * 3)
              },
              casualStats: { wins: 10, losses: 10, streak: 0 },
              rankTier: oppTier,
              status: 'IDLE'
          };
          setViewingProfile(mockProfile);
      }
  };

  const renderProfileModal = () => {
      if (!viewingProfile) return null;
      return (
          <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingProfile(null)}>
              <div className="bg-slate-800 border-2 border-slate-600 p-6 rounded-xl w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button className="absolute top-2 right-4 text-slate-400 hover:text-white text-xl" onClick={() => setViewingProfile(null)}>✕</button>
                  <div className="flex flex-col items-center mb-6">
                       <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center text-4xl border-2 border-blue-500 mb-2 relative overflow-hidden">
                           <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 opacity-50"></div>
                           <span className="z-10">👤</span>
                       </div>
                       <h3 className="text-2xl font-black text-white tracking-wide uppercase">{viewingProfile.name}</h3>
                       <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Warrior Profile</div>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-slate-900/80 p-4 rounded-lg border border-indigo-500/30 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">🏆</div>
                          <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 relative z-10">
                              <span className="font-bold text-indigo-400 tracking-wider">RANKED SEASON</span>
                              <div className="flex flex-col items-center">
                                  <RankIcon tier={viewingProfile.rankTier} className="w-8 h-8" />
                                  <span className="text-[10px] text-yellow-500 font-bold">{viewingProfile.rankedStats.elo}</span>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 text-sm relative z-10">
                              <div className="text-slate-400">Wins: <span className="text-green-400 font-bold text-lg">{viewingProfile.rankedStats.wins}</span></div>
                              <div className="text-slate-400">Losses: <span className="text-red-400 font-bold text-lg">{viewingProfile.rankedStats.losses}</span></div>
                              <div className="text-slate-400">Rating: <span className="text-yellow-400 font-bold">{viewingProfile.rankedStats.elo}</span></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const t = TRANS[lang];

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100 select-none overflow-hidden relative">
      
      {/* GLOBAL SETTINGS */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
          <button onClick={() => setLang(prev => prev === 'VN' ? 'EN' : 'VN')} className="px-2 py-1 bg-slate-700 text-xs rounded border border-slate-500 hover:bg-slate-600 font-bold">{lang === 'VN' ? '🇬🇧 EN' : '🇻🇳 VN'}</button>
          <button onClick={toggleMute} className={`px-2 py-1 rounded border hover:bg-slate-600 text-xs font-bold ${isMuted ? 'bg-red-800 border-red-600 text-red-200' : 'bg-slate-700 border-slate-500 text-white'}`}>{isMuted ? '🔇 MUTED' : '🔊 SOUND'}</button>
      </div>

      {renderProfileModal()}

      {gameState === 'MENU' && (
        <div className="text-center space-y-6 animate-fade-in">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-8">
            STICKMAN WAR
            <span className="block text-2xl text-slate-400 font-normal mt-2">Mountain Defense <span className="text-sm text-slate-500 bg-slate-800 px-2 py-1 rounded-full ml-2 align-middle">v1.6 Ranked PvP</span></span>
          </h1>
          <div className="flex flex-col gap-4">
            <button onClick={() => setGameState('LEVEL_SELECT')} className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-2xl shadow-lg transform transition hover:scale-105">{t.start}</button>
            <button onClick={() => setGameState('ONLINE_LOBBY')} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xl shadow-lg transform transition hover:scale-105">🌐 CHƠI ONLINE (PvP)</button>
          </div>
          <div className="text-slate-500 mt-8"><p>{t.tip}</p></div>
        </div>
      )}
      
      {gameState === 'ONLINE_LOBBY' && (
          <OnlineLobby 
            lang={lang}
            onBack={() => setGameState('MENU')}
            onStartMatch={(oppName, oppElo, mapId, isSpec, isRanked, team) => {
                startGame(30, true, oppName, oppElo, mapId, isSpec, isRanked, team);
            }} 
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
                            <button key={lvl} onClick={() => { if (!locked) { setLevel(lvl); startGame(lvl); } }} disabled={locked} className={`rounded-lg flex flex-col items-center justify-center border-2 transition-all relative overflow-hidden group ${isBoss ? 'h-32 md:h-32 border-red-500 shadow-red-900/40' : 'h-20 md:h-24'} ${locked ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:scale-105 cursor-pointer shadow-lg'}`}>
                                {!locked && <div className="absolute inset-0 opacity-20" style={{background: `linear-gradient(to bottom, ${theme.skyTop}, ${theme.groundColor})`}} />}
                                <span className={`${isBoss ? 'text-4xl text-red-400' : 'text-xl'} font-black z-10`}>{lvl}</span>
                                {isBoss && <span className="text-[10px] text-red-500 font-bold z-10 animate-pulse">BOSS</span>}
                                {locked ? <span className="text-xs text-slate-500 mt-1 z-10">🔒</span> : <div className="z-10 flex flex-col items-center">{!isBoss && <span className="text-[10px] text-slate-300 mt-1 uppercase font-bold hidden md:block">{lang === 'VN' ? theme.nameVn : theme.nameEn}</span>}{record && <span className="text-[10px] text-yellow-400 font-mono bg-black/40 px-1 rounded mt-1">⏱️ {formatTime(record)}</span>}</div>}
                            </button>
                        );
                    })}
                </div>
              </div>
              <button onClick={() => setGameState('MENU')} className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 w-fit mx-auto">{t.menu}</button>
          </div>
      )}

      {gameState === 'PLAYING' && engine && (
        <>
          <div className="w-full max-w-[95vw] flex justify-between items-center mb-1 px-2 md:px-4">
             <div className="flex items-center gap-2 md:gap-4 flex-1">
                <div className="text-lg md:text-xl font-bold text-yellow-400 flex items-center gap-2 w-24"><span className="text-xl md:text-2xl">🪙</span> {gold}</div>
                {isOnlineMatch ? (
                    <div className="flex-1 flex justify-center items-center">
                        <div className="bg-slate-800/90 border border-slate-600 px-4 py-1 rounded-lg flex items-center gap-4 shadow-lg backdrop-blur-sm">
                            {/* YOU (With Teammates) */}
                            {teammates.length > 0 ? (
                                <>
                                    {/* 3v3 LEFT */}
                                    <div className="flex -space-x-3 items-center hover:scale-105 transition-transform cursor-pointer" onClick={() => handleViewProfile(true)}>
                                        <div className="w-10 h-10 rounded-full border-2 border-green-500 overflow-hidden bg-slate-700 z-30" title="You"><img src={getAvatarUrl(myProfile?.avatarSeed || 'me')} className="w-full h-full object-cover" /></div>
                                        <div className="w-9 h-9 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-700 z-20" title={teammates[0].name}><img src={getAvatarUrl(teammates[0].avatarSeed)} className="w-full h-full object-cover" /></div>
                                        <div className="w-8 h-8 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-700 z-10" title={teammates[1].name}><img src={getAvatarUrl(teammates[1].avatarSeed)} className="w-full h-full object-cover" /></div>
                                        <div className="ml-4 flex flex-col items-end"><span className="font-bold text-sm text-green-400">TEAM</span><span className="text-[10px] text-yellow-500 font-mono">{myProfile?.rankedStats.elo} AVG</span></div>
                                    </div>
                                    <div className="mx-4"><div className="bg-red-600 text-white font-black text-xs px-2 py-1 rounded skew-x-[-10deg]">VS</div></div>
                                    {/* 3v3 RIGHT */}
                                    <div className="flex flex-row-reverse -space-x-3 space-x-reverse items-center hover:scale-105 transition-transform cursor-pointer" onClick={() => handleViewProfile(false)}>
                                        <div className="w-10 h-10 rounded-full border-2 border-red-500 overflow-hidden bg-slate-700 z-30"><img src={getAvatarUrl(opponentName)} className="w-full h-full object-cover" /></div>
                                        <div className="w-9 h-9 rounded-full border-2 border-red-500 overflow-hidden bg-slate-700 z-20 opacity-80"><img src={getAvatarUrl(opponentName + "_2")} className="w-full h-full object-cover" /></div>
                                        <div className="w-8 h-8 rounded-full border-2 border-red-500 overflow-hidden bg-slate-700 z-10 opacity-60"><img src={getAvatarUrl(opponentName + "_3")} className="w-full h-full object-cover" /></div>
                                        <div className="mr-4 flex flex-col items-start"><span className="font-bold text-sm text-red-400">ENEMIES</span><span className="text-[10px] text-yellow-500 font-mono">{opponentElo} AVG</span></div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* 1v1 */}
                                    <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded" onClick={() => handleViewProfile(true)}>
                                        <RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-8 h-8" />
                                        <div className="flex flex-col items-end"><span className={`font-bold text-sm text-green-400`}>YOU</span><span className="text-[10px] text-yellow-500 font-mono">{myProfile?.rankedStats.elo || 100}</span></div>
                                    </div>
                                    <div className="bg-red-600 text-white font-black text-xs px-2 py-1 rounded skew-x-[-10deg]">VS</div>
                                    <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded" onClick={() => handleViewProfile(false)}>
                                        <RankIcon tier={getRankTier(opponentElo)} className="w-8 h-8" />
                                        <div className="flex flex-col items-start"><span className="font-bold text-sm text-red-400">{opponentName}</span><span className="text-[10px] text-yellow-500 font-mono">{opponentElo}</span></div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-800 px-3 py-1 rounded text-xs md:text-sm text-slate-300 flex items-center gap-2"><span>{level % 10 === 0 ? <span className="text-red-400 font-bold">{t.bossLevel} {level}</span> : `Level ${level}`}</span></div>
                )}
                <div className={`font-mono font-bold w-16 text-right ${timeElapsed > 900 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>⏱️ {formatTime(timeElapsed)}</div>
             </div>

             <div className="flex gap-2">
                 <button onClick={handleTogglePause} className="px-3 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600">{paused && gameStarted ? t.resume : t.paused}</button>
                 <button onClick={handleBackToMenu} className="px-3 py-1 bg-slate-800 rounded text-xs hover:bg-red-900 text-slate-400">{isOnlineMatch ? t.exit : t.menu}</button>
             </div>
          </div>

          <div className="relative">
            <GameCanvas engine={engine} targetingSkill={activeSkill} onSkillUsed={handleSkillUsed} />
            {!isSpectator && (<UpgradeMenu upgrades={isOnlineMatch ? engine.upgrades : upgrades} gold={gold} onUpgrade={handleUpgrade} lang={lang} maxReachedLevel={isOnlineMatch ? 60 : maxReachedLevel} />)}
            {(!gameStarted || paused) && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 backdrop-blur-sm">
                    {!gameStarted ? (
                        <div className="text-center animate-bounce">
                            <h2 className="text-4xl font-black text-white mb-4">{isSpectator ? 'WATCH MATCH' : (isOnlineMatch ? (teammates.length > 0 ? 'ALLIANCE WAR' : 'PVP MATCH') : t.ready)}</h2>
                             {isOnlineMatch && <div className="text-xl text-blue-400 font-bold mb-4">{isSpectator ? opponentName : (teammates.length > 0 ? `TEAM vs ENEMY SQUAD` : `YOU vs ${opponentName}`)}</div>}
                            <button onClick={handleStartMatch} className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-lg text-2xl font-bold shadow-lg text-white">{isSpectator ? 'Start Watching' : t.go}</button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <h2 className="text-4xl font-black text-white mb-4">{t.paused}</h2>
                            <button onClick={handleTogglePause} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-2xl font-bold shadow-lg text-white">{t.resume}</button>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className={`w-full max-w-[85vw] flex flex-col items-center ${isSpectator ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
             <ControlPanel gold={gold} population={population} maxPopulation={maxPopulation} heroPopulation={heroPopulation} unitCounts={unitCounts} spawnQueue={spawnQueue} onBuyUnit={handleBuyUnit} onDismissUnit={handleDismissUnit} activeSkill={activeSkill} onUseSkill={(skill) => setActiveSkill(skill === activeSkill ? null : skill)} onSetStrategy={handleSetStrategy} onSetVanguardPct={handleSetVanguardPct} vanguardPointSet={vanguardPointSet} vanguardPercentage={vanguardPercentage} onBuyPopUpgrade={handleBuyPopUpgrade} onBuyPassiveGoldUpgrade={handleBuyPassiveGoldUpgrade} onBuyTower={handleBuyTower} towerCount={towerCount} passiveGoldLevel={isOnlineMatch ? engine.upgrades.passiveGold : (upgrades.passiveGold || 0)} rallyPointSet={rallyPointSet} patrolPointSet={patrolPointSet} cooldowns={cooldowns} activeTimers={activeTimers} maxDurations={maxDurations} lang={lang} />
          </div>
        </>
      )}

      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-600 text-center max-w-md shadow-2xl animate-fade-in relative overflow-hidden">
             <h2 className={`text-5xl font-black mb-4 ${gameState === 'VICTORY' ? 'text-green-500' : 'text-red-500'}`}>{isSpectator ? 'GAME OVER' : (gameState === 'VICTORY' ? t.victory : t.defeat)}</h2>
             
             {isOnlineMatch && isRankedMatchRef.current && matchResult && (
                 <div className="mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                     <div className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-2">Rank Update</div>
                     <div className="flex items-center justify-center gap-4 text-2xl font-mono font-bold">
                         <span className="text-slate-500">{matchResult.oldElo}</span>
                         <span className="text-slate-600">➜</span>
                         <span className="text-white">{matchResult.newElo}</span>
                     </div>
                     <div className={`text-xl font-bold mt-1 ${matchResult.eloChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {matchResult.eloChange >= 0 ? '+' : ''}{matchResult.eloChange} Elo
                     </div>
                     <div className="mt-2 text-yellow-500 font-bold uppercase tracking-wide">
                         {matchResult.currentRank}
                     </div>
                     {matchResult.isRankUp && <div className="text-xs text-green-400 animate-pulse mt-1">RANK UP!</div>}
                     {matchResult.streak > 1 && (
                         <div className="mt-2 text-xs font-bold text-orange-400 animate-pulse">
                             🔥 {matchResult.streak} WIN STREAK!
                         </div>
                     )}
                 </div>
             )}

             {!isOnlineMatch && gameState === 'VICTORY' && <div className="text-yellow-400 font-mono text-xl mb-2">{t.victoryDesc} <br/> ⏱️ {formatTime(timeElapsed)}</div>}
             
             <p className="text-slate-300 mb-8">
                {gameState === 'DEFEAT' ? (isSpectator ? 'Red Team Wins!' : t.defeatDesc) : ''}
                {gameState === 'VICTORY' && level === MAX_LEVEL && !isOnlineMatch && <div className="mt-4 text-yellow-400 font-bold text-xl animate-pulse">{t.finalWin}</div>}
             </p>
             <div className="flex gap-4 justify-center flex-wrap">
                {gameState === 'VICTORY' && level < MAX_LEVEL && !isOnlineMatch ? (
                     <button onClick={handleNextLevel} className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg text-white">{t.next}</button>
                ) : (
                    <>
                        {(!isOnlineMatch || !isRankedMatchRef.current) && (
                            <button onClick={handleRestart} className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold shadow-lg text-white">
                                {isOnlineMatch ? (isSpectator ? 'Replay' : 'Đấu Lại') : t.restart}
                            </button>
                        )}
                        <button onClick={() => { setEngine(null); if (isOnlineMatch) setGameState('ONLINE_LOBBY'); else setGameState('LEVEL_SELECT'); }} className="px-6 py-3 border border-slate-500 text-slate-400 hover:text-white rounded-lg font-bold">
                            {isOnlineMatch ? 'Về Sảnh' : t.menu}
                        </button>
                    </>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
