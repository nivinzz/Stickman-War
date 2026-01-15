
import { db, auth, googleProvider } from './firebaseConfig';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { ref, set, push, onValue, update, remove, onDisconnect, get, child, serverTimestamp, query, orderByChild, limitToLast } from 'firebase/database';
import { PlayerProfile, RankTier, LobbyRoom, ChatMessage } from '../types';
import { getRankTier } from '../constants';

export interface GameAction {
    type: 'SPAWN' | 'SKILL' | 'TOWER' | 'UPGRADE_BASE' | 'EMOTE' | 'GG';
    payload: string; // UnitType or Skill Name
    who: string; // User ID
    timestamp: number;
}

class FirebaseService {
    currentUser: User | null = null;
    currentProfile: PlayerProfile | null = null;
    currentRoomId: string | null = null;
    
    // Callbacks
    onRoomUpdate: ((room: LobbyRoom | null) => void) | null = null;
    onGameAction: ((action: GameAction) => void) | null = null;

    constructor() {
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            if (user) {
                this.loadUserProfile(user);
            }
        });
    }

    // --- AUTHENTICATION ---
    async loginWithGoogle(): Promise<User | null> {
        try {
            console.log("Attempting Google Login...");
            const result = await signInWithPopup(auth, googleProvider);
            this.currentUser = result.user;
            await this.loadUserProfile(result.user);
            return result.user;
        } catch (error: any) {
            console.warn("Google Login failed:", error.code, error.message);
            
            // Fallback 1: Attempt Anonymous Login
            try {
                console.log("Attempting Anonymous Login...");
                const result = await signInAnonymously(auth);
                this.currentUser = result.user;
                await this.loadUserProfile(result.user);
                return result.user;
            } catch (anonError) {
                console.warn("Anonymous Login failed. Falling back to GUEST MODE (Mock).");
                
                // Fallback 2: Mock Guest User (No Firebase Auth required)
                // This ensures the user can always enter the lobby even if Firebase Auth is fully blocked.
                const mockUid = 'guest_' + Math.floor(Math.random() * 999999);
                const mockUser = {
                    uid: mockUid,
                    displayName: 'Guest Warrior',
                    photoURL: null,
                    email: null,
                    emailVerified: false,
                    isAnonymous: true,
                    metadata: {},
                    providerData: [],
                    refreshToken: '',
                    tenantId: null,
                    delete: async () => {},
                    getIdToken: async () => 'mock-token',
                    getIdTokenResult: async () => ({} as any),
                    reload: async () => {},
                    toJSON: () => ({}),
                    phoneNumber: null
                } as unknown as User;

                this.currentUser = mockUser;
                // We try to load profile, but if DB fails (due to no auth rules), we handle it gracefully inside loadUserProfile
                await this.loadUserProfile(mockUser);
                return mockUser;
            }
        }
    }

    async logout() {
        try {
            await signOut(auth);
        } catch(e) {
            console.log("Logout (mock or real) complete");
        }
        this.currentUser = null;
        this.currentProfile = null;
    }

    async loadUserProfile(user: User): Promise<PlayerProfile> {
        const defaultProfile: PlayerProfile = {
            name: user.displayName || `Warrior ${user.uid.slice(0, 4)}`,
            avatarSeed: user.photoURL || user.uid,
            rankedStats: { wins: 0, losses: 0, elo: 1000, streak: 0 },
            casualStats: { wins: 0, losses: 0, streak: 0 },
            rankTier: RankTier.SILVER, // Start at Silver/1000
            status: 'IDLE'
        };

        try {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                this.currentProfile = snapshot.val();
            } else {
                // New user, try to create profile in DB
                try {
                    await set(userRef, defaultProfile);
                    this.currentProfile = defaultProfile;
                } catch (writeErr) {
                    console.warn("DB Write Permission Denied (Guest Mode?). Using local profile.");
                    this.currentProfile = defaultProfile;
                }
            }
            
            // Set online status (fire and forget)
            try {
                const statusRef = ref(db, `users/${user.uid}/status`);
                set(statusRef, 'IDLE');
                onDisconnect(statusRef).set('OFFLINE');
            } catch(e) {}

        } catch (err) {
            console.warn("DB Read Permission Denied (Guest Mode?). Using local profile.");
            this.currentProfile = defaultProfile;
        }
        
        return this.currentProfile!;
    }

    // --- LOBBY & ROOMS ---
    listenToRooms(callback: (rooms: LobbyRoom[]) => void) {
        const roomsRef = ref(db, 'rooms');
        return onValue(roomsRef, (snapshot) => {
            const rooms: LobbyRoom[] = [];
            snapshot.forEach((child) => {
                rooms.push(child.val());
            });
            callback(rooms.reverse()); // Newest first
        }, (error) => {
            console.warn("Listen Rooms failed (Guest Mode?):", error.message);
            callback([]); // Return empty list on error
        });
    }

    listenToChat(callback: (msgs: ChatMessage[]) => void) {
        const chatRef = query(ref(db, 'global_chat'), limitToLast(50));
        return onValue(chatRef, (snapshot) => {
            const msgs: ChatMessage[] = [];
            snapshot.forEach((child) => {
                msgs.push(child.val());
            });
            callback(msgs);
        }, (error) => {
            console.warn("Listen Chat failed (Guest Mode?):", error.message);
        });
    }

    sendChat(text: string) {
        if (!this.currentProfile) return;
        try {
            const chatRef = ref(db, 'global_chat');
            const newMsgRef = push(chatRef);
            set(newMsgRef, {
                id: newMsgRef.key,
                sender: this.currentProfile.name,
                text,
                rank: this.currentProfile.rankTier,
                timestamp: serverTimestamp()
            });
        } catch(e) { console.warn("Send chat failed"); }
    }

    async createRoom(mapIndex: number): Promise<string> {
        if (!this.currentUser || !this.currentProfile) throw new Error("Not logged in");
        
        const roomsRef = ref(db, 'rooms');
        const newRoomRef = push(roomsRef);
        const roomId = newRoomRef.key!;
        
        const roomData: LobbyRoom = {
            id: roomId,
            name: `${this.currentProfile.name}'s Arena`,
            host: this.currentProfile.name,
            hostId: this.currentUser.uid,
            hostElo: this.currentProfile.rankedStats.elo,
            status: 'WAITING',
            players: 1,
            mapIndex,
            createdAt: Date.now()
        };

        await set(newRoomRef, roomData);
        this.currentRoomId = roomId;
        this.subscribeToRoom(roomId);
        
        onDisconnect(newRoomRef).remove(); // Delete room if host disconnects
        
        return roomId;
    }

    async joinRoom(roomId: string): Promise<boolean> {
        if (!this.currentUser || !this.currentProfile) return false;

        const roomRef = ref(db, `rooms/${roomId}`);
        const snapshot = await get(roomRef);
        
        if (!snapshot.exists()) return false;
        const room = snapshot.val() as LobbyRoom;
        
        if (room.status !== 'WAITING') return false;

        await update(roomRef, {
            guestName: this.currentProfile.name,
            guestId: this.currentUser.uid,
            guestElo: this.currentProfile.rankedStats.elo,
            status: 'PLAYING',
            players: 2
        });

        this.currentRoomId = roomId;
        this.subscribeToRoom(roomId);
        return true;
    }

    subscribeToRoom(roomId: string) {
        const roomRef = ref(db, `rooms/${roomId}`);
        onValue(roomRef, (snapshot) => {
            const room = snapshot.val();
            if (this.onRoomUpdate) this.onRoomUpdate(room);
        });

        const actionsRef = ref(db, `rooms/${roomId}/actions`);
        onValue(actionsRef, (snapshot) => {
            snapshot.forEach((child) => {
                const action = child.val();
                // We only want new actions, simplified here by game engine handling
                if (this.onGameAction) this.onGameAction(action);
            });
        }, { onlyOnce: false });
        
        // Listen for new actions specifically
        // In a real app, we'd use 'child_added' and handle timestamps strictly
        const newActionsRef = query(ref(db, `rooms/${roomId}/actions`), limitToLast(1));
        onValue(newActionsRef, (snapshot) => {
             snapshot.forEach((child) => {
                const action = child.val();
                // Simple dedup based on timestamp would happen in Engine
                if (this.onGameAction && action.timestamp > Date.now() - 2000) {
                    this.onGameAction(action);
                }
            });
        });
    }

    leaveRoom() {
        if (this.currentRoomId) {
            // If host, remove room. If guest, just update status? 
            // For simplicity: Remove room on exit to prevent ghost rooms
            try {
                remove(ref(db, `rooms/${this.currentRoomId}`));
            } catch(e) {}
            this.currentRoomId = null;
        }
    }

    // --- GAMEPLAY SYNC ---
    sendGameAction(actionType: string, payload: string) {
        if (!this.currentRoomId || !this.currentUser) return;
        
        try {
            const actionsRef = ref(db, `rooms/${this.currentRoomId}/actions`);
            const newActionRef = push(actionsRef);
            set(newActionRef, {
                type: actionType,
                payload: payload,
                who: this.currentUser.uid,
                timestamp: serverTimestamp()
            });
        } catch(e) {}
    }

    async updateMatchResult(win: boolean) {
        if (!this.currentUser || !this.currentProfile) return;
        
        const userRef = ref(db, `users/${this.currentUser.uid}`);
        
        // Calculate new stats locally (simplified)
        // Ideally Elo calculation happens on server (Cloud Functions)
        const stats = this.currentProfile.rankedStats;
        let newElo = stats.elo;
        
        if (win) {
            stats.wins++;
            stats.streak++;
            newElo += 25;
        } else {
            stats.losses++;
            stats.streak = 0;
            newElo = Math.max(0, newElo - 20);
        }
        
        const newRank = getRankTier(newElo);
        
        try {
            await update(userRef, {
                rankedStats: { ...stats, elo: newElo },
                rankTier: newRank,
                status: 'IDLE'
            });
        } catch(e) {}
        
        // Refresh local profile
        this.currentProfile = {
            ...this.currentProfile,
            rankedStats: { ...stats, elo: newElo },
            rankTier: newRank
        };
    }
}

export const firebaseService = new FirebaseService();
