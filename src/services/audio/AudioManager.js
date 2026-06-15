class AudioManager {
  constructor() {
    this.enabled = true;
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  getContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = AudioContext ? new AudioContext() : null;
    }
    return this.context;
  }

  tone(frequency, duration = 0.08, type = 'sine') {
    if (!this.enabled) return;
    const context = this.getContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  move() {
    this.tone(420, 0.07, 'triangle');
  }

  capture() {
    this.tone(180, 0.12, 'square');
  }

  promote() {
    this.tone(720, 0.08, 'triangle');
    window.setTimeout(() => this.tone(960, 0.09, 'sine'), 70);
  }

  notify() {
    this.tone(620, 0.1, 'sine');
  }
}

export const audioManager = new AudioManager();
