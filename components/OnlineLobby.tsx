
import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, Language, RankTier } from '../types';
import { generateBotNames, LEVEL_THEMES, getRankTier } from '../constants';

interface OnlineLobbyProps {
  onStartMatch: (opponentName: string, opponentElo: number, mapThemeIndex: number, isSpectator?: boolean) => void;
  onBack: () => void;
  lang: Language;
}

// Helper to get random item
function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const getAdjacentTiers = (current: RankTier): RankTier[] => {
    const tiers = Object.values(RankTier);
    const idx = tiers.indexOf(current);
    const min = Math.max(0, idx - 1);
    const max = Math.min(tiers.length - 1, idx + 1);
    return tiers.slice(min, max + 1);
};

// --- NEW RANK ICON COMPONENT ---
export const RankIcon: React.FC<{ tier: RankTier, className?: string }> = ({ tier, className }) => {
    // Define Gradients and Shapes based on Tier
    const getDefs = () => (
        <defs>
            <linearGradient id="gradBronze" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#cd7f32" />
                <stop offset="50%" stopColor="#8c5a2b" />
                <stop offset="100%" stopColor="#5c3a1b" />
            </linearGradient>
            <linearGradient id="gradSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="gradGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>
            <linearGradient id="gradPlatinum" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#0891b2" />
                <stop offset="100%" stopColor="#164e63" />
            </linearGradient>
            <linearGradient id="gradDiamond" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id="gradChallenger" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#7e22ce" />
                <stop offset="100%" stopColor="#3b0764" />
            </linearGradient>
            <linearGradient id="gradLegend" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
    );

    const renderShape = () => {
        switch (tier) {
            case RankTier.BRONZE:
                return (
                    <g>
                        <path d="M50 10 L90 30 L50 95 L10 30 Z" fill="url(#gradBronze)" stroke="#5c3a1b" strokeWidth="2" />
                        <path d="M50 20 L80 35 L50 85 L20 35 Z" fill="#ffffff" fillOpacity="0.2" />
                    </g>
                );
            case RankTier.SILVER:
                return (
                    <g>
                        <path d="M50 5 L95 50 L50 95 L5 50 Z" fill="url(#gradSilver)" stroke="#475569" strokeWidth="2" />
                        <path d="M50 15 L85 50 L50 85 L15 50 Z" fill="none" stroke="#fff" strokeWidth="1" opacity="0.5" />
                    </g>
                );
            case RankTier.GOLD:
                return (
                    <g>
                        <path d="M50 5 L95 35 L80 90 L20 90 L5 35 Z" fill="url(#gradGold)" stroke="#854d0e" strokeWidth="2" />
                        <path d="M50 20 L80 40 L70 80 L30 80 L20 40 Z" fill="#fff" fillOpacity="0.2" />
                        <circle cx="50" cy="50" r="10" fill="#fff" fillOpacity="0.4" />
                    </g>
                );
            case RankTier.PLATINUM:
                return (
                    <g>
                        <path d="M50 5 L85 25 L85 75 L50 95 L15 75 L15 25 Z" fill="url(#gradPlatinum)" stroke="#164e63" strokeWidth="2" />
                        <path d="M50 5 L85 25 M85 75 L50 95 M15 75 L50 95 M15 75 L15 25 M15 25 L50 5" stroke="#fff" strokeWidth="1" opacity="0.6" />
                        <path d="M50 25 L70 35 L70 65 L50 75 L30 65 L30 35 Z" fill="#0891b2" stroke="#fff" strokeWidth="1" />
                    </g>
                );
            case RankTier.DIAMOND:
                return (
                    <g>
                        <path d="M50 0 L80 20 L100 50 L80 80 L50 100 L20 80 L0 50 L20 20 Z" fill="url(#gradDiamond)" stroke="#1e3a8a" strokeWidth="2" />
                        <circle cx="50" cy="50" r="25" fill="#2563eb" stroke="#93c5fd" strokeWidth="2" />
                        <path d="M50 25 L75 50 L50 75 L25 50 Z" fill="#93c5fd" />
                    </g>
                );
            case RankTier.CHALLENGER:
                return (
                    <g filter="url(#glow)">
                        <path d="M50 100 L20 80 L20 30 L50 5 L80 30 L80 80 Z" fill="url(#gradChallenger)" stroke="#3b0764" strokeWidth="3" />
                        <path d="M15 30 L0 10 L30 20 Z" fill="#a855f7" />
                        <path d="M85 30 L100 10 L70 20 Z" fill="#a855f7" />
                        <ellipse cx="50" cy="50" rx="15" ry="20" fill="#3b0764" />
                        <ellipse cx="50" cy="50" rx="8" ry="12" fill="#d8b4fe" />
                    </g>
                );
            case RankTier.LEGEND:
                return (
                    <g filter="url(#glow)">
                        <path d="M50 95 L20 70 L10 20 L30 40 L50 10 L70 40 L90 20 L80 70 Z" fill="url(#gradLegend)" stroke="#7f1d1d" strokeWidth="2" />
                        <path d="M50 95 L50 50" stroke="#fca5a5" strokeWidth="2" />
                        <circle cx="50" cy="35" r="8" fill="#fff" />
                        <path d="M10 20 L30 40 M90 20 L70 40" stroke="#fca5a5" strokeWidth="2" />
                    </g>
                );
            default:
                return null;
        }
    };

    return (
        <svg viewBox="0 0 100 100" className={`drop-shadow-lg ${className || 'w-12 h-12'}`}>
            {getDefs()}
            {renderShape()}
        </svg>
    );
};

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onStartMatch, onBack, lang }) => {
  const [view, setView] = useState<'LOGIN' | 'HOME' | 'CUSTOM_ROOM' | 'RANK_SEARCH'>('LOGIN');
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<PlayerProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);
  
  const [customMapIndex, setCustomMapIndex] = useState(0);
  const [customOpponent, setCustomOpponent] = useState<PlayerProfile | null>(null);
  const [searchTimer, setSearchTimer] = useState(0);
  
  const leaderboardRef = useRef<PlayerProfile[]>([]);
  const currentPlayerNameRef = useRef<string>('');

  useEffect(() => {
    const savedName = localStorage.getItem('stickman_player_name');
    if (savedName) {
        setPlayerName(savedName);
        currentPlayerNameRef.current = savedName;
        setView('HOME');
    }
    
    let fakeLb: PlayerProfile[] = [];
    const savedLb = localStorage.getItem('stickman_bots_v4'); 
    
    if (savedLb) {
        fakeLb = JSON.parse(savedLb);
    } else {
        const generatedNames = generateBotNames(600);
        fakeLb = generatedNames.map(name => {
            const r = Math.random();
            let baseElo = 0;
            if (r < 0.4) baseElo = Math.random() * 250;
            else if (r < 0.7) baseElo = 250 + Math.random() * 300;
            else if (r < 0.85) baseElo = 550 + Math.random() * 350;
            else if (r < 0.95) baseElo = 900 + Math.random() * 400;
            else baseElo = 1300 + Math.random() * 1000;

            baseElo = Math.floor(baseElo);
            
            const rankMatches = Math.floor(Math.random() * 300) + 10;
            const rankWinRate = 0.3 + ((baseElo / 2500) * 0.4); 
            const rankWins = Math.floor(rankMatches * rankWinRate);
            const casualMatches = Math.floor(Math.random() * 200);
            const casualWins = Math.floor(casualMatches * (0.4 + Math.random() * 0.2));

            return {
                name,
                rankedStats: {
                    wins: rankWins,
                    losses: rankMatches - rankWins,
                    elo: baseElo,
                    streak: Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0
                },
                casualStats: {
                    wins: casualWins,
                    losses: casualMatches - casualWins
                },
                rankTier: getRankTier(baseElo),
                status: 'IDLE'
            };
        });
        localStorage.setItem('stickman_bots_v4', JSON.stringify(fakeLb));
    }

    setLeaderboard(fakeLb);
    leaderboardRef.current = fakeLb;

    const interval = setInterval(runBotSimulation, 5000); 
    return () => clearInterval(interval);
  }, []);

  const runBotSimulation = () => {
      const lb = [...leaderboardRef.current];
      const myName = currentPlayerNameRef.current;

      const botIndices = lb
        .map((p, index) => ({ p, index }))
        .filter(item => item.p.name !== myName)
        .map(item => item.index);

      for(let k=0; k<20; k++) {
          if (botIndices.length < 2) break;
          const rand1 = Math.floor(Math.random() * botIndices.length);
          const idx1 = botIndices[rand1];
          botIndices.splice(rand1, 1);

          const rand2 = Math.floor(Math.random() * botIndices.length);
          const idx2 = botIndices[rand2];
          botIndices.splice(rand2, 1);

          const bot1 = lb[idx1];
          const bot2 = lb[idx2];
          
          const isRanked = Math.random() > 0.3; 

          if (isRanked) {
             const expectedWin1 = 1 / (1 + Math.pow(10, (bot2.rankedStats.elo - bot1.rankedStats.elo) / 400));
             const bot1Wins = Math.random() < expectedWin1;
             
             if (bot1Wins) {
                 bot1.rankedStats.wins++; bot1.rankedStats.elo += 25; 
                 bot2.rankedStats.losses++; bot2.rankedStats.elo = Math.max(0, bot2.rankedStats.elo - 20);
             } else {
                 bot2.rankedStats.wins++; bot2.rankedStats.elo += 25; 
                 bot1.rankedStats.losses++; bot1.rankedStats.elo = Math.max(0, bot1.rankedStats.elo - 20);
             }
             bot1.rankTier = getRankTier(bot1.rankedStats.elo);
             bot2.rankTier = getRankTier(bot2.rankedStats.elo);
          } else {
             if (Math.random() > 0.5) { bot1.casualStats.wins++; bot2.casualStats.losses++; }
             else { bot2.casualStats.wins++; bot1.casualStats.losses++; }
          }
      }
      leaderboardRef.current = lb;
      setLeaderboard(lb); 
      localStorage.setItem('stickman_bots_v4', JSON.stringify(lb));
  };

  const handleLogin = () => {
    let cleanName = playerName.trim();
    if (cleanName.length > 0) {
        if (cleanName.includes('@')) {
            cleanName = cleanName.split('@')[0];
        }
        cleanName = cleanName.substring(0, 10);
        
        localStorage.setItem('stickman_player_name', cleanName);
        setPlayerName(cleanName); 
        currentPlayerNameRef.current = cleanName;
        setView('HOME');
        
        setLeaderboard(prev => {
            const exists = prev.find(p => p.name === cleanName);
            if (!exists) {
                const newProfile: PlayerProfile = { 
                    name: cleanName, 
                    rankedStats: { wins: 0, losses: 0, elo: 100, streak: 0 },
                    casualStats: { wins: 0, losses: 0 },
                    rankTier: RankTier.BRONZE, 
                    status: 'IDLE' 
                };
                const newLb = [newProfile, ...prev];
                leaderboardRef.current = newLb;
                localStorage.setItem('stickman_bots_v4', JSON.stringify(newLb));
                return newLb;
            }
            return prev;
        });
    }
  };

  const handleCreateRoom = () => {
      setCustomOpponent(null);
      setCustomMapIndex(0);
      setView('CUSTOM_ROOM');
  };

  const handleInviteBot = () => {
      const bots = leaderboardRef.current.filter(p => p.name !== playerName);
      const bot = getRandom(bots);
      setCustomOpponent(bot);
  };
  
  const handleAutoFindCustom = () => {
      const myProfile = leaderboardRef.current.find(p => p.name === playerName) || { rankedStats: {elo: 100} };
      const myElo = myProfile.rankedStats?.elo || 100;
      const candidates = leaderboardRef.current.filter(p => 
          p.name !== playerName && 
          Math.abs(p.rankedStats.elo - myElo) < 300
      );
      const pool = candidates.length > 0 ? candidates : leaderboardRef.current.filter(p => p.name !== playerName);
      const bot = getRandom(pool);
      setCustomOpponent(bot);
  };

  const handleStartCustom = () => {
      if (customOpponent) {
          onStartMatch(customOpponent.name, customOpponent.rankedStats.elo, customMapIndex, false);
      }
  };

  const handleFindRanked = () => {
      setView('RANK_SEARCH');
      setSearchTimer(0);
  };

  useEffect(() => {
      let interval: number;
      if (view === 'RANK_SEARCH') {
          interval = window.setInterval(() => {
              setSearchTimer(prev => prev + 1);
              if (searchTimer > 2 && Math.random() > 0.7) {
                  const myProfile = leaderboardRef.current.find(p => p.name === playerName) || { rankedStats: {elo: 100}, rankTier: RankTier.BRONZE };
                  const currentTier = myProfile.rankTier || RankTier.BRONZE;
                  const targetTiers = getAdjacentTiers(currentTier);
                  
                  const candidates = leaderboardRef.current.filter(p => 
                      p.name !== playerName && 
                      p.rankTier && targetTiers.includes(p.rankTier)
                  );
                  
                  const pool = candidates.length > 0 ? candidates : leaderboardRef.current.filter(p => p.name !== playerName);
                  
                  let opponent: PlayerProfile | undefined;
                  if (pool.length > 0) {
                      opponent = getRandom<PlayerProfile>(pool);
                  }

                  if (opponent) {
                      const randomMap = Math.floor(Math.random() * 12);
                      onStartMatch(opponent.name, opponent.rankedStats.elo, randomMap, false);
                      clearInterval(interval);
                  }
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [view, searchTimer, playerName, onStartMatch]);

  const renderRankBadge = (tier?: RankTier, elo?: number) => {
      if (!tier) tier = RankTier.BRONZE;
      return (
          <div className="flex flex-col items-center justify-center relative group">
              <RankIcon tier={tier} className="w-12 h-12 md:w-14 md:h-14" />
              {elo !== undefined && (
                  <span className="text-[10px] text-yellow-500 font-mono mt-[-2px] font-bold z-10 bg-black/50 px-1 rounded backdrop-blur-sm border border-slate-700">
                      {elo}
                  </span>
              )}
          </div>
      );
  };

  const renderDetailModal = () => {
      if (!selectedProfile) return null;
      return (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedProfile(null)}>
              <div className="bg-slate-800 border-2 border-slate-600 p-6 rounded-xl w-full max-w-sm shadow-2xl relative animate-fade-in" onClick={e => e.stopPropagation()}>
                  <button className="absolute top-2 right-4 text-slate-400 hover:text-white text-xl" onClick={() => setSelectedProfile(null)}>✕</button>
                  
                  <div className="flex flex-col items-center mb-6">
                       <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center text-4xl border-2 border-blue-500 mb-2 relative overflow-hidden">
                           <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 opacity-50"></div>
                           <span className="z-10">👤</span>
                       </div>
                       <h3 className="text-2xl font-black text-white tracking-wide uppercase">{selectedProfile.name}</h3>
                       <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Warrior Profile</div>
                  </div>

                  {/* STATS GRID */}
                  <div className="space-y-4">
                      {/* RANKED */}
                      <div className="bg-slate-900/80 p-4 rounded-lg border border-indigo-500/30 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">🏆</div>
                          <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 relative z-10">
                              <span className="font-bold text-indigo-400 tracking-wider">RANKED SEASON</span>
                              {renderRankBadge(selectedProfile.rankTier, selectedProfile.rankedStats.elo)}
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 text-sm relative z-10">
                              <div className="text-slate-400">Wins: <span className="text-green-400 font-bold text-lg">{selectedProfile.rankedStats.wins}</span></div>
                              <div className="text-slate-400">Losses: <span className="text-red-400 font-bold text-lg">{selectedProfile.rankedStats.losses}</span></div>
                              <div className="text-slate-400">Win Streak: <span className="text-orange-400 font-bold">🔥 {selectedProfile.rankedStats.streak}</span></div>
                              <div className="text-slate-400">Rating: <span className="text-yellow-400 font-bold">{selectedProfile.rankedStats.elo}</span></div>
                          </div>
                      </div>

                      {/* CASUAL */}
                      <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-600/30 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">⚔️</div>
                          <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2 relative z-10">
                              <span className="font-bold text-slate-400 tracking-wider">FRIENDLY MATCHES</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm relative z-10">
                              <div className="text-slate-400">Wins: <span className="text-green-400 font-bold">{selectedProfile.casualStats.wins}</span></div>
                              <div className="text-slate-400">Losses: <span className="text-red-400 font-bold">{selectedProfile.casualStats.losses}</span></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // ... rest of the file stays same
  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-8">ONLINE ARENA</h2>
              <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl w-full max-w-md">
                  <label className="block text-slate-300 mb-2 font-bold">Warrior Name (or Email):</label>
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded mb-6 focus:outline-none focus:border-blue-500 text-lg"
                    placeholder="e.g. name@email.com"
                  />
                  <div className="flex gap-4">
                    <button 
                        onClick={handleLogin}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-all"
                    >
                        Join Arena
                    </button>
                    <button 
                        onClick={onBack}
                        className="px-4 border border-slate-600 text-slate-400 hover:text-white rounded"
                    >
                        Back
                    </button>
                  </div>
                  <p className="text-slate-500 text-xs mt-4 text-center">
                      * Nhập email sẽ tự động lấy 10 ký tự đầu làm tên (Ví dụ: abc@gmail.com -> abc)
                  </p>
              </div>
          </div>
      );
  }

  const myProfile = leaderboard.find(p => p.name === playerName);

  return (
    <div className="w-full max-w-6xl h-[85vh] flex flex-col animate-fade-in bg-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-700 relative">
        {renderDetailModal()}

        {/* HEADER - ENHANCED FOR VISIBILITY */}
        <div className="bg-slate-800 p-4 border-b border-slate-600 flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xl">←</button>
                <h2 className="text-2xl font-black italic text-blue-400">ONLINE ARENA</h2>
            </div>
            
            <div 
                className="flex items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-2 rounded-xl border border-blue-500/50 cursor-pointer hover:bg-slate-800 transition-all shadow-lg hover:scale-105" 
                onClick={() => myProfile && setSelectedProfile(myProfile)}
            >
                <div className="flex flex-col items-end">
                    <span className="font-bold text-white text-xl tracking-wide">{playerName}</span>
                    <span className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">View Profile</span>
                </div>
                {/* RANK ICON DISPLAY IN HEADER */}
                <div className="bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                    {myProfile && renderRankBadge(myProfile.rankTier, myProfile.rankedStats.elo)}
                </div>
            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* LEFT: MODE SELECTION (Visible in HOME) */}
            {view === 'HOME' && (
                <div className="flex-1 p-8 flex flex-col justify-center items-center gap-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat">
                     {/* RANKED BUTTON */}
                     <button 
                        onClick={handleFindRanked}
                        className="group w-full max-w-md h-32 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg border border-indigo-400 flex items-center justify-between px-8 hover:scale-105 transition-all relative overflow-hidden"
                     >
                         <div className="z-10 text-left">
                             <div className="text-3xl font-black text-white italic">RANKED MATCH</div>
                             <div className="text-indigo-200">Play for Elo & Rank.</div>
                         </div>
                         <div className="z-10 transform group-hover:scale-110 transition-transform duration-300">
                             <RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-16 h-16" />
                         </div>
                         <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </button>

                     {/* FRIENDLY BUTTON */}
                     <button 
                        onClick={handleCreateRoom}
                        className="group w-full max-w-md h-24 bg-slate-700 hover:bg-slate-600 rounded-xl shadow-lg border border-slate-500 flex items-center justify-between px-8 transition-all"
                     >
                         <div className="text-left">
                             <div className="text-2xl font-bold text-white">FRIENDLY / CUSTOM</div>
                             <div className="text-slate-400 text-sm">No Elo loss. Practice.</div>
                         </div>
                         <div className="text-4xl group-hover:rotate-12 transition-transform">⚔️</div>
                     </button>
                </div>
            )}

            {/* CUSTOM ROOM VIEW */}
            {view === 'CUSTOM_ROOM' && (
                <div className="flex-1 flex flex-col p-8 bg-slate-900/50">
                    <div className="flex-1 flex items-center justify-center gap-8">
                         {/* PLAYER CARD */}
                         <div className="w-64 h-80 bg-slate-800 border-2 border-blue-500 rounded-xl flex flex-col items-center justify-center gap-4 shadow-blue-900/20 shadow-xl">
                             <div className="text-6xl">👤</div>
                             <div className="text-xl font-bold text-white">{playerName}</div>
                             {myProfile && renderRankBadge(myProfile.rankTier, myProfile.rankedStats.elo)}
                             <div className="mt-4 text-green-400 font-bold px-3 py-1 bg-green-900/30 rounded">READY</div>
                         </div>

                         <div className="text-4xl font-black text-red-500 italic">VS</div>

                         {/* OPPONENT CARD */}
                         <div className="w-64 h-80 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-4 relative">
                             {customOpponent ? (
                                 <>
                                     <div className="absolute top-2 right-2 cursor-pointer text-slate-500 hover:text-red-500" onClick={() => setCustomOpponent(null)}>✕</div>
                                     <div className="text-6xl">🤖</div>
                                     <div className="text-xl font-bold text-white">{customOpponent.name}</div>
                                     {renderRankBadge(customOpponent.rankTier, customOpponent.rankedStats.elo)}
                                     <div className="mt-4 text-green-400 font-bold px-3 py-1 bg-green-900/30 rounded">READY</div>
                                 </>
                             ) : (
                                 <>
                                    <button onClick={handleInviteBot} className="w-16 h-16 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-3xl mb-2 text-slate-300">+</button>
                                    <div className="text-slate-500 font-bold">Invite Opponent</div>
                                    <button onClick={handleAutoFindCustom} className="mt-4 text-xs text-blue-400 hover:underline">Auto Find Bot</button>
                                 </>
                             )}
                         </div>
                    </div>

                    {/* BOTTOM CONTROLS */}
                    <div className="h-24 bg-slate-800 rounded-lg p-4 flex items-center justify-between border-t border-slate-600">
                         <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-400">MAP:</span>
                             <select 
                                value={customMapIndex}
                                onChange={(e) => setCustomMapIndex(parseInt(e.target.value))}
                                className="bg-slate-900 text-white p-2 rounded border border-slate-600 outline-none w-48"
                             >
                                 {LEVEL_THEMES.map((t, i) => (
                                     <option key={i} value={i}>{lang === 'VN' ? t.nameVn : t.nameEn}</option>
                                 ))}
                             </select>
                         </div>

                         <div className="flex gap-4">
                             <button onClick={() => setView('HOME')} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded">Exit Room</button>
                             <button 
                                onClick={handleStartCustom}
                                disabled={!customOpponent}
                                className={`px-8 py-3 font-bold rounded text-xl shadow-lg transition-all ${customOpponent ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                             >
                                 START GAME
                             </button>
                         </div>
                    </div>
                </div>
            )}

            {/* RANK SEARCH VIEW */}
            {view === 'RANK_SEARCH' && (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10 animate-slide"></div>
                    
                    <div className="z-10 flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full border-4 border-slate-700 flex items-center justify-center animate-spin-slow relative mb-8">
                             <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                             <RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-16 h-16 animate-pulse" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">SEARCHING...</h2>
                        <div className="text-slate-400 font-mono text-xl">{searchTimer}s</div>
                        <div className="mt-4 px-4 py-2 bg-slate-800 rounded border border-slate-600 text-sm text-slate-300">
                            Looking for players near <span className="text-yellow-400 font-bold">{myProfile?.rankedStats.elo || 100} Elo</span>...
                        </div>
                        
                        <button onClick={() => setView('HOME')} className="mt-12 px-6 py-2 border border-red-500 text-red-500 hover:bg-red-900/30 rounded">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* RIGHT: LEADERBOARD (Always visible in HOME & CUSTOM) */}
            {view !== 'RANK_SEARCH' && (
                <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
                    <div className="p-3 bg-slate-900 border-b border-slate-700 font-bold text-yellow-400 text-center uppercase tracking-widest">
                        Leaderboard
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                         <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-slate-800 sticky top-0 z-10">
                                <tr className="text-slate-500 text-xs uppercase shadow-sm">
                                    <th className="p-2">#</th>
                                    <th className="p-2">Name</th>
                                    <th className="p-2 text-right">Rank</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard
                                    .sort((a,b) => b.rankedStats.elo - a.rankedStats.elo)
                                    .slice(0, 50) // Show top 50
                                    .map((p, idx) => (
                                    <tr 
                                        key={idx} 
                                        onClick={() => setSelectedProfile(p)}
                                        className={`border-b border-slate-700/50 cursor-pointer transition-colors ${p.name === playerName ? 'bg-blue-900/40' : 'hover:bg-slate-700/30'}`}
                                    >
                                        <td className="p-2 font-mono text-slate-500 w-8 text-center">
                                            {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                                        </td>
                                        <td className="p-2 text-white overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                                            <div className="font-bold">{p.name}</div>
                                            <div className="text-[10px] text-slate-400">{p.rankTier}</div>
                                        </td>
                                        <td className="p-2 text-right">
                                            <div className="flex justify-end">
                                                {renderRankBadge(p.rankTier, p.rankedStats.elo)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Passive Update Info */}
                    <div className="p-2 text-[10px] text-slate-500 text-center bg-slate-900">
                        Top 50 Ranking (Elo based)
                    </div>
                </div>
            )}

        </div>
    </div>
  );
};

export default OnlineLobby;
