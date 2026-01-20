
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
const STORAGE_KEY_BOTS_DATA = 'stickman_bots_v7'; 
const STORAGE_KEY_PLAYER_NAME = 'stickman_player_name';
const STORAGE_KEY_ALLIANCE = 'stickman_alliance_v3'; 

function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const BADGES_SHOP = [
    { icon: '🛡️', price: 0, name: 'Tấm Khiên' },
    { icon: '🐲', price: 5000, name: 'Rồng Thần' },
    { icon: '⚔️', price: 5000, name: 'Song Kiếm' },
    { icon: '👑', price: 10000, name: 'Vương Miện' },
    { icon: '💀', price: 10000, name: 'Đầu Lâu' },
    { icon: '🦅', price: 20000, name: 'Đại Bàng' },
    { icon: '🔥', price: 20000, name: 'Ngọn Lửa' }
];

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

const NotificationTicker: React.FC = () => {
    const [messages, setMessages] = useState<TickerNotification[]>([]);
    useEffect(() => {
        const initial: TickerNotification[] = [];
        for(let i=0; i<3; i++) initial.push(generateMessage());
        setMessages(initial);
        const interval = setInterval(() => {
            setMessages(prev => { const next = [...prev, generateMessage()]; return next.slice(-3); });
        }, 3000); 
        return () => clearInterval(interval);
    }, []);
    const generateMessage = (): TickerNotification => {
        const types: ('SYSTEM' | 'PERSONAL' | 'ALLIANCE')[] = ['SYSTEM', 'PERSONAL', 'ALLIANCE'];
        const type = types[Math.floor(Math.random() * types.length)];
        const templates = TICKER_TEMPLATES[type];
        let text = templates[Math.floor(Math.random() * templates.length)];
        const randomName = NAMES_VN[Math.floor(Math.random() * NAMES_VN.length)];
        const randomAlliance = `${ALLIANCE_NAMES_PREFIX[Math.floor(Math.random()*ALLIANCE_NAMES_PREFIX.length)]} ${ALLIANCE_NAMES_SUFFIX[Math.floor(Math.random()*ALLIANCE_NAMES_SUFFIX.length)]}`;
        text = text.replace('{name}', randomName).replace('{rank}', Math.floor(Math.random()*100).toString()).replace('{streak}', Math.floor(Math.random()*20).toString()).replace('{tier}', 'DIAMOND').replace('{alliance}', randomAlliance);
        let color = 'text-green-400';
        if (type === 'SYSTEM') color = 'text-yellow-400';
        if (type === 'ALLIANCE') color = 'text-blue-400';
        return { id: Math.random().toString(), text, type, color };
    };
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
    const [view, setView] = useState<'HOME' | 'WAR_LOBBY' | 'SHOP'>('HOME');
    const [warMembers, setWarMembers] = useState<AllianceMember[]>([]);
    const [isSearchingWar, setIsSearchingWar] = useState(false);
    const [searchTime, setSearchTime] = useState(0);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY_ALLIANCE);
        if (saved) {
            const al = JSON.parse(saved);
            // Migration
            if (!al.elo) al.elo = 1000;
            if (!al.maxMembers) al.maxMembers = 50;
            if (!al.badges) al.badges = ['🛡️'];
            if (!al.currentBadge) al.currentBadge = '🛡️';
            // Ensure members have roles if older version
            al.members = al.members.map((m: any) => ({
                ...m,
                role: m.role === 'LEADER' ? 'LEADER' : (m.role === 'VICE_LEADER' ? 'VICE_LEADER' : 'MEMBER')
            }));
            setAlliance(al);
        }
    }, []);

    const save = (al: Alliance) => {
        setAlliance({...al});
        localStorage.setItem(STORAGE_KEY_ALLIANCE, JSON.stringify(al));
    };

    const createAlliance = () => {
        if (!createName) return;
        const newAl: Alliance = {
            id: Date.now().toString(), name: createName, tag: createName.substring(0, 3).toUpperCase(), level: 1,
            members: [{ name: myName, role: 'LEADER', contribution: 0, elo: myElo, avatarSeed: myName }],
            requests: [], funds: 0, elo: 1000, rankTier: RankTier.BRONZE,
            maxMembers: 50, badges: ['🛡️'], currentBadge: '🛡️'
        };
        save(newAl);
    };

    const handleAccept = (p: PlayerProfile) => {
        if(!alliance) return;
        if(alliance.members.length >= alliance.maxMembers) {
            alert("Liên minh đã đầy!");
            return;
        }
        alliance.members.push({ name: p.name, role: 'MEMBER', contribution: 0, elo: p.rankedStats.elo, avatarSeed: p.avatarSeed });
        alliance.requests = alliance.requests.filter(r => r.name !== p.name);
        save(alliance);
    };

    const handleKick = (memberName: string) => {
        if (!alliance) return;
        if (window.confirm(`Bạn muốn đuổi ${memberName}?`)) {
            alliance.members = alliance.members.filter(m => m.name !== memberName);
            save(alliance);
        }
    };

    const handlePromote = (memberName: string) => {
        if (!alliance) return;
        const member = alliance.members.find(m => m.name === memberName);
        if (member) {
            member.role = 'VICE_LEADER';
            save(alliance);
        }
    };

    const handleBuyBadge = (badge: {icon: string, price: number}) => {
        if (!alliance) return;
        if (alliance.funds >= badge.price) {
            alliance.funds -= badge.price;
            alliance.badges.push(badge.icon);
            alliance.currentBadge = badge.icon;
            save(alliance);
        }
    };

    const handleExpandAlliance = () => {
        if (!alliance) return;
        if (alliance.funds >= 10000) {
            alliance.funds -= 10000;
            alliance.maxMembers += 5;
            alliance.level += 1;
            save(alliance);
        }
    };

    const handleOpenWarLobby = () => {
        const me = alliance?.members.find(m => m.name === myName);
        if (me) {
            setWarMembers([me]);
            setView('WAR_LOBBY'); setIsSearchingWar(false);
        }
    };

    const inviteBot = () => {
        if (!alliance || warMembers.length >= 3) return;
        // Strict Filter: Only members in list
        const availableMembers = alliance.members.filter(m => !warMembers.some(wm => wm.name === m.name));
        
        if (availableMembers.length === 0) return;

        setTimeout(() => {
            const bot = getRandom(availableMembers);
            setWarMembers(prev => [...prev, bot]);
        }, 500);
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

    const myRole = alliance?.members.find(m => m.name === myName)?.role || 'MEMBER';
    const sortedMembers = alliance ? [...alliance.members].sort((a,b) => {
        const roleOrder = { LEADER: 3, VICE_LEADER: 2, MEMBER: 1 };
        if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[b.role] - roleOrder[a.role];
        return b.contribution - a.contribution;
    }) : [];

    if (view === 'WAR_LOBBY' && alliance) {
        return (
            <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-white">
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-2 tracking-widest italic uppercase">3v3 WAR ROOM</h2>
                <div className="text-slate-400 mb-8">Alliance Rating: <span className="text-yellow-500 font-bold">{Math.floor(warMembers.reduce((a,b)=>a+b.elo,0)/Math.max(1,warMembers.length))} ELO</span></div>
                <div className="flex gap-4 md:gap-8 mb-12">
                    {[0, 1, 2].map(idx => {
                        const member = warMembers[idx];
                        return (
                            <div key={idx} className="flex flex-col items-center gap-3 w-32">
                                {member ? (
                                    <div className={`w-24 h-24 rounded-full border-4 ${idx===0 ? 'border-green-500 shadow-[0_0_20px_#22c55e]' : 'border-blue-500'} bg-slate-800 overflow-hidden relative group`}>
                                        <img src={getAvatarUrl(member.avatarSeed)} className="w-full h-full object-cover" />
                                        {idx > 0 && <button onClick={() => setWarMembers(prev => prev.filter(m => m.name !== member.name))} className="absolute top-0 right-0 bg-red-600 w-6 h-6 rounded-full text-xs flex items-center justify-center hover:bg-red-500 z-10">✕</button>}
                                        {idx === 0 && <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-center font-bold text-green-400 py-1">CAPTAIN</div>}
                                    </div>
                                ) : (
                                    <button onClick={inviteBot} className="w-24 h-24 rounded-full border-4 border-dashed border-slate-600 flex items-center justify-center text-4xl text-slate-500 hover:border-white hover:text-white transition-all bg-slate-800 animate-pulse">+</button>
                                )}
                                {member ? (
                                    <div className="text-center w-full">
                                        <div className={`font-bold text-white bg-slate-800 px-2 py-1 rounded border ${idx===0 ? 'border-green-500' : 'border-blue-500'} text-sm truncate`}>{member.name}</div>
                                        <div className="text-xs text-yellow-500 font-mono mt-1">{member.elo} Elo</div>
                                    </div>
                                ) : (<div className="text-center w-full text-slate-500 text-xs">Mời thành viên</div>)}
                            </div>
                        );
                    })}
                </div>
                {isSearchingWar ? (
                    <div className="text-center bg-slate-900/80 p-8 rounded-xl border border-slate-700 shadow-2xl">
                        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <div className="text-2xl font-bold text-white mb-2 animate-pulse">SEARCHING...</div>
                        <div className="text-4xl font-mono text-yellow-400 font-black">{searchTime}s</div>
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

    if (view === 'SHOP' && alliance) {
        return (
            <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <h2 className="text-2xl font-bold text-yellow-400">🏪 CỬA HÀNG LIÊN MINH</h2>
                    <div className="text-xl font-mono text-green-400 font-bold">Quỹ: {alliance.funds} G</div>
                    <button onClick={() => setView('HOME')} className="text-slate-400 hover:text-white font-bold">QUAY LẠI</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 p-4 rounded border border-slate-600 flex flex-col items-center gap-2">
                        <div className="text-4xl">🏰</div>
                        <div className="font-bold text-white">Mở Rộng Quy Mô</div>
                        <div className="text-xs text-slate-400 text-center">Tăng +5 Slot thành viên. Cấp độ +1.</div>
                        <button disabled={alliance.funds < 10000} onClick={handleExpandAlliance} className={`mt-2 px-4 py-2 rounded font-bold w-full ${alliance.funds >= 10000 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>10,000 G</button>
                    </div>
                    {BADGES_SHOP.map((badge, i) => {
                        const owned = alliance.badges.includes(badge.icon);
                        return (
                            <div key={i} className="bg-slate-800 p-4 rounded border border-slate-600 flex flex-col items-center gap-2 relative">
                                <div className="text-4xl">{badge.icon}</div>
                                <div className="font-bold text-white">{badge.name}</div>
                                {owned ? (
                                    <div className="px-4 py-2 bg-slate-700 text-green-400 font-bold rounded w-full text-center">ĐÃ SỞ HỮU</div>
                                ) : (
                                    <button disabled={alliance.funds < badge.price} onClick={() => handleBuyBadge(badge)} className={`mt-2 px-4 py-2 rounded font-bold w-full ${alliance.funds >= badge.price ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>{badge.price} G</button>
                                )}
                            </div>
                        )
                    })}
                </div>
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
                        <h3 className="text-2xl font-bold text-slate-300">CHƯA GIA NHẬP LIÊN MINH</h3>
                        <div className="flex gap-2"><input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Tên Liên Minh" className="p-3 bg-slate-800 border border-slate-600 rounded font-bold text-center" /><button onClick={createAlliance} className="px-6 py-3 bg-green-600 font-bold rounded">TẠO MỚI</button></div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-1/3 bg-slate-800 p-6 flex flex-col items-center border-r border-slate-700">
                            <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-5xl mb-4 border-4 border-yellow-500">{alliance.currentBadge}</div>
                            <h3 className="text-2xl font-black text-yellow-400 mb-1">[{alliance.tag}] {alliance.name}</h3>
                            <div className="text-slate-400 text-sm font-bold mb-4">Level {alliance.level} • {alliance.members.length}/{alliance.maxMembers}</div>
                            <div className="text-green-400 font-mono font-bold mb-4">Quỹ: {alliance.funds} G</div>
                            
                            <div className="grid grid-cols-2 gap-2 w-full mb-4">
                                <button onClick={() => setView('SHOP')} className="py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded">🏪 CỬA HÀNG</button>
                                <button onClick={() => {}} className="py-2 bg-slate-700 text-slate-400 font-bold rounded cursor-not-allowed">🎁 SỰ KIỆN</button>
                            </div>

                            <button onClick={handleOpenWarLobby} className="w-full py-4 bg-red-600 text-white font-black rounded shadow-lg hover:scale-105 transition-transform mt-auto">⚔️ CHIẾN TRANH</button>
                        </div>
                        <div className="w-2/3 p-4 overflow-y-auto">
                            <h4 className="font-bold text-slate-400 mb-2">ĐƠN XIN VÀO ({alliance.requests.length})</h4>
                            <div className="space-y-2 mb-6 max-h-40 overflow-y-auto custom-scrollbar">{alliance.requests.map((r,i) => <div key={i} className="flex justify-between bg-slate-800 p-2 rounded items-center"><span>{r.name} ({r.rankedStats.elo} Elo)</span><button onClick={()=>handleAccept(r)} className="bg-green-600 px-3 py-1 rounded text-xs text-white font-bold">DUYỆT</button></div>)}</div>
                            
                            <h4 className="font-bold text-slate-400 mb-2 flex justify-between"><span>THÀNH VIÊN ({alliance.members.length})</span> <span className="text-xs italic">Sắp xếp theo cống hiến</span></h4>
                            <div className="space-y-1">
                                {sortedMembers.map((m,i) => (
                                    <div key={i} className="flex justify-between items-center p-2 border-b border-slate-800 hover:bg-slate-800/50 group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-mono w-4">{i+1}</span>
                                            <span className={m.role === 'LEADER' ? 'text-yellow-400 font-bold' : (m.role === 'VICE_LEADER' ? 'text-blue-400 font-bold' : 'text-white')}>
                                                {m.role === 'LEADER' ? '👑 ' : (m.role === 'VICE_LEADER' ? '🛡️ ' : '')}{m.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-yellow-500 font-mono text-xs">{m.elo} Elo</span>
                                            <span className="text-green-400 font-mono text-xs">{m.contribution} G</span>
                                            {/* Action Buttons */}
                                            {(myRole === 'LEADER' || (myRole === 'VICE_LEADER' && m.role === 'MEMBER')) && m.name !== myName && (
                                                <div className="hidden group-hover:flex gap-1">
                                                    {myRole === 'LEADER' && m.role === 'MEMBER' && <button onClick={() => handlePromote(m.name)} className="bg-blue-600 text-white px-2 py-0.5 rounded text-[9px]">UP</button>}
                                                    <button onClick={() => handleKick(m.name)} className="bg-red-600 text-white px-2 py-0.5 rounded text-[9px]">KICK</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
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

  // --- INITIALIZATION ---
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEY_PLAYER_NAME);
    if (savedName) {
        setPlayerName(savedName);
        currentPlayerNameRef.current = savedName;
        setView('HOME');
    }

    let fakeLb: PlayerProfile[] = [];
    const savedLb = localStorage.getItem(STORAGE_KEY_BOTS_DATA); 
    if (savedLb) {
        try { fakeLb = JSON.parse(savedLb); } catch (e) { fakeLb = []; }
    }
    
    // --- 1. GENERATE BOTS (Fix 1: Stats logic) ---
    if (fakeLb.length < 5000) {
        const needed = 5000 - fakeLb.length;
        const generatedNames = generateBotNames(needed);
        const newBots = generatedNames.map(name => {
            const r = Math.random();
            let baseElo = 1000;
            if (r < 0.4) baseElo = 600 + Math.floor(Math.random() * 400); 
            else if (r < 0.8) baseElo = 1000 + Math.floor(Math.random() * 800); 
            else if (r < 0.98) baseElo = 1800 + Math.floor(Math.random() * 600); 
            else baseElo = 2400 + Math.floor(Math.random() * 600); 

            // Fix 1: Calculate wins based on Elo
            const netWins = Math.floor((baseElo - 1000) / 25);
            const wins = Math.max(0, netWins + Math.floor(Math.random() * 50));
            const losses = Math.max(0, Math.floor(Math.random() * 50));

            return {
                name,
                avatarSeed: `${name}_${Math.random()}`,
                rankedStats: { wins, losses, elo: baseElo, streak: 0 },
                casualStats: { wins: 0, losses: 0, streak: 0 },
                rankTier: getRankTier(baseElo),
                status: Math.random() > 0.6 ? 'PLAYING' : 'IDLE'
            } as PlayerProfile;
        });
        fakeLb = [...fakeLb, ...newBots];
    }

    // --- Fix 2: PERSISTENCE CHECK ---
    if (savedName) {
        const meIndex = fakeLb.findIndex(p => p.name === savedName);
        if (meIndex === -1) {
             // Not found in new list, check if we should create
             fakeLb.push({ 
                name: savedName, avatarSeed: savedName,
                rankedStats: { wins: 0, losses: 0, elo: 1000, streak: 0 },
                casualStats: { wins: 0, losses: 0, streak: 0 },
                rankTier: RankTier.BRONZE, status: 'IDLE' 
            });
        }
        // If found, we do nothing, preserving old stats from localStorage
    }

    fakeLb.sort((a,b) => b.rankedStats.elo - a.rankedStats.elo);
    setLeaderboard(fakeLb);
    leaderboardRef.current = fakeLb;
    localStorage.setItem(STORAGE_KEY_BOTS_DATA, JSON.stringify(fakeLb));

    const fakeAlliances: Alliance[] = [];
    for(let i=0; i<100; i++) {
        const prefix = ALLIANCE_NAMES_PREFIX[Math.floor(Math.random() * ALLIANCE_NAMES_PREFIX.length)];
        const suffix = ALLIANCE_NAMES_SUFFIX[Math.floor(Math.random() * ALLIANCE_NAMES_SUFFIX.length)];
        const name = `${prefix} ${suffix}`;
        const elo = 1000 + Math.floor(Math.random() * 2500); 
        fakeAlliances.push({
            id: `al_${i}`, name: name, tag: prefix.substring(0, 3).toUpperCase(), level: Math.floor(Math.random() * 10) + 1,
            members: [], requests: [], funds: Math.floor(Math.random() * 50000), elo: elo, rankTier: getRankTier(elo),
            maxMembers: 50, badges: ['🛡️'], currentBadge: '🛡️'
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

    return () => { clearInterval(botSim); clearInterval(chatSim); clearInterval(roomSim); };
  }, []);

  const runBotSimulation = () => { /* Simulation Code ... */ };
  const runRoomSimulation = () => { /* Simulation Code ... */ };
  const runChatSimulation = () => { /* Simulation Code ... */ };
  
  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (playerName.trim().length < 3) return;
      localStorage.setItem(STORAGE_KEY_PLAYER_NAME, playerName);
      currentPlayerNameRef.current = playerName;
      setView('HOME');
  };
  const handleLogout = () => { /*...*/ };
  const handleCreateRoom = () => { setView('CUSTOM_ROOM'); };
  const handleExitRoom = () => { setView('HOME'); };
  const handleJoinRoom = (r: LobbyRoom) => { onStartMatch(r.host, r.hostElo, r.mapIndex, false, false); };
  const handleInvitePlayer = (p: PlayerProfile) => { /*...*/ };
  const handleAutoFindCustom = () => { /*...*/ };
  const handleChatClick = (n: string) => { /*...*/ };
  const handleSendChat = (e: React.FormEvent) => { /*...*/ };
  const handleStartCustom = () => { /*...*/ };
  const handleFindRanked = () => { setView('RANK_SEARCH'); setSearchTimer(0); };
  
  const handleStartAllianceWarMatch = (m: AllianceMember[]) => {
      setShowAlliance(false);
      const teammates: PlayerProfile[] = m
        .filter(mem => mem.name !== playerName)
        .map(mem => ({
            name: mem.name,
            avatarSeed: mem.avatarSeed,
            rankedStats: { elo: mem.elo, wins:0, losses:0, streak:0},
            casualStats: { wins:0, losses:0, streak:0},
            rankTier: getRankTier(mem.elo),
            status: 'PLAYING'
        }));

      onStartMatch("Enemy Alliance", 1500, 0, false, true, teammates);
  };

  const myProfile = leaderboard.find(p => p.name === playerName);
  const myRankPos = leaderboard.findIndex(p => p.name === playerName) + 1;

  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center min-h-[85vh] w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-8">
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-8">STICKMAN ARENA</h2>
              <form onSubmit={handleLoginSubmit} className="flex flex-col items-center gap-4 w-full max-w-md">
                  <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full p-4 bg-slate-800 border-2 border-slate-600 rounded-lg text-white font-bold text-xl text-center" placeholder="YOUR NAME" maxLength={12} autoFocus />
                  <button type="submit" disabled={playerName.length < 3} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-black text-xl text-white shadow-lg">JOIN BATTLE</button>
              </form>
          </div>
      );
  }

  return (
    <div className="w-full max-w-7xl h-[85vh] flex flex-col animate-fade-in bg-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-700 relative">
        {showAlliance && myProfile && <AllianceModal onClose={() => setShowAlliance(false)} onStartWar={handleStartAllianceWarMatch} myElo={myProfile.rankedStats.elo} myName={myProfile.name} />}
        
        {/* HEADER & TICKER */}
        <div className="bg-slate-800 border-b border-slate-600 shadow-md z-10 flex flex-col">
            <div className="p-3 flex justify-between items-center h-16">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xl px-2">←</button>
                    <h2 className="text-xl font-black italic text-blue-400">ONLINE ARENA</h2>
                </div>
                {myProfile && (
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="font-bold text-white text-lg">{playerName}</div>
                            <div className="text-xs text-yellow-500 font-mono font-bold flex justify-end gap-2">
                                <span>#{myRankPos}</span>
                                <span>{myProfile.rankedStats.elo} ELO</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800">
                            <img src={getAvatarUrl(myProfile.avatarSeed)} className="w-full h-full object-cover" />
                        </div>
                    </div>
                )}
            </div>
            <NotificationTicker />
        </div>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* LEFT SIDEBAR (Actions) */}
            <div className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 flex flex-col gap-4">
                <button onClick={handleFindRanked} className="w-full py-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg border border-purple-400 flex flex-col items-center hover:scale-105 transition-all group">
                    <span className="text-2xl mb-1 group-hover:rotate-12 transition-transform">🏆</span>
                    <span className="font-black text-white italic text-xl">RANKED</span>
                    <span className="text-[10px] text-purple-200">Find Match</span>
                </button>
                <button onClick={handleCreateRoom} className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-500 flex flex-col items-center transition-all">
                    <span className="text-2xl mb-1">⚔️</span>
                    <span className="font-bold text-white">CREATE ROOM</span>
                    <span className="text-[10px] text-slate-400">Friendly Match</span>
                </button>
                <button onClick={() => setShowAlliance(true)} className="w-full py-4 bg-gradient-to-r from-red-900 to-orange-800 hover:from-red-800 hover:to-orange-700 rounded-lg border border-orange-