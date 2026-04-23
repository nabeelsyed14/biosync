/**
 * BioSync V2 - Audio Engine
 * Synthesizes sound effects using the Web Audio API.
 * No external audio files needed.
 */

window.audioEngine = (() => {
    let audioCtx = null;
    let enabled = localStorage.getItem('biosync_sound') !== 'false'; // default on

    const getCtx = () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx;
    };

    const playChime = () => {
        if (!enabled) return;
        try {
            const ctx = getCtx();
            const now = ctx.currentTime;

            // Two-note ascending chime
            const notes = [523.25, 659.25]; // C5, E5
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.12);

                gain.gain.setValueAtTime(0, now + i * 0.12);
                gain.gain.linearRampToValueAtTime(0.3, now + i * 0.12 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 0.5);
            });
        } catch(e) {
            // Silently fail if audio is blocked
        }
    };

    const toggle = () => {
        enabled = !enabled;
        localStorage.setItem('biosync_sound', enabled);
        return enabled;
    };

    const isEnabled = () => enabled;

    return { playChime, toggle, isEnabled };
})();
