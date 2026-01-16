
import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, Language, RankTier, ChatMessage, LobbyRoom } from '../types';
import { generateBotNames, LEVEL_THEMES, getRankTier, NAMES_VN, ROOM_NAMES_VN, ROOM_NAMES_EN, getAvatarUrl, CHAT_TEMPLATES_VN, CHAT_TEMPLATES_EN, CHAT_TOPICS } from '../constants';

interface OnlineLobbyProps {
  onStartMatch: (opponentName: string, opponentElo: number, mapThemeIndex: number, isSpectator?: boolean, isRanked?: boolean) => void;
  onBack: () => void;
  lang: Language;
}

// Keys for "Fake Server"
const STORAGE_KEY_CHAT = 'stickman_global_chat_v1';
const STORAGE_KEY_USER_ROOMS = 'stickman_user_rooms_v1';
const STORAGE_KEY_BOT_ROOMS = 'stickman_bot_rooms_v1'; // NEW: Persist bot rooms

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

// Reuse RankIcon
export const RankIcon: React.FC<{ tier: RankTier, className?: string }> = ({ tier, className }) => {
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
            case RankTier.BRONZE: return (<g><path d="M50 10 L90 30 L50 95 L10 30 Z" fill="url(#gradBronze)" stroke="#5c3a1b" strokeWidth="2" /><path d="M50 20 L80 35 L50 85 L20 35 Z" fill="#ffffff" fillOpacity="0.2" /></g>);
            case RankTier.SILVER: return (<g><path d="M50 5 L95 50 L50 95 L5 50 Z" fill="url(#gradSilver)" stroke="#475569" strokeWidth="2" /><path d="M50 15 L85 50 L50 85 L15 50 Z" fill="none" stroke="#fff" strokeWidth="1" opacity="0.5" /></g>);
            case RankTier.GOLD: return (<g><path d="M50 5 L95 35 L80 90 L20 90 L5 35 Z" fill="url(#gradGold)" stroke="#854d0e" strokeWidth="2" /><path d="M50 20 L80 40 L70 80 L30 80 L20 40 Z" fill="#fff" fillOpacity="0.2" /><circle cx="50" cy="50" r="10" fill="#fff" fillOpacity="0.4" /></g>);
            case RankTier.PLATINUM: return (<g><path d="M50 5 L85 25 L85 75 L50 95 L15 75 L15 25 Z" fill="url(#gradPlatinum)" stroke="#164e63" strokeWidth="2" /><path d="M50 5 L85 25 M85 75 L50 95 M15 75 L50 95 M15 75 L15 25 M15 25 L50 5" stroke="#fff" strokeWidth="1" opacity="0.6" /><path d="M50 25 L70 35 L70 65 L50 75 L30 65 L30 35 Z" fill="#0891b2" stroke="#fff" strokeWidth="1" /></g>);
            case RankTier.DIAMOND: return (<g><path d="M50 0 L80 20 L100 50 L80 80 L50 100 L20 80 L0 50 L20 20 Z" fill="url(#gradDiamond)" stroke="#1e3a8a" strokeWidth="2" /><circle cx="50" cy="50" r="25" fill="#2563eb" stroke="#93c5fd" strokeWidth="2" /><path d="M50 25 L75 50 L50 75 L25 50 Z" fill="#93c5fd" /></g>);
            case RankTier.CHALLENGER: return (<g filter="url(#glow)"><path d="M50 100 L20 80 L20 30 L50 5 L80 30 L80 80 Z" fill="url(#gradChallenger)" stroke="#3b0764" strokeWidth="3" /><path d="M15 30 L0 10 L30 20 Z" fill="#a855f7" /><path d="M85 30 L100 10 L70 20 Z" fill="#a855f7" /><ellipse cx="50" cy="50" rx="15" ry="20" fill="#3b0764" /><ellipse cx="50" cy="50" rx="8" ry="12" fill="#d8b4fe" /></g>);
            case RankTier.LEGEND: return (<g filter="url(#glow)"><path d="M50 95 L20 70 L10 20 L30 40 L50 10 L70 40 L90 20 L80 70 Z" fill="url(#gradLegend)" stroke="#7f1d1d" strokeWidth="2" /><path d="M50 95 L50 50" stroke="#fca5a5" strokeWidth="2" /><circle cx="50" cy="35" r="8" fill="#fff" /><path d="M10 20 L30 40 M90 20 L70 40" stroke="#fca5a5" strokeWidth="2" /></g>);
            default: return null;
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
  
  // Custom Room State
  const [roomName, setRoomName] = useState('');
  const [roomIdDisplay, setRoomIdDisplay] = useState('');
  const [customMapIndex, setCustomMapIndex] = useState(0);
  const [customOpponent, setCustomOpponent] = useState<PlayerProfile | null>(null);
  
  // Split rooms into Local Bots and Shared Users
  const [botRooms, setBotRooms] = useState<LobbyRoom[]>([]);
  const [sharedRooms, setSharedRooms] = useState<LobbyRoom[]>([]);
  
  // Social State
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'CHAT' | 'ONLINE'>('CHAT');
  const [statsTab, setStatsTab] = useState<'RANKED' | 'CASUAL'>('RANKED');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'NONE' | 'SENDING' | 'ACCEPTED' | 'REJECTED'>('NONE');
  
  // Avatar Selection State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const avatarSeeds = useRef<string[]>([]);
  
  const [searchTimer, setSearchTimer] = useState(0);
  
  const leaderboardRef = useRef<PlayerProfile[]>([]);
  const currentPlayerNameRef = useRef<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initialize 500 Avatar Seeds
  if (avatarSeeds.current.length === 0) {
      for(let i = 0; i < 500; i++) {
          avatarSeeds.current.push(`avatar_v1_${i}`);
      }
  }

  // --- SYNC ENGINE (LocalStorage Listener) ---
  useEffect(() => {
      // 1. Load Initial Data from "Server"
      const loadSharedData = () => {
          try {
              const savedChat = localStorage.getItem(STORAGE_KEY_CHAT);
              if (savedChat) setChatHistory(JSON.parse(savedChat));

              const savedRooms = localStorage.getItem(STORAGE_KEY_USER_ROOMS);
              if (savedRooms) setSharedRooms(JSON.parse(savedRooms));
              
              // PERSISTENT BOT ROOMS: Load existing rooms to feel like a real lobby
              const savedBotRooms = localStorage.getItem(STORAGE_KEY_BOT_ROOMS);
              if (savedBotRooms) setBotRooms(JSON.parse(savedBotRooms));
          } catch (e) { console.error("Sync Error", e); }
      };
      
      loadSharedData();

      // 2. Listen for "Server" updates from other tabs
      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === STORAGE_KEY_CHAT && e.newValue) {
              setChatHistory(JSON.parse(e.newValue));
          }
          if (e.key === STORAGE_KEY_USER_ROOMS && e.newValue) {
              setSharedRooms(JSON.parse(e.newValue));
          }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize
  useEffect(() => {
    const savedName = localStorage.getItem('stickman_player_name');
    let currentName = '';
    if (savedName) {
        setPlayerName(savedName);
        currentPlayerNameRef.current = savedName;
        currentName = savedName;
        setView('HOME');
    }
    
    // Load or Gen Bots
    let fakeLb: PlayerProfile[] = [];
    const savedLb = localStorage.getItem('stickman_bots_v4'); 
    
    if (savedLb) {
        try { fakeLb = JSON.parse(savedLb); } catch (e) { fakeLb = []; }
    } 
    
    // INCREASED BOT COUNT TO 3000
    if (fakeLb.length < 3000) {
        const generatedNames = generateBotNames(3000);
        fakeLb = generatedNames.map(name => {
            const r = Math.random();
            let baseElo = Math.floor(r < 0.4 ? Math.random() * 250 : r < 0.7 ? 250 + Math.random() * 300 : r < 0.85 ? 550 + Math.random() * 350 : r < 0.95 ? 900 + Math.random() * 400 : 1300 + Math.random() * 1000);
            const rankMatches = Math.floor(Math.random() * 300) + 10;
            const rankWins = Math.floor(rankMatches * (0.3 + ((baseElo / 2500) * 0.4)));
            const status = Math.random() > 0.6 ? 'PLAYING' : (Math.random() > 0.3 ? 'WAITING' : 'IDLE');
            
            // Realistic Streak Generation logic
            let streak = 0;
            if (baseElo > 2200) { 
                streak = Math.random() > 0.3 ? Math.floor(Math.random() * 8) + 1 : 0; 
            } else if (baseElo > 1500) { 
                streak = Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : 0;
            } else if (baseElo > 900) {
                streak = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0;
            }

            return {
                name,
                avatarSeed: `${name}_${Math.random()}`, // Assign random avatar seed
                rankedStats: { wins: rankWins, losses: rankMatches - rankWins, elo: baseElo, streak: streak },
                casualStats: { wins: Math.floor(Math.random() * 50), losses: Math.floor(Math.random() * 50), streak: Math.floor(Math.random() * 3) },
                rankTier: getRankTier(baseElo),
                status: status as any
            };
        });
    }

    if (currentName) {
        const meIndex = fakeLb.findIndex(p => p.name === currentName);
        if (meIndex === -1) {
             const newProfile: PlayerProfile = { 
                name: currentName,
                avatarSeed: currentName, // Default seed
                rankedStats: { wins: 0, losses: 0, elo: 100, streak: 0 },
                casualStats: { wins: 0, losses: 0, streak: 0 },
                rankTier: RankTier.BRONZE, 
                status: 'IDLE' 
            };
            fakeLb.unshift(newProfile);
            localStorage.setItem('stickman_bots_v4', JSON.stringify(fakeLb));
        } else {
            fakeLb[meIndex].rankTier = getRankTier(fakeLb[meIndex].rankedStats.elo);
            // Ensure avatar seed exists for legacy data
            if (!fakeLb[meIndex].avatarSeed) fakeLb[meIndex].avatarSeed = currentName;
        }
    } else if (!savedLb) {
        localStorage.setItem('stickman_bots_v4', JSON.stringify(fakeLb));
    }

    setLeaderboard(fakeLb);
    leaderboardRef.current = fakeLb;

    const interval = setInterval(runBotSimulation, 5000); 
    const chatInterval = setInterval(runChatSimulation, 1200); // Fast chat (1.2s)
    const roomInterval = setInterval(runRoomSimulation, 4000); 

    return () => {
        clearInterval(interval);
        clearInterval(chatInterval);
        clearInterval(roomInterval);
    };
  }, []);

  useEffect(() => {
      if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
  }, [chatHistory, activeTab]);

  const runBotSimulation = () => {
      const lb: PlayerProfile[] = [...leaderboardRef.current];
      for(let k=0; k<20; k++) {
          const idx = Math.floor(Math.random() * lb.length);
          if (lb[idx].name !== currentPlayerNameRef.current) {
              lb[idx].status = Math.random() > 0.7 ? 'PLAYING' : (Math.random() > 0.4 ? 'WAITING' : 'IDLE');
              if (Math.random() > 0.5) { 
                  const change = Math.floor(Math.random() * 50) - 25;
                  lb[idx].rankedStats.elo = Math.max(0, lb[idx].rankedStats.elo + change);
                  lb[idx].rankTier = getRankTier(lb[idx].rankedStats.elo);
                  if (change > 0) {
                      lb[idx].rankedStats.wins++;
                      lb[idx].rankedStats.streak++;
                  } else {
                      lb[idx].rankedStats.losses++;
                      lb[idx].rankedStats.streak = 0;
                  }
              }
          }
      }
      leaderboardRef.current = lb;
      setLeaderboard(prev => [...lb]); 
  };

  // --- SMART CHAT SYSTEM ---
  const runChatSimulation = () => {
      // Much higher chance to chat for busy server feel
      if (Math.random() > 0.9) return; 
      
      const lb = leaderboardRef.current;
      const history = chatHistory;
      const lastMsg = history.length > 0 ? history[history.length - 1] : null;
      
      // Filter valid bots (Idle/Waiting, not player)
      const potentialBots = lb.filter(p => p.name !== currentPlayerNameRef.current && (p.status === 'IDLE' || p.status === 'WAITING'));
      if (potentialBots.length === 0) return;
      
      // Explicitly cast to PlayerProfile to satisfy TypeScript unknown inference
      const randomBot = getRandom(potentialBots) as PlayerProfile;
      const isVN = NAMES_VN.some(n => randomBot.name.includes(n)) || Math.random() > 0.5;
      const TEMPLATES = isVN ? CHAT_TEMPLATES_VN : CHAT_TEMPLATES_EN;
      
      let msg = "";
      
      // DECIDE: Reply or New Topic?
      const shouldReply = lastMsg && !lastMsg.isSystem && Math.random() < 0.6; // 60% chance to reply
      
      if (shouldReply && lastMsg) {
          const content = lastMsg.text.toLowerCase();
          
          // Detect Topic from last message to reply intelligently
          let foundTopic = false;
          
          // 1. Check for Laugh/Joke
          if (content.includes("haha") || content.includes("lol") || content.includes("kkk")) {
              msg = getRandom(TEMPLATES.REPLY_LAUGH);
              foundTopic = true;
          }
          // 2. Check for Agree/Disagree
          else if (content.includes("đúng") || content.includes("chuẩn") || content.includes("true") || content.includes("agree")) {
              msg = getRandom(TEMPLATES.REPLY_AGREE);
              foundTopic = true;
          }
          // 3. Check for specific keywords
          else if (CHAT_TOPICS.BRAG.some(k => content.includes(k))) {
              // Someone bragged -> Agree or Call them a noob
              msg = Math.random() > 0.5 ? getRandom(TEMPLATES.REPLY_LAUGH) : (isVN ? "Ghê đấy" : "Wow nice");
              foundTopic = true;
          }
          else if (CHAT_TOPICS.COMPLAIN.some(k => content.includes(k))) {
              msg = getRandom(TEMPLATES.REPLY_AGREE); // Sympathize
              foundTopic = true;
          }
          
          if (!foundTopic) {
              // Generic Reply if no topic found
              msg = isVN ? "Chuẩn" : "Yeah";
          }
          
          // Add mention sometimes
          if (Math.random() < 0.4) {
              msg = `@${lastMsg.sender} ${msg}`;
          }
          
      } else {
          // NEW TOPIC
          const topics = ['GREETING', 'BRAG', 'COMPLAIN', 'STRATEGY', 'INVITE'];
          const pickedTopic = getRandom(topics);
          // @ts-ignore
          msg = getRandom(TEMPLATES[pickedTopic]);
      }

      // Check Duplicates in last 5 messages
      const recentTexts = history.slice(-5).map(m => m.text);
      if (recentTexts.includes(msg)) return; // Skip if duplicate

      let topRank: number | undefined = undefined;
      // Calculate Rank dynamically for bots
      const sortedLb = [...lb].sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
      const idx = sortedLb.findIndex(p => p.name === randomBot.name);
      if (idx !== -1 && idx < 100) topRank = idx + 1;

      const newMsg: ChatMessage = {
          id: Math.random().toString(),
          sender: randomBot.name,
          text: msg,
          rank: randomBot.rankTier,
          timestamp: Date.now(),
          topRank: topRank
      };

      setChatHistory(prev => [...prev.slice(-49), newMsg]);
  };

  const runRoomSimulation = () => {
      setBotRooms(prev => {
          let next = [...prev];
          
          next = next.filter(room => {
              if (room.status === 'PLAYING') {
                  if (Math.random() < 0.15) return false;
              }
              return true;
          });

          next = next.map(room => {
              if (room.status === 'WAITING') {
                  const waitingCount = next.filter(r => r.status === 'WAITING').length;
                  const total = next.length || 1;
                  const fillChance = (waitingCount / total) > 0.4 ? 0.5 : 0.15; 

                  if (Math.random() < fillChance && leaderboardRef.current.length > 0) {
                      // Explicit cast to PlayerProfile
                      const guest = getRandom(leaderboardRef.current) as PlayerProfile;
                      if (guest && guest.name !== room.host) {
                          return {
                              ...room,
                              status: 'PLAYING',
                              players: 2,
                              guestName: guest.name,
                              guestElo: guest.rankedStats.elo
                          };
                      }
                  }
              }
              return room;
          });

          // Target ~150 Bot Rooms for a crowded look
          const MAX_BOT_ROOMS = 150;
          
          if (next.length < MAX_BOT_ROOMS && leaderboardRef.current.length > 0) {
              // Explicit cast to PlayerProfile
              const host = getRandom(leaderboardRef.current) as PlayerProfile;
              const isVN = NAMES_VN.some(n => host.name.includes(n));
              const roomName = isVN ? getRandom(ROOM_NAMES_VN) : getRandom(ROOM_NAMES_EN);
              
              // 70% Playing, 30% Waiting
              const startAsPlaying = Math.random() > 0.3;
              let guestName: string | undefined;
              let guestElo: number | undefined;

              if (startAsPlaying) {
                  const guest = getRandom(leaderboardRef.current) as PlayerProfile;
                  guestName = guest.name;
                  guestElo = guest.rankedStats.elo;
              }

              next.push({
                  id: Math.random().toString(),
                  name: `${roomName} #${Math.floor(Math.random()*999)}`,
                  host: host.name,
                  hostElo: host.rankedStats.elo,
                  status: startAsPlaying ? 'PLAYING' : 'WAITING',
                  players: startAsPlaying ? 2 : 1,
                  mapIndex: Math.floor(Math.random() * 12),
                  guestName,
                  guestElo
              });
          }
          
          // SAVE ROOMS TO LOCAL STORAGE (PERSISTENCE)
          localStorage.setItem(STORAGE_KEY_BOT_ROOMS, JSON.stringify(next));

          return next;
      });
  };

  const handleLogin = () => {
    let cleanName = playerName.trim();
    if (cleanName.length > 0) {
        if (cleanName.includes('@')) cleanName = cleanName.split('@')[0];
        cleanName = cleanName.substring(0, 10);
        localStorage.setItem('stickman_player_name', cleanName);
        setPlayerName(cleanName); 
        currentPlayerNameRef.current = cleanName;
        setView('HOME');
        
        setChatHistory(prev => [...prev, {
            id: 'sys', sender: 'SYSTEM', text: `Welcome ${cleanName} to the Arena!`, rank: RankTier.BRONZE, timestamp: Date.now(), isSystem: true
        }]);
    }
  };

  // Change Player Avatar from Modal
  const handleSelectAvatar = (seed: string) => {
      if (!myProfile) return;
      
      const newLb = leaderboard.map(p => {
          if (p.name === playerName) {
              return { ...p, avatarSeed: seed };
          }
          return p;
      });
      
      setLeaderboard(newLb);
      leaderboardRef.current = newLb;
      localStorage.setItem('stickman_bots_v4', JSON.stringify(newLb));
      setIsAvatarModalOpen(false);
      
      // Update selected profile view if open
      if (selectedProfile && selectedProfile.name === playerName) {
          setSelectedProfile({ ...selectedProfile, avatarSeed: seed });
      }
  };

  const handleCreateRoom = () => {
      setCustomOpponent(null);
      setCustomMapIndex(0);
      const generatedId = Math.floor(Math.random() * 9000) + 1000;
      setRoomIdDisplay(`#${generatedId}`);
      setRoomName(`${playerName}'s Room #${generatedId}`);
      
      const myProf = leaderboard.find(p => p.name === playerName);
      const newRoom: LobbyRoom = {
          id: `${playerName}_${Date.now()}`,
          name: `${playerName}'s Room #${generatedId}`,
          host: playerName,
          hostElo: myProf?.rankedStats.elo || 100,
          status: 'WAITING',
          players: 1,
          mapIndex: 0
      };
      
      const updatedRooms = [newRoom, ...sharedRooms];
      setSharedRooms(updatedRooms);
      localStorage.setItem(STORAGE_KEY_USER_ROOMS, JSON.stringify(updatedRooms));

      setView('CUSTOM_ROOM');
  };

  const handleExitRoom = () => {
      const updatedRooms = sharedRooms.filter(r => r.host !== playerName);
      setSharedRooms(updatedRooms);
      localStorage.setItem(STORAGE_KEY_USER_ROOMS, JSON.stringify(updatedRooms));
      
      setView('HOME');
  };

  const handleJoinRoom = (room: LobbyRoom) => {
      onStartMatch(room.host, room.hostElo, room.mapIndex, false, false);
  };

  const handleInvitePlayer = (p: PlayerProfile) => {
      setInviteStatus('SENDING');
      setTimeout(() => {
          if (Math.random() > 0.3) {
              setInviteStatus('ACCEPTED');
              setCustomOpponent(p);
              setIsInviting(false);
          } else {
              setInviteStatus('REJECTED');
              setTimeout(() => setInviteStatus('NONE'), 1500);
          }
      }, 1500 + Math.random() * 1500);
  };
  
  const handleAutoFindCustom = () => {
      const bots = leaderboard.filter(p => p.name !== playerName && p.status === 'IDLE');
      if (bots.length > 0) {
          const bot = getRandom(bots);
          setCustomOpponent(bot);
      }
  };

  const handleChatClick = (senderName: string) => {
      const profile = leaderboard.find(p => p.name === senderName);
      if (profile) {
          setSelectedProfile(profile);
      }
  };

  const handleSendChat = (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      
      const myProfile = leaderboard.find(p => p.name === playerName);
      const sortedLb = [...leaderboard].sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
      const myRank = sortedLb.findIndex(p => p.name === playerName) + 1;

      const newMsg: ChatMessage = {
          id: Math.random().toString(),
          sender: playerName,
          text: chatInput,
          rank: myProfile?.rankTier || RankTier.BRONZE,
          timestamp: Date.now(),
          topRank: myRank
      };

      const updatedChat = [...chatHistory, newMsg].slice(-50); // Keep last 50
      setChatHistory(updatedChat);
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(updatedChat));
      
      setChatInput('');
  };

  const handleStartCustom = () => {
      if (customOpponent) {
          handleExitRoom();
          onStartMatch(customOpponent.name, customOpponent.rankedStats.elo, customMapIndex, false, false);
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
                  const foundProfile = leaderboardRef.current.find(p => p.name === playerName);
                  const myRankTier = foundProfile ? foundProfile.rankTier : RankTier.BRONZE;
                  const targetTiers = getAdjacentTiers(myRankTier);
                  const pool = leaderboardRef.current.filter(p => p.name !== playerName && p.rankTier && targetTiers.includes(p.rankTier));
                  
                  const opponent = getRandom<PlayerProfile>(pool.length ? pool : leaderboardRef.current);
                  
                  if (opponent) {
                      onStartMatch(opponent.name, opponent.rankedStats.elo, Math.floor(Math.random() * 12), false, true);
                      clearInterval(interval);
                  }
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [view, searchTimer, playerName, onStartMatch]);

  // -- RENDER HELPERS --
  const renderRankBadge = (tier?: RankTier, elo?: number) => {
      if (!tier) tier = RankTier.BRONZE;
      return (
          <div className="flex flex-col items-center justify-center relative group">
              <RankIcon tier={tier} className="w-8 h-8 md:w-10 md:h-10" />
              {elo !== undefined && (
                  <span className="text-[9px] text-yellow-500 font-mono mt-[-2px] font-bold z-10 bg-black/50 px-1 rounded border border-slate-700">{elo}</span>
              )}
          </div>
      );
  };

  const getSenderStyle = (rank?: number) => {
      if (!rank) return 'text-blue-400';
      if (rank === 1) return 'text-yellow-400 font-black'; // Top 1
      if (rank <= 10) return 'text-red-500 font-bold'; // Top 10
      if (rank <= 50) return 'text-purple-400 font-bold'; // Top 50
      if (rank <= 100) return 'text-cyan-400 font-semibold'; // Top 100
      return 'text-blue-400';
  };

  const getSenderBadge = (rank?: number) => {
      if (!rank || rank > 100) return null;
      
      // TOP 1: Yellow with Red Outline, Highlight
      if (rank === 1) {
          return <span className="bg-yellow-400 text-red-900 border-2 border-red-600 text-[10px] px-1.5 py-0.5 rounded font-black mr-1 shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse" title="CHAMPION">TOP 1</span>;
      }
      // TOP 10 (Rank 2-10): Red
      if (rank <= 10) {
          return <span className="bg-gradient-to-r from-red-600 to-red-500 text-white border border-red-400 text-[9px] px-1 rounded font-bold mr-1" title="Top 10">TOP 10</span>;
      }
      // TOP 50 (Rank 11-50): Purple
      if (rank <= 50) {
          return <span className="bg-purple-600 text-white border border-purple-400 text-[9px] px-1 rounded font-bold mr-1" title="Top 50">TOP 50</span>;
      }
      // TOP 100 (Rank 51-100): Cyan/Blue
      if (rank <= 100) {
          return <span className="bg-cyan-600 text-white border border-cyan-400 text-[9px] px-1 rounded font-bold mr-1" title="Top 100">TOP 100</span>;
      }
      return null;
  };

  const renderAvatarSelectionModal = () => {
      if (!isAvatarModalOpen || !myProfile) return null;
      
      // Calculate my rank info again for the header
      const sortedLb = [...leaderboard].sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
      const myRank = sortedLb.findIndex(p => p.name === playerName) + 1;
      
      return (
          <div className="absolute inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsAvatarModalOpen(false)}>
              <div className="bg-slate-800 border-2 border-slate-600 w-full max-w-4xl h-[90vh] rounded-xl flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button className="absolute top-2 right-4 text-slate-400 hover:text-white text-2xl z-10" onClick={() => setIsAvatarModalOpen(false)}>✕</button>
                  
                  {/* HEADER: PLAYER INFO */}
                  <div className="p-4 border-b border-slate-700 bg-slate-900 rounded-t-xl flex items-center gap-6">
                      <div className="w-20 h-20 rounded-full border-4 border-blue-500 overflow-hidden bg-slate-800 shadow-lg">
                          <img src={getAvatarUrl(myProfile.avatarSeed)} alt="Current" className="w-full h-full object-cover" />
                      </div>
                      <div>
                          <div className="flex items-center gap-2">
                              <h2 className="text-3xl font-black text-white">{myProfile.name}</h2>
                              {getSenderBadge(myRank <= 100 ? myRank : undefined)}
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                              <div className="flex items-center gap-1">
                                  <RankIcon tier={myProfile.rankTier} className="w-6 h-6" />
                                  <span className="text-yellow-500 font-mono font-bold text-lg">{myProfile.rankedStats.elo} Elo</span>
                              </div>
                              <div className="text-slate-400 font-bold">Wins: <span className="text-green-400">{myProfile.rankedStats.wins}</span></div>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-slate-800 border-b border-slate-700">
                      <h3 className="text-white font-bold text-lg">CHOOSE AVATAR (500+ Options)</h3>
                      <p className="text-slate-400 text-sm">Select an avatar to represent you in the Arena.</p>
                  </div>

                  {/* GRID OF AVATARS */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/50">
                      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                          {avatarSeeds.current.map((seed, idx) => (
                              <button 
                                key={seed}
                                onClick={() => handleSelectAvatar(seed)}
                                className={`aspect-square rounded-lg border-2 overflow-hidden hover:scale-105 transition-all bg-slate-800 relative group ${myProfile.avatarSeed === seed ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'border-slate-700 hover:border-blue-400'}`}
                              >
                                  <img src={getAvatarUrl(seed)} alt={`Avatar ${idx}`} className="w-full h-full object-cover" loading="lazy" />
                                  {myProfile.avatarSeed === seed && (
                                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                          <span className="text-2xl">✓</span>
                                      </div>
                                  )}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderDetailModal = () => {
      if (!selectedProfile) return null;
      return (
          <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedProfile(null)}>
              <div className="bg-slate-800 border-2 border-slate-600 p-6 rounded-xl w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button className="absolute top-2 right-4 text-slate-400 hover:text-white text-xl" onClick={() => setSelectedProfile(null)}>✕</button>
                  <div className="flex flex-col items-center mb-6">
                       {/* AVATAR CLICKABLE FOR ME */}
                       <div 
                            className={`w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center border-4 ${selectedProfile.name === playerName ? 'border-blue-500 cursor-pointer hover:border-white transition-colors' : 'border-slate-500'} mb-2 relative overflow-hidden shadow-lg`}
                            onClick={() => selectedProfile.name === playerName && setIsAvatarModalOpen(true)}
                       >
                           {selectedProfile.avatarSeed ? (
                               <img src={getAvatarUrl(selectedProfile.avatarSeed)} alt="Avatar" className="w-full h-full object-cover" />
                           ) : (
                               <RankIcon tier={selectedProfile.rankTier} className="w-16 h-16" />
                           )}
                           {/* OVERLAY ICON FOR EDIT */}
                           {selectedProfile.name === playerName && (
                               <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                   <span className="text-2xl">📷</span>
                               </div>
                           )}
                       </div>
                       
                       <h3 className="text-2xl font-black text-white tracking-wide uppercase">{selectedProfile.name}</h3>
                       <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded ${selectedProfile.status === 'PLAYING' ? 'bg-red-900 text-red-400' : selectedProfile.status === 'WAITING' ? 'bg-yellow-900 text-yellow-400' : 'bg-green-900 text-green-400'}`}>
                           {selectedProfile.status}
                       </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-900 p-3 rounded text-center">
                          <div className="text-[10px] text-slate-500 uppercase font-bold">Elo Rating</div>
                          <div className="text-xl text-yellow-500 font-bold">{selectedProfile.rankedStats.elo}</div>
                      </div>
                       <div className="bg-slate-900 p-3 rounded text-center">
                          <div className="text-[10px] text-slate-500 uppercase font-bold">Rank</div>
                          <div className="text-xl text-white font-bold">{selectedProfile.rankTier}</div>
                      </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                      <div className="flex justify-between border-b border-slate-700 pb-1"><span>Wins:</span> <span className="text-green-400 font-bold">{selectedProfile.rankedStats.wins}</span></div>
                      <div className="flex justify-between border-b border-slate-700 pb-1"><span>Losses:</span> <span className="text-red-400 font-bold">{selectedProfile.rankedStats.losses}</span></div>
                      <div className="flex justify-between"><span>Streak:</span> <span className="text-orange-400 font-bold">{selectedProfile.rankedStats.streak}</span></div>
                  </div>
                  
                  {selectedProfile.name !== playerName && (
                      <div className="mt-6 flex gap-2">
                          <button onClick={() => { handleInvitePlayer(selectedProfile); setSelectedProfile(null); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded">Challenge</button>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const myProfile = leaderboard.find(p => p.name === playerName);
  // Calculate Rank for Top Bar Display
  const myRankForBar = myProfile ? [...leaderboard].sort((a,b) => b.rankedStats.elo - a.rankedStats.elo).findIndex(p => p.name === playerName) + 1 : undefined;

  const displayRooms = [...sharedRooms, ...botRooms].sort((a, b) => {
      const aIsShared = sharedRooms.some(r => r.id === a.id);
      const bIsShared = sharedRooms.some(r => r.id === b.id);
      
      if (aIsShared && !bIsShared) return -1;
      if (!aIsShared && bIsShared) return 1;

      if (a.status === 'WAITING' && b.status !== 'WAITING') return -1;
      if (a.status !== 'WAITING' && b.status === 'WAITING') return 1;
      return 0;
  });

  // --- LOGIN VIEW ---
  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-8">ONLINE ARENA</h2>
              <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl w-full max-w-md">
                  <label className="block text-slate-300 mb-2 font-bold">Warrior Name:</label>
                  <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded mb-6 text-lg" placeholder="Enter name..." />
                  <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-all">Join Lobby</button>
                  <button onClick={onBack} className="w-full mt-2 border border-slate-600 text-slate-400 py-2 rounded">Back</button>
              </div>
          </div>
      );
  }

  // --- INVITE MODAL ---
  const renderInviteModal = () => {
      if (!isInviting) return null;
      const onlinePlayers = leaderboard.filter(p => p.status === 'IDLE' && p.name !== playerName).slice(0, 20); // Simulating visible pool
      
      return (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-white">Invite Opponent</h3>
                      <button onClick={() => {setIsInviting(false); setInviteStatus('NONE');}} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {inviteStatus !== 'NONE' && (
                          <div className={`p-3 mb-2 rounded text-center font-bold ${inviteStatus === 'SENDING' ? 'bg-yellow-900/50 text-yellow-400' : inviteStatus === 'ACCEPTED' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                              {inviteStatus === 'SENDING' ? 'Sending Invite...' : inviteStatus === 'ACCEPTED' ? 'Accepted!' : 'Declined / Busy'}
                          </div>
                      )}
                      {onlinePlayers.map(p => (
                          <div key={p.name} className="flex justify-between items-center p-2 hover:bg-slate-700 rounded border-b border-slate-700/50">
                              <div className="flex items-center gap-3">
                                  {/* AVATAR IN LIST */}
                                  <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-500 bg-slate-900">
                                      <img src={getAvatarUrl(p.avatarSeed || p.name)} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-200">{p.name}</div>
                                      <div className="text-[10px] text-green-400">● {p.rankTier}</div>
                                  </div>
                              </div>
                              <button 
                                disabled={inviteStatus === 'SENDING'}
                                onClick={() => handleInvitePlayer(p)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white disabled:opacity-50"
                              >
                                  Invite
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  };

  // --- LOBBY LAYOUT ---
  return (
    <div className="w-full max-w-7xl h-[85vh] flex flex-col animate-fade-in bg-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-700 relative">
        {renderDetailModal()}
        {renderInviteModal()}
        {renderAvatarSelectionModal()}

        {/* HEADER */}
        <div className="bg-slate-800 p-3 border-b border-slate-600 flex justify-between items-center shadow-md z-10 h-16">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xl px-2">←</button>
                <h2 className="text-xl font-black italic text-blue-400">ONLINE ARENA</h2>
            </div>
            
            <div 
                className="flex items-center gap-4 cursor-pointer hover:bg-slate-700 px-2 py-1 rounded transition-all group" 
                onClick={() => myProfile && setSelectedProfile(myProfile)}
            >
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                        {/* Show Top Rank Badge if applicable */}
                        {myRankForBar && getSenderBadge(myRankForBar <= 100 ? myRankForBar : undefined)}
                        <span className="font-bold text-white text-lg tracking-wide">{playerName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-4 h-4" />
                        <span className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">{myProfile?.rankedStats.elo || 100} ELO</span>
                    </div>
                </div>
                {/* MY MINI AVATAR */}
                <div className="w-10 h-10 rounded-full border-2 border-blue-500 group-hover:border-white transition-colors overflow-hidden bg-slate-900 relative">
                    <img src={getAvatarUrl(myProfile?.avatarSeed || playerName)} alt="Me" className="w-full h-full object-cover" />
                </div>
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* LEFT SIDEBAR: ACTIONS (25%) */}
            <div className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 flex flex-col gap-4">
                <button 
                    onClick={handleFindRanked}
                    className="w-full py-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg border border-purple-400 flex flex-col items-center hover:scale-105 transition-all group"
                >
                    <span className="text-2xl mb-1 group-hover:rotate-12 transition-transform">🏆</span>
                    <span className="font-black text-white italic text-xl">RANKED</span>
                    <span className="text-[10px] text-purple-200">Find Match</span>
                </button>

                <button 
                    onClick={handleCreateRoom}
                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-500 flex flex-col items-center transition-all"
                >
                    <span className="text-2xl mb-1">⚔️</span>
                    <span className="font-bold text-white">CREATE ROOM</span>
                    <span className="text-[10px] text-slate-400">Friendly Match</span>
                </button>

                <div className="mt-auto bg-slate-900 p-3 rounded border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs text-slate-400 uppercase font-bold">My Stats</div>
                        <div className="flex gap-1">
                            <button onClick={() => setStatsTab('RANKED')} className={`text-[9px] px-1.5 py-0.5 rounded ${statsTab === 'RANKED' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'}`}>RANK</button>
                            <button onClick={() => setStatsTab('CASUAL')} className={`text-[9px] px-1.5 py-0.5 rounded ${statsTab === 'CASUAL' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>CASUAL</button>
                        </div>
                    </div>
                    {statsTab === 'RANKED' ? (
                        <>
                            <div className="flex justify-between text-sm mb-1"><span>Wins:</span> <span className="text-green-400">{myProfile?.rankedStats.wins}</span></div>
                            <div className="flex justify-between text-sm mb-1"><span>Losses:</span> <span className="text-red-400">{myProfile?.rankedStats.losses}</span></div>
                            <div className="flex justify-between text-sm"><span>Streak:</span> <span className="text-orange-400">🔥 {myProfile?.rankedStats.streak}</span></div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between text-sm mb-1"><span>Wins:</span> <span className="text-green-400">{myProfile?.casualStats.wins}</span></div>
                            <div className="flex justify-between text-sm mb-1"><span>Losses:</span> <span className="text-red-400">{myProfile?.casualStats.losses}</span></div>
                            <div className="flex justify-between text-sm"><span>Streak:</span> <span className="text-blue-400">🌊 {myProfile?.casualStats.streak || 0}</span></div>
                        </>
                    )}
                </div>
            </div>

            {/* CENTER: CUSTOM ROOM LIST OR ACTIVE VIEW (50%) */}
            <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-900 relative flex flex-col">
                {view === 'HOME' && (
                    <>
                        <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm">
                            <span className="font-bold text-white">LOBBY ROOMS</span>
                            <div className="text-xs text-slate-400 flex gap-4">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> WAITING (30%)</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> PLAYING</span>
                            </div>
                        </div>
                        {/* UPDATED GRID: MORE COLS (2 -> 4), SMALLER GAP, SMALLER TEXT */}
                        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 content-start custom-scrollbar">
                            {displayRooms.map(room => (
                                <div key={room.id} className={`bg-slate-800 border rounded-lg p-2 transition-all shadow flex flex-col gap-1 relative overflow-hidden group ${room.status === 'PLAYING' ? 'border-red-500/30' : 'border-slate-600 hover:border-blue-500'}`}>
                                    <div className={`absolute top-0 left-0 w-0.5 h-full ${room.status === 'WAITING' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div className="flex justify-between items-start pl-1">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white text-[10px] truncate">{room.name}</div>
                                            
                                            {room.status === 'PLAYING' && room.guestName ? (
                                                <div className="text-[9px] text-slate-300 mt-0.5 bg-black/30 p-0.5 rounded border border-slate-700">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-400 truncate w-14">{room.host}</span>
                                                        <span className="text-[8px] text-yellow-500 font-mono">{room.hostElo}</span>
                                                    </div>
                                                    <div className="text-[8px] text-center font-bold text-red-500 italic scale-75">VS</div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-red-400 truncate w-14">{room.guestName}</span>
                                                        <span className="text-[8px] text-yellow-500 font-mono">{room.guestElo}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                                                    Host: {room.host} <span className="text-yellow-500">({room.hostElo})</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end pl-1">
                                             <div className="bg-slate-900 px-1 py-0.5 rounded text-[9px] font-mono border border-slate-700">
                                                {room.players}/2
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pl-1 mt-0.5">
                                        <div className="text-[8px] text-slate-500 uppercase font-bold truncate max-w-[60px]">{LEVEL_THEMES[room.mapIndex].nameEn}</div>
                                        {room.status === 'WAITING' ? (
                                            <button 
                                                onClick={() => handleJoinRoom(room)} 
                                                className="px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white text-[9px] font-bold rounded shadow cursor-pointer"
                                            >
                                                JOIN
                                            </button>
                                        ) : (
                                            <button className="px-2 py-0.5 bg-slate-700 text-red-400 text-[9px] font-bold rounded cursor-not-allowed border border-red-900/30 opacity-70">PLAYING</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {view === 'CUSTOM_ROOM' && (
                    <div className="flex-1 flex flex-col p-8 bg-slate-900/90 h-full">
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 uppercase font-bold">Room Name</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    className="flex-1 bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded font-bold"
                                />
                                <div className="bg-slate-700 border border-slate-600 px-3 py-2 rounded text-yellow-400 font-mono font-bold">
                                    ID: {roomIdDisplay}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center gap-4 md:gap-12">
                             {/* PLAYER CARD */}
                             <div className="w-48 h-64 bg-slate-800 border-2 border-blue-500 rounded-xl flex flex-col items-center justify-center gap-2 shadow-xl relative overflow-hidden">
                                 {/* AVATAR DISPLAY */}
                                 <div className="w-24 h-24 rounded-full border-2 border-white/20 bg-slate-700 mb-2 overflow-hidden">
                                     <img src={getAvatarUrl(myProfile?.avatarSeed || playerName)} alt="Me" className="w-full h-full object-cover" />
                                 </div>
                                 
                                 <div className="font-bold text-white text-center px-2 text-lg">{playerName}</div>
                                 <RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-8 h-8" />
                                 <div className="text-yellow-500 text-xs font-mono">{myProfile?.rankedStats.elo}</div>
                                 <div className="mt-2 text-green-400 font-bold px-2 py-0.5 bg-green-900/30 rounded text-xs">READY</div>
                             </div>

                             <div className="text-2xl font-black text-red-500 italic">VS</div>

                             {/* OPPONENT CARD */}
                             <div className="w-48 h-64 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 relative overflow-hidden">
                                 {customOpponent ? (
                                     <>
                                         <div className="absolute top-2 right-2 cursor-pointer text-slate-500 hover:text-red-500 text-lg z-10" onClick={() => setCustomOpponent(null)}>✕</div>
                                         
                                         {/* OPPONENT AVATAR */}
                                         <div className="w-24 h-24 rounded-full border-2 border-red-500/50 bg-slate-700 mb-2 overflow-hidden">
                                             <img src={getAvatarUrl(customOpponent.avatarSeed || customOpponent.name)} alt="Opponent" className="w-full h-full object-cover" />
                                         </div>

                                         <div className="font-bold text-white text-center px-2 text-lg">{customOpponent.name}</div>
                                         <RankIcon tier={customOpponent.rankTier} className="w-8 h-8" />
                                         <div className="text-yellow-500 text-xs font-mono">{customOpponent.rankedStats.elo}</div>
                                         <div className="mt-2 text-green-400 font-bold px-2 py-0.5 bg-green-900/30 rounded text-xs">READY</div>
                                     </>
                                 ) : (
                                     <>
                                        <button onClick={() => setIsInviting(true)} className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-2xl mb-1 text-slate-300 transition-all">+</button>
                                        <div className="text-slate-500 font-bold text-sm">Invite Opponent</div>
                                        <button onClick={handleAutoFindCustom} className="mt-2 text-[10px] text-blue-400 hover:underline">Auto Find Bot</button>
                                     </>
                                 )}
                             </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-700 flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                 <span className="font-bold text-slate-400 text-sm">MAP:</span>
                                 <select 
                                    value={customMapIndex}
                                    onChange={(e) => setCustomMapIndex(parseInt(e.target.value))}
                                    className="bg-slate-800 text-white p-2 rounded border border-slate-600 text-sm w-40"
                                 >
                                     {LEVEL_THEMES.map((t, i) => (
                                         <option key={i} value={i}>{lang === 'VN' ? t.nameVn : t.nameEn}</option>
                                     ))}
                                 </select>
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={handleExitRoom} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-sm">Exit Room</button>
                                 <button 
                                    onClick={handleStartCustom}
                                    disabled={!customOpponent}
                                    className={`px-6 py-2 font-bold rounded text-sm shadow-lg transition-all ${customOpponent ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                                 >
                                     START GAME
                                 </button>
                             </div>
                        </div>
                    </div>
                )}

                {view === 'RANK_SEARCH' && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-700 flex items-center justify-center relative mb-4 overflow-hidden p-1">
                             <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin z-10"></div>
                             {/* My Avatar Searching */}
                             <img src={getAvatarUrl(myProfile?.avatarSeed || playerName)} className="w-full h-full rounded-full opacity-80" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-1">SEARCHING...</h2>
                        <div className="text-slate-400 font-mono">{searchTimer}s</div>
                        <button onClick={() => setView('HOME')} className="mt-8 px-6 py-2 border border-red-500 text-red-500 hover:bg-red-900/30 rounded text-sm">Cancel</button>
                    </div>
                )}
            </div>

            {/* RIGHT SIDEBAR: SOCIAL (25%) */}
            <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
                <div className="flex border-b border-slate-700">
                    <button onClick={() => setActiveTab('CHAT')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'CHAT' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>CHAT</button>
                    <button onClick={() => setActiveTab('ONLINE')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'ONLINE' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>ONLINE (3000+)</button>
                    <button onClick={() => setActiveTab('LEADERBOARD')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'LEADERBOARD' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>TOP</button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 relative">
                    {activeTab === 'CHAT' && (
                        <div className="absolute inset-0 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-2 space-y-2" ref={chatScrollRef}>
                                {chatHistory.map(msg => (
                                    <div key={msg.id} className="text-xs break-words">
                                        {msg.isSystem ? (
                                            <span className="text-yellow-500 italic font-bold">📢 {msg.text}</span>
                                        ) : (
                                            <>
                                                <span className="mr-1">{getSenderBadge(msg.topRank)}</span>
                                                <span 
                                                    className={`font-bold ${msg.sender === playerName ? 'text-green-400' : getSenderStyle(msg.topRank)} cursor-pointer hover:underline`}
                                                    onClick={() => handleChatClick(msg.sender)}
                                                >
                                                    {msg.sender}
                                                </span>
                                                <span className="text-slate-500 text-[10px] ml-1">[{msg.rank}]</span>
                                                <span className="text-slate-300">: {msg.text}</span>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendChat} className="p-2 border-t border-slate-700 bg-slate-800">
                                <input 
                                    type="text" 
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                                    placeholder="Say something..." 
                                />
                            </form>
                        </div>
                    )}

                    {activeTab === 'ONLINE' && (
                        <div className="p-2 space-y-1">
                            {leaderboard.filter(p => p.status !== 'OFFLINE').slice(0, 100).map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-1 hover:bg-slate-800 rounded cursor-pointer" onClick={() => setSelectedProfile(p)}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'IDLE' ? 'bg-green-500' : p.status === 'WAITING' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                        <span className="text-xs text-slate-300 truncate w-24">{p.name}</span>
                                    </div>
                                    <RankIcon tier={p.rankTier} className="w-4 h-4" />
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'LEADERBOARD' && (
                        <table className="w-full text-left text-xs">
                            <tbody>
                                {leaderboard.sort((a,b) => b.rankedStats.elo - a.rankedStats.elo).slice(0, 100).map((p, idx) => (
                                    <tr key={idx} onClick={() => setSelectedProfile(p)} className="border-b border-slate-800 hover:bg-slate-800 cursor-pointer">
                                        <td className="p-2 text-slate-500 font-mono">
                                            {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                                        </td>
                                        <td className={`p-2 truncate max-w-[80px] ${idx < 3 ? 'font-bold text-yellow-200' : 'text-slate-300'}`}>{p.name}</td>
                                        <td className="p-2 text-right text-yellow-500">{p.rankedStats.elo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    </div>
  );
};

export default OnlineLobby;
