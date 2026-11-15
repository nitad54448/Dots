(function (global) {
  'use strict';

  let canvas = null;
  let ctx = null;
  let wrapEl = null;
  let callbacks = {};

  let level = null;
  let wallSet = new Set();
  let bridgeSet = new Set();
  let paths = [];
  let moves = 0;
  let lastMovedColor = -1;
  let undoStack = [];
  let hintedColors = new Set();
  let activeColor = -1;
  let activePointerId = null;
  let activePointerPos = null;
  let preDragSnapshot = null;
  let won = false;
  let almostWinNotified = false;

  let metrics = {
    cssSize: 320,
    dpr: 1,
    boardX: 8,
    boardY: 8,
    boardSize: 304,
    cellSize: 60
  };

  let rafId = null;
  let lastFrameTime = 0;

  function init(canvasEl, boardWrapEl, cbs) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    wrapEl = boardWrapEl;
    callbacks = cbs || {};

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', onContextMenu);

    if (global.ResizeObserver && wrapEl) {
      const ro = new global.ResizeObserver(() => {
        resizeCanvas();
      });
      ro.observe(wrapEl);
    }
    global.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  function resizeCanvas() {
    if (!canvas || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    const availW = Math.max(200, Math.floor(rect.width));
    const availH = Math.max(200, Math.floor(rect.height));
    const cssSize = Math.min(availW, availH, 840);
    const dpr = Math.min(global.devicePixelRatio || 1, 2.5);

    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);

    const pad = Math.max(4, Math.round(cssSize * 0.014));
    const boardSize = cssSize - pad * 2;
    const gridN = level ? level.size : 7;

    metrics = {
      cssSize: cssSize,
      dpr: dpr,
      boardX: pad,
      boardY: pad,
      boardSize: boardSize,
      cellSize: boardSize / gridN
    };

    render();
  }

  function loadLevel(nextLevel, savedState) {
    level = nextLevel;
    wallSet = new Set((level.walls || []).map((w) => w.r * level.size + w.c));
    bridgeSet = new Set((level.bridges || []).map((b) => b.r * level.size + b.c));

    activeColor = -1;
    activePointerId = null;
    activePointerPos = null;
    preDragSnapshot = null;
    lastMovedColor = -1;
    won = false;
    almostWinNotified = false;
    undoStack = [];
    hintedColors = new Set();

    if (
      savedState &&
      Array.isArray(savedState.paths) &&
      savedState.paths.length === level.numPairs
    ) {
      paths = savedState.paths.map((p) =>
        Array.isArray(p) ? p.map((pt) => ({ r: pt.r, c: pt.c })) : []
      );
      moves = Number(savedState.moves) || 0;
      if (Array.isArray(savedState.hintedColors)) {
        savedState.hintedColors.forEach((c) => hintedColors.add(c));
      }
    } else {
      paths = Array.from({ length: level.numPairs }, () => []);
      moves = 0;
    }

    if (global.DotsEffects) global.DotsEffects.clear();
    resizeCanvas();
    emitStats();
    render();
  }

  function serializePaths(srcPaths) {
    return JSON.stringify(srcPaths || paths);
  }

  function restorePaths(serialized) {
    const parsed = JSON.parse(serialized);
    paths = parsed.map((p) => p.map((pt) => ({ r: pt.r, c: pt.c })));
  }

  function pushUndo(snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 40) {
      undoStack.shift();
    }
  }

  function sameCell(a, b) {
    return Boolean(a && b && a.r === b.r && a.c === b.c);
  }

  function isWallAt(r, c) {
    return Boolean(level && wallSet.has(r * level.size + c));
  }

  function isBridgeAt(r, c) {
    return Boolean(level && bridgeSet.has(r * level.size + c));
  }

  function getEndpointColorAt(r, c) {
    if (!level) return -1;
    for (let i = 0; i < level.endpoints.length; i++) {
      const ep = level.endpoints[i];
      if ((ep.start.r === r && ep.start.c === c) || (ep.end.r === r && ep.end.c === c)) {
        return i;
      }
    }
    return -1;
  }

  function isPairConnected(colorIdx) {
    if (!level) return false;
    const p = paths[colorIdx];
    if (!p || p.length < 2) return false;
    const ep = level.endpoints[colorIdx];
    const head = p[0];
    const tail = p[p.length - 1];
    return (
      (sameCell(head, ep.start) && sameCell(tail, ep.end)) ||
      (sameCell(head, ep.end) && sameCell(tail, ep.start))
    );
  }

  function findPipesAt(r, c) {
    const hits = [];
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      for (let j = 0; j < p.length; j++) {
        if (p[j].r === r && p[j].c === c) {
          hits.push({ color: i, index: j });
        }
      }
    }
    return hits;
  }

  function clientToCell(clientX, clientY, clampForDrag) {
    if (!canvas || !level) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - metrics.boardX;
    const y = clientY - rect.top - metrics.boardY;

    let c = Math.floor(x / metrics.cellSize);
    let r = Math.floor(y / metrics.cellSize);

    if (clampForDrag) {
      if (
        x < -metrics.cellSize * 0.6 ||
        y < -metrics.cellSize * 0.6 ||
        x > metrics.boardSize + metrics.cellSize * 0.6 ||
        y > metrics.boardSize + metrics.cellSize * 0.6
      ) {
        return null;
      }
      c = Math.max(0, Math.min(level.size - 1, c));
      r = Math.max(0, Math.min(level.size - 1, r));
      return { r, c, localX: x + metrics.boardX, localY: y + metrics.boardY };
    }

    if (r < 0 || r >= level.size || c < 0 || c >= level.size) {
      return null;
    }
    return { r, c, localX: x + metrics.boardX, localY: y + metrics.boardY };
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (!level || won) return;
    const cell = clientToCell(e.clientX, e.clientY, false);
    if (!cell || isWallAt(cell.r, cell.c)) return;

    let targetColor = getEndpointColorAt(cell.r, cell.c);
    if (targetColor === -1) {
      const hits = findPipesAt(cell.r, cell.c);
      if (hits.length === 1) targetColor = hits[0].color;
    }
    if (targetColor !== -1 && paths[targetColor] && paths[targetColor].length > 0) {
      pushUndo(serializePaths(paths));
      paths[targetColor] = [];
      hintedColors.delete(targetColor);
      lastMovedColor = -1;
      if (global.DotsAudio) global.DotsAudio.playUndo();
      emitStats();
      render();
    }
  }

  function onPointerDown(e) {
    if (!level || won) return;
    if (activePointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return;

    const cell = clientToCell(e.clientX, e.clientY, false);
    if (!cell || isWallAt(cell.r, cell.c)) return;

    const epColor = getEndpointColorAt(cell.r, cell.c);
    if (epColor !== -1) {
      preDragSnapshot = serializePaths(paths);
      hintedColors.delete(epColor);
      activeColor = epColor;
      paths[epColor] = [{ r: cell.r, c: cell.c }];
      activePointerId = e.pointerId;
      activePointerPos = { x: cell.localX, y: cell.localY };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (global.DotsAudio) global.DotsAudio.playPickup(epColor);
      render();
      return;
    }

    const hits = findPipesAt(cell.r, cell.c);
    if (hits.length === 1) {
      const hit = hits[0];
      preDragSnapshot = serializePaths(paths);
      hintedColors.delete(hit.color);
      activeColor = hit.color;
      paths[hit.color] = paths[hit.color].slice(0, hit.index + 1);
      activePointerId = e.pointerId;
      activePointerPos = { x: cell.localX, y: cell.localY };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (global.DotsAudio) global.DotsAudio.playPickup(hit.color);
      render();
    }
  }

  function stepToCell(nr, nc) {
    const curPath = paths[activeColor];
    if (!curPath || curPath.length === 0) return false;
    if (isWallAt(nr, nc)) return false;

    const head = curPath[curPath.length - 1];
    const alreadyConnected = isPairConnected(activeColor);
    if (alreadyConnected) {
      if (curPath.length >= 2) {
        const prev = curPath[curPath.length - 2];
        if (prev.r === nr && prev.c === nc) {
          curPath.pop();
          if (global.DotsAudio) global.DotsAudio.playStep(curPath.length);
          return true;
        }
      }
      return false;
    }

    // Enforce straight-through motion when stepping off a bridge cell
    if (isBridgeAt(head.r, head.c) && curPath.length >= 2) {
      const prev = curPath[curPath.length - 2];
      const forwardR = head.r + (head.r - prev.r);
      const forwardC = head.c + (head.c - prev.c);
      const isBacktrack = prev.r === nr && prev.c === nc;
      const isStraight = forwardR === nr && forwardC === nc;
      if (!isBacktrack && !isStraight) {
        return false;
      }
    }

    const epColor = getEndpointColorAt(nr, nc);
    if (epColor !== -1 && epColor !== activeColor) {
      return false;
    }

    // Backtrack if stepping onto an earlier cell of the active path
    for (let i = 0; i < curPath.length; i++) {
      if (curPath[i].r === nr && curPath[i].c === nc) {
        curPath.length = i + 1;
        if (global.DotsAudio) global.DotsAudio.playStep(curPath.length);
        return true;
      }
    }

    const stepVert = nr !== head.r;
    const hits = findPipesAt(nr, nc);
    let didCut = false;

    if (isBridgeAt(nr, nc)) {
      for (let h = 0; h < hits.length; h++) {
        const hit = hits[h];
        if (hit.color === activeColor) continue;
        const op = paths[hit.color];
        const j = hit.index;
        const otherVert =
          j > 0 ? op[j].r !== op[j - 1].r : j + 1 < op.length ? op[j + 1].r !== op[j].r : stepVert;
        if (otherVert === stepVert) {
          if (hintedColors.has(hit.color)) return false;
          op.length = j;
          if (op.length <= 1) paths[hit.color] = [];
          didCut = true;
        }
      }
    } else if (hits.length > 0) {
      for (let h = 0; h < hits.length; h++) {
        const hit = hits[h];
        if (hit.color === activeColor) continue;
        if (hintedColors.has(hit.color)) return false;
        paths[hit.color].length = hit.index;
        if (paths[hit.color].length <= 1) {
          paths[hit.color] = [];
        }
        didCut = true;
      }
    }

    if (didCut && global.DotsAudio) {
      global.DotsAudio.playCut();
    }

    curPath.push({ r: nr, c: nc });

    if (epColor === activeColor && curPath.length >= 2) {
      const colorInfo = global.DotsThemes
        ? global.DotsThemes.getColor(activeColor)
        : { hex: '#38bdf8' };
      const cx = metrics.boardX + (nc + 0.5) * metrics.cellSize;
      const cy = metrics.boardY + (nr + 0.5) * metrics.cellSize;
      if (global.DotsAudio) global.DotsAudio.playConnect(activeColor);
      if (global.DotsEffects) {
        global.DotsEffects.spawnConnectBurst(cx, cy, colorInfo.hex);
        ensureAnimating();
      }
      return 'connected';
    }

    if (global.DotsAudio && !didCut) {
      global.DotsAudio.playStep(curPath.length);
    }
    return true;
  }

  function onPointerMove(e) {
    if (activeColor === -1 || activePointerId !== e.pointerId || won) return;
    const target = clientToCell(e.clientX, e.clientY, true);
    if (!target) return;

    activePointerPos = { x: target.localX, y: target.localY };
    const curPath = paths[activeColor];
    if (!curPath || curPath.length === 0) return;

    let head = curPath[curPath.length - 1];
    if (head.r === target.r && head.c === target.c) {
      render();
      return;
    }

    let steps = 0;
    let moved = false;
    const maxSteps = level.size * 3;

    while ((head.r !== target.r || head.c !== target.c) && steps < maxSteps) {
      steps++;
      const dr = target.r - head.r;
      const dc = target.c - head.c;

      const tryDirs = [];
      if (Math.abs(dr) >= Math.abs(dc)) {
        if (dr !== 0) tryDirs.push({ r: head.r + Math.sign(dr), c: head.c });
        if (dc !== 0) tryDirs.push({ r: head.r, c: head.c + Math.sign(dc) });
      } else {
        if (dc !== 0) tryDirs.push({ r: head.r, c: head.c + Math.sign(dc) });
        if (dr !== 0) tryDirs.push({ r: head.r + Math.sign(dr), c: head.c });
      }

      let stepped = false;
      for (let i = 0; i < tryDirs.length; i++) {
        const res = stepToCell(tryDirs[i].r, tryDirs[i].c);
        if (res) {
          stepped = true;
          moved = true;
          if (res === 'connected') {
            head = paths[activeColor][paths[activeColor].length - 1];
            steps = maxSteps;
          }
          break;
        }
      }

      if (!stepped) break;
      head = paths[activeColor][paths[activeColor].length - 1];
    }

    if (moved) {
      emitStats();
    }
    render();
  }

  function onPointerUp(e) {
    if (activePointerId !== e.pointerId) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (activeColor !== -1 && paths[activeColor] && paths[activeColor].length <= 1) {
      paths[activeColor] = [];
    }

    const afterSnapshot = serializePaths(paths);
    if (preDragSnapshot !== null && afterSnapshot !== preDragSnapshot) {
      pushUndo(preDragSnapshot);
      if (activeColor !== -1 && paths[activeColor] && paths[activeColor].length >= 2) {
        if (activeColor !== lastMovedColor) {
          moves++;
          lastMovedColor = activeColor;
        }
      } else {
        lastMovedColor = -1;
      }
      emitStats();
      checkCompletion();
    }

    activeColor = -1;
    activePointerId = null;
    activePointerPos = null;
    preDragSnapshot = null;
    render();
  }

  function getStats() {
    if (!level) {
      return {
        connectedPairs: 0,
        totalPairs: 0,
        filledCells: 0,
        totalCells: 0,
        coveragePct: 0,
        moves: 0,
        undoCount: 0,
        isSolved: false
      };
    }

    const N = level.size;
    let connectedPairs = 0;
    const normalFilled = new Set();
    const bridgeHFilled = new Set();
    const bridgeVFilled = new Set();

    for (let i = 0; i < level.numPairs; i++) {
      if (isPairConnected(i)) connectedPairs++;
      const p = paths[i];
      if (!p || p.length < 2) continue;

      for (let j = 0; j < p.length; j++) {
        const key = p[j].r * N + p[j].c;
        if (bridgeSet.has(key)) {
          const isVert =
            j > 0 ? p[j].r !== p[j - 1].r : p[j + 1].r !== p[j].r;
          if (isVert) bridgeVFilled.add(key);
          else bridgeHFilled.add(key);
        } else if (!wallSet.has(key)) {
          normalFilled.add(key);
        }
      }
    }

    const totalSlots = N * N - wallSet.size + bridgeSet.size;
    const filledSlots = normalFilled.size + bridgeHFilled.size + bridgeVFilled.size;
    const coveragePct = totalSlots > 0 ? Math.floor((filledSlots / totalSlots) * 100) : 100;
    const isSolved = connectedPairs === level.numPairs && filledSlots === totalSlots;

    return {
      connectedPairs,
      totalPairs: level.numPairs,
      filledCells: filledSlots,
      totalCells: totalSlots,
      coveragePct,
      moves,
      undoCount: undoStack.length,
      isSolved
    };
  }

  function computeStars() {
    if (!level) return 3;
    if (moves <= level.numPairs && hintedColors.size === 0) return 3;
    if (moves <= Math.ceil(level.numPairs * 1.6) + 1 && hintedColors.size <= 1) return 2;
    return 1;
  }

  function emitStats() {
    const stats = getStats();
    if (callbacks.onStatsChange) {
      callbacks.onStatsChange(stats, getSerializableState());
    }
    if (
      !won &&
      stats.connectedPairs === stats.totalPairs &&
      stats.filledCells < stats.totalCells
    ) {
      if (!almostWinNotified) {
        almostWinNotified = true;
        if (callbacks.onShowBanner) {
          callbacks.onShowBanner(
            'All dots linked! Fill every square (' + stats.coveragePct + '%)'
          );
        }
        ensureAnimating();
      }
    } else {
      almostWinNotified = false;
    }
  }

  function checkCompletion() {
    if (won || !level) return;
    const stats = getStats();
    if (stats.isSolved) {
      won = true;
      const stars = computeStars();
      if (global.DotsAudio) global.DotsAudio.playWin();
      if (global.DotsEffects && global.DotsThemes) {
        global.DotsEffects.spawnWinConfetti(
          metrics.cssSize,
          metrics.cssSize,
          global.DotsThemes.PALETTE.slice(0, level.numPairs)
        );
        ensureAnimating();
      }
      if (callbacks.onLevelComplete) {
        callbacks.onLevelComplete({
          moves: moves,
          stars: stars,
          coveragePct: 100
        });
      }
    }
  }

  function undo() {
    if (won || undoStack.length === 0) return false;
    const prev = undoStack.pop();
    restorePaths(prev);
    lastMovedColor = -1;
    if (global.DotsAudio) global.DotsAudio.playUndo();
    emitStats();
    render();
    return true;
  }

  function clearBoard() {
    if (!level) return;
    const hasAny = paths.some((p) => p.length > 0);
    if (hasAny && !won) {
      pushUndo(serializePaths(paths));
    }
    paths = Array.from({ length: level.numPairs }, () => []);
    moves = 0;
    lastMovedColor = -1;
    won = false;
    almostWinNotified = false;
    hintedColors.clear();
    emitStats();
    render();
  }

  function pathMatchesSolution(colorIdx) {
    const p = paths[colorIdx];
    const sol = level.solutionPaths[colorIdx];
    if (!p || !sol || p.length !== sol.length) return false;
    let forward = true;
    let reverse = true;
    for (let i = 0; i < sol.length; i++) {
      if (!sameCell(p[i], sol[i])) forward = false;
      if (!sameCell(p[i], sol[sol.length - 1 - i])) reverse = false;
      if (!forward && !reverse) return false;
    }
    return true;
  }

  function applyHint() {
    if (!level || won) return { applied: false };

    let targetColor = -1;
    for (let i = 0; i < level.numPairs; i++) {
      if (!isPairConnected(i) && !pathMatchesSolution(i)) {
        targetColor = i;
        break;
      }
    }
    if (targetColor === -1) {
      for (let i = 0; i < level.numPairs; i++) {
        if (!pathMatchesSolution(i)) {
          targetColor = i;
          break;
        }
      }
    }

    if (targetColor === -1) return { applied: false };

    pushUndo(serializePaths(paths));

    const N = level.size;
    const sol = level.solutionPaths[targetColor];
    const solNormalKeys = new Set();
    const solBridgeAxes = new Map();

    for (let i = 0; i < sol.length; i++) {
      const key = sol[i].r * N + sol[i].c;
      if (bridgeSet.has(key)) {
        const isVert = i > 0 ? sol[i].r !== sol[i - 1].r : sol[i + 1].r !== sol[i].r;
        solBridgeAxes.set(key, isVert);
      } else {
        solNormalKeys.add(key);
      }
    }

    for (let other = 0; other < level.numPairs; other++) {
      if (other === targetColor) continue;
      const op = paths[other];
      for (let j = 0; j < op.length; j++) {
        const oKey = op[j].r * N + op[j].c;
        if (bridgeSet.has(oKey)) {
          if (solBridgeAxes.has(oKey)) {
            const otherVert =
              j > 0 ? op[j].r !== op[j - 1].r : j + 1 < op.length ? op[j + 1].r !== op[j].r : false;
            if (otherVert === solBridgeAxes.get(oKey)) {
              op.length = j;
              if (op.length <= 1) paths[other] = [];
              break;
            }
          }
        } else if (solNormalKeys.has(oKey)) {
          op.length = j;
          if (op.length <= 1) paths[other] = [];
          break;
        }
      }
    }

    paths[targetColor] = sol.map((pt) => ({ r: pt.r, c: pt.c }));
    hintedColors.add(targetColor);

    const colorInfo = global.DotsThemes
      ? global.DotsThemes.getColor(targetColor)
      : { hex: '#38bdf8' };
    if (global.DotsAudio) global.DotsAudio.playHint();
    if (global.DotsEffects) {
      global.DotsEffects.spawnPulse(paths[targetColor], colorInfo.hex);
      ensureAnimating();
    }

    emitStats();
    render();
    checkCompletion();
    return { applied: true, colorIndex: targetColor };
  }

  function getSerializableState() {
    if (!level) return null;
    return {
      levelNum: level.levelNumber,
      paths: paths.map((p) => p.map((pt) => ({ r: pt.r, c: pt.c }))),
      moves: moves,
      hintedColors: Array.from(hintedColors)
    };
  }

  function ensureAnimating() {
    if (rafId !== null) return;
    lastFrameTime = performance.now();
    const tick = (now) => {
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      render(dt);
      const effectsActive = global.DotsEffects && global.DotsEffects.hasActive();
      if (effectsActive || almostWinNotified) {
        rafId = global.requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };
    rafId = global.requestAnimationFrame(tick);
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function traceSmoothPipe(context, pts, boardX, boardY, cellSize) {
    if (!pts || pts.length < 2) return;
    const cx = (pt) => boardX + (pt.c + 0.5) * cellSize;
    const cy = (pt) => boardY + (pt.r + 0.5) * cellSize;

    context.beginPath();
    context.moveTo(cx(pts[0]), cy(pts[0]));

    if (pts.length === 2) {
      context.lineTo(cx(pts[1]), cy(pts[1]));
      return;
    }

    const radius = cellSize * 0.28;
    for (let i = 1; i < pts.length - 1; i++) {
      const xPrev = cx(pts[i - 1]);
      const yPrev = cy(pts[i - 1]);
      const xCur = cx(pts[i]);
      const yCur = cy(pts[i]);
      const xNext = cx(pts[i + 1]);
      const yNext = cy(pts[i + 1]);

      if ((xCur === xPrev && xNext === xCur) || (yCur === yPrev && yNext === yCur)) {
        context.lineTo(xCur, yCur);
      } else {
        context.arcTo(xCur, yCur, xNext, yNext, radius);
      }
    }
    const last = pts[pts.length - 1];
    context.lineTo(cx(last), cy(last));
  }

  function strokePipePath(color, pts, skin, pipeWidth) {
    const { boardX, boardY, cellSize } = metrics;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    traceSmoothPipe(ctx, pts, boardX, boardY, cellSize);

    if (skin === 'neon') {
      ctx.shadowColor = color.hex;
      ctx.shadowBlur = Math.min(5, Math.max(1, cellSize * 0.1));
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = pipeWidth;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = color.light;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = pipeWidth * 0.34;
      ctx.stroke();
    } else if (skin === 'glass') {
      ctx.strokeStyle = color.hex;
      ctx.globalAlpha = 0.86;
      ctx.lineWidth = pipeWidth;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = pipeWidth * 0.32;
      ctx.stroke();
    } else {
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = pipeWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  function render(dt) {
    if (!ctx || !canvas) return;
    const { cssSize, dpr, boardX, boardY, boardSize, cellSize } = metrics;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const settings = global.DotsStorage
      ? global.DotsStorage.getSettings()
      : { skin: 'neon', bg: 'midnight', colorBlind: false };
    const bgTheme = global.DotsThemes
      ? global.DotsThemes.getBackground(settings.bg)
      : {
          id: 'midnight',
          boardBg: '#090e1a',
          gridLine: 'rgba(148,163,184,0.16)',
          emptyPulse: 'rgba(56,189,248,0.14)',
          cellTintAlpha: 0.14,
          wallFill: '#1e293b',
          wallStroke: 'rgba(148,163,184,0.42)',
          bridgeDeck: 'rgba(15,23,42,0.96)',
          bridgeRail: '#64748b'
        };
    const skin = settings.skin || 'neon';

    ctx.fillStyle = bgTheme.boardBg;
    ctx.fillRect(0, 0, cssSize, cssSize);

    if (!level) {
      ctx.restore();
      return;
    }

    const N = level.size;
    const occupiedMap = new Map();
    for (let c = 0; c < level.numPairs; c++) {
      const p = paths[c];
      if (p && p.length >= 2) {
        for (let j = 0; j < p.length; j++) {
          const key = p[j].r * N + p[j].c;
          if (!bridgeSet.has(key)) {
            occupiedMap.set(key, c);
          }
        }
      }
    }

    // Soft cell fills & empty-cell hints
    const pulseAlpha = almostWinNotified
      ? 0.5 + 0.5 * Math.sin(performance.now() * 0.006)
      : 0;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const key = r * N + c;
        if (wallSet.has(key)) continue;
        const x = boardX + c * cellSize;
        const y = boardY + r * cellSize;
        const colorIdx = occupiedMap.get(key);
        if (colorIdx !== undefined) {
          const color = global.DotsThemes.getColor(colorIdx, bgTheme.id);
          ctx.fillStyle = hexToRgba(color.hex, bgTheme.cellTintAlpha);
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        } else if (almostWinNotified && !bridgeSet.has(key)) {
          ctx.fillStyle = bgTheme.emptyPulse;
          ctx.globalAlpha = 0.4 + pulseAlpha * 0.6;
          ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Crisp Grid Lines
    ctx.strokeStyle = bgTheme.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const gx = Math.round(boardX + i * cellSize) + 0.5;
      const gy = Math.round(boardY + i * cellSize) + 0.5;
      ctx.moveTo(gx, boardY);
      ctx.lineTo(gx, boardY + boardSize);
      ctx.moveTo(boardX, gy);
      ctx.lineTo(boardX + boardSize, gy);
    }
    ctx.stroke();

    // Draw Wall Blocks
    if (wallSet.size > 0) {
      const inset = Math.max(2, cellSize * 0.1);
      const rad = Math.max(3, cellSize * 0.14);
      level.walls.forEach((w) => {
        const wx = boardX + w.c * cellSize + inset;
        const wy = boardY + w.r * cellSize + inset;
        const ws = cellSize - inset * 2;
        ctx.save();
        ctx.fillStyle = bgTheme.wallFill;
        ctx.strokeStyle = bgTheme.wallStroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(wx, wy, ws, ws, rad);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = bgTheme.wallStroke;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx + ws * 0.28, wy + ws * 0.28);
        ctx.lineTo(wx + ws * 0.72, wy + ws * 0.72);
        ctx.moveTo(wx + ws * 0.72, wy + ws * 0.28);
        ctx.lineTo(wx + ws * 0.28, wy + ws * 0.72);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Draw Base Pipes (underpass pass)
    const pipeWidth = Math.max(1.5, cellSize * (skin === 'minimal' ? 0.13 : 0.2));
    for (let c = 0; c < level.numPairs; c++) {
      const p = paths[c];
      if (!p || p.length < 2) continue;
      const color = global.DotsThemes.getColor(c, bgTheme.id);
      strokePipePath(color, p, skin, pipeWidth);
    }

    // Draw Bridge Overpass Decks & Horizontal Overpass Pipe Segments
    if (bridgeSet.size > 0) {
      level.bridges.forEach((b) => {
        const bx = boardX + b.c * cellSize;
        const by = boardY + b.r * cellSize;
        const deckPadY = cellSize * 0.16;
        const deckH = cellSize - deckPadY * 2;

        ctx.save();
        ctx.fillStyle = bgTheme.bridgeDeck;
        ctx.fillRect(bx + 1, by + deckPadY, cellSize - 2, deckH);

        ctx.strokeStyle = bgTheme.bridgeRail;
        ctx.lineWidth = Math.max(1.5, cellSize * 0.055);
        ctx.beginPath();
        ctx.moveTo(bx + 1, by + deckPadY);
        ctx.lineTo(bx + cellSize - 1, by + deckPadY);
        ctx.moveTo(bx + 1, by + cellSize - deckPadY);
        ctx.lineTo(bx + cellSize - 1, by + cellSize - deckPadY);
        ctx.stroke();
        ctx.restore();
      });

      // Re-stroke horizontal segments crossing bridges so they sit cleanly over the deck
      for (let c = 0; c < level.numPairs; c++) {
        const p = paths[c];
        if (!p || p.length < 2) continue;
        const color = global.DotsThemes.getColor(c, bgTheme.id);
        for (let j = 0; j < p.length; j++) {
          const key = p[j].r * N + p[j].c;
          if (!bridgeSet.has(key)) continue;
          const isHoriz =
            (j > 0 && p[j].r === p[j - 1].r) ||
            (j + 1 < p.length && p[j].r === p[j + 1].r);
          if (isHoriz) {
            const seg = [];
            if (j > 0) seg.push(p[j - 1]);
            seg.push(p[j]);
            if (j + 1 < p.length) seg.push(p[j + 1]);
            if (seg.length >= 2) {
              strokePipePath(color, seg, skin, pipeWidth);
            }
          }
        }
      }
    }

    // Draw Endpoint Dots
    const dotRadius = Math.max(4, cellSize * 0.35);
    for (let c = 0; c < level.numPairs; c++) {
      const ep = level.endpoints[c];
      const color = global.DotsThemes.getColor(c, bgTheme.id);
      const connected = isPairConnected(c);
      const isActive = activeColor === c;
      const isHinted = hintedColors.has(c);
      const pts = [ep.start, ep.end];

      for (let k = 0; k < 2; k++) {
        const pt = pts[k];
        const cx = boardX + (pt.c + 0.5) * cellSize;
        const cy = boardY + (pt.r + 0.5) * cellSize;

        ctx.save();
        if (isActive || connected) {
          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius * (isActive ? 1.32 : 1.18), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(color.hex, isActive ? 0.32 : 0.2);
          ctx.fill();
        }

        if (skin === 'neon') {
          ctx.shadowColor = color.hex;
          ctx.shadowBlur = Math.min(10, Math.max(2, cellSize * 0.22));
        }

        if (skin === 'minimal') {
          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius * 0.92, 0, Math.PI * 2);
          ctx.fillStyle = bgTheme.boardBg;
          ctx.fill();
          ctx.lineWidth = Math.max(2, dotRadius * 0.3);
          ctx.strokeStyle = color.hex;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius * 0.38, 0, Math.PI * 2);
          ctx.fillStyle = color.hex;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = color.hex;
          ctx.fill();

          if (skin === 'glass' || skin === 'classic') {
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(cx - dotRadius * 0.28, cy - dotRadius * 0.28, dotRadius * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.42)';
            ctx.fill();
          }
        }

        if (isHinted) {
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius * 1.16, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (settings.colorBlind) {
          ctx.shadowBlur = 0;
          ctx.font = 'bold ' + Math.max(8, Math.round(dotRadius * 1.12)) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(1.5, dotRadius * 0.24);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeText(color.symbol, cx, cy + 0.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(color.symbol, cx, cy + 0.5);
        }

        ctx.restore();
      }
    }

    // Active drag ring & magnetic live pointer glow
    if (activeColor !== -1 && paths[activeColor] && paths[activeColor].length > 0) {
      const head = paths[activeColor][paths[activeColor].length - 1];
      const color = global.DotsThemes.getColor(activeColor, bgTheme.id);
      const hx = boardX + (head.c + 0.5) * cellSize;
      const hy = boardY + (head.r + 0.5) * cellSize;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, dotRadius * 1.28, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color.light, 0.78);
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (activePointerPos) {
        const dx = activePointerPos.x - hx;
        const dy = activePointerPos.y - hy;
        const dist = Math.hypot(dx, dy);
        const maxR = cellSize * 0.65;
        const px = dist > maxR ? hx + (dx / dist) * maxR : activePointerPos.x;
        const py = dist > maxR ? hy + (dy / dist) * maxR : activePointerPos.y;
        ctx.beginPath();
        ctx.arc(px, py, dotRadius * 0.95, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color.hex, 0.24);
        ctx.fill();
      }
      ctx.restore();
    }

    if (global.DotsEffects && global.DotsEffects.hasActive()) {
      global.DotsEffects.updateAndDraw(ctx, dt || 0.016, cellSize, boardX, boardY);
    }

    ctx.restore();
  }

  global.DotsGame = {
    init,
    loadLevel,
    resizeCanvas,
    render,
    undo,
    clearBoard,
    applyHint,
    getStats,
    getSerializableState
  };
})(window);
