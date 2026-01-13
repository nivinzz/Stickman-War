
import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, GameRoom, Language } from '../types';
import { BOT_NAMES, LEVEL_THEMES } from '../constants';

interface OnlineLobbyProps {
  onStartMatch: (opponentName: string, opponentElo: number, mapThemeIndex: number, isSpectator?: boolean) => void;
  onBack: () => void;
  lang: Language;
}

// Helper to get random item (Moved outside to avoid TSX parsing ambiguity)
function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onStartMatch, onBack, lang }) => {
  const [view, setView] = useState<'LOGIN' | 'LOBBY'>('LOGIN');
  const [playerName, setPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState<'ROOMS' | 'RANK'>('ROOMS');
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMapIndex, setSelectedMapIndex] = useState<number>(-1); // -1 = Random

  // Refs for Simulation Loop to access latest state without re-rendering issues
  const leaderboardRef = useRef<PlayerProfile[]>([]);
  const roomsRef = useRef<GameRoom[]>([]);

  // Initialize Data & Ecosystem
  useEffect(() => {
    const savedName = localStorage.getItem('stickman_player_name');
    if (savedName) {
        setPlayerName(savedName);
        setView('LOBBY');
    }
    
    // 1. GENERATE 100 BOTS (One time)
    let fakeLb: PlayerProfile[] = [];
    const savedLb = localStorage.getItem('stickman_leaderboard_v3');
    
    if (savedLb) {
        fakeLb = JSON.parse(savedLb);
    } else {
        const shuffledNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
        // Ensure 100 bots
        while (shuffledNames.length < 100) {
            shuffledNames.push(`${getRandom(BOT_NAMES)}_${Math.floor(Math.random()*999)}`);
        }

        fakeLb = shuffledNames.slice(0, 100).map(name => {
            // Skewed distribution: Most around 1000-1500, some pros > 2000
            const matches = Math.floor(Math.random() * 800) + 50;
            const winRate = 0.4 + (Math.random() * 0.25); // 40% - 65% base
            // High Skill Bias
            const isPro = Math.random() > 0.9;
            const finalWinRate = isPro ? winRate + 0.15 : winRate;
            
            const wins = Math.floor(matches * Math.min(0.9, finalWinRate));
            const baseElo = 1000;
            const elo = Math.floor(baseElo + (wins * 25) - ((matches - wins) * 20));
            return {
                name,
                wins,
                matches,
                elo: Math.max(500, elo), // Min Elo
                status: 'IDLE'
            };
        });
        localStorage.setItem('stickman_leaderboard_v3', JSON.stringify(fakeLb));
    }
    
    setLeaderboard(fakeLb);
    leaderboardRef.current = fakeLb;

    // 2. GENERATE INITIAL ROOMS (25 Rooms)
    const roomNames = ["Pro Battle", "Vui Vẻ", "Solo Yasuo", "1vs1 Hard", "Noobs Only", "Vietnam #1", "HCM City", "Hanoi Server", "Cafe Gaming", "Thách Đấu", "Rank Cao", "Farm Vàng", "Test Tướng", "Đánh Cho Vui", "Giao Lưu", "Tuyển Ny", "Ai Solo Ko", "Phòng Vip", "Anh Em", "Clan War"];
    const initRooms: GameRoom[] = [];
    
    for(let i=0; i<25; i++) {
        const isPlaying = Math.random() > 0.4;
        // Pick a host from bots
        const potentialHosts = fakeLb.filter(p => p.status === 'IDLE');
        if (potentialHosts.length === 0) break;
        const host = getRandom(potentialHosts);
        host.status = isPlaying ? 'PLAYING' : 'WAITING';
        
        let guest: PlayerProfile | undefined;
        if (isPlaying) {
            const potentialGuests = fakeLb.filter(p => p.status === 'IDLE');
            if (potentialGuests.length > 0) {
                guest = getRandom(potentialGuests);
                guest.status = 'PLAYING';
            } else {
                host.status = 'IDLE'; continue; // Fail to make room
            }
        }

        initRooms.push({
            id: Math.random().toString(36).substr(2, 9),
            roomIdDisplay: `#${Math.floor(1000 + Math.random() * 9000)}`,
            name: `${getRandom(roomNames)}`,
            host: host.name,
            hostElo: host.elo,
            guest: guest?.name,
            guestElo: guest?.elo,
            status: isPlaying ? 'PLAYING' : 'WAITING',
            mapThemeIndex: Math.floor(Math.random() * 12),
            timer: isPlaying ? Math.floor(Math.random() * 10) : 0 // Random progress
        });
    }
    
    // Sort: Waiting first
    initRooms.sort((a, b) => (a.status === 'WAITING' ? -1 : 1));
    setRooms(initRooms);
    roomsRef.current = initRooms;

    // 3. START SIMULATION LOOP
    const interval = setInterval(runBotSimulation, 3000); // Every 3s
    return () => clearInterval(interval);
  }, []);

  // --- BOT SIMULATION LOGIC ---
  const runBotSimulation = () => {
      const lb = [...leaderboardRef.current];
      let currentRooms = [...roomsRef.current];
      let hasChanges = false;

      // A. END MATCHES (Bots finish fighting)
      // Probability to end match based on duration simulation
      currentRooms = currentRooms.filter(room => {
          if (room.status === 'PLAYING') {
              room.timer = (room.timer || 0) + 1;
              // Matches last approx 10-30 ticks (30s - 90s in sim time)
              if (room.timer > 10 && Math.random() > 0.7) {
                  // MATCH OVER
                  const host = lb.find(p => p.name === room.host);
                  const guest = lb.find(p => p.name === room.guest);
                  
                  if (host && guest) {
                      // Determine Winner based on Elo probability
                      // E_a = 1 / (1 + 10 ^ ((Rb - Ra) / 400))
                      const expectedHostWin = 1 / (1 + Math.pow(10, (guest.elo - host.elo) / 400));
                      const hostWon = Math.random() < expectedHostWin;
                      
                      if (hostWon) {
                          host.wins++; host.elo += 25; guest.elo = Math.max(0, guest.elo - 20);
                      } else {
                          guest.wins++; guest.elo += 25; host.elo = Math.max(0, host.elo - 20);
                      }
                      host.matches++; guest.matches++;
                      host.status = 'IDLE'; guest.status = 'IDLE';
                  }
                  hasChanges = true;
                  return false; // Remove room
              }
          }
          return true;
      });

      // B. BOT ACTIONS (Create/Join)
      const idleBots = lb.filter(p => p.status === 'IDLE');
      
      // 1. Join Waiting Rooms
      const waitingRooms = currentRooms.filter(r => r.status === 'WAITING');
      waitingRooms.forEach(room => {
          if (idleBots.length > 0 && Math.random() > 0.6) {
              const guest = idleBots.pop()!;
              room.guest = guest.name;
              room.guestElo = guest.elo;
              room.status = 'PLAYING';
              room.timer = 0;
              guest.status = 'PLAYING';
              const host = lb.find(p => p.name === room.host);
              if (host) host.status = 'PLAYING';
              hasChanges = true;
          }
      });

      // 2. Create New Rooms
      if (idleBots.length > 0 && currentRooms.length < 30 && Math.random() > 0.5) {
          const host = idleBots.pop()!;
          const roomNames = ["Giao Luu", "Solo", "1vs1", "Pro", "Test", "Rank", "Vui"];
          currentRooms.push({
              id: Math.random().toString(),
              roomIdDisplay: `#${Math.floor(1000 + Math.random() * 9000)}`,
              name: `${getRandom(roomNames)}`,
              host: host.name,
              hostElo: host.elo,
              status: 'WAITING',
              mapThemeIndex: Math.floor(Math.random() * 12),
              timer: 0
          });
          host.status = 'WAITING';
          hasChanges = true;
      }

      // C. Remove Old Waiting Rooms (Timeout)
      currentRooms = currentRooms.filter(r => {
          if (r.status === 'WAITING' && Math.random() > 0.95) {
              const host = lb.find(p => p.name === r.host);
              if (host) host.status = 'IDLE';
              hasChanges = true;
              return false;
          }
          return true;
      });

      if (hasChanges) {
          // Sort: Waiting first
          currentRooms.sort((a, b) => (a.status === 'WAITING' ? -1 : 1));
          roomsRef.current = currentRooms;
          setRooms(currentRooms);
          setLeaderboard(lb); // Update UI stats
      }
  };

  const handleLogin = () => {
    if (playerName.trim().length > 0) {
        localStorage.setItem('stickman_player_name', playerName);
        setView('LOBBY');
        
        // Add player to leaderboard if not exists
        setLeaderboard(prev => {
            const exists = prev.find(p => p.name === playerName);
            if (!exists) {
                const newProfile: PlayerProfile = { name: playerName, wins: 0, matches: 0, elo: 1000, status: 'IDLE' };
                leaderboardRef.current.push(newProfile); // Add to ref for sim
                return [...prev, newProfile];
            }
            return prev;
        });
    }
  };

  const handleCreateRoom = () => {
      setIsCreating(true);
      // Simulate "Waiting for opponent" - Bot joins after delay
      setTimeout(() => {
          setIsCreating(false);
          // Pick a random bot from leaderboard to challenge user
          const bot = getRandom(leaderboardRef.current);
          const map = selectedMapIndex === -1 ? Math.floor(Math.random() * 12) : selectedMapIndex;
          if (bot) {
              onStartMatch(bot.name, bot.elo, map, false);
          }
      }, 1500 + Math.random() * 2000);
  };

  const handleJoinRoom = (room: GameRoom) => {
      onStartMatch(room.host, room.hostElo, room.mapThemeIndex, false);
  };

  const handleWatchRoom = (room: GameRoom) => {
      // Spectator Mode
      // If Waiting, simulate a guest joining
      const p1 = room.host;
      const p1Elo = room.hostElo;
      let p2 = room.guest;
      let p2Elo = room.guestElo;

      if (!p2) {
          const bot = getRandom(leaderboardRef.current);
          if (bot) {
              p2 = bot.name;
              p2Elo = bot.elo;
          }
      }

      onStartMatch(`${p1} (E:${p1Elo}) vs ${p2} (E:${p2Elo})`, p1Elo, room.mapThemeIndex, true);
  };

  const filteredRooms = rooms.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roomIdDisplay.includes(searchQuery) ||
      r.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const labels = {
      VN: {
          title: "ĐẤU TRƯỜNG ONLINE",
          enterName: "Nhập tên chiến binh:",
          join: "Vào Ngay",
          rooms: "Danh Sách Phòng",
          rank: "Bảng Xếp Hạng",
          create: "Tạo Phòng",
          finding: "Đang tìm đối thủ...",
          back: "Quay Lại",
          host: "Chủ phòng",
          status: "Trạng thái",
          wins: "Thắng",
          elo: "Điểm Elo",
          playing: "Đang chơi",
          waiting: "Chờ...",
          watch: "Xem",
          search: "Tìm phòng (ID, Tên)...",
          map: "Bản đồ",
          random: "Ngẫu nhiên"
      },
      EN: {
          title: "ONLINE ARENA",
          enterName: "Enter Warrior Name:",
          join: "Enter",
          rooms: "Room List",
          rank: "Leaderboard",
          create: "Create Room",
          finding: "Searching for opponent...",
          back: "Back",
          host: "Host",
          status: "Status",
          wins: "Wins",
          elo: "Elo Rating",
          playing: "Playing",
          waiting: "Waiting",
          watch: "Watch",
          search: "Search room (ID, Name)...",
          map: "Map",
          random: "Random"
      }
  };

  const t = labels[lang];

  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-8">{t.title}</h2>
              <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl w-full max-w-md">
                  <label className="block text-slate-300 mb-2 font-bold">{t.enterName}</label>
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded mb-6 focus:outline-none focus:border-blue-500 text-lg"
                    placeholder="Player1..."
                  />
                  <div className="flex gap-4">
                    <button 
                        onClick={handleLogin}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-all"
                    >
                        {t.join}
                    </button>
                    <button 
                        onClick={onBack}
                        className="px-4 border border-slate-600 text-slate-400 hover:text-white rounded"
                    >
                        {t.back}
                    </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full max-w-5xl h-[80vh] flex flex-col animate-fade-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-blue-400 italic">{t.title}</h2>
            <div className="flex items-center gap-4">
                <span className="text-slate-300 font-bold">👤 {playerName}</span>
                <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-sm border border-slate-600">
                    {t.back}
                </button>
            </div>
        </div>

        <div className="flex gap-4 mb-4">
            <button 
                onClick={() => setActiveTab('ROOMS')}
                className={`flex-1 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'ROOMS' ? 'bg-slate-700 text-white border-t-2 border-blue-500' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
            >
                {t.rooms}
            </button>
            <button 
                onClick={() => setActiveTab('RANK')}
                className={`flex-1 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'RANK' ? 'bg-slate-700 text-white border-t-2 border-yellow-500' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
            >
                {t.rank}
            </button>
        </div>

        <div className="bg-slate-700 flex-1 rounded-b-lg rounded-tr-lg p-4 overflow-hidden shadow-xl border border-slate-600 relative">
            {activeTab === 'ROOMS' && (
                <div className="flex flex-col h-full">
                    {/* Search Bar */}
                    <div className="mb-4">
                        <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.search}
                            className="w-full bg-slate-800 border border-slate-600 text-white px-4 py-2 rounded focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {filteredRooms.map(room => (
                            <div key={room.id} className="bg-slate-800 p-3 rounded flex justify-between items-center hover:bg-slate-750 border border-slate-700">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-900 text-slate-400 text-xs px-1 rounded font-mono">{room.roomIdDisplay}</span>
                                        <div className="font-bold text-lg text-white">{room.name}</div>
                                        <span className="text-[10px] bg-indigo-900 text-indigo-300 px-2 rounded border border-indigo-700">
                                            {lang === 'VN' ? LEVEL_THEMES[room.mapThemeIndex].nameVn : LEVEL_THEMES[room.mapThemeIndex].nameEn}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 flex gap-4">
                                        <span>{t.host}: <span className="text-blue-300 font-bold">{room.host}</span> <span className="text-yellow-500">({room.hostElo})</span></span>
                                        {room.status === 'PLAYING' && (
                                            <span>VS <span className="text-red-300 font-bold">{room.guest}</span> <span className="text-yellow-500">({room.guestElo})</span></span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${room.status === 'WAITING' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                        {room.status === 'WAITING' ? t.waiting : t.playing}
                                    </span>
                                    {room.status === 'WAITING' ? (
                                        <button 
                                            onClick={() => handleJoinRoom(room)}
                                            className="px-6 py-2 rounded font-bold bg-blue-600 hover:bg-blue-500 text-white"
                                        >
                                            VS
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleWatchRoom(room)}
                                            className="px-6 py-2 rounded font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1"
                                        >
                                            👁️ {t.watch}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredRooms.length === 0 && <div className="text-center text-slate-500 italic py-4">No rooms found.</div>}
                    </div>
                    
                    {/* Create Room Section */}
                    <div className="pt-4 border-t border-slate-600 mt-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-300">{t.map}:</span>
                            <select 
                                value={selectedMapIndex}
                                onChange={(e) => setSelectedMapIndex(parseInt(e.target.value))}
                                className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1 flex-1 outline-none"
                            >
                                <option value={-1}>{t.random}</option>
                                {LEVEL_THEMES.slice(0, 12).map((theme, idx) => (
                                    <option key={idx} value={idx}>{lang === 'VN' ? theme.nameVn : theme.nameEn}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleCreateRoom}
                            disabled={isCreating}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded shadow-lg flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <span className="animate-pulse">{t.finding}</span>
                            ) : (
                                <><span>+</span> {t.create}</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'RANK' && (
                <div className="overflow-y-auto custom-scrollbar h-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-600">
                                <th className="p-3">#</th>
                                <th className="p-3">{t.host}</th>
                                <th className="p-3 text-right">{t.wins}</th>
                                <th className="p-3 text-right">{t.elo}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard
                                .sort((a,b) => b.elo - a.elo)
                                .map((p, idx) => (
                                <tr key={idx} className={`border-b border-slate-600/50 ${p.name === playerName ? 'bg-blue-900/30' : ''}`}>
                                    <td className="p-3 font-mono text-slate-500">
                                        {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : idx + 1}
                                    </td>
                                    <td className="p-3 font-bold text-white flex items-center gap-2">
                                        {p.name}
                                        {p.status === 'PLAYING' && <span className="text-[8px] bg-red-600 px-1 rounded">PLAYING</span>}
                                        {p.status === 'WAITING' && <span className="text-[8px] bg-green-600 px-1 rounded">WAITING</span>}
                                    </td>
                                    <td className="p-3 text-right text-green-400 font-mono">{p.wins}</td>
                                    <td className="p-3 text-right text-yellow-400 font-mono font-bold">{p.elo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
};

export default OnlineLobby;
