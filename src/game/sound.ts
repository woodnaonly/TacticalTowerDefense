import { MapId, TowerType } from './types';

const AUDIO_PREFS_KEY = 'bastion_td_audio_v1';

interface AmbientTrackConfig {
  tempoMs: number;
  notes: number[];
  bassNotes: number[];
  droneFreqs: [number, number];
  noiseFreq: number;
  noiseQ: number;
  noiseModDepth: number;
  noiseModRate: number;
  noiseGain: number;
  noteWave: OscillatorType;
  noteCutoff: number;
}

const MAP_AMBIENT_TRACKS: Record<MapId, AmbientTrackConfig> = {
  // 回旋隘口：峡谷风声 + 沉稳 D Dorian 战术旋律
  gorge: {
    tempoMs: 620,
    notes: [
      293.66, 0, 329.63, 349.23, 440.0, 0, 392.0, 349.23,
      293.66, 0, 261.63, 293.66, 349.23, 0, 329.63, 220.0,
    ],
    bassNotes: [73.42, 0, 0, 0, 87.31, 0, 0, 0, 65.41, 0, 0, 0, 55.0, 0, 0, 0],
    droneFreqs: [73.42, 110.0],
    noiseFreq: 340,
    noiseQ: 2.3,
    noiseModDepth: 165,
    noiseModRate: 0.11,
    noiseGain: 0.045,
    noteWave: 'triangle',
    noteCutoff: 950,
  },
  // 双线夹击：高地林风 + 清亮 E Minor Pentatonic 双线脉冲
  twin_lanes: {
    tempoMs: 470,
    notes: [
      329.63, 392.0, 493.88, 392.0, 587.33, 493.88, 392.0, 329.63,
      293.66, 329.63, 392.0, 493.88, 659.25, 587.33, 493.88, 392.0,
    ],
    bassNotes: [82.41, 0, 0, 82.41, 98.0, 0, 0, 0, 73.42, 0, 0, 73.42, 110.0, 0, 0, 0],
    droneFreqs: [164.81, 246.94],
    noiseFreq: 720,
    noiseQ: 1.35,
    noiseModDepth: 230,
    noiseModRate: 0.18,
    noiseGain: 0.032,
    noteWave: 'sine',
    noteCutoff: 1500,
  },
  // 核心迷宫：反应堆低鸣 + 紧张 C# Phrygian 序列
  spiral: {
    tempoMs: 410,
    notes: [
      277.18, 293.66, 329.63, 415.3, 329.63, 293.66, 277.18, 246.94,
      277.18, 329.63, 415.3, 440.0, 415.3, 329.63, 293.66, 207.65,
    ],
    bassNotes: [69.3, 0, 69.3, 0, 73.42, 0, 0, 0, 69.3, 0, 69.3, 0, 61.74, 0, 73.42, 0],
    droneFreqs: [69.3, 138.59],
    noiseFreq: 210,
    noiseQ: 1.1,
    noiseModDepth: 75,
    noiseModRate: 0.28,
    noiseGain: 0.038,
    noteWave: 'triangle',
    noteCutoff: 1150,
  },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientNoiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private volume = 0.8; // 0..1

  private activeMapId: MapId | null = null;
  private pendingMapId: MapId | null = null;
  private ambientPaused = false;
  private ambientTimer: number | null = null;
  private ambientStep = 0;
  private ambientNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];

  private lastShotByType: Record<TowerType, number> = {
    gatling: 0,
    cryo: 0,
    mortar: 0,
    tesla: 0,
  };
  private lastDieTime = 0;
  private lastExplosionTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(AUDIO_PREFS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.muted === 'boolean') this.muted = parsed.muted;
          if (typeof parsed.volume === 'number' && !Number.isNaN(parsed.volume)) {
            this.volume = Math.min(1, Math.max(0, parsed.volume));
          }
        }
      } catch {
        // ignore storage read errors
      }
    }
  }

  private savePrefs(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        AUDIO_PREFS_KEY,
        JSON.stringify({ muted: this.muted, volume: this.volume })
      );
    } catch {
      // ignore storage errors
    }
  }

  private getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.compressor.connect(this.sfxGain);
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(
        this.ambientPaused ? 0.22 : 1.0,
        this.ctx.currentTime
      );
      this.ambientGain.connect(this.masterGain);
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private getAmbientNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.ambientNoiseBuffer && this.ambientNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.ambientNoiseBuffer;
    }
    // 3-second soft pink-ish noise buffer for wind/room ambience
    const length = Math.floor(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.05) * 0.45;
    }
    this.ambientNoiseBuffer = buffer;
    return buffer;
  }

  private withAudio(fn: (ctx: AudioContext, dest: AudioNode) => void): void {
    if (this.muted || this.volume <= 0.001) return;
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.compressor) return;
    const dest = this.compressor;

    if (ctx.state === 'suspended') {
      ctx.resume()
        .then(() => {
          if (!this.muted && this.volume > 0.001) fn(ctx, dest);
        })
        .catch(() => {});
      return;
    }

    fn(ctx, dest);
  }

  public unlock(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume()
        .then(() => {
          if (this.pendingMapId) {
            const target = this.pendingMapId;
            this.pendingMapId = null;
            this.startMapAmbience(target);
          }
        })
        .catch(() => {});
    } else if (this.pendingMapId) {
      const target = this.pendingMapId;
      this.pendingMapId = null;
      this.startMapAmbience(target);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.savePrefs();
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.035
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    this.volume = clamped;
    if (clamped > 0 && this.muted) {
      this.muted = false;
    }
    this.savePrefs();
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.035
      );
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setAmbientPaused(paused: boolean): void {
    this.ambientPaused = paused;
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(
        paused ? 0.22 : 1.0,
        this.ctx.currentTime,
        0.12
      );
    }
  }

  public startMapAmbience(mapId: MapId): void {
    if (this.activeMapId === mapId && this.ambientTimer !== null) {
      return;
    }

    const ctx = this.getOrCreateContext();
    if (!ctx || !this.ambientGain) {
      this.pendingMapId = mapId;
      return;
    }

    if (ctx.state === 'suspended') {
      this.pendingMapId = mapId;
      ctx.resume()
        .then(() => {
          if (this.pendingMapId === mapId) {
            this.pendingMapId = null;
            this.startMapAmbience(mapId);
          }
        })
        .catch(() => {});
      return;
    }

    this.stopMapAmbience();
    this.activeMapId = mapId;
    this.ambientStep = 0;

    const cfg = MAP_AMBIENT_TRACKS[mapId];
    const now = ctx.currentTime;

    // 1. Environmental Wind / Reactor Noise Bed
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getAmbientNoiseBuffer(ctx);
    noiseSrc.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = mapId === 'spiral' ? 'lowpass' : 'bandpass';
    noiseFilter.frequency.setValueAtTime(cfg.noiseFreq, now);
    noiseFilter.Q.setValueAtTime(cfg.noiseQ, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(cfg.noiseModRate, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(cfg.noiseModDepth, now);
    lfo.connect(lfoGain);
    lfoGain.connect(noiseFilter.frequency);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.setTargetAtTime(cfg.noiseGain, now, 0.5);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);
    noiseSrc.start(now);
    lfo.start(now);

    this.ambientNodes.push(noiseSrc, noiseFilter, lfo, lfoGain, noiseGain);

    // 2. Sustained Atmospheric Drone Pad
    cfg.droneFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 && mapId === 'spiral' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(idx === 0 ? 220 : 380, now);

      const dGain = ctx.createGain();
      dGain.gain.setValueAtTime(0.001, now);
      dGain.gain.setTargetAtTime(idx === 0 ? 0.048 : 0.03, now, 0.7);

      osc.connect(lp);
      lp.connect(dGain);
      dGain.connect(this.ambientGain!);
      osc.start(now);

      this.ambientNodes.push(osc, lp, dGain);
    });

    // 3. Procedural Map Music Sequencer
    const triggerStep = () => {
      if (!this.ctx || !this.ambientGain || this.activeMapId !== mapId) return;
      if (this.ctx.state !== 'running') return;
      if (this.muted || this.volume <= 0.001 || this.ambientPaused) {
        this.ambientStep = (this.ambientStep + 1) % cfg.notes.length;
        return;
      }

      const stepIdx = this.ambientStep;
      this.ambientStep = (this.ambientStep + 1) % cfg.notes.length;
      const t = this.ctx.currentTime;

      const noteFreq = cfg.notes[stepIdx];
      if (noteFreq > 0) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = cfg.noteWave;
        osc.frequency.setValueAtTime(noteFreq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cfg.noteCutoff, t);

        const dur = (cfg.tempoMs / 1000) * 1.45;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.042, t + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }

      const bassFreq = cfg.bassNotes[stepIdx];
      if (bassFreq > 0) {
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bassFreq, t);

        const dur = (cfg.tempoMs / 1000) * 1.8;
        bGain.gain.setValueAtTime(0.0001, t);
        bGain.gain.linearRampToValueAtTime(0.06, t + 0.03);
        bGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        bOsc.connect(bGain);
        bGain.connect(this.ambientGain);
        bOsc.start(t);
        bOsc.stop(t + dur + 0.02);
      }
    };

    triggerStep();
    this.ambientTimer = window.setInterval(triggerStep, cfg.tempoMs);
  }

  public stopMapAmbience(): void {
    this.activeMapId = null;
    this.pendingMapId = null;
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    for (const node of this.ambientNodes) {
      try {
        node.stop?.();
      } catch {
        // ignore already stopped
      }
      try {
        node.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
    this.ambientNodes = [];
  }

  public playSelect(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.04);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.05);
    });
  }

  public playError(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [180, 145].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.065;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.065);
      });
    });
  }

  public playPlace(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(150, now);
      sub.frequency.exponentialRampToValueAtTime(75, now + 0.09);
      subGain.gain.setValueAtTime(0.18, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      sub.connect(subGain);
      subGain.connect(dest);
      sub.start(now);
      sub.stop(now + 0.1);

      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(320, now + 0.02);
      chime.frequency.exponentialRampToValueAtTime(520, now + 0.1);
      chimeGain.gain.setValueAtTime(0.1, now + 0.02);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      chime.connect(chimeGain);
      chimeGain.connect(dest);
      chime.start(now + 0.02);
      chime.stop(now + 0.13);
    });
  }

  public playUpgrade(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [392, 523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 3 ? 'triangle' : 'sine';
        const t = now + idx * 0.05;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.17);
      });
    });
  }

  public playSell(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [987.77, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.14);
      });
    });
  }

  public playShoot(type: TowerType): void {
    const nowMs = performance.now();
    const minInterval =
      type === 'gatling' ? 55 : type === 'cryo' ? 85 : type === 'mortar' ? 90 : 75;
    if (nowMs - this.lastShotByType[type] < minInterval) return;
    this.lastShotByType[type] = nowMs;

    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;

      if (type === 'gatling') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440 + Math.random() * 45, now);
        osc.frequency.exponentialRampToValueAtTime(130, now + 0.045);
        gain.gain.setValueAtTime(0.048, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.055);
      } else if (type === 'cryo') {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.15);
        osc2.frequency.setValueAtTime(1380, now);
        osc2.frequency.exponentialRampToValueAtTime(720, now + 0.15);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.165);
        osc2.stop(now + 0.165);
      } else if (type === 'mortar') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(185, now);
        osc.frequency.exponentialRampToValueAtTime(52, now + 0.17);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.19);
      } else {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.1);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.Q.setValueAtTime(2.5, now);
        gain.gain.setValueAtTime(0.085, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.115);
      }
    });
  }

  public playExplosion(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastExplosionTime < 75) return;
    this.lastExplosionTime = nowMs;

    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;

      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, now);
      filter.frequency.exponentialRampToValueAtTime(95, now + 0.24);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.16, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.26);

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(95, now);
      sub.frequency.exponentialRampToValueAtTime(34, now + 0.2);
      subGain.gain.setValueAtTime(0.14, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      sub.connect(subGain);
      subGain.connect(dest);
      sub.start(now);
      sub.stop(now + 0.22);
    });
  }

  public playEnemyDie(isBoss = false): void {
    const nowMs = performance.now();
    if (!isBoss && nowMs - this.lastDieTime < 55) return;
    this.lastDieTime = nowMs;

    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      if (isBoss) {
        this.playExplosion();
        [440, 554.37, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + i * 0.05;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.1, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.19);
        });
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.075);
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.09);
    });
  }

  public playCoreHit(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.linearRampToValueAtTime(82, now + 0.24);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.27);
    });
  }

  public playWaveStart(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [261.63, 392.0].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = now + i * 0.09;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.23);
      });
    });
  }

  public playWaveClear(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.065;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.21);
      });
    });
  }

  public playVictory(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [392, 493.88, 587.33, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = now + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    });
  }

  public playGameOver(): void {
    this.withAudio((ctx, dest) => {
      const now = ctx.currentTime;
      [293.66, 261.63, 220, 174.61].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const t = now + i * 0.13;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.29);
      });
    });
  }
}

export const sound = new SoundEngine();
