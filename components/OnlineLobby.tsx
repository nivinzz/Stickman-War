
import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, Language, RankTier, ChatMessage, LobbyRoom, Alliance, AllianceMember, TickerNotification } from '../types';
import { generateBotNames, LEVEL_THEMES, getRankTier, NAMES_VN, ROOM_NAMES_VN, ROOM_NAMES_EN, getAvatarUrl, CHAT_TEMPLATES_VN, CHAT_TEMPLATES_EN, CHAT_TOPICS, ALLIANCE_NAMES_PREFIX, ALLIANCE_NAMES_SUFFIX, TICKER_TEMPLATES } from '../constants';

interface OnlineLobbyProps {
  onStartMatch: (opponentName: string, opponentElo: number, mapThemeIndex: number, isSpectator?: boolean, isRanked?: boolean, teammates?: PlayerProfile[]) => void;
  onBack: () => void;
  lang: Language;
}

const STORAGE_KEY_CHAT = 'stickman_global_chat_v1';
const STORAGE_KEY_USER_ROOMS = 'stickman_user_rooms_v1';
const STORAGE_KEY_BOT_ROOMS = 'stickman_bot_rooms_v1';
const STORAGE_KEY_BOTS_DATA = 'stickman_bots_v6'; 
const STORAGE_KEY_PLAYER_NAME = 'stickman_player_name';
const STORAGE_KEY_ALLIANCE = 'stickman_alliance_v2'; 

function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const getRankTitle = (tier: RankTier, rankPos: number) => {
    if (rankPos === 1) return "GOD OF WAR";
    if (rankPos <= 10) return "WARLORD";
    switch (tier) {
        case RankTier.LEGEND: return "LEGENDARY";
        case RankTier.CHALLENGER: return "GRANDMASTER";
        case RankTier.DIAMOND: return "COMMANDER";
        case RankTier.PLATINUM: return "VETERAN";
        case RankTier.GOLD: return "KNIGHT";
        case RankTier.SILVER: return "SOLDIER";
        default: return "ROOKIE";
    }
};

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

const NotificationTicker: React.FC<{ leaderboard: PlayerProfile[] }> = ({ leaderboard }) => {
    const [messages, setMessages] = useState<TickerNotification[]>([]);
    
    // Store previous ranks to detect changes
    // Map<PlayerName, Rank>
    const prevRanksRef = useRef<Map<string, number>>(new Map());
    const isFirstRun = useRef(true);

    // --- REFINED LOGIC: Track Rank Changes ---
    useEffect(() => {
        const sortedLb = [...leaderboard]; 
        // Note: leaderboard passed in is already sorted by App logic, but we ensure it here if needed
        // Assuming leaderboard is sorted by Elo descending.
        
        const currentRanks = new Map<string, number>();
        const newMessages: TickerNotification[] = [];

        // 1. Map current ranks
        sortedLb.forEach((p, index) => {
            const rank = index + 1;
            currentRanks.set(p.name, rank);
        });

        // 2. Compare with previous if not first run
        if (!isFirstRun.current) {
            // Check top 100 changes
            for (let i = 0; i < Math.min(sortedLb.length, 105); i++) {
                const p = sortedLb[i];
                const newRank = i + 1;
                const oldRank = prevRanksRef.current.get(p.name);

                if (oldRank !== undefined) {
                    // Check for milestones
                    // Top 1
                    if (newRank === 1 && oldRank !== 1) {
                        newMessages.push({ id: Date.now() + Math.random().toString(), text: `Chúc mừng người chơi ${p.name} đạt Top 1!`, type: 'SYSTEM', color: 'text-yellow-400' });
                    }
                    // Top 10 (e.g. was 11, now 9)
                    else if (newRank <= 10 && oldRank > 10) {
                        newMessages.push({ id: Date.now() + Math.random().toString(), text: `Chúc mừng người chơi ${p.name} đạt Top 10!`, type: 'SYSTEM', color: 'text-red-400' });
                    }
                    // Top 50 (e.g. was 51, now 49)
                    else if (newRank <= 50 && oldRank > 50) {
                        newMessages.push({ id: Date.now() + Math.random().toString(), text: `Chúc mừng người chơi ${p.name} đạt Top 50!`, type: 'SYSTEM', color: 'text-purple-400' });
                    }
                    // Top 100 (e.g. was 101, now 99)
                    else if (newRank <= 100 && oldRank > 100) {
                        newMessages.push({ id: Date.now() + Math.random().toString(), text: `Chúc mừng người chơi ${p.name} đạt Top 100!`, type: 'SYSTEM', color: 'text-blue-400' });
                    }
                } else {
                    // New player entering list directly into high rank
                    if (newRank <= 100) {
                         // Optional: Handle new entries
                    }
                }
            }
        } else {
            // First run, populate initial messages
            if (sortedLb.length > 0) {
                newMessages.push({ id: 'init_1', text: `Chúc mừng người chơi ${sortedLb[0].name} đạt Top 1!`, type: 'SYSTEM', color: 'text-yellow-400' });
                newMessages.push({ id: 'init_2', text: `Server đang rất sôi động với ${sortedLb.length} người chơi!`, type: 'SYSTEM', color: 'text-green-400' });
            }
            isFirstRun.current = false;
        }

        // 3. Update Ref
        prevRanksRef.current = currentRanks;

        // 4. Update State if new messages
        if (newMessages.length > 0) {
            setMessages(prev => {
                // Keep max 5 messages in history
                const combined = [...prev, ...newMessages];
                return combined.slice(-5);
            });
        }

    }, [leaderboard]);

    // Keep the interval for random "Flavor" messages (Alliance/Personal) but remove Rank ones
    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.7) { // 30% chance every 3s to add flavor text
                const types: ('PERSONAL' | 'ALLIANCE')[] = ['PERSONAL', 'ALLIANCE'];
                const type = types[Math.floor(Math.random() * types.length)];
                const templates = TICKER_TEMPLATES[type];
                let text = templates[Math.floor(Math.random() * templates.length)];
                
                const randomName = NAMES_VN[Math.floor(Math.random() * NAMES_VN.length)];
                const randomAlliance = `${ALLIANCE_NAMES_PREFIX[Math.floor(Math.random()*ALLIANCE_NAMES_PREFIX.length)]} ${ALLIANCE_NAMES_SUFFIX[Math.floor(Math.random()*ALLIANCE_NAMES_SUFFIX.length)]}`;
                
                text = text.replace('{name}', randomName)
                           .replace('{streak}', Math.floor(Math.random()*20).toString())
                           .replace('{tier}', 'DIAMOND')
                           .replace('{alliance}', randomAlliance);
                           
                let color = 'text-green-400';
                if (type === 'ALLIANCE') color = 'text-blue-400';
                
                setMessages(prev => [...prev, { id: Math.random().toString(), text, type, color }].slice(-5));
            }
        }, 3000); 
        return () => clearInterval(interval);
    }, []);
    
    return (
        <div className="w-full bg-slate-900/95 border-b border-slate-700 h-20 overflow-hidden flex flex-col justify-center relative px-4 py-1 gap-1 shadow-inner">
            {messages.map((msg, i) => (
                <div key={msg.id} className={`text-xs font-bold truncate animate-slide-in-right flex items-center gap-2 ${msg.color}`}>
                    <span className="opacity-70 text-[9px] border border-current px-1 rounded uppercase min-w-[50px] text-center tracking-wider">{msg.type}</span>
                    <span className="tracking-wide">{msg.text}</span>
                </div>
            ))}
        </div>
    );
};

