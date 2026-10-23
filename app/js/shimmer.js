/**
 * Subtle particle shimmer that drifts off the orb on the exhale.
 * Purely decorative; disabled when the user prefers reduced motion.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function createShimmer(canvas) {
  const g = canvas.getContext('2d');
  let parts = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let lastT = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return {
    start() {
      resize();
      parts = [];
      lastT = performance.now();
    },

    stop() {
      parts = [];
      g.clearRect(0, 0, w, h);
    },

    /**
     * @param {{ status: string, scale: number, segment: { type: string } | null }} state
     * @param {number} orbFraction orb diameter at scale 1, as a fraction of the stage
     */
    update(state, orbFraction) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (reduced.matches || !w) return;

      const cx = w / 2;
      const cy = h / 2;
      const radius = ((w * orbFraction) / 2) * state.scale;

      if (state.status === 'running' && state.segment?.type === 'out') {
        const count = Math.random() < 0.9 ? 1 : 2;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          parts.push({
            x: cx + Math.cos(a) * radius * 0.92,
            y: cy + Math.sin(a) * radius * 0.92,
            vx: Math.cos(a) * (8 + Math.random() * 14),
            vy: Math.sin(a) * (8 + Math.random() * 14) - 4,
            life: 0,
            max: 1.6 + Math.random() * 1.6,
            size: 0.6 + Math.random() * 1.4,
          });
        }
      }

      g.clearRect(0, 0, w, h);
      parts = parts.filter((p) => (p.life += dt) < p.max);
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.max;
        const alpha = Math.sin(Math.PI * k) * 0.75;
        g.beginPath();
        g.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
    },

    resize,
  };
}
