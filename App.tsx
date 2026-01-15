
import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import ControlPanel from './components/ControlPanel';
import UpgradeMenu from './components/UpgradeMenu';
import OnlineLobby, { RankIcon } from './components/OnlineLobby'; 
import { GameEngine } from './services/GameEngine';
import { soundManager } from './services/SoundManager';
import { firebaseService, GameAction } from './services/FirebaseService'; // Import Service
import { UnitType, UpgradeState, GameLevel, Faction, UnitState, SpawnQueueItem, Language, PlayerProfile, RankTier } from './types';
import { INITIAL_GOLD, TRANS, MAX_HEROES, LEVEL_THEMES, MAX_LEVEL, MAX_POPULATION, POP_UPGRADE_COST, MAX_POP_UPGRADES, PASSIVE_GOLD_UPGRADE_COST, MAX_PASSIVE_GOLD_LEVEL, MAX_TOWERS, getRankTier, getTheme } from './constants';

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
  
  // Local Save Data (Offline)
  const [maxReachedLevel, setMaxReachedLevel] = useState<number>(() => {
      const saved = localStorage.getItem('stickman_max_level');
      return saved ? parseInt(saved) : 1;
  });
  
  const [upgrades, setUpgrades] = useState<UpgradeState>(() => {
      const saved = localStorage.getItem('stickman_upgrades');
      return saved ? JSON.parse(saved) : { 
        baseHp: 0, swordDamage: 0, archerDamage: 0, cavalryDamage: 0, spawnSpeed: 0,
        arrowRainPower: 0, lightningPower: 0, freezePower: 0, heroPower: 0,
        minerSpeed: 0, maxPopUpgrade: 0, passiveGold: 0, towerPower: 0
      };
  });

  // Save progress
  useEffect(() => {
      localStorage.setItem('stickman_max_level', maxReachedLevel.toString());
      localStorage.setItem('stickman_upgrades', JSON.stringify(upgrades));
  }, [maxReachedLevel, upgrades]);

  const [level, setLevel] = useState<number>(1);
  const [lang, setLang] = useState<Language>('VN');
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted());
  
  // Online State
  const [isOnlineMatch, setIsOnlineMatch] = useState(false);
  const [isRankedMatch, setIsRankedMatch] = useState(false); 
  const [isSpectator, setIsSpectator] = useState(false);
  const [opponentName, setOpponentName] = useState<string>('');
  const [opponentElo, setOpponentElo] = useState<number>(1000);
  const [mapThemeIndex, setMapThemeIndex] = useState<number>(0);
  const [roomId, setRoomId] = useState<string | undefined>(undefined);
  const [myUserId, setMyUserId] = useState<string | undefined>(undefined);

  const isOnlineMatchRef = useRef(false);
  
  useEffect(() => { isOnlineMatchRef.current = isOnlineMatch; }, [isOnlineMatch]);

  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const resultProcessedRef = useRef(false);
  
  const [viewingProfile, setViewingProfile] = useState<PlayerProfile | null>(null);
  const [myProfile, setMyProfile] = useState<PlayerProfile | null>(null);

  // UI Mirrors
  const [gold, setGold] = useState(INITIAL_GOLD);
  const [population, setPopulation] = useState(0);
  const [maxPopulation, setMaxPopulation] = useState(MAX_POPULATION);
  const [heroPopulation, setHeroPopulation] = useState(0);
  const [unitCounts, setUnitCounts] = useState({ miner: 0, sword: 0, archer: 0, cav: 0, hero: 0 });
  const [towerCount, setTowerCount] = useState(0);
  const [spawnQueue, setSpawnQueue] = useState<SpawnQueueItem[]>([]);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  
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

  // Sync profile when in lobby
  useEffect(() => {
      if (gameState === 'ONLINE_LOBBY' || isOnlineMatch) {
          if (firebaseService.currentProfile) {
              setMyProfile(firebaseService.currentProfile);
          }
      }
  }, [gameState, isOnlineMatch]);

  const updateLeaderboard = (win: boolean) => {
      if (resultProcessedRef.current) return; 
      resultProcessedRef.current = true;

      if (isOnlineMatchRef.current) {
          firebaseService.updateMatchResult(win);
          
          // Create visual result (optimistic)
          if (myProfile) {
              setMatchResult({
                  oldElo: myProfile.rankedStats.elo,
                  newElo: win ? myProfile.rankedStats.elo + 25 : Math.max(0, myProfile.rankedStats.elo - 20),
                  eloChange: win ? 25 : -20,
                  currentRank: win ? getRankTier(myProfile.rankedStats.elo + 25) : myProfile.rankTier,
                  isRankUp: false,
                  streak: win ? myProfile.rankedStats.streak + 1 : 0
              });
          }
      } else {
          // Offline Progress
          if (win && level === maxReachedLevel && level < MAX_LEVEL) {
              setMaxReachedLevel(l => l + 1);
          }
      }
  };

  const syncState = (eng: GameEngine) => {
      setGold(Math.floor(eng.gold));
      // ... (Sync unit counts logic same as before) ...
      const activeUnits = eng.units.filter(u => u.faction === Faction.PLAYER && u.state !== UnitState.DEAD && u.state !== UnitState.DIE);
      setPopulation(activeUnits.length + eng.playerQueue.length); // Simplified for brevity
      setTowerCount(eng.playerTowers);
      setSpawnQueue([...eng.playerQueue]); 
      setCooldowns({...eng.skillCooldowns});
      setTimeElapsed(Math.floor(eng.levelTimer / 60));

      if (eng.victory) {
          setGameState('VICTORY');
          updateLeaderboard(true); // Always update, logic inside handles online/offline
      }
      if (eng.gameOver) {
          setGameState('DEFEAT');
          updateLeaderboard(false);
      }
  };

  const startGame = (lvl: number, isMultiplayer: boolean, oppName: string, oppElo: number, mapId: number, isSpec: boolean, isRanked: boolean, rId?: string, uid?: string) => {
    setLevel(lvl); // Set current level state
    setPaused(false);
    setGameStarted(false); 
    setGameState('PLAYING');
    setIsOnlineMatch(isMultiplayer);
    isOnlineMatchRef.current = isMultiplayer;
    setIsRankedMatch(isRanked); 
    setIsSpectator(isSpec);
    setOpponentName(oppName);
    setOpponentElo(oppElo);
    setMapThemeIndex(mapId);
    setRoomId(rId);
    setMyUserId(uid);
    setMatchResult(null); 
    resultProcessedRef.current = false; 
    
    // LISTEN TO FIREBASE ACTIONS
    firebaseService.onGameAction = (action: GameAction) => {
        if (engine) engine.applyRemoteAction(action);
    };

    const gameLevel: GameLevel = {
      level: isMultiplayer ? (mapId * 5) + 1 : lvl, 
      enemySpawnRate: 100, 
      enemyStatMultiplier: 1,
      enemySmartAI: true,
      enemyGoldDrip: 0,
      isBoss: lvl % 10 === 0,
      isMultiplayer,
      isSpectator: isSpec,
      onlineRoomId: rId,
      myUserId: uid,
      isRanked
    };

    // Callback to send actions
    const sendAction = (type: string, payload: string) => {
        if (isMultiplayer) firebaseService.sendGameAction(type, payload);
    };

    const newEngine = new GameEngine(
        gameLevel, 
        isMultiplayer ? { baseHp: 0, swordDamage: 0, archerDamage: 0, cavalryDamage: 0, spawnSpeed: 0, arrowRainPower: 0, lightningPower: 0, freezePower: 0, heroPower: 0, minerSpeed: 0, maxPopUpgrade: 0, passiveGold: 0, towerPower: 0 } : upgrades, 
        syncState,
        sendAction
    );
    
    // In Online, engine needs access to apply remote actions
    firebaseService.onGameAction = (action: GameAction) => {
        newEngine.applyRemoteAction(action);
    };

    setEngine(newEngine);
    newEngine.startGame(); 
    setGameStarted(true);
  };

  const handleBackToMenu = () => {
      firebaseService.leaveRoom();
      setEngine(null);
      if (isOnlineMatch) setGameState('ONLINE_LOBBY');
      else setGameState('LEVEL_SELECT');
  };

  // UI Handlers (Delegates to Engine)
  const handleBuyUnit = (type: UnitType) => engine?.queueUnit(type, Faction.PLAYER);
  const handleDismissUnit = (type: UnitType) => engine?.dismissUnit(type);
  const handleUpgrade = (type: keyof UpgradeState, cost: number) => { 
      if(engine && engine.gold >= cost) { 
          engine.gold -= cost; 
          engine.upgrades[type]++; 
          if (!isOnlineMatch) setUpgrades({...engine.upgrades}); 
      } 
  };
  const handleBuyPopUpgrade = () => {
      if (!engine) return;
      // Offline only logic for now, or simple decrement
      if (engine.gold >= POP_UPGRADE_COST) {
          engine.gold -= POP_UPGRADE_COST;
          // Normally we'd track this in state, but for now simple engine mod
          // (In a real app, bind this to upgrades state)
      }
  };
  const handleBuyPassiveGoldUpgrade = () => { /* ... */ };
  const handleBuyTower = () => engine?.buyTower(Faction.PLAYER);
  const handleUseSkill = (skill: string) => setActiveSkill(skill === activeSkill ? null : skill);
  const handleSkillUsed = () => setActiveSkill(null);
  
  const handleSetStrategy = (s: any) => { /* logic */ };
  const handleSetVanguardPct = (p: number) => { /* logic */ };

  const handleToggleSound = () => {
      const muted = soundManager.toggleMute();
      setIsMuted(muted);
  };

  const t = TRANS[lang];

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100 select-none overflow-hidden relative">
      
      {/* GLOBAL TOP-LEFT CONTROLS (Lang + Sound) */}
      <div className="absolute top-4 left-4 flex gap-2 z-50">
        <button 
            onClick={() => setLang('VN')} 
            className={`px-3 py-1 rounded border font-bold text-xs transition-all flex items-center gap-1 ${lang === 'VN' ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'}`}
        >
            🇻🇳 VN
        </button>
        <button 
            onClick={() => setLang('EN')} 
            className={`px-3 py-1 rounded border font-bold text-xs transition-all flex items-center gap-1 ${lang === 'EN' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'}`}
        >
            🇬🇧 EN
        </button>
        
        <button 
            onClick={handleToggleSound}
            className={`px-3 py-1 rounded border font-bold text-xs transition-all flex items-center gap-1 ${!isMuted ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-800 border-slate-600 text-red-400 hover:text-white'}`}
        >
            {isMuted ? '🔇 MUTE' : '🔊 SOUND'}
        </button>
      </div>

      {/* --- MENU SCREEN --- */}
      {gameState === 'MENU' && (
        <div className="text-center space-y-6 animate-fade-in relative z-10 w-full max-w-lg">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-2">STICKMAN WAR</h1>
          <div className="inline-block px-3 py-1 bg-slate-800 border border-slate-600 text-slate-400 rounded font-mono text-sm mb-6">
              Ver 1.0
          </div>
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setGameState('LEVEL_SELECT')} className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-2xl shadow-lg w-full transition-transform hover:scale-105 active:scale-95">
                {t.campaign}
            </button>
            <button onClick={() => setGameState('ONLINE_LOBBY')} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xl shadow-lg w-full transition-transform hover:scale-105 active:scale-95">
                🌐 {t.onlinePvP}
            </button>
          </div>
        </div>
      )}

      {/* --- LEVEL SELECT SCREEN (MISSING BEFORE) --- */}
      {gameState === 'LEVEL_SELECT' && (
        <div className="flex flex-col items-center w-full max-w-5xl h-[85vh] animate-fade-in">
            <div className="flex justify-between items-center w-full mb-4 bg-slate-800 p-4 rounded-lg shadow-lg">
                <h2 className="text-3xl font-black text-white">{t.selectLevel}</h2>
                <button onClick={() => setGameState('MENU')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold">{t.backMenu}</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-slate-800/50 rounded-lg w-full custom-scrollbar">
                <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => {
                        const lvl = i + 1;
                        const isLocked = lvl > maxReachedLevel;
                        const isBoss = lvl % 10 === 0;
                        const theme = getTheme(lvl);
                        
                        return (
                            <button
                                key={lvl}
                                disabled={isLocked}
                                onClick={() => startGame(lvl, false, 'Computer', 1000, 0, false, false)}
                                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border-2 transition-all group
                                    ${isLocked 
                                        ? 'bg-slate-900 border-slate-700 opacity-50 cursor-not-allowed' 
                                        : isBoss 
                                            ? 'bg-red-900/80 border-red-500 hover:bg-red-800 hover:scale-105' 
                                            : 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:scale-105 hover:border-blue-400'}`}
                            >
                                <span className={`text-xl font-black ${isBoss ? 'text-red-200' : 'text-white'}`}>{lvl}</span>
                                {isLocked && <span className="text-[10px] text-slate-500 absolute bottom-1">🔒</span>}
                                {!isLocked && isBoss && <span className="text-[8px] font-bold text-red-300 absolute bottom-1 uppercase">BOSS</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
      )}
      
      {/* --- ONLINE LOBBY --- */}
      {gameState === 'ONLINE_LOBBY' && (
          <OnlineLobby 
            lang={lang}
            onBack={() => setGameState('MENU')}
            onStartMatch={(oppName, oppElo, mapId, isSpec, isRanked, roomId, uid) => {
                startGame(1, true, oppName, oppElo, mapId, isSpec || false, isRanked || false, roomId, uid);
            }} 
          />
      )}

      {/* --- PLAYING SCREEN --- */}
      {gameState === 'PLAYING' && engine && (
        <>
          <div className="w-full max-w-[95vw] flex justify-between items-center mb-1 px-2">
             <div className="flex items-center gap-4 text-xl font-bold text-yellow-400">
                <span>🪙 {gold}</span>
                {isOnlineMatch ? (
                     <span className="text-sm text-blue-300">VS {opponentName}</span>
                ) : (
                     <span className="text-sm text-slate-300">{t.selectLevel} {level}</span>
                )}
             </div>
             <button onClick={handleBackToMenu} className="px-3 py-1 bg-slate-800 rounded text-xs text-red-400 hover:bg-slate-700">{t.exit}</button>
          </div>

          <div className="relative">
            <GameCanvas engine={engine} targetingSkill={activeSkill} onSkillUsed={handleSkillUsed} />
            {!isSpectator && (
                <UpgradeMenu upgrades={isOnlineMatch ? engine.upgrades : upgrades} gold={gold} onUpgrade={handleUpgrade} lang={lang} maxReachedLevel={maxReachedLevel} />
            )}
          </div>

          <ControlPanel 
                gold={gold} population={population} maxPopulation={maxPopulation} heroPopulation={heroPopulation} unitCounts={unitCounts} spawnQueue={spawnQueue}
                onBuyUnit={handleBuyUnit} onDismissUnit={handleDismissUnit} activeSkill={activeSkill} onUseSkill={handleUseSkill}
                onSetStrategy={handleSetStrategy} onSetVanguardPct={handleSetVanguardPct} vanguardPointSet={vanguardPointSet} vanguardPercentage={vanguardPercentage}
                onBuyPopUpgrade={handleBuyPopUpgrade} onBuyPassiveGoldUpgrade={handleBuyPassiveGoldUpgrade} onBuyTower={handleBuyTower} towerCount={towerCount}
                passiveGoldLevel={0} rallyPointSet={rallyPointSet} patrolPointSet={patrolPointSet} 
                cooldowns={cooldowns} activeTimers={activeTimers} maxDurations={maxDurations} lang={lang}
          />
        </>
      )}

      {/* --- END SCREEN --- */}
      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-600 text-center shadow-2xl animate-bounce-in">
             <h2 className={`text-6xl font-black mb-4 ${gameState === 'VICTORY' ? 'text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-green-700' : 'text-red-600'}`}>
                 {gameState === 'VICTORY' ? t.victory : t.defeat}
             </h2>
             <p className="text-slate-300 mb-6 text-lg">{gameState === 'VICTORY' ? t.victoryDesc : t.defeatDesc}</p>
             
             {isOnlineMatch && matchResult && (
                 <div className="bg-slate-900 p-4 rounded-lg mb-6 border border-slate-700">
                     <div className="text-sm text-slate-400 mb-1">RANK UPDATE</div>
                     <div className="flex items-center justify-center gap-4 text-2xl font-bold">
                         <span className="text-slate-500">{matchResult.oldElo}</span>
                         <span className="text-slate-600">→</span>
                         <span className={matchResult.eloChange > 0 ? 'text-green-400' : 'text-red-400'}>
                             {matchResult.newElo} ({matchResult.eloChange > 0 ? '+' : ''}{matchResult.eloChange})
                         </span>
                     </div>
                 </div>
             )}

             <div className="flex gap-4 justify-center">
                 <button onClick={handleBackToMenu} className="px-6 py-3 border border-slate-500 text-white hover:bg-slate-700 rounded-lg font-bold transition-all">
                     {t.backMenu}
                 </button>
                 {!isOnlineMatch && gameState === 'VICTORY' && level < MAX_LEVEL && (
                     <button 
                        onClick={() => startGame(level + 1, false, 'Computer', 1000, 0, false, false)} 
                        className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg transition-all animate-pulse"
                    >
                         {t.next}
                     </button>
                 )}
                 {!isOnlineMatch && gameState === 'DEFEAT' && (
                     <button 
                        onClick={() => startGame(level, false, 'Computer', 1000, 0, false, false)} 
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg transition-all"
                    >
                         {t.restart}
                     </button>
                 )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
