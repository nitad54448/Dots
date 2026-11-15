(function (global) {
  'use strict';

  const PENTATONIC = [
    261.63, 293.66, 329.63, 392.0, 440.0,
    523.25, 587.33, 659.25, 783.99, 880.0
  ];

  let audioCtx = null;

  function isSoundEnabled() {
    return global.DotsStorage ? global.DotsStorage.getSettings().sound : true;
  }

  function isHapticsEnabled() {
    return global.DotsStorage ? global.DotsStorage.getSettings().haptics !== false : true;
  }

  function vibrate(pattern) {
    if (!isHapticsEnabled()) return;
    try {
      if (global.navigator && typeof global.navigator.vibrate === 'function') {
        global.navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  function getCtx() {
    if (!isSoundEnabled()) return null;
    if (!audioCtx) {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freqStart, freqEnd, durationSec, type, gainPeak, delaySec) {
    const ctx = getCtx();
    if (!ctx) return;

    const now = ctx.currentTime + (delaySec || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.012);
  }

  function playPickup(colorIndex) {
    const base = PENTATONIC[Math.abs(colorIndex || 0) % 6];
    playTone(base, base * 1.18, 0.055, 'triangle', 0.1, 0);
    vibrate(8);
  }

  function playStep(stepCount) {
    const idx = Math.max(0, (stepCount || 0) - 1) % PENTATONIC.length;
    const freq = PENTATONIC[idx];
    playTone(freq, freq * 1.01, 0.045, 'sine', 0.055, 0);
    playTone(freq * 2, freq * 2, 0.03, 'triangle', 0.015, 0);
  }

  function playConnect(colorIndex) {
    const root = PENTATONIC[Math.abs(colorIndex || 0) % 5];
    playTone(root, root, 0.11, 'triangle', 0.1, 0);
    playTone(root * 1.25, root * 1.25, 0.13, 'sine', 0.085, 0.035);
    playTone(root * 1.5, root * 1.5, 0.18, 'sine', 0.1, 0.07);
    vibrate([12, 24, 16]);
  }

  function playCut() {
    playTone(145, 75, 0.075, 'triangle', 0.09, 0);
    playTone(110, 62, 0.06, 'sine', 0.06, 0.01);
    vibrate(14);
  }

  function playUndo() {
    playTone(440, 293.66, 0.07, 'triangle', 0.08, 0);
  }

  function playHint() {
    const notes = [523.25, 659.25, 783.99];
    for (let i = 0; i < notes.length; i++) {
      playTone(notes[i], notes[i] * 1.015, 0.11, 'sine', 0.095, i * 0.055);
    }
    vibrate(12);
  }

  function playWin() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      playTone(notes[i], notes[i], i === 4 ? 0.34 : 0.13, 'triangle', 0.115, i * 0.065);
    }
    vibrate([20, 35, 20, 35, 45]);
  }

  global.DotsAudio = {
    vibrate,
    playPickup,
    playStep,
    playConnect,
    playCut,
    playUndo,
    playHint,
    playWin
  };
})(window);
