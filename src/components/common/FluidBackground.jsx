import { useEffect, useRef } from 'react';

// Organic drifting metaball-style blobs rendered to canvas. Sits fixed behind
// the whole app; glass panels reveal it through backdrop-filter blur, giving
// the refraction / depth effect the rest of the UI is built around.
const BLOBS = [
  { hue: 'rgba(94,234,212,0.55)',  r: 0.34, sx: 0.021, sy: 0.017, ox: 0.18, oy: 0.22, px: 1.3, py: 1.7 },
  { hue: 'rgba(167,139,250,0.50)', r: 0.30, sx: 0.014, sy: 0.023, ox: 0.78, oy: 0.30, px: 2.1, py: 1.1 },
  { hue: 'rgba(244,114,182,0.42)', r: 0.28, sx: 0.019, sy: 0.011, ox: 0.62, oy: 0.78, px: 1.7, py: 2.4 },
  { hue: 'rgba(96,165,250,0.40)',  r: 0.26, sx: 0.012, sy: 0.020, ox: 0.15, oy: 0.72, px: 2.6, py: 1.5 },
  { hue: 'rgba(251,191,36,0.22)',  r: 0.22, sx: 0.016, sy: 0.014, ox: 0.90, oy: 0.90, px: 1.1, py: 2.0 },
];

export default function FluidBackground() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const dim = Math.max(w, h);

      for (const b of BLOBS) {
        const cx = (b.ox + Math.sin(t * b.sx + b.px) * 0.10) * w;
        const cy = (b.oy + Math.cos(t * b.sy + b.py) * 0.10) * h;
        const r = b.r * dim * (1 + Math.sin(t * 0.01 + b.px) * 0.06);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, b.hue);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReduced) t += 1;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fluid-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="fluid-bg-canvas" />
      <div className="fluid-bg-veil" />
    </div>
  );
}