const AllianceModal: React.FC<{ onClose: () => void, onStartWar: (members: AllianceMember[]) => void, myElo: number, myName: string }> = ({ onClose, onStartWar, myElo, myName }) => {
    const [alliance, setAlliance] = useState<Alliance | null>(null);
    const [createName, setCreateName] = useState("");
    const [view, setView] = useState<'HOME' | 'WAR_LOBBY'>('HOME');
    const [warMembers, setWarMembers] = useState<AllianceMember[]>([]);
    const [isSearchingWar, setIsSearchingWar] = useState(false);
    const [searchTime, setSearchTime] = useState(0);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY_ALLIANCE);
        if (saved) {
            const al = JSON.parse(saved);
            if (!al.elo) al.elo = 1000;
            if (!al.members[0].avatarSeed) al.members = al.members.map((m: any) => ({...m, avatarSeed: m.name, elo: 1000}));
            setAlliance(al);
        }
    }, []);

    useEffect(() => {
        if (!alliance) return;
        const interval = setInterval(() => {
            const count = Math.floor(Math.random() * 5) + 1;
            const newReqs: PlayerProfile[] = [];
            const names = generateBotNames(count);
            for(let name of names) {
                const elo = Math.floor(Math.max(0, alliance.elo - 400) + Math.random() * 800);
                newReqs.push({
                    name: name,
                    avatarSeed: name,
                    rankedStats: { elo, wins: 0, losses: 0, streak: 0 },
                    casualStats: { wins: 0, losses: 0, streak: 0 },
                    rankTier: getRankTier(elo),
                    status: 'IDLE'
                });
            }
            const eloChange = Math.floor(Math.random() * 20) - 10;
            const updated = {
                ...alliance,
                requests: [...alliance.requests, ...newReqs],
                elo: Math.max(0, alliance.elo + eloChange)
            };
            setAlliance(updated);
            localStorage.setItem(STORAGE_KEY_ALLIANCE, JSON.stringify(updated));
        }, 12000);
        return () => clearInterval(interval);
    }, [alliance]);

    const save = (al: Alliance) => {
        setAlliance({...al});
        localStorage.setItem(STORAGE_KEY_ALLIANCE, JSON.stringify(al));
    };

    const createAlliance = () => {
        if (!createName) return;
        const newAl: Alliance = {
            id: Date.now().toString(), name: createName, tag: createName.substring(0, 3).toUpperCase(), level: 1,
            members: [{ name: myName, role: 'LEADER', contribution: 0, elo: myElo, avatarSeed: myName }],
            requests: [], funds: 0, elo: 1000
        };
        save(newAl);
    };

    const handleAccept = (p: PlayerProfile) => {
        if(!alliance) return;
        alliance.members.push({ name: p.name, role: 'MEMBER', contribution: 0, elo: p.rankedStats.elo, avatarSeed: p.avatarSeed });
        alliance.requests = alliance.requests.filter(r => r.name !== p.name);
        save(alliance);
    };

    const handleOpenWarLobby = () => {
        const me: AllianceMember = { name: myName, role: 'LEADER', contribution: 0, elo: myElo, avatarSeed: myName };
        setWarMembers([me]);
        setView('WAR_LOBBY'); setIsSearchingWar(false);
    };

    const inviteBot = () => {
        if (!alliance || warMembers.length >= 3) return;
        const delay = 500 + Math.random() * 1500;
        const available = alliance.members.filter(m => !warMembers.some(wm => wm.name === m.name));
        let bot = available.length > 0 ? getRandom(available) : null;
        if (!bot) { const name = getRandom(NAMES_VN); bot = { name, role: 'MEMBER', contribution: 0, elo: 1000, avatarSeed: name }; }
        setTimeout(() => { if (Math.random() > 0.1) setWarMembers(prev => [...prev, bot!]); }, delay);
    };

    const startWarSearch = () => {
        if (warMembers.length < 3) return;
        setIsSearchingWar(true); setSearchTime(0);
        const timer = setInterval(() => {
            setSearchTime(prev => {
                if (prev > 3 && Math.random() > 0.8) { clearInterval(timer); onStartWar(warMembers); return prev; }
                return prev + 1;
            });
        }, 1000);
    };

    if (view === 'WAR_LOBBY' && alliance) {
        return (
            <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-white">
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-2 tracking-widest italic uppercase">3v3 WAR ROOM</h2>
                <div className="text-slate-400 mb-8">Alliance Rating: <span className="text-yellow-500 font-bold">{Math.floor(warMembers.reduce((a,b)=>a+b.elo,0)/Math.max(1,warMembers.length))} ELO</span></div>
                <div className="flex gap-4 md:gap-8 mb-12">
                    <div className="flex flex-col items-center gap-3 w-32">
                        <div className="w-24 h-24 rounded-full border-4 border-green-500 bg-slate-800 overflow-hidden shadow-[0_0_20px_#22c55e] relative"><img src={getAvatarUrl(warMembers[0].avatarSeed)} className="w-full h-full object-cover" /><div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-center font-bold text-green-400 py-1">LEADER</div></div>
                        <div className="text-center"><div className="font-bold text-white bg-slate-800 px-2 py-1 rounded border border-green-500 text-sm truncate w-full">{warMembers[0].name}</div><div className="text-xs text-yellow-500 font-mono mt-1">{warMembers[0].elo} Elo</div></div>
                    </div>
                    {[1, 2].map(idx => (
                        <div key={idx} className="flex flex-col items-center gap-3 w-32">
                            {warMembers[idx] ? (
                                <div className="w-24 h-24 rounded-full border-4 border-blue-500 bg-slate-800 overflow-hidden relative group"><img src={getAvatarUrl(warMembers[idx].avatarSeed)} className="w-full h-full object-cover" /><button onClick={() => setWarMembers(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-600 w-6 h-6 rounded-full text-xs flex items-center justify-center hover:bg-red-500 z-10">✕</button></div>
                            ) : (
                                <button onClick={inviteBot} className="w-24 h-24 rounded-full border-4 border-dashed border-slate-600 flex items-center justify-center text-4xl text-slate-500 hover:border-white hover:text-white transition-all bg-slate-800 animate-pulse">+</button>
                            )}
                            {warMembers[idx] && <div className="text-center w-full"><div className="font-bold text-white bg-slate-800 px-2 py-1 rounded border border-blue-500 text-sm truncate">{warMembers[idx].name}</div><div className="text-xs text-yellow-500 font-mono mt-1">{warMembers[idx].elo} Elo</div></div>}
                        </div>
                    ))}
                </div>
                {isSearchingWar ? (
                    <div className="text-center bg-slate-900/80 p-8 rounded-xl border border-slate-700 shadow-2xl">
                        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <div className="text-2xl font-bold text-white mb-2 animate-pulse">SEARCHING OPPONENT...</div>
                        <div className="text-4xl font-mono text-yellow-400 font-black">{searchTime}s</div>
                        <div className="mt-4 text-slate-400 text-xs uppercase tracking-widest">Matchmaking Range: <span className="text-white">±200 Elo</span></div>
                    </div>
                ) : (
                    <div className="flex gap-4">
                        <button onClick={() => setView('HOME')} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded border border-slate-500">BACK</button>
                        <button onClick={startWarSearch} disabled={warMembers.length < 3} className={`px-12 py-3 font-black rounded text-xl shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all ${warMembers.length === 3 ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white scale-105' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>FIND MATCH</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-600 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">🛡️ LIÊN MINH QUỐC CHIẾN</h2>
                    <button onClick={onClose} className="text-2xl text-slate-400 hover:text-white transition-colors">✕</button>
                </div>
                {!alliance ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                        <div className="text-6xl mb-2">🛡️</div>
                        <h3 className="text-3xl font-black text-slate-300">CHƯA GIA NHẬP LIÊN MINH</h3>
                        <div className="flex gap-2"><input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Tên Liên Minh Mới" className="p-4 bg-slate-800 border-2 border-slate-600 text-white rounded-lg w-72 text-center font-bold text-lg focus:border-blue-500 outline-none" /><button onClick={createAlliance} className="px-8 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 shadow-lg text-lg">TẠO MỚI (10,000 G)</button></div>
                        <p className="text-slate-500 text-sm">Hoặc chờ lời mời từ các bang hội khác...</p>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-1/3 bg-slate-800 p-6 border-r border-slate-700 flex flex-col gap-6 items-center">
                            <div className="text-center w-full">
                                <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-5xl mx-auto mb-4 border-4 border-yellow-500 shadow-lg">🛡️</div>
                                <h3 className="text-2xl font-black text-yellow-400 tracking-wide mb-1 truncate">[{alliance.tag}] {alliance.name}</h3>
                                <div className="text-slate-400 text-sm font-bold bg-slate-900/50 py-1 rounded">Level {alliance.level} • {alliance.members.length}/50 Mem</div>
                                <div className="flex justify-center items-center gap-2 mt-4 bg-gradient-to-r from-slate-900 to-slate-800 p-3 rounded border border-slate-700"><div className="flex flex-col items-start"><span className="text-[10px] text-slate-400 uppercase font-bold">Alliance Elo</span><span className="text-xl text-white font-mono font-bold">{alliance.elo}</span></div></div>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-lg text-center border border-slate-600 w-full"><div className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Quỹ Bang</div><div className="text-3xl font-mono text-green-400">{alliance.funds.toLocaleString()} <span className="text-sm">G</span></div></div>
                            <button onClick={handleOpenWarLobby} className="py-6 w-full bg-gradient-to-r from-red-700 to-red-600 text-white font-black text-2xl rounded-xl shadow-lg hover:scale-105 transition-transform border-t-4 border-red-400 mt-auto flex flex-col items-center justify-center group relative overflow-hidden"><div className="absolute inset-0 bg-red-500 opacity-0 group-hover:opacity-20 transition-opacity"></div><span className="relative z-10 flex items-center gap-2">⚔️ CHIẾN TRANH</span><span className="text-[10px] font-normal text-red-200 mt-1 relative z-10 uppercase tracking-widest">3 vs 3 Ranked Battle</span></button>
                        </div>
                        <div className="w-2/3 flex flex-col bg-slate-900/50">
                            <div className="p-4 border-b border-slate-700 bg-slate-800/30 h-1/3 overflow-hidden flex flex-col">
                                <h4 className="font-bold text-slate-400 mb-2 flex justify-between items-center text-xs uppercase tracking-wider"><span>ĐƠN XIN VÀO ({alliance.requests.length})</span>{alliance.requests.length > 0 && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">NEW</span>}</h4>
                                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                    {alliance.requests.map((req, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 hover:border-slate-500 transition-colors">
                                            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-slate-700 overflow-hidden"><img src={getAvatarUrl(req.avatarSeed)} className="w-full h-full object-cover" /></div><div><div className="font-bold text-white text-sm">{req.name}</div><div className="text-[10px] text-yellow-500 font-mono flex items-center gap-1"><RankIcon tier={req.rankTier} className="w-3 h-3" /> {req.rankedStats.elo} Elo</div></div></div>
                                            <button onClick={() => handleAccept(req)} className="px-4 py-1.5 bg-green-600 text-[10px] font-bold text-white rounded hover:bg-green-500 shadow">DUYỆT</button>
                                        </div>
                                    ))}
                                    {alliance.requests.length === 0 && <div className="h-full flex items-center justify-center text-slate-600 text-sm italic">Chưa có đơn mới. Tự động cập nhật...</div>}
                                </div>
                            </div>
                            <div className="flex-1 p-4 overflow-hidden flex flex-col">
                                <h4 className="font-bold text-slate-400 mb-2 text-xs uppercase tracking-wider">THÀNH VIÊN ({alliance.members.length})</h4>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-xs text-slate-500 border-b border-slate-700"><tr><th className="pb-2 pl-2">#</th><th className="pb-2">Name</th><th className="pb-2 text-right">Elo</th><th className="pb-2 text-right pr-2">Contrib</th></tr></thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {alliance.members.map((mem, i) => (
                                                <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="py-2 pl-2 text-slate-500 font-mono w-8">{i+1}</td>
                                                    <td className="py-2"><div className="flex items-center gap-2"><span className={mem.name === myName ? 'text-green-400 font-bold' : 'text-slate-300'}>{mem.role === 'LEADER' ? '👑 ' : ''}{mem.name}</span></div></td>
                                                    <td className="py-2 text-right text-yellow-600 font-mono font-bold">{mem.elo}</td>
                                                    <td className="py-2 text-right pr-2 text-slate-500 font-mono">{mem.contribution}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onStartMatch, onBack, lang }) => {
  const [view, setView] = useState<'LOGIN' | 'HOME' | 'CUSTOM_ROOM' | 'RANK_SEARCH'>('LOGIN');
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<PlayerProfile[]>([]);
  const [allianceLeaderboard, setAllianceLeaderboard] = useState<Alliance[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomIdDisplay, setRoomIdDisplay] = useState('');
  const [customMapIndex, setCustomMapIndex] = useState(0);
  const [customOpponent, setCustomOpponent] = useState<PlayerProfile | null>(null);
  const [botRooms, setBotRooms] = useState<LobbyRoom[]>([]);
  const [sharedRooms, setSharedRooms] = useState<LobbyRoom[]>([]);
  // ADD ALLIANCE_RANK TAB
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'ALLIANCE_RANK' | 'CHAT' | 'ONLINE'>('CHAT');
  const [statsTab, setStatsTab] = useState<'RANKED' | 'CASUAL'>('RANKED');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'NONE' | 'SENDING' | 'ACCEPTED' | 'REJECTED'>('NONE');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const avatarSeeds = useRef<string[]>([]);
  const [showAlliance, setShowAlliance] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const leaderboardRef = useRef<PlayerProfile[]>([]);
  const currentPlayerNameRef = useRef<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const botLastBattleTime = useRef<Record<string, number>>({});

  if (avatarSeeds.current.length === 0) {
      for(let i = 0; i < 500; i++) { avatarSeeds.current.push(`avatar_v1_${i}`); }
  }

  useEffect(() => {
      const loadSharedData = () => {
          try {
              const savedChat = localStorage.getItem(STORAGE_KEY_CHAT);
              if (savedChat) setChatHistory(JSON.parse(savedChat));
              const savedRooms = localStorage.getItem(STORAGE_KEY_USER_ROOMS);
              if (savedRooms) setSharedRooms(JSON.parse(savedRooms));
              const savedBotRooms = localStorage.getItem(STORAGE_KEY_BOT_ROOMS);
              if (savedBotRooms) setBotRooms(JSON.parse(savedBotRooms));
          } catch (e) { console.error("Sync Error", e); }
      };
      loadSharedData();
      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === STORAGE_KEY_CHAT && e.newValue) setChatHistory(JSON.parse(e.newValue));
          if (e.key === STORAGE_KEY_USER_ROOMS && e.newValue) setSharedRooms(JSON.parse(e.newValue));
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEY_PLAYER_NAME);
    let currentName = '';
    if (!savedName) { setView('LOGIN'); } 
    else { setPlayerName(savedName); currentPlayerNameRef.current = savedName; currentName = savedName; setView('HOME'); }
    
    let fakeLb: PlayerProfile[] = [];
    const savedLb = localStorage.getItem(STORAGE_KEY_BOTS_DATA); 
    if (savedLb) { try { fakeLb = JSON.parse(savedLb); } catch (e) { fakeLb = []; } } 
    
    // REGENERATE BOTS WITH REALISTIC STATS
    if (fakeLb.length < 10000) {
        const needed = 10000 - fakeLb.length;
        const generatedNames = generateBotNames(needed);
        const newBots = generatedNames.map(name => {
            const r = Math.random();
            let baseElo = 1000;
            if (r < 0.3) baseElo = 600 + Math.floor(Math.random() * 400); // 600-1000
            else if (r < 0.6) baseElo = 1000 + Math.floor(Math.random() * 500); // 1000-1500
            else if (r < 0.8) baseElo = 1500 + Math.floor(Math.random() * 500); // 1500-2000
            else if (r < 0.95) baseElo = 2000 + Math.floor(Math.random() * 500); // 2000-2500
            else baseElo = 2500 + Math.floor(Math.random() * 1000); // 2500+

            // REALISTIC STATS FORMULA
            const netWins = Math.round((baseElo - 1000) / 25);
            const activityLevel = (baseElo / 3000); 
            const minGames = Math.abs(netWins) + 10;
            const extraGames = Math.floor(Math.random() * 300 * (1 + activityLevel));
            const totalGames = minGames + extraGames;
            
            let wins = Math.round((totalGames + netWins) / 2);
            let losses = totalGames - wins;
            if (wins < 0) { wins = 0; losses = totalGames; }
            if (losses < 0) { losses = 0; wins = totalGames; }

            return {
                name,
                avatarSeed: `${name}_${Math.random()}`,
                rankedStats: { wins: wins, losses: losses, elo: baseElo, streak: Math.random() > 0.7 ? Math.floor(Math.random() * 5) : 0 },
                casualStats: { wins: Math.floor(Math.random() * 50), losses: Math.floor(Math.random() * 50), streak: Math.floor(Math.random() * 3) },
                rankTier: getRankTier(baseElo),
                status: Math.random() > 0.6 ? 'PLAYING' : 'IDLE'
            } as PlayerProfile;
        });
        fakeLb = [...fakeLb, ...newBots];
    }

    if (currentName) {
        const meIndex = fakeLb.findIndex(p => p.name === currentName);
        if (meIndex === -1) {
             const startElo = 100;
             fakeLb.push({ 
                name: currentName,
                avatarSeed: currentName,
                rankedStats: { wins: 0, losses: 0, elo: startElo, streak: 0 },
                casualStats: { wins: 0, losses: 0, streak: 0 },
                rankTier: getRankTier(startElo),
                status: 'IDLE' 
            });
        } else {
            fakeLb[meIndex].status = 'IDLE';
        }
    }

    fakeLb.sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
    setLeaderboard(fakeLb);
    leaderboardRef.current = fakeLb;
    localStorage.setItem(STORAGE_KEY_BOTS_DATA, JSON.stringify(fakeLb));

    // GENERATE FAKE ALLIANCE LEADERBOARD
    const fakeAlliances: Alliance[] = [];
    for(let i=0; i<100; i++) {
        const prefix = ALLIANCE_NAMES_PREFIX[Math.floor(Math.random() * ALLIANCE_NAMES_PREFIX.length)];
        const suffix = ALLIANCE_NAMES_SUFFIX[Math.floor(Math.random() * ALLIANCE_NAMES_SUFFIX.length)];
        const name = `${prefix} ${suffix}`;
        const elo = 1000 + Math.floor(Math.random() * 2500); 
        fakeAlliances.push({
            id: `al_${i}`, name: name, tag: prefix.substring(0, 3).toUpperCase(), level: Math.floor(Math.random() * 10) + 1,
            members: [], requests: [], funds: Math.floor(Math.random() * 50000), elo: elo
        });
    }
    // Inject User's Alliance if exists
    const userAlliance = localStorage.getItem(STORAGE_KEY_ALLIANCE);
    if(userAlliance) {
        const myAl = JSON.parse(userAlliance);
        fakeAlliances.push(myAl);
    }
    fakeAlliances.sort((a,b) => b.elo - a.elo);
    setAllianceLeaderboard(fakeAlliances);

    const botSim = setInterval(runBotSimulation, 5000); 
    const chatSim = setInterval(runChatSimulation, 1500); 
    const roomSim = setInterval(runRoomSimulation, 3000);
    if (botRooms.length < 20) runRoomSimulation(); 

    return () => { clearInterval(botSim); clearInterval(chatSim); clearInterval(roomSim); };
  }, []);

  useEffect(() => { if (chatScrollRef.current) { chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; } }, [chatHistory, activeTab]);

  const runBotSimulation = () => {
      let lb: PlayerProfile[] = [...leaderboardRef.current];
      const now = Date.now();
      let hasChanges = false;
      const checkAndBattle = (idx: number, cooldownMs: number, targetPoolRange: number) => {
          const bot = lb[idx];
          if (!bot) return;
          if (bot.name === currentPlayerNameRef.current) return;
          const lastFight = botLastBattleTime.current[bot.name] || 0;
          if (now - lastFight > cooldownMs) {
              let oppIdx = Math.floor(Math.random() * targetPoolRange);
              if (oppIdx === idx) oppIdx = idx + 1;
              const opponent = lb[oppIdx];
              if (opponent && opponent.name !== currentPlayerNameRef.current) {
                  simulateBattle(bot, opponent);
                  botLastBattleTime.current[bot.name] = now;
                  botLastBattleTime.current[opponent.name] = now;
                  hasChanges = true;
              }
          }
      };
      for(let i=0; i < 20; i++) checkAndBattle(i, 5 * 60 * 1000, 200); 
      for(let i=20; i < 100; i++) checkAndBattle(i, 3 * 60 * 1000, 500); 
      for(let k=0; k<50; k++) {
          const randomIdx = 100 + Math.floor(Math.random() * (lb.length - 100));
          checkAndBattle(randomIdx, 10 * 60 * 1000, lb.length);
      }
      if (hasChanges) { lb.sort((a, b) => b.rankedStats.elo - a.rankedStats.elo); leaderboardRef.current = lb; setLeaderboard([...lb]); }
  };

  const simulateBattle = (p1: PlayerProfile, p2: PlayerProfile) => {
      const eloDiff = p2.rankedStats.elo - p1.rankedStats.elo;
      const expectedScoreP1 = 1 / (1 + Math.pow(10, eloDiff / 400));
      let roll = Math.random();
      const cappedProb = Math.min(0.85, Math.max(0.15, expectedScoreP1));
      const p1Wins = roll < cappedProb;
      const winner = p1Wins ? p1 : p2;
      const loser = p1Wins ? p2 : p1;
      let K = 32;
      if (winner.rankedStats.elo > 2000) K = 15;
      else if (winner.rankedStats.elo > 1000) K = 24;
      const actualScore = p1Wins ? 1 : 0;
      const eloChange = Math.round(K * (actualScore - expectedScoreP1));
      const gain = Math.abs(eloChange) || 1;
      winner.rankedStats.elo += gain;
      winner.rankedStats.wins++;
      winner.rankedStats.streak++;
      winner.rankTier = getRankTier(winner.rankedStats.elo);
      loser.rankedStats.elo = Math.max(0, loser.rankedStats.elo - gain);
      loser.rankedStats.losses++;
      loser.rankedStats.streak = 0;
      loser.rankTier = getRankTier(loser.rankedStats.elo);
  };

  const runRoomSimulation = () => {
      setBotRooms(prev => {
          let next = [...prev];
          next = next.filter(room => {
              if (room.status === 'PLAYING' && Math.random() < 0.1) return false;
              if (room.status === 'WAITING' && Math.random() < 0.05) return false;
              return true;
          });
          const currentCount = next.length;
          const targetCount = 60;
          if (currentCount < targetCount) {
              const needed = targetCount - currentCount;
              const casualPoolStart = 800;
              const casualPoolSize = leaderboardRef.current.length - 800;
              for(let k=0; k < Math.min(needed, 5); k++) {
                  if (casualPoolSize <= 0) break;
                  const idx = casualPoolStart + Math.floor(Math.random() * casualPoolSize);
                  const host = leaderboardRef.current[idx];
                  if (!host || host.name === currentPlayerNameRef.current) continue;
                  const isVN = NAMES_VN.some(n => host.name.includes(n));
                  const roomName = isVN ? getRandom(ROOM_NAMES_VN) : getRandom(ROOM_NAMES_EN);
                  const startAsPlaying = Math.random() > 0.4;
                  let guestName: string | undefined;
                  let guestElo: number | undefined;
                  if (startAsPlaying) {
                      const gIdx = casualPoolStart + Math.floor(Math.random() * casualPoolSize);
                      const guest = leaderboardRef.current[gIdx];
                      if(guest) { guestName = guest.name; guestElo = guest.rankedStats.elo; }
                  }
                  next.unshift({
                      id: Math.random().toString(),
                      name: `${roomName} #${Math.floor(Math.random()*999)}`,
                      host: host.name,
                      hostElo: host.rankedStats.elo,
                      status: startAsPlaying ? 'PLAYING' : 'WAITING',
                      players: startAsPlaying ? 2 : 1,
                      mapIndex: Math.floor(Math.random() * 12),
                      guestName, guestElo
                  });
              }
          }
          localStorage.setItem(STORAGE_KEY_BOT_ROOMS, JSON.stringify(next));
          return next;
      });
  };

  const runChatSimulation = () => {
      if (Math.random() > 0.8) return; 
      const lb = leaderboardRef.current;
      let idx;
      if (Math.random() < 0.4) idx = Math.floor(Math.random() * 100);
      else idx = Math.floor(Math.random() * lb.length);
      const bot = lb[idx];
      if (!bot || bot.name === currentPlayerNameRef.current) return;
      const isVN = NAMES_VN.some(n => bot.name.includes(n)) || Math.random() > 0.5;
      const TEMPLATES = isVN ? CHAT_TEMPLATES_VN : CHAT_TEMPLATES_EN;
      const topicKeys = Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>;
      const randomTopic = getRandom(topicKeys);
      const msg = getRandom(TEMPLATES[randomTopic]);
      const newMsg: ChatMessage = {
          id: Math.random().toString(),
          sender: bot.name,
          text: msg,
          rank: bot.rankTier,
          timestamp: Date.now(),
          topRank: idx + 1
      };
      setChatHistory(prev => { const updated = [...prev, newMsg].slice(-50); localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(updated)); return updated; });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const cleanName = playerName.trim();
      if (cleanName.length > 2) {
          localStorage.setItem(STORAGE_KEY_PLAYER_NAME, cleanName);
          setPlayerName(cleanName);
          currentPlayerNameRef.current = cleanName;
          let lb = [...leaderboardRef.current];
          const exists = lb.findIndex(p => p.name === cleanName);
          if (exists === -1) {
               const newProfile: PlayerProfile = { 
                  name: cleanName,
                  avatarSeed: cleanName,
                  rankedStats: { wins: 0, losses: 0, elo: 100, streak: 0 },
                  casualStats: { wins: 0, losses: 0, streak: 0 },
                  rankTier: RankTier.BRONZE,
                  status: 'IDLE' 
              };
              lb.push(newProfile);
              lb.sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
              leaderboardRef.current = lb;
              setLeaderboard(lb);
              localStorage.setItem(STORAGE_KEY_BOTS_DATA, JSON.stringify(lb));
          }
          setView('HOME');
      }
  };

  const handleLogout = () => {
      if (window.confirm("Bạn có chắc muốn đăng xuất và đổi tên không?")) {
          localStorage.removeItem(STORAGE_KEY_PLAYER_NAME);
          setPlayerName('');
          setView('LOGIN');
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

  const handleJoinRoom = (room: LobbyRoom) => { onStartMatch(room.host, room.hostElo, room.mapIndex, false, false); };

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
      if (bots.length > 0) { const bot = getRandom(bots); setCustomOpponent(bot); }
  };

  const handleChatClick = (senderName: string) => {
      const profile = leaderboard.find(p => p.name === senderName);
      if (profile) setSelectedProfile(profile);
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
      const updatedChat = [...chatHistory, newMsg].slice(-50);
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

  const handleFindRanked = () => { setView('RANK_SEARCH'); setSearchTimer(0); };
  
  const handleStartAllianceWarMatch = (members: AllianceMember[]) => {
      setShowAlliance(false);
      const avgElo = Math.floor(members.reduce((sum, m) => sum + m.elo, 0) / members.length);
      const oppElo = avgElo + Math.floor(Math.random() * 300) - 100;
      // Pass teammates
      const teammates: PlayerProfile[] = members.filter(m => m.name !== playerName).map(m => ({
          name: m.name,
          avatarSeed: m.avatarSeed,
          rankedStats: { elo: m.elo, wins:0, losses:0, streak:0 },
          casualStats: { wins:0, losses:0, streak:0 },
          rankTier: getRankTier(m.elo),
          status: 'PLAYING'
      }));
      onStartMatch("Enemy Alliance", oppElo, Math.floor(Math.random() * 12), false, true, teammates);
  };
  
  useEffect(() => {
      let interval: number;
      if (view === 'RANK_SEARCH') {
          interval = window.setInterval(() => {
              setSearchTimer(prev => prev + 1);
              if (searchTimer > 2 && Math.random() > 0.7) {
                  const foundProfile = leaderboardRef.current.find(p => p.name === playerName);
                  const myElo = foundProfile ? foundProfile.rankedStats.elo : 100;
                  const minElo = Math.max(0, myElo - 150);
                  const maxElo = myElo + 150;
                  let pool = leaderboardRef.current.filter(p => p.name !== playerName && p.rankedStats.elo >= minElo && p.rankedStats.elo <= maxElo);
                  if (pool.length === 0) pool = leaderboardRef.current.filter(p => p.name !== playerName && Math.abs(p.rankedStats.elo - myElo) < 300);
                  if (pool.length === 0) pool = leaderboardRef.current.filter(p => p.name !== playerName);
                  const opponent = getRandom<PlayerProfile>(pool);
                  if (opponent) {
                      onStartMatch(opponent.name, opponent.rankedStats.elo, Math.floor(Math.random() * 12), false, true);
                      clearInterval(interval);
                  }
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [view, searchTimer, playerName, onStartMatch]);

  const myProfile = leaderboard.find(p => p.name === playerName);
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

  const getSenderBadge = (rank?: number) => {
      if (!rank) return null;
      if (rank === 1) return (<span className="inline-flex items-center bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[10px] font-black border border-yellow-200 shadow-md mr-1 gap-1"><span>👑</span> TOP 1</span>);
      if (rank <= 10) return (<span className="inline-flex items-center bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-400 mr-1">TOP 10</span>);
      if (rank <= 50) return (<span className="inline-flex items-center bg-purple-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-purple-400 mr-1">TOP 50</span>);
      if (rank <= 100) return (<span className="inline-flex items-center bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-400 mr-1">TOP 100</span>);
      return null;
  };

  const getSenderStyle = (rank?: number) => {
      if (!rank) return 'text-slate-300';
      if (rank === 1) return 'text-yellow-300 font-black text-sm drop-shadow-md tracking-wide';
      if (rank <= 10) return 'text-red-400 font-bold tracking-wide';
      if (rank <= 50) return 'text-purple-400 font-bold';
      if (rank <= 100) return 'text-blue-400 font-bold';
      return 'text-slate-300';
  };

  const renderDetailModal = () => {
      if (!selectedProfile) return null;
      const sortedLb = [...leaderboard].sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
      const rankPos = sortedLb.findIndex(p => p.name === selectedProfile.name) + 1;
      const title = getRankTitle(selectedProfile.rankTier, rankPos);
      return (
          <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedProfile(null)}>
              <div className="bg-slate-800 border-2 border-slate-600 p-6 rounded-xl w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button className="absolute top-2 right-4 text-slate-400 hover:text-white text-xl" onClick={() => setSelectedProfile(null)}>✕</button>
                  <div className="flex flex-col items-center mb-6">
                       <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center text-4xl border-2 border-blue-500 mb-2 relative overflow-hidden">
                           <img src={getAvatarUrl(selectedProfile.avatarSeed || selectedProfile.name)} alt="Profile" className="w-full h-full object-cover" />
                       </div>
                       <div className={`px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase mb-1 border shadow-lg ${rankPos === 1 ? 'bg-yellow-500 text-black border-white' : rankPos <= 10 ? 'bg-red-600 text-white border-red-400' : rankPos <= 100 ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                           {title}
                       </div>
                       <h3 className="text-2xl font-black text-white tracking-wide uppercase">{selectedProfile.name}</h3>
                       <div className="text-xs text-slate-400 font-bold mt-1">Server Rank: <span className="text-white">#{rankPos}</span></div>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-slate-900/80 p-4 rounded-lg border border-indigo-500/30 relative overflow-hidden">
                          <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 relative z-10">
                              <span className="font-bold text-indigo-400 tracking-wider">RANKED SEASON</span>
                              <div className="flex flex-col items-center"><RankIcon tier={selectedProfile.rankTier} className="w-8 h-8" /><span className="text-[10px] text-yellow-500 font-bold">{selectedProfile.rankedStats.elo} ELO</span></div>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 text-sm relative z-10">
                              <div className="text-slate-400">Wins: <span className="text-green-400 font-bold text-lg">{selectedProfile.rankedStats.wins}</span></div>
                              <div className="text-slate-400">Losses: <span className="text-red-400 font-bold text-lg">{selectedProfile.rankedStats.losses}</span></div>
                              <div className="text-slate-400 col-span-2 flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50"><span>Win Streak:</span> <span className="text-orange-400 font-bold text-lg flex items-center">🔥 {selectedProfile.rankedStats.streak}</span></div>
                          </div>
                      </div>
                      {view === 'CUSTOM_ROOM' && selectedProfile.name !== playerName && (
                          <button onClick={() => { handleInvitePlayer(selectedProfile); setSelectedProfile(null); }} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg">INVITE TO ROOM</button>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  const renderInviteModal = () => {
      if (!isInviting) return null;
      const inviteList = leaderboard.filter(p => p.name !== playerName && p.status === 'IDLE').slice(0, 50);
      return (
          <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
               <div className="bg-slate-800 border border-slate-600 rounded-lg w-full max-w-md h-[70vh] flex flex-col shadow-2xl">
                   <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                       <h3 className="font-bold text-white">INVITE PLAYER</h3>
                       <button onClick={() => setIsInviting(false)} className="text-slate-400 hover:text-white">✕</button>
                   </div>
                   {inviteStatus !== 'NONE' ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            {inviteStatus === 'SENDING' && (<><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div><div className="text-xl font-bold text-white">Sending Invite...</div></>)}
                            {inviteStatus === 'ACCEPTED' && (<><div className="text-5xl mb-4">✅</div><div className="text-xl font-bold text-green-400">Accepted!</div></>)}
                            {inviteStatus === 'REJECTED' && (<><div className="text-5xl mb-4">❌</div><div className="text-xl font-bold text-red-400">Declined / Busy</div></>)}
                        </div>
                   ) : (
                       <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                           {inviteList.map((p, i) => (
                               <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-700 rounded bg-slate-900/50">
                                   <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden"><img src={getAvatarUrl(p.avatarSeed || p.name)} className="w-full h-full object-cover" /></div>
                                       <div><div className="font-bold text-sm text-white">{p.name}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><RankIcon tier={p.rankTier} className="w-3 h-3" /> {p.rankedStats.elo}</div></div>
                                   </div>
                                   <button onClick={() => handleInvitePlayer(p)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded">INVITE</button>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
          </div>
      );
  };
  
  const renderAvatarSelectionModal = () => {
      if (!isAvatarModalOpen) return null;
      return (
          <div className="absolute inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-4xl bg-slate-900 rounded-xl border border-slate-600 shadow-2xl flex flex-col h-[80vh]">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
                      <div><h3 className="font-black text-white text-xl tracking-wider">CHOOSE AVATAR</h3><p className="text-xs text-slate-400">Select an icon to represent you in battle</p></div>
                      <button onClick={() => setIsAvatarModalOpen(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                          {avatarSeeds.current.map((seed, i) => (
                              <div key={i} onClick={() => {
                                    const updatedLb = leaderboard.map(p => { if (p.name === playerName) return { ...p, avatarSeed: seed }; return p; });
                                    setLeaderboard(updatedLb); leaderboardRef.current = updatedLb;
                                    localStorage.setItem(STORAGE_KEY_BOTS_DATA, JSON.stringify(updatedLb)); setIsAvatarModalOpen(false);
                                }} className={`aspect-square bg-slate-800 rounded-xl overflow-hidden border-2 cursor-pointer transition-all relative group ${myProfile?.avatarSeed === seed ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'border-slate-700 hover:border-blue-500 hover:scale-105'}`}>
                                  <img src={getAvatarUrl(seed)} loading="lazy" className="w-full h-full object-cover" />
                                  {myProfile?.avatarSeed === seed && (<div className="absolute inset-0 bg-green-500/20 flex items-center justify-center"><div className="bg-green-500 rounded-full w-8 h-8 flex items-center justify-center border-2 border-white text-white font-bold">✓</div></div>)}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center min-h-[85vh] w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-8 animate-fade-in">
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">STICKMAN ARENA</h2>
              <p className="text-slate-400 mb-8">Enter your name to join the global leaderboard</p>
              <form onSubmit={handleLoginSubmit} className="flex flex-col items-center gap-4 w-full max-w-md">
                  <div className="relative w-full">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-2xl">👤</span></div>
                      <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-800 border-2 border-slate-600 rounded-lg text-white font-bold text-xl focus:border-blue-500 outline-none transition-all placeholder-slate-600" placeholder="YOUR NAME" maxLength={12} autoFocus />
                  </div>
                  <button type="submit" disabled={playerName.length < 3} className={`w-full py-4 rounded-lg font-black text-xl tracking-widest transition-all transform hover:scale-105 shadow-lg ${playerName.length >= 3 ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>JOIN BATTLE</button>
              </form>
          </div>
      );
  }

  return (
    <div className="w-full max-w-7xl h-[85vh] flex flex-col animate-fade-in bg-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-700 relative">
        {renderDetailModal()}
        {renderInviteModal()}
        {renderAvatarSelectionModal()}
        {showAlliance && myProfile && <AllianceModal onClose={() => setShowAlliance(false)} onStartWar={handleStartAllianceWarMatch} myElo={myProfile.rankedStats.elo} myName={myProfile.name} />}

        <div className="bg-slate-800 border-b border-slate-600 shadow-md z-10 flex flex-col">
            <div className="p-3 flex justify-between items-center h-16">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xl px-2">←</button>
                    <h2 className="text-xl font-black italic text-blue-400">ONLINE ARENA</h2>
                </div>
                <div className="flex items-center gap-4 px-2 py-1 rounded transition-all group">
                    <div className="flex flex-col items-end cursor-pointer" onClick={() => myProfile && setSelectedProfile(myProfile)}>
                        <div className="flex items-center gap-2">{myRankForBar && getSenderBadge(myRankForBar <= 100 ? myRankForBar : undefined)}<span className="font-bold text-white text-lg tracking-wide">{playerName}</span></div>
                        <div className="flex items-center gap-1"><RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-4 h-4" /><span className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">{myProfile?.rankedStats.elo || 100} ELO</span></div>
                    </div>
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-blue-500 cursor-pointer overflow-hidden bg-slate-900 relative group-hover:border-white transition-colors" onClick={(e) => { e.stopPropagation(); setIsAvatarModalOpen(true); }} title="Change Avatar">
                            <img src={getAvatarUrl(myProfile?.avatarSeed || playerName)} alt="Me" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><span className="text-xs">✎</span></div>
                        </div>
                        <button onClick={handleLogout} className="absolute -bottom-2 -right-2 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-slate-800 shadow-md z-10" title="Logout / Change Name">✕</button>
                    </div>
                </div>
            </div>
            <NotificationTicker leaderboard={leaderboard} />
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            <div className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 flex flex-col gap-4">
                <button onClick={handleFindRanked} className="w-full py-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg border border-purple-400 flex flex-col items-center hover:scale-105 transition-all group"><span className="text-2xl mb-1 group-hover:rotate-12 transition-transform">🏆</span><span className="font-black text-white italic text-xl">RANKED</span><span className="text-[10px] text-purple-200">Find Match</span></button>
                <button onClick={handleCreateRoom} className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-500 flex flex-col items-center transition-all"><span className="text-2xl mb-1">⚔️</span><span className="font-bold text-white">CREATE ROOM</span><span className="text-[10px] text-slate-400">Friendly Match</span></button>
                <button onClick={() => setShowAlliance(true)} className="w-full py-4 bg-gradient-to-r from-red-900 to-orange-800 hover:from-red-800 hover:to-orange-700 rounded-lg border border-orange-500 flex flex-col items-center transition-all shadow-lg"><span className="text-2xl mb-1">🛡️</span><span className="font-bold text-white">LIÊN MINH</span><span className="text-[10px] text-orange-300">Bang Hội & 3v3</span></button>
                <div className="mt-auto bg-slate-900 p-3 rounded border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs text-slate-400 uppercase font-bold">My Stats</div>
                        <div className="flex gap-1"><button onClick={() => setStatsTab('RANKED')} className={`text-[9px] px-1.5 py-0.5 rounded ${statsTab === 'RANKED' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'}`}>RANK</button><button onClick={() => setStatsTab('CASUAL')} className={`text-[9px] px-1.5 py-0.5 rounded ${statsTab === 'CASUAL' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>CASUAL</button></div>
                    </div>
                    {statsTab === 'RANKED' ? (
                        <><div className="flex justify-between text-sm mb-1"><span>Wins:</span> <span className="text-green-400">{myProfile?.rankedStats.wins}</span></div><div className="flex justify-between text-sm mb-1"><span>Losses:</span> <span className="text-red-400">{myProfile?.rankedStats.losses}</span></div><div className="flex justify-between text-sm"><span>Streak:</span> <span className="text-orange-400">🔥 {myProfile?.rankedStats.streak}</span></div></>
                    ) : (
                        <><div className="flex justify-between text-sm mb-1"><span>Wins:</span> <span className="text-green-400">{myProfile?.casualStats.wins}</span></div><div className="flex justify-between text-sm mb-1"><span>Losses:</span> <span className="text-red-400">{myProfile?.casualStats.losses}</span></div><div className="flex justify-between text-sm"><span>Streak:</span> <span className="text-blue-400">🌊 {myProfile?.casualStats.streak || 0}</span></div></>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-900 relative flex flex-col overflow-hidden">
                {view === 'HOME' && (
                    <>
                        <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm sticky top-0 z-20">
                            <span className="font-bold text-white">LOBBY ROOMS ({displayRooms.length})</span>
                            <div className="text-xs text-slate-400 flex gap-4"><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> WAITING</span><span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> PLAYING</span></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
                                {displayRooms.map(room => (
                                    <div key={room.id} className={`bg-slate-800 border rounded-lg p-3 transition-all shadow-lg flex flex-col gap-2 relative overflow-hidden group ${room.status === 'PLAYING' ? 'border-red-500/30 bg-slate-900/50' : 'border-slate-600 hover:border-blue-500 hover:bg-slate-700'}`}>
                                        <div className={`absolute top-0 left-0 w-1 h-full ${room.status === 'WAITING' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <div className="flex justify-between items-start pl-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-white text-sm truncate" title={room.name}>{room.name}</div>
                                                {room.status === 'PLAYING' && room.guestName ? (
                                                    <div className="text-xs text-slate-300 mt-1 bg-black/40 p-1.5 rounded border border-slate-700/50"><div className="flex justify-between items-center"><span className="text-blue-400 truncate w-20">{room.host}</span><span className="text-[10px] text-yellow-500 font-mono">{room.hostElo}</span></div><div className="text-[9px] text-center font-bold text-red-500 italic scale-75 my-0.5">VS</div><div className="flex justify-between items-center"><span className="text-red-400 truncate w-20">{room.guestName}</span><span className="text-[10px] text-yellow-500 font-mono">{room.guestElo}</span></div></div>
                                                ) : (
                                                    <div className="text-xs text-slate-400 mt-1 truncate">Host: <span className="text-white font-bold">{room.host}</span> <span className="text-yellow-500 font-mono">({room.hostElo})</span></div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end pl-2"><div className={`px-2 py-0.5 rounded text-[10px] font-mono border font-bold ${room.players === 2 ? 'bg-red-900/50 border-red-800 text-red-400' : 'bg-green-900/50 border-green-800 text-green-400'}`}>{room.players}/2</div></div>
                                        </div>
                                        <div className="flex justify-between items-center pl-2 mt-auto border-t border-slate-700/50 pt-2">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[100px] flex items-center gap-1"><span>🗺️</span> {LEVEL_THEMES[room.mapIndex].nameEn}</div>
                                            {room.status === 'WAITING' ? (<button onClick={() => handleJoinRoom(room)} className="px-4 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded shadow cursor-pointer transition-colors">JOIN</button>) : (<button className="px-3 py-1 bg-slate-800 text-red-500 text-[10px] font-bold rounded cursor-not-allowed border border-red-900/20 opacity-70">PLAYING</button>)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {view === 'CUSTOM_ROOM' && (
                    <div className="flex-1 flex flex-col p-8 bg-slate-900/90 h-full">
                        <div className="mb-4">
                            <label className="text-xs text-slate-400 uppercase font-bold">Room Name</label>
                            <div className="flex gap-2"><input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="flex-1 bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded font-bold" /><div className="bg-slate-700 border border-slate-600 px-3 py-2 rounded text-yellow-400 font-mono font-bold">ID: {roomIdDisplay}</div></div>
                        </div>
                        <div className="flex-1 flex items-center justify-center gap-4 md:gap-12">
                             <div className="w-48 h-64 bg-slate-800 border-2 border-blue-500 rounded-xl flex flex-col items-center justify-center gap-2 shadow-xl relative overflow-hidden">
                                 <div className="w-24 h-24 rounded-full border-2 border-white/20 bg-slate-700 mb-2 overflow-hidden"><img src={getAvatarUrl(myProfile?.avatarSeed || playerName)} alt="Me" className="w-full h-full object-cover" /></div>
                                 <div className="font-bold text-white text-center px-2 text-lg">{playerName}</div>
                                 <RankIcon tier={myProfile?.rankTier || RankTier.BRONZE} className="w-8 h-8" />
                                 <div className="text-yellow-500 text-xs font-mono">{myProfile?.rankedStats.elo}</div>
                                 <div className="mt-2 text-green-400 font-bold px-2 py-0.5 bg-green-900/30 rounded text-xs">READY</div>
                             </div>
                             <div className="text-2xl font-black text-red-500 italic">VS</div>
                             <div className="w-48 h-64 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 relative overflow-hidden">
                                 {customOpponent ? (
                                     <>
                                         <div className="absolute top-2 right-2 cursor-pointer text-slate-500 hover:text-red-500 text-lg z-10" onClick={() => setCustomOpponent(null)}>✕</div>
                                         <div className="w-24 h-24 rounded-full border-2 border-red-500/50 bg-slate-700 mb-2 overflow-hidden"><img src={getAvatarUrl(customOpponent.avatarSeed || customOpponent.name)} alt="Opponent" className="w-full h-full object-cover" /></div>
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
                             <div className="flex items-center gap-2"><span className="font-bold text-slate-400 text-sm">MAP:</span><select value={customMapIndex} onChange={(e) => setCustomMapIndex(parseInt(e.target.value))} className="bg-slate-800 text-white p-2 rounded border border-slate-600 text-sm w-40">{LEVEL_THEMES.map((t, i) => (<option key={i} value={i}>{lang === 'VN' ? t.nameVn : t.nameEn}</option>))}</select></div>
                             <div className="flex gap-2"><button onClick={handleExitRoom} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-sm">Exit Room</button><button onClick={handleStartCustom} disabled={!customOpponent} className={`px-6 py-2 font-bold rounded text-sm shadow-lg transition-all ${customOpponent ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>START GAME</button></div>
                        </div>
                    </div>
                )}

                {view === 'RANK_SEARCH' && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-700 flex items-center justify-center relative mb-4 overflow-hidden p-1">
                             <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin z-10"></div>
                             <img src={getAvatarUrl(myProfile?.avatarSeed || playerName)} className="w-full h-full rounded-full opacity-80" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-1">SEARCHING...</h2>
                        <div className="text-slate-400 font-mono">{searchTimer}s</div>
                        <button onClick={() => setView('HOME')} className="mt-8 px-6 py-2 border border-red-500 text-red-500 hover:bg-red-900/30 rounded text-sm">Cancel</button>
                    </div>
                )}
            </div>

            <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
                <div className="flex border-b border-slate-700">
                    <button onClick={() => setActiveTab('CHAT')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'CHAT' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>CHAT</button>
                    <button onClick={() => setActiveTab('ONLINE')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'ONLINE' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>ONLINE (3000+)</button>
                    <button onClick={() => setActiveTab('LEADERBOARD')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'LEADERBOARD' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>TOP</button>
                    <button onClick={() => setActiveTab('ALLIANCE_RANK')} className={`flex-1 py-3 text-xs font-bold ${activeTab === 'ALLIANCE_RANK' ? 'bg-slate-700 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/50'}`}>BANG</button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 relative">
                    {activeTab === 'CHAT' && (
                        <div className="absolute inset-0 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-2 space-y-2" ref={chatScrollRef}>
                                {chatHistory.map(msg => (
                                    <div key={msg.id} className="text-xs break-words">
                                        {msg.isSystem ? (<span className="text-yellow-500 italic font-bold">📢 {msg.text}</span>) : (<><span className="mr-1">{getSenderBadge(msg.topRank)}</span><span className={`font-bold ${msg.sender === playerName ? 'text-green-400' : getSenderStyle(msg.topRank)} cursor-pointer hover:underline`} onClick={() => handleChatClick(msg.sender)}>{msg.sender}</span><span className="text-slate-500 text-[10px] ml-1">[{msg.rank}]</span><span className="text-slate-300">: {msg.text}</span></>)}
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendChat} className="p-2 border-t border-slate-700 bg-slate-800"><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none" placeholder="Say something..." /></form>
                        </div>
                    )}
                    {activeTab === 'ONLINE' && (
                        <div className="p-2 space-y-1">
                            {leaderboard.filter(p => p.status !== 'OFFLINE').slice(0, 100).map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-1 hover:bg-slate-800 rounded cursor-pointer" onClick={() => setSelectedProfile(p)}>
                                    <div className="flex items-center gap-2 overflow-hidden"><div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'IDLE' ? 'bg-green-500' : p.status === 'WAITING' ? 'bg-yellow-500' : 'bg-red-500'}`}></div><span className="text-xs text-slate-300 truncate w-24">{p.name}</span></div>
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
                                        <td className="p-2 text-slate-500 font-mono">{idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}</td>
                                        <td className={`p-2 truncate max-w-[80px] ${idx < 3 ? 'font-bold text-yellow-200' : 'text-slate-300'}`}>{p.name}</td>
                                        <td className="p-2 text-right text-yellow-500">{p.rankedStats.elo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {activeTab === 'ALLIANCE_RANK' && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-800 text-slate-500">
                                <tr>
                                    <th className="p-2">#</th>
                                    <th className="p-2">Name</th>
                                    <th className="p-2 text-right">Rating</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allianceLeaderboard.map((a, idx) => (
                                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                        <td className="p-2 text-slate-500 font-mono w-8">{idx+1}</td>
                                        <td className="p-2 font-bold text-white truncate max-w-[120px]">
                                            <span className="text-slate-400 mr-1">[{a.tag}]</span>
                                            {a.name}
                                        </td>
                                        <td className="p-2 text-right text-yellow-500 font-mono">{a.elo}</td>
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
