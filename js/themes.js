(function (global) {
  'use strict';

  const PALETTE = [
    { name: 'Red', hex: '#ef4444', dayHex: '#dc2626', light: '#fca5a5', glow: 'rgba(239, 68, 68, 0.65)', symbol: '●' },
    { name: 'Blue', hex: '#3b82f6', dayHex: '#2563eb', light: '#93c5fd', glow: 'rgba(59, 130, 246, 0.65)', symbol: '▲' },
    { name: 'Green', hex: '#22c55e', dayHex: '#16a34a', light: '#86efac', glow: 'rgba(34, 197, 94, 0.65)', symbol: '■' },
    { name: 'Yellow', hex: '#eab308', dayHex: '#ca8a04', light: '#fef08a', glow: 'rgba(234, 179, 8, 0.65)', symbol: '★' },
    { name: 'Purple', hex: '#a855f7', dayHex: '#9333ea', light: '#d8b4fe', glow: 'rgba(168, 85, 247, 0.65)', symbol: '◆' },
    { name: 'Orange', hex: '#f97316', dayHex: '#ea580c', light: '#fdba74', glow: 'rgba(249, 115, 22, 0.65)', symbol: '✚' },
    { name: 'Cyan', hex: '#06b6d4', dayHex: '#0891b2', light: '#67e8f9', glow: 'rgba(6, 182, 212, 0.65)', symbol: '▼' },
    { name: 'Pink', hex: '#ec4899', dayHex: '#db2777', light: '#f9a8d4', glow: 'rgba(236, 72, 153, 0.65)', symbol: '♥' },
    { name: 'Lime', hex: '#84cc16', dayHex: '#65a30d', light: '#bef264', glow: 'rgba(132, 204, 22, 0.65)', symbol: '✖' },
    { name: 'Teal', hex: '#14b8a6', dayHex: '#0d9488', light: '#5eead4', glow: 'rgba(20, 184, 166, 0.65)', symbol: '⬟' },
    { name: 'Indigo', hex: '#6366f1', dayHex: '#4f46e5', light: '#a5b4fc', glow: 'rgba(99, 102, 241, 0.65)', symbol: '☀' },
    { name: 'Rose', hex: '#f43f5e', dayHex: '#e11d48', light: '#fda4af', glow: 'rgba(244, 63, 94, 0.65)', symbol: '☾' },
    { name: 'Ice', hex: '#e2e8f0', dayHex: '#334155', light: '#ffffff', glow: 'rgba(226, 232, 240, 0.6)', symbol: '⚡' },
    { name: 'Amber', hex: '#d97706', dayHex: '#92400e', light: '#fcd34d', glow: 'rgba(217, 119, 6, 0.65)', symbol: '❖' },
    { name: 'Crimson', hex: '#dc2626', dayHex: '#991b1b', light: '#f87171', glow: 'rgba(220, 38, 38, 0.6)', symbol: 'A' },
    { name: 'Royal', hex: '#2563eb', dayHex: '#1d4ed8', light: '#60a5fa', glow: 'rgba(37, 99, 235, 0.6)', symbol: 'B' },
    { name: 'Emerald', hex: '#10b981', dayHex: '#047857', light: '#6ee7b7', glow: 'rgba(16, 185, 129, 0.6)', symbol: 'C' },
    { name: 'Gold', hex: '#facc15', dayHex: '#a16207', light: '#fef9c3', glow: 'rgba(250, 204, 21, 0.6)', symbol: 'D' },
    { name: 'Violet', hex: '#8b5cf6', dayHex: '#6d28d9', light: '#c4b5fd', glow: 'rgba(139, 92, 246, 0.6)', symbol: 'E' },
    { name: 'Tangerine', hex: '#fb923c', dayHex: '#c2410c', light: '#fed7aa', glow: 'rgba(251, 146, 60, 0.6)', symbol: 'F' },
    { name: 'Sky', hex: '#38bdf8', dayHex: '#0369a1', light: '#bae6fd', glow: 'rgba(56, 189, 248, 0.6)', symbol: 'G' },
    { name: 'Hot Pink', hex: '#f472b6', dayHex: '#be185d', light: '#fbcfe8', glow: 'rgba(244, 114, 182, 0.6)', symbol: 'H' },
    { name: 'Chartreuse', hex: '#a3e635', dayHex: '#4d7c0f', light: '#d9f99d', glow: 'rgba(163, 230, 53, 0.6)', symbol: 'I' },
    { name: 'Mint', hex: '#2dd4bf', dayHex: '#0f766e', light: '#99f6e4', glow: 'rgba(45, 212, 191, 0.6)', symbol: 'J' },
    { name: 'Periwinkle', hex: '#818cf8', dayHex: '#4338ca', light: '#c7d2fe', glow: 'rgba(129, 140, 248, 0.6)', symbol: 'K' },
    { name: 'Coral', hex: '#fb7185', dayHex: '#be123c', light: '#fecdd3', glow: 'rgba(251, 113, 133, 0.6)', symbol: 'L' },
    { name: 'Silver', hex: '#94a3b8', dayHex: '#475569', light: '#e2e8f0', glow: 'rgba(148, 163, 184, 0.6)', symbol: 'M' },
    { name: 'Bronze', hex: '#b45309', dayHex: '#78350f', light: '#f59e0b', glow: 'rgba(180, 83, 9, 0.6)', symbol: 'N' },
    { name: 'Magenta', hex: '#d946ef', dayHex: '#a21caf', light: '#f0abfc', glow: 'rgba(217, 70, 239, 0.6)', symbol: 'O' },
    { name: 'Turquoise', hex: '#22d3ee', dayHex: '#0e7490', light: '#a5f3fc', glow: 'rgba(34, 211, 238, 0.6)', symbol: 'P' },
    { name: 'Olive', hex: '#65a30d', dayHex: '#3f6212', light: '#bef264', glow: 'rgba(101, 163, 13, 0.6)', symbol: 'Q' },
    { name: 'Salmon', hex: '#f87171', dayHex: '#b91c1c', light: '#fecaca', glow: 'rgba(248, 113, 113, 0.6)', symbol: 'R' },
    { name: 'Lavender', hex: '#c084fc', dayHex: '#7e22ce', light: '#e9d5ff', glow: 'rgba(192, 132, 252, 0.6)', symbol: 'S' },
    { name: 'Peach', hex: '#fdba74', dayHex: '#9a3412', light: '#ffedd5', glow: 'rgba(253, 186, 116, 0.6)', symbol: 'T' },
    { name: 'Maroon', hex: '#be123c', dayHex: '#881337', light: '#fda4af', glow: 'rgba(190, 18, 60, 0.6)', symbol: 'U' },
    { name: 'Navy', hex: '#60a5fa', dayHex: '#1e3a8a', light: '#bfdbfe', glow: 'rgba(96, 165, 250, 0.6)', symbol: 'V' }
  ];

  const SKINS = [
    {
      id: 'neon',
      name: 'Neon Glow',
      desc: 'Glowing tubes & luminous dots',
      swatch: 'linear-gradient(135deg, #38bdf8, #a855f7)'
    },
    {
      id: 'classic',
      name: 'Classic Flow',
      desc: 'Crisp solid pipes & dots',
      swatch: 'linear-gradient(135deg, #ef4444, #eab308)'
    },
    {
      id: 'glass',
      name: 'Crystal Tube',
      desc: 'Glossy 3D specular tubes',
      swatch: 'linear-gradient(135deg, #22c55e, #06b6d4)'
    },
    {
      id: 'minimal',
      name: 'Minimal Ink',
      desc: 'Clean geometric ring dots',
      swatch: 'linear-gradient(135deg, #94a3b8, #f8fafc)'
    }
  ];

  const BACKGROUNDS = [
    {
      id: 'midnight',
      name: 'Midnight (Night)',
      desc: 'Classic dark board',
      themeColor: '#070b14',
      swatch: 'linear-gradient(135deg, #0f172a, #020617)',
      boardBg: '#090e1a',
      gridLine: 'rgba(148, 163, 184, 0.16)',
      emptyPulse: 'rgba(56, 189, 248, 0.14)',
      cellTintAlpha: 0.14,
      wallFill: '#1e293b',
      wallStroke: 'rgba(148, 163, 184, 0.42)',
      bridgeDeck: 'rgba(15, 23, 42, 0.96)',
      bridgeRail: '#64748b'
    },
    {
      id: 'daylight',
      name: 'Daylight (Day)',
      desc: 'Bright crisp paper board',
      themeColor: '#f1f5f9',
      swatch: 'linear-gradient(135deg, #ffffff, #cbd5e1)',
      boardBg: '#ffffff',
      gridLine: 'rgba(15, 23, 42, 0.14)',
      emptyPulse: 'rgba(37, 99, 235, 0.09)',
      cellTintAlpha: 0.15,
      wallFill: '#cbd5e1',
      wallStroke: 'rgba(51, 65, 85, 0.45)',
      bridgeDeck: 'rgba(241, 245, 249, 0.96)',
      bridgeRail: '#475569'
    },
    {
      id: 'ocean',
      name: 'Deep Ocean',
      desc: 'Cool midnight blues',
      themeColor: '#071324',
      swatch: 'linear-gradient(135deg, #144269, #061322)',
      boardBg: '#071526',
      gridLine: 'rgba(125, 211, 252, 0.18)',
      emptyPulse: 'rgba(56, 189, 248, 0.14)',
      cellTintAlpha: 0.15,
      wallFill: '#0e3052',
      wallStroke: 'rgba(56, 189, 248, 0.42)',
      bridgeDeck: 'rgba(7, 25, 46, 0.96)',
      bridgeRail: '#38bdf8'
    },
    {
      id: 'woodland',
      name: 'Woodland',
      desc: 'Warm espresso amber',
      themeColor: '#140e0a',
      swatch: 'linear-gradient(135deg, #422818, #130b07)',
      boardBg: '#160d08',
      gridLine: 'rgba(245, 158, 11, 0.18)',
      emptyPulse: 'rgba(245, 158, 11, 0.14)',
      cellTintAlpha: 0.15,
      wallFill: '#3b2416',
      wallStroke: 'rgba(245, 158, 11, 0.42)',
      bridgeDeck: 'rgba(28, 16, 10, 0.96)',
      bridgeRail: '#d97706'
    },
    {
      id: 'sunset',
      name: 'Sunset Dusk',
      desc: 'Plum & coral glow',
      themeColor: '#170f1e',
      swatch: 'linear-gradient(135deg, #5b233d, #150b1b)',
      boardBg: '#190b1d',
      gridLine: 'rgba(251, 146, 60, 0.18)',
      emptyPulse: 'rgba(251, 146, 60, 0.14)',
      cellTintAlpha: 0.15,
      wallFill: '#3f1b3f',
      wallStroke: 'rgba(251, 146, 60, 0.45)',
      bridgeDeck: 'rgba(30, 12, 34, 0.96)',
      bridgeRail: '#fb923c'
    },
    {
      id: 'slate',
      name: 'Slate Pro',
      desc: 'Balanced dark slate',
      themeColor: '#0f172a',
      swatch: 'linear-gradient(135deg, #334155, #0f172a)',
      boardBg: '#0f172a',
      gridLine: 'rgba(148, 163, 184, 0.2)',
      emptyPulse: 'rgba(56, 189, 248, 0.14)',
      cellTintAlpha: 0.14,
      wallFill: '#334155',
      wallStroke: 'rgba(148, 163, 184, 0.5)',
      bridgeDeck: 'rgba(15, 23, 42, 0.96)',
      bridgeRail: '#94a3b8'
    }
  ];

  function getColor(index, bgId) {
    const base = PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
    const activeBg =
      bgId ||
      (global.document && global.document.body && global.document.body.dataset && global.document.body.dataset.bg) ||
      'midnight';
    if (activeBg === 'daylight') {
      return Object.assign({}, base, { hex: base.dayHex });
    }
    return base;
  }

  function getSkin(skinId) {
    return SKINS.find((s) => s.id === skinId) || SKINS[0];
  }

  function getBackground(bgId) {
    return BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS[0];
  }

  function applyTheme(settings) {
    const bg = getBackground(settings && settings.bg);
    if (global.document && global.document.body) {
      global.document.body.dataset.bg = bg.id;
    }
    const meta = global.document && global.document.querySelector
      ? global.document.querySelector('meta[name="theme-color"]')
      : null;
    if (meta) {
      meta.setAttribute('content', bg.themeColor);
    }
  }

  global.DotsThemes = {
    PALETTE,
    SKINS,
    BACKGROUNDS,
    getColor,
    getSkin,
    getBackground,
    applyTheme
  };
})(window);
