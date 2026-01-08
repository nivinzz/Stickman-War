class SoundManager {
  private static instance: SoundManager;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private constructor() {
    // Initialize lazily on first user interaction to comply with browser policies
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
        this.masterGain.gain.value = 0.3; // Master volume
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Synthesizer Function
  private playTone(freq: number, type: OscillatorType, duration: number, slideTo?: number, noise?: boolean) {
    this.init();
    if (!this.audioCtx || !this.masterGain) return;

    const t = this.audioCtx.currentTime;

    if (noise) {
        // Noise buffer for hits/explosions
        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        noiseSource.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noiseSource.start();
        return;
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    }

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + duration);
  }

  playBGM() {
    // Placeholder - BGM is tricky to synthesize pleasantly without loops
  }

  playAttack(type: string) {
    if (type === 'ARCHER') {
        // High pitch "Pew"
        this.playTone(600, 'sine', 0.15, 100);
    } else {
        // Swing noise
        this.playTone(100, 'triangle', 0.1, 50, true);
    }
  }

  playHit() {
    // Dull thud
    this.playTone(150, 'square', 0.1, 50);
  }

  playDie() {
    // Falling tone
    this.playTone(200, 'sawtooth', 0.4, 50);
  }

  playSpawn() {
    // Rising futuristic tone
    this.playTone(300, 'sine', 0.3, 600);
  }

  playSkill(skillName: string) {
    if (skillName === 'Arrow Rain') {
        this.playTone(800, 'sawtooth', 0.5, 200);
    } else {
        // Lightning crack
        this.playTone(100, 'sawtooth', 0.3, 50, true);
    }
  }

  playGold() {
    // High coin ping
    this.playTone(1200, 'sine', 0.1);
    setTimeout(() => this.playTone(1600, 'sine', 0.15), 50);
  }

  playVictory() {
    this.playTone(400, 'triangle', 0.2);
    setTimeout(() => this.playTone(500, 'triangle', 0.2), 200);
    setTimeout(() => this.playTone(600, 'triangle', 0.4), 400);
  }

  playDefeat() {
    this.playTone(300, 'sawtooth', 0.5, 100);
  }
}

export const soundManager = SoundManager.getInstance();
