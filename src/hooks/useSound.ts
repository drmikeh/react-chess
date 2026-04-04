import { useCallback, useRef, useState } from 'react';

export type SoundEvent =
  | 'move'
  | 'capture'
  | 'castle'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'promote';

// Lazily created AudioContext — must happen after a user gesture
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

function resume(ctx: AudioContext) {
  if (ctx.state === 'suspended') ctx.resume();
}

// ── Low-level helpers ────────────────────────────────────────────────────────

function playTone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  peakGain: number,
  freqEnd?: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
  }

  const attack = Math.min(0.01, duration * 0.1);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ── Sound definitions ────────────────────────────────────────────────────────

const SOUNDS: Record<SoundEvent, (ctx: AudioContext) => void> = {
  move(ctx) {
    const t = ctx.currentTime;
    playTone(ctx, 680, 'sine', t, 0.12, 0.22, 420);
  },

  capture(ctx) {
    const t = ctx.currentTime;
    // Low thud
    playTone(ctx, 220, 'square', t, 0.18, 0.32, 100);
    // High snap layered on top
    playTone(ctx, 800, 'sine', t, 0.06, 0.14, 500);
  },

  castle(ctx) {
    // Two quick move clicks
    const t = ctx.currentTime;
    playTone(ctx, 680, 'sine', t, 0.10, 0.18, 420);
    playTone(ctx, 780, 'sine', t + 0.13, 0.10, 0.18, 520);
  },

  check(ctx) {
    // Two sharp alert beeps
    const t = ctx.currentTime;
    playTone(ctx, 960, 'sine', t, 0.10, 0.28);
    playTone(ctx, 960, 'sine', t + 0.15, 0.10, 0.28);
  },

  promote(ctx) {
    // Ascending 4-note fanfare: C5 E5 G5 C6
    const notes = [523, 659, 784, 1047];
    const t = ctx.currentTime;
    notes.forEach((freq, i) => {
      playTone(ctx, freq, 'sine', t + i * 0.1, 0.18, 0.3);
    });
  },

  checkmate(ctx) {
    // Descending 3-note toll
    const notes = [440, 330, 220];
    const t = ctx.currentTime;
    notes.forEach((freq, i) => {
      playTone(ctx, freq, 'sine', t + i * 0.22, 0.3, 0.35);
    });
  },

  stalemate(ctx) {
    // Two neutral tones
    const t = ctx.currentTime;
    playTone(ctx, 440, 'sine', t, 0.22, 0.25);
    playTone(ctx, 400, 'sine', t + 0.26, 0.22, 0.25);
  },
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSoundReturn {
  playSound: (event: SoundEvent) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

export function useSound(): UseSoundReturn {
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      isMutedRef.current = !prev;
      return !prev;
    });
  }, []);

  const playSound = useCallback((event: SoundEvent) => {
    if (isMutedRef.current) return;
    try {
      const ctx = getCtx();
      resume(ctx);
      SOUNDS[event](ctx);
    } catch {
      // Silently ignore — audio is non-critical
    }
  }, []);

  return { playSound, isMuted, toggleMute };
}
