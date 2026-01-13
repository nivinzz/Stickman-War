
class SoundManager {
  private static instance: SoundManager;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  
  private muted: boolean = false;
  
  // Music / Ambience Nodes
  private activeAmbienceNodes: AudioNode[] = [];
  private ambienceInterval: number | null = null;
  private musicLoopId: number | null = null; 
  private musicGain: GainNode | null = null; // Dedicated gain for music fade-in

  private constructor() {
    // Initialize lazily
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.4;
        this.masterGain.connect(this.audioCtx.destination);

        // Create a 2-second white noise buffer for reuse
        const bufferSize = this.audioCtx.sampleRate * 2;
        this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
    }
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public toggleMute() {
      this.muted = !this.muted;
      if (this.masterGain) {
          this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.4, this.audioCtx?.currentTime || 0);
      }
      return this.muted;
  }
  
  public isMuted() {
      return this.muted;
  }

  // --- HELPER: Create Noise Source ---
  private createNoiseSource(): AudioBufferSourceNode | null {
      if (!this.audioCtx || !this.noiseBuffer) return null;
      const node = this.audioCtx.createBufferSource();
      node.buffer = this.noiseBuffer;
      return node;
  }

  // --- HELPER: Play Noise Burst ---
  private playNoise(duration: number, filterType: BiquadFilterType, freq: number, vol: number) {
      if (this.muted) return;
      this.init();
      if (!this.audioCtx || !this.masterGain) return;
      const t = this.audioCtx.currentTime;

      const noise = this.createNoiseSource();
      if (!noise) return;
      
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();
      
      filter.type = filterType;
      filter.frequency.setValueAtTime(freq, t);
      
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      noise.start();
      noise.stop(t + duration + 0.1);
  }

  // --- SYNTH INSTRUMENTS FOR MUSIC ---
  
  private playSynthKick(t: number) {
      if (!this.audioCtx || !this.masterGain) return;
      const dest = this.musicGain || this.masterGain;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
      
      // Lowered volume from 0.8 to 0.5 to be less startling
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.5);
  }

  private playSynthSnare(t: number, vol: number = 0.25) { // Lowered default from 0.4 to 0.25
      if (!this.audioCtx || !this.masterGain) return;
      const dest = this.musicGain || this.masterGain;

      // Noise part
      const noise = this.createNoiseSource();
      if (noise) {
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 1000;
          const gain = this.audioCtx.createGain();
          gain.gain.setValueAtTime(vol, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          noise.start(t);
          noise.stop(t + 0.25);
      }
      
      // Tonal part (body)
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      oscGain.gain.setValueAtTime(vol * 0.5, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      
      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);
  }

  private playBrassChord(freqs: number[], t: number, duration: number) {
      if (!this.audioCtx || !this.masterGain) return;
      const dest = this.musicGain || this.masterGain;
      
      freqs.forEach((f, i) => {
          const osc = this.audioCtx!.createOscillator();
          const gain = this.audioCtx!.createGain();
          const filter = this.audioCtx!.createBiquadFilter();
          
          // Sawtooth gives a brassy/horn sound
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          
          // Lowpass filter envelope simulates the "Blare" of a horn
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(f, t);
          filter.frequency.exponentialRampToValueAtTime(f * 4, t + 0.1); // Attack
          filter.frequency.exponentialRampToValueAtTime(f * 2, t + duration); // Decay
          
          // Volume Envelope
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.15, t + 0.1); // Attack
          gain.gain.setValueAtTime(0.15, t + duration - 0.1); // Sustain
          gain.gain.linearRampToValueAtTime(0, t + duration); // Release
          
          // Detune slightly for thickness
          if (i > 0) osc.detune.value = Math.random() * 10 - 5;

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          
          osc.start(t);
          osc.stop(t + duration + 0.1);
      });
  }

  // --- AMBIENCE & MUSIC SYSTEM ---
  
  public stopAmbience() {
      // Stop continuous nodes
      this.activeAmbienceNodes.forEach(node => {
          try { (node as any).stop(); } catch(e) {}
          node.disconnect();
      });
      this.activeAmbienceNodes = [];
      
      // Stop loops
      if (this.ambienceInterval) {
          clearInterval(this.ambienceInterval);
          this.ambienceInterval = null;
      }
      if (this.musicLoopId) {
          clearInterval(this.musicLoopId);
          this.musicLoopId = null;
      }
      
      // Cleanup Music Gain
      if (this.musicGain) {
          this.musicGain.disconnect();
          this.musicGain = null;
      }
  }

  public playMenuMusic() {
      this.stopAmbience();
      if (this.muted) return;
      this.init();
      if (!this.audioCtx || !this.masterGain) return;

      const ctx = this.audioCtx;
      
      // Create dedicated music gain for gentle fade-in
      this.musicGain = ctx.createGain();
      this.musicGain.connect(this.masterGain);
      
      // FADE IN: 0 -> 1 over 3 seconds to avoid "startle" effect
      this.musicGain.gain.setValueAtTime(0, ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 3.0);
      
      // EPIC MARCHING INTRO
      // Tempo: 110 BPM
      const beat = 60 / 110; 
      let barIndex = 0;

      const playBar = () => {
          if (this.muted) return;
          const now = ctx.currentTime;
          
          // 1. DRUMS (The March)
          // Kick on 1, 3
          this.playSynthKick(now);
          this.playSynthKick(now + beat * 2);
          
          // Snare patterns (Military style)
          this.playSynthSnare(now + beat);       // Beat 2
          this.playSynthSnare(now + beat * 3);   // Beat 4
          // Grace notes
          this.playSynthSnare(now + beat * 3.75, 0.15); 
          
          // 2. BRASS (The Heroic Theme)
          // Chord Progression: Cm | Ab | Fm | G (Epic Standard)
          let chord = [130.81, 155.56, 196.00]; // Cm (C3, Eb3, G3)
          
          if (barIndex === 1) chord = [103.83, 130.81, 155.56]; // Ab (Ab2, C3, Eb3)
          if (barIndex === 2) chord = [87.31, 103.83, 130.81];  // Fm (F2, Ab2, C3)
          if (barIndex === 3) chord = [98.00, 123.47, 146.83];  // G (G2, B2, D3)

          // Play Long Swell Chord (Whole note)
          this.playBrassChord(chord, now, beat * 4);
          
          barIndex = (barIndex + 1) % 4;
      };

      // Play immediately
      playBar();
      // Schedule loop (4 beats)
      this.musicLoopId = window.setInterval(playBar, beat * 4 * 1000);
  }

  public playGameAmbience(themeName: string) {
      this.stopAmbience();
      if (this.muted) return;
      this.init();
      if (!this.audioCtx || !this.masterGain) return;

      // Base Wind/Atmosphere (Pink Noise through Lowpass)
      const noise = this.createNoiseSource();
      if (noise) {
          noise.loop = true;
          const filter = this.audioCtx.createBiquadFilter();
          const gain = this.audioCtx.createGain();
          
          filter.type = 'lowpass';
          filter.frequency.value = 400;
          gain.gain.value = 0.08; // Subtle background

          if (themeName.includes('Desert') || themeName.includes('Dusty')) {
             filter.type = 'bandpass'; filter.frequency.value = 600; // Whistling wind
          } else if (themeName.includes('Winter') || themeName.includes('Frozen')) {
             filter.type = 'highpass'; filter.frequency.value = 800; // Cold wind
             gain.gain.value = 0.12;
          } else if (themeName.includes('Volcanic') || themeName.includes('Inferno')) {
             filter.type = 'lowpass'; filter.frequency.value = 150; // Deep rumble
          } else if (themeName.includes('Green') || themeName.includes('Valley')) {
             filter.type = 'lowpass'; filter.frequency.value = 800; // Gentle breeze
             gain.gain.value = 0.05;
          }

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);
          noise.start();
          this.activeAmbienceNodes.push(noise, filter, gain);
      }

      // Random Nature Sounds (Birds, Crickets, Drips)
      this.ambienceInterval = window.setInterval(() => {
          if (this.muted) return;
          const t = this.audioCtx!.currentTime;
          
          // Occasional Events
          if (Math.random() > 0.6) { 
              if (themeName.includes('Green') || themeName.includes('Forest') || themeName.includes('Spring')) {
                  // Bird Chirp (Sine sweep)
                  const osc = this.audioCtx!.createOscillator();
                  const g = this.audioCtx!.createGain();
                  osc.type = 'sine';
                  const startF = 2000 + Math.random()*1000;
                  osc.frequency.setValueAtTime(startF, t);
                  osc.frequency.linearRampToValueAtTime(startF - 500, t + 0.1);
                  
                  g.gain.setValueAtTime(0.05, t);
                  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                  
                  osc.connect(g); g.connect(this.masterGain!);
                  osc.start(); osc.stop(t + 0.15);
              } else if (themeName.includes('Volcanic')) {
                   // Lava Bubble (Low gloop)
                   this.playNoise(0.2, 'lowpass', 200, 0.2);
              } else if (themeName.includes('Winter')) {
                   // Ice Crackle (High pitch noise)
                   this.playNoise(0.05, 'highpass', 3000, 0.1);
              }
          }
      }, 2500); // Check every 2.5s
  }

  // --- SPECIFIC SFX ---

  playGold() {
      // SILENT
  }

  playMetalClash() {
      if (this.muted) return;
      this.init();
      if (!this.audioCtx || !this.masterGain) return;
      const t = this.audioCtx.currentTime;

      // Metallic Ring (Sine waves at non-integer ratios)
      const freqs = [800, 1250, 2400];
      freqs.forEach(f => {
          const osc = this.audioCtx!.createOscillator();
          const g = this.audioCtx!.createGain();
          osc.frequency.value = f;
          g.gain.setValueAtTime(0.1, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); // Ring out
          osc.connect(g); g.connect(this.masterGain!);
          osc.start(); osc.stop(t + 0.35);
      });

      // Impact Noise (Sharp)
      this.playNoise(0.05, 'highpass', 2000, 0.3);
  }

  playSpearThrust() {
      if (this.muted) return;
      this.init();
      if (!this.audioCtx || !this.masterGain) return;
      const t = this.audioCtx.currentTime;

      // Whoosh (Filter sweep)
      const noise = this.createNoiseSource();
      if (noise) {
          const gain = this.audioCtx.createGain();
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.Q.value = 1;
          filter.frequency.setValueAtTime(800, t);
          filter.frequency.linearRampToValueAtTime(200, t + 0.15); // Swipe down
          
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.linearRampToValueAtTime(0, t + 0.15);

          noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
          noise.start(); noise.stop(t + 0.2);
      }
      
      // Hit (Thud)
      setTimeout(() => this.playNoise(0.1, 'lowpass', 300, 0.4), 50);
  }
  
  playCastleHit() {
      if (this.muted) return;
      this.init();
      if (!this.audioCtx || !this.masterGain) return;
      
      // Heavy boom + Crumble
      this.playNoise(0.3, 'lowpass', 100, 0.8); // Deep impact
      setTimeout(() => this.playNoise(0.2, 'highpass', 500, 0.3), 50); // Crumble
  }
  
  playTowerShot() {
      if (this.muted) return;
      // Heavier mechanical "Thwung" than the archer
      this.playNoise(0.15, 'bandpass', 400, 0.4);
  }

  playAttack(type: string) {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx || !this.masterGain) return;
    const t = this.audioCtx.currentTime;

    if (type === 'ARCHER') {
        // "Thwip" sound
        const osc = this.audioCtx.createOscillator();
        const oscGain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.15); 
        oscGain.gain.setValueAtTime(0.2, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(oscGain); oscGain.connect(this.masterGain);
        osc.start(); osc.stop(t + 0.2);
        
        // Air burst
        this.playNoise(0.08, 'highpass', 2500, 0.2);

    } else if (type === 'CAVALRY') {
        this.playSpearThrust();
    } else {
        // SWORD / HERO -> Metal Clash logic is usually handled on HIT, 
        // but for the swing itself:
        this.playNoise(0.1, 'bandpass', 600, 0.2); // Sharp swing
    }
  }

  playHit() {
      // General flesh hit (fallback)
      this.playNoise(0.1, 'lowpass', 400, 0.3);
  }

  playDie() {
    if (this.muted) return;
    this.init();
    const t = this.audioCtx!.currentTime;
    const osc = this.audioCtx!.createOscillator();
    const gain = this.audioCtx!.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3); 
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(); osc.stop(t + 0.35);
  }

  playSpawn() {
    if (this.muted) return;
    this.init();
    const t = this.audioCtx!.currentTime;
    const osc = this.audioCtx!.createOscillator();
    const gain = this.audioCtx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(); osc.stop(t + 0.2);
  }

  playSkill(skillName: string) {
    if (this.muted) return;
    this.init();
    if (skillName === 'Arrow Rain') {
        this.playNoise(1.5, 'bandpass', 800, 0.3); // Long wind
    } else if (skillName === 'Lightning') {
        this.playNoise(0.2, 'lowpass', 150, 0.8); // Boom
        this.playNoise(0.1, 'highpass', 3000, 0.6); // Crack
    } else if (skillName === 'Freeze') {
        const t = this.audioCtx!.currentTime;
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        osc.frequency.setValueAtTime(2000, t); 
        osc.frequency.linearRampToValueAtTime(2200, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain); gain.connect(this.masterGain!);
        osc.start(); osc.stop(t + 0.6);
        this.playNoise(0.3, 'highpass', 1500, 0.4); // Shatter noise
    }
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    const t = this.audioCtx!.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; 
    notes.forEach((freq, i) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        const startTime = t + (i * 0.15);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.0);
        osc.connect(gain); gain.connect(this.masterGain!);
        osc.start(startTime); osc.stop(startTime + 1.2);
    });
  }

  playDefeat() {
    if (this.muted) return;
    this.init();
    const t = this.audioCtx!.currentTime;
    const notes = [440, 415.30, 392.00, 349.23]; 
    notes.forEach((freq, i) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        const startTime = t + (i * 0.3);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, startTime + 0.8);
        osc.connect(gain); gain.connect(this.masterGain!);
        osc.start(startTime); osc.stop(startTime + 1.0);
    });
  }
}

export const soundManager = SoundManager.getInstance();
