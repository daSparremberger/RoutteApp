import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  targetOpacity: number;
}

export function LampAnimation({ height = 180 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = rect?.width || 224;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles (fewer fireflies - only 5)
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < 5; i++) {
        particlesRef.current.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 60,
          y: height * 0.5 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.1,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.4,
          targetOpacity: Math.random() * 0.5 + 0.1,
        });
      }
    };
    initParticles();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;

      // Focal light cone - narrower and more concentrated
      const beamTopWidth = 8;
      const beamBottomWidth = canvas.width * 0.5;

      // Inner bright beam
      const innerGradient = ctx.createLinearGradient(centerX, 0, centerX, height);
      innerGradient.addColorStop(0, 'rgba(247, 175, 39, 0.6)');
      innerGradient.addColorStop(0.2, 'rgba(247, 175, 39, 0.25)');
      innerGradient.addColorStop(0.5, 'rgba(247, 175, 39, 0.08)');
      innerGradient.addColorStop(1, 'rgba(247, 175, 39, 0)');

      ctx.beginPath();
      ctx.moveTo(centerX - beamTopWidth / 2, 0);
      ctx.lineTo(centerX + beamTopWidth / 2, 0);
      ctx.lineTo(centerX + beamBottomWidth / 2, height);
      ctx.lineTo(centerX - beamBottomWidth / 2, height);
      ctx.closePath();
      ctx.fillStyle = innerGradient;
      ctx.fill();

      // Outer soft glow
      const outerGradient = ctx.createLinearGradient(centerX, 0, centerX, height);
      outerGradient.addColorStop(0, 'rgba(247, 175, 39, 0.15)');
      outerGradient.addColorStop(0.4, 'rgba(247, 175, 39, 0.03)');
      outerGradient.addColorStop(1, 'rgba(247, 175, 39, 0)');

      ctx.beginPath();
      ctx.moveTo(centerX - 20, 0);
      ctx.lineTo(centerX + 20, 0);
      ctx.lineTo(centerX + canvas.width * 0.4, height);
      ctx.lineTo(centerX - canvas.width * 0.4, height);
      ctx.closePath();
      ctx.fillStyle = outerGradient;
      ctx.fill();

      // Lamp bulb glow - more focal
      const bulbGradient = ctx.createRadialGradient(centerX, 0, 0, centerX, 0, 25);
      bulbGradient.addColorStop(0, 'rgba(255, 220, 150, 0.9)');
      bulbGradient.addColorStop(0.3, 'rgba(247, 175, 39, 0.5)');
      bulbGradient.addColorStop(0.6, 'rgba(247, 175, 39, 0.15)');
      bulbGradient.addColorStop(1, 'rgba(247, 175, 39, 0)');
      ctx.beginPath();
      ctx.arc(centerX, 0, 25, 0, Math.PI * 2);
      ctx.fillStyle = bulbGradient;
      ctx.fill();

      // Draw subtle fireflies (fewer and smaller)
      particlesRef.current.forEach((p) => {
        // Slow opacity animation
        if (p.opacity < p.targetOpacity) {
          p.opacity += 0.005;
        } else {
          p.opacity -= 0.005;
        }
        if (p.opacity <= 0.05 || p.opacity >= 0.5) {
          p.targetOpacity = Math.random() * 0.4 + 0.1;
        }

        // Gentle movement
        p.x += p.vx;
        p.y += p.vy;

        // Keep within light cone area
        const maxX = centerX + 40;
        const minX = centerX - 40;
        if (p.x < minX || p.x > maxX) p.vx *= -1;
        if (p.y < height * 0.4 || p.y > height * 0.85) p.vy *= -1;

        // Very subtle random drift
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;
        p.vx = Math.max(-0.2, Math.min(0.2, p.vx));
        p.vy = Math.max(-0.15, Math.min(0.15, p.vy));

        // Subtle firefly glow
        const particleGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        particleGradient.addColorStop(0, `rgba(255, 250, 240, ${p.opacity * 0.8})`);
        particleGradient.addColorStop(0.5, `rgba(247, 175, 39, ${p.opacity * 0.3})`);
        particleGradient.addColorStop(1, 'rgba(247, 175, 39, 0)');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = particleGradient;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full pointer-events-none"
      style={{ height }}
    />
  );
}



