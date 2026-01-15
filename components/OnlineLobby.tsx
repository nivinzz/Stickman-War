
import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, Language, RankTier, ChatMessage, LobbyRoom } from '../types';
import { LEVEL_THEMES, getRankTier, getAvatarUrl } from '../constants';
import { firebaseService } from '../services/FirebaseService'; // New Service

interface OnlineLobbyProps {
  onStartMatch: (opponentName: string, opponentElo: number, mapThemeIndex: number, isSpectator?: boolean, isRanked?: boolean, roomId?: string, myUserId?: string) => void;
  onBack: () => void;
  lang: Language;
}

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
  const [view, setView] = useState<'LOGIN' | 'HOME' | 'CUSTOM_ROOM'>('LOGIN');
  const [userProfile, setUserProfile] = useState<PlayerProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Real Data
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // UI States
  const [customMapIndex, setCustomMapIndex] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initialize Firebase Listeners
  useEffect(() => {
      // Logic to handle auth updates safely
      const handleAuthUpdate = (user: any, profile: PlayerProfile | null) => {
          if (profile) {
              setUserProfile(profile);
              setView('HOME');
          } else {
              setUserProfile(null);
              setView('LOGIN');
          }
      };

      // 1. Check current state immediately
      if (firebaseService.currentProfile) {
          handleAuthUpdate(firebaseService.currentUser, firebaseService.currentProfile);
      }

      // 2. Subscribe
      firebaseService.onAuthUpdate = handleAuthUpdate;

      // 3. Listen for Rooms
      const unsubRooms = firebaseService.listenToRooms((newRooms) => {
          setRooms(newRooms);
          
          // Check if my room is active and ready to play
          if (firebaseService.currentRoomId) {
              const myRoom = newRooms.find(r => r.id === firebaseService.currentRoomId);
              if (myRoom && myRoom.status === 'PLAYING') {
                  const opponentName = myRoom.host === firebaseService.currentProfile?.name ? myRoom.guestName! : myRoom.host;
                  const opponentElo = myRoom.host === firebaseService.currentProfile?.name ? myRoom.guestElo! : myRoom.hostElo;
                  
                  onStartMatch(
                      opponentName, 
                      opponentElo, 
                      myRoom.mapIndex, 
                      false, 
                      true, 
                      myRoom.id, 
                      firebaseService.currentUser?.uid
                  );
              }
          }
      });

      // 4. Listen for Chat
      const unsubChat = firebaseService.listenToChat((msgs) => {
          setChatHistory(msgs);
      });

      return () => {
          unsubRooms();
          unsubChat();
          firebaseService.onAuthUpdate = null; // Cleanup
      };
  }, []); // Run ONCE on mount

  useEffect(() => {
      if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
  }, [chatHistory]);

  const handleGoogleLogin = async () => {
      setErrorMsg('');
      try {
          await firebaseService.loginWithGoogle();
          // Auth update handled by listener
      } catch (e: any) {
          if (e.code === 'auth/unauthorized-domain') {
              setErrorMsg(`Lỗi Domain! Vui lòng dùng "Play as Guest" để vào game ngay.`);
          } else {
              setErrorMsg(`Lỗi đăng nhập: ${e.message}`);
          }
      }
  };

  const handleGuestLogin = async () => {
      setErrorMsg('');
      await firebaseService.loginAsGuest();
      // Auth update handled by listener
  };

  const handleLogout = async () => {
      await firebaseService.logout();
      // Auth update handled by listener
  };

  const handleCreateRoom = async () => {
      try {
          await firebaseService.createRoom(customMapIndex);
          // Wait for listener to trigger game start when someone joins
          setView('CUSTOM_ROOM');
      } catch (e) {
          console.error(e);
          alert("Could not create room");
      }
  };

  const handleJoinRoom = async (room: LobbyRoom) => {
      const success = await firebaseService.joinRoom(room.id);
      if (success) {
          // Join success, wait for update
          // Game start handled in useEffect via room update
      } else {
          alert("Room is full or no longer exists.");
      }
  };

  const handleCancelRoom = () => {
      firebaseService.leaveRoom();
      setView('HOME');
  };

  const handleSendChat = (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      firebaseService.sendChat(chatInput);
      setChatInput('');
  };

  // --- VIEW: LOGIN ---
  if (view === 'LOGIN') {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in relative">
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-8">ONLINE ARENA</h2>
              <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl w-full max-w-md text-center">
                  <div className="text-slate-300 mb-6">Log in to play Online Multiplayer!</div>
                  
                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleGoogleLogin} 
                        className="w-full bg-white hover:bg-slate-100 text-slate-800 font-bold py-3 rounded flex items-center justify-center gap-3 transition-all"
                      >
                          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6"/>
                          Sign in with Google
                      </button>
                      
                      <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-slate-600"></div>
                          <span className="flex-shrink mx-4 text-slate-500 text-xs">OR</span>
                          <div className="flex-grow border-t border-slate-600"></div>
                      </div>

                      <button 
                        onClick={handleGuestLogin} 
                        className={`w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded flex items-center justify-center gap-3 transition-all border border-slate-500 ${errorMsg.includes('Domain') ? 'animate-pulse ring-2 ring-yellow-400' : ''}`}
                      >
                          👤 Play as Guest (Chơi Ngay)
                      </button>
                  </div>

                  {errorMsg && (
                      <div className="mt-4 p-2 bg-red-900/50 border border-red-500 rounded text-red-200 text-xs text-left">
                          ⚠️ {errorMsg}
                      </div>
                  )}
                  
                  <button onClick={onBack} className="w-full mt-6 text-slate-500 hover:text-slate-300 text-sm underline">Back to Menu</button>
              </div>
              
              {/* Version Tag */}
              <div className="absolute bottom-[-100px] text-slate-600 font-mono text-xs">
                  v2.2 (Component Check)
              </div>
          </div>
      );
  }

  // --- VIEW: MAIN LOBBY ---
  return (
    <div className="w-full max-w-7xl h-[85vh] flex flex-col animate-fade-in bg-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-700 relative">
        
        {/* HEADER */}
        <div className="bg-slate-800 p-3 border-b border-slate-600 flex justify-between items-center shadow-md z-10 h-16">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xl px-2">←</button>
                <h2 className="text-xl font-black italic text-blue-400">ONLINE ARENA</h2>
                <span className="text-xs text-slate-600 font-mono border border-slate-700 px-1 rounded">v2.2</span>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="font-bold text-white text-lg tracking-wide">{userProfile?.name}</span>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-yellow-500 font-bold">{userProfile?.rankedStats.elo} ELO</span>
                        <span className="text-[10px] text-slate-400">| Wins: {userProfile?.rankedStats.wins}</span>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-900">
                    <img src={getAvatarUrl(userProfile?.avatarSeed || 'user')} alt="Me" className="w-full h-full object-cover" />
                </div>
                
                {/* LOGOUT BUTTON */}
                <button 
                    onClick={handleLogout}
                    className="ml-2 p-2 bg-red-900/50 hover:bg-red-800 border border-red-700 rounded-lg text-xs text-red-200 font-bold transition-all shadow-lg flex flex-col items-center justify-center gap-1"
                    title="Sign Out / Change Account"
                >
                    <span className="text-lg leading-none">🚪</span>
                </button>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* LEFT: ACTIONS */}
            <div className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 flex flex-col gap-4">
                {view === 'HOME' ? (
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                        <h3 className="text-white font-bold mb-2 text-sm">CREATE MATCH</h3>
                        <div className="mb-2">
                            <label className="text-[10px] text-slate-400 uppercase">Map</label>
                            <select 
                                value={customMapIndex}
                                onChange={(e) => setCustomMapIndex(parseInt(e.target.value))}
                                className="w-full bg-slate-900 text-white text-xs p-1 rounded border border-slate-600"
                            >
                                {LEVEL_THEMES.map((t, i) => (
                                    <option key={i} value={i}>{t.nameEn}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleCreateRoom}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold text-sm shadow-lg"
                        >
                            Create Room
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 text-center">
                        <div className="animate-spin text-4xl mb-2">⏳</div>
                        <div className="text-white font-bold mb-2">Waiting for Player...</div>
                        <button onClick={handleCancelRoom} className="w-full py-2 bg-red-600 hover:bg-red-500 rounded text-white font-bold text-sm">Cancel</button>
                    </div>
                )}
            </div>

            {/* CENTER: ROOM LIST */}
            <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-900 flex flex-col">
                <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm">
                    <span className="font-bold text-white">ACTIVE ROOMS</span>
                    <div className="text-xs text-slate-400 flex gap-4">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> WAITING</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> PLAYING</span>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-3 gap-2 content-start custom-scrollbar">
                    {rooms.length === 0 && <div className="col-span-full text-center text-slate-500 mt-10">No active rooms. Create one!</div>}
                    {rooms.map(room => (
                        <div key={room.id} className={`bg-slate-800 border rounded-lg p-2 transition-all shadow flex flex-col gap-1 relative overflow-hidden group ${room.status === 'PLAYING' ? 'border-red-500/30' : 'border-slate-600 hover:border-blue-500'}`}>
                            <div className={`absolute top-0 left-0 w-1 h-full ${room.status === 'WAITING' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div className="flex justify-between items-start pl-2">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-xs truncate">{room.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                        Host: {room.host} <span className="text-yellow-500">({room.hostElo})</span>
                                    </div>
                                </div>
                                <div className="bg-slate-900 px-1 py-0.5 rounded text-[9px] font-mono border border-slate-700 text-slate-300">
                                    {room.players}/2
                                </div>
                            </div>
                            <div className="flex justify-between items-center pl-2 mt-1">
                                <div className="text-[9px] text-slate-500 uppercase font-bold truncate max-w-[60px]">{LEVEL_THEMES[room.mapIndex].nameEn}</div>
                                {room.status === 'WAITING' && room.hostId !== firebaseService.currentUser?.uid ? (
                                    <button 
                                        onClick={() => handleJoinRoom(room)} 
                                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded shadow cursor-pointer"
                                    >
                                        JOIN
                                    </button>
                                ) : (
                                    <button className="px-3 py-1 bg-slate-700 text-slate-400 text-[9px] font-bold rounded cursor-not-allowed opacity-70">
                                        {room.hostId === firebaseService.currentUser?.uid ? 'MY ROOM' : 'PLAYING'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: CHAT */}
            <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
                <div className="flex border-b border-slate-700">
                    <button className="flex-1 py-3 text-xs font-bold bg-slate-700 text-white border-b-2 border-blue-500">GLOBAL CHAT</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2" ref={chatScrollRef}>
                    {chatHistory.map(msg => (
                        <div key={msg.id} className="text-xs break-words">
                            <span className="font-bold text-blue-400">{msg.sender}</span>
                            <span className="text-slate-500 text-[10px] ml-1">[{msg.rank}]</span>: 
                            <span className="text-slate-300 ml-1">{msg.text}</span>
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
        </div>
    </div>
  );
};

export default OnlineLobby;
