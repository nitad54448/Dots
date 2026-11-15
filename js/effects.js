(function (global) {
  'use strict';

  const particles = [];
  const rings = [];
  const pulses = [];

  function clear() {
    particles.length = 0;
    rings.length = 0;
    pulses.length = 0;
  }

  function spawnConnectBurst(x, y, colorHex) {
    rings.push({
      x: x,
      y: y,
      color: colorHex,
      radius: 8,
      maxRadius: 44,
      life: 0,
      duration: 0.42
    });

    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 75 + Math.random() * 120;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.8 + Math.random() * 2.5,
        color: colorHex,
        life: 0,
        duration: 0.38 + Math.random() * 0.2,
        gravity: 160,
        isConfetti: false
      });
    }
  }

  function spawnWinConfetti(width, height, palette) {
    const colors = (palette || []).map((p) => p.hex || p);
    const fallback = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4'];
    const pool = colors.length ? colors : fallback;

    for (let i = 0; i < 60; i++) {
      const x = Math.random() * width;
      const y = height * 0.25 + (Math.random() - 0.5) * height * 0.2;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 150 + Math.random() * 240;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: 5 + Math.random() * 5,
        color: pool[i % pool.length],
        life: 0,
        duration: 1.2 + Math.random() * 0.7,
        gravity: 380,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        isConfetti: true
      });
    }
  }

  function spawnPulse(cells, colorHex) {
    if (!cells || cells.length < 2) return;
    pulses.push({
      cells: cells.map((c) => ({ r: c.r, c: c.c })),
      color: colorHex,
      life: 0,
      duration: 0.65
    });
  }

  function hasActive() {
    return particles.length > 0 || rings.length > 0 || pulses.length > 0;
  }

  function updateAndDraw(ctx, dt, cellSize, boardX, boardY) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt || 0.016));

    // Pulses along pipes
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.life += safeDt;
      if (p.life >= p.duration) {
        pulses.splice(i, 1);
        continue;
      }
      const t = p.life / p.duration;
      const alpha = Math.sin(t * Math.PI) * 0.85;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(4, cellSize * 0.22);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let j = 0; j < p.cells.length; j++) {
        const cx = boardX + (p.cells[j].c + 0.5) * cellSize;
        const cy = boardY + (p.cells[j].r + 0.5) * cellSize;
        if (j === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Expanding rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life += safeDt;
      if (r.life >= r.duration) {
        rings.splice(i, 1);
        continue;
      }
      const t = r.life / r.duration;
      const radius = r.radius + (r.maxRadius - r.radius) * (1 - Math.pow(1 - t, 2));
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles & confetti
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += safeDt;
      if (pt.life >= pt.duration) {
        particles.splice(i, 1);
        continue;
      }
      const t = pt.life / pt.duration;
      pt.vy += pt.gravity * safeDt;
      pt.x += pt.vx * safeDt;
      pt.y += pt.vy * safeDt;
      pt.vx *= 0.985;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.pow(t, 1.5));
      ctx.fillStyle = pt.color;
      if (pt.isConfetti) {
        pt.rot += pt.vRot * safeDt;
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillRect(-pt.size * 0.5, -pt.size * 0.3, pt.size, pt.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    return hasActive();
  }

  global.DotsEffects = {
    clear,
    spawnConnectBurst,
    spawnWinConfetti,
    spawnPulse,
    hasActive,
    updateAndDraw
  };
})(window);
