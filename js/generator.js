(function (global) {
  'use strict';

  const MODES = [
    {
      id: 'beginner',
      name: 'Beginner',
      icon: '🟢',
      subtitle: '7×7 Grid',
      totalLevels: 5000,
      gridSizes: [7],
      minPairs: 6,
      maxPairs: 8
    },
    {
      id: 'intermediate',
      name: 'Intermediate',
      icon: '🔵',
      subtitle: '9×9 Grid',
      totalLevels: 5000,
      gridSizes: [9],
      minPairs: 8,
      maxPairs: 11
    },
    {
      id: 'hard',
      name: 'Hard',
      icon: '🟠',
      subtitle: '15×15 Grid',
      totalLevels: 5000,
      gridSizes: [15],
      minPairs: 15,
      maxPairs: 22
    },
    {
      id: 'extreme',
      name: 'Extreme',
      icon: '🔴',
      subtitle: '17×17 Grid',
      totalLevels: 5000,
      gridSizes: [17],
      minPairs: 18,
      maxPairs: 27
    },
    {
      id: 'insane',
      name: 'Insane',
      icon: '🟣',
      subtitle: '19×19 Grid',
      totalLevels: 5000,
      gridSizes: [19],
      minPairs: 22,
      maxPairs: 32
    },
    {
      id: 'blockade',
      name: 'Blockade',
      icon: '🧱',
      subtitle: '9×9–15×15 Obstacle Grids',
      totalLevels: 5000,
      gridSizes: [9, 11, 13, 15],
      minPairs: 8,
      maxPairs: 22,
      hasWalls: true,
      isTwist: true
    },
    {
      id: 'bridges',
      name: 'Bridges',
      icon: '🌉',
      subtitle: '9×9–13×13 Overpass Grids',
      totalLevels: 5000,
      gridSizes: [9, 11, 13],
      minPairs: 8,
      maxPairs: 20,
      hasBridges: true,
      isTwist: true
    },
    {
      id: 'daily',
      name: 'Daily Puzzle',
      icon: '📅',
      subtitle: 'Fresh 11×11 Challenge Daily',
      isDaily: true,
      gridSizes: [11],
      minPairs: 10,
      maxPairs: 14
    },
    {
      id: 'timerush',
      name: 'Time Rush',
      icon: '⏱️',
      subtitle: '120s Rapid-Fire 7×7–11×11',
      isTimeRush: true,
      gridSizes: [7, 9, 11],
      minPairs: 6,
      maxPairs: 14
    }
  ];

  const DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  function getMode(modeId) {
    return MODES.find((m) => m.id === modeId) || MODES[0];
  }

  function getClassicTierModes() {
    return MODES.filter((m) => !m.isDaily && !m.isTimeRush && !m.isTwist);
  }

  function getTwistModes() {
    return MODES.filter((m) => Boolean(m.isTwist));
  }

  function getTierModes() {
    return MODES.filter((m) => !m.isDaily && !m.isTimeRush);
  }

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function manhattanIdx(a, b, N) {
    return Math.abs(((a / N) | 0) - ((b / N) | 0)) + Math.abs((a % N) - (b % N));
  }

  function pickBoardParams(mode, levelNumber) {
    if (mode.isDaily) {
      return { size: 11, minP: 10, maxP: 14, numWalls: 0, numBridges: 0 };
    }

    if (mode.isTimeRush) {
      if (levelNumber <= 2) return { size: 7, minP: 6, maxP: 8, numWalls: 0, numBridges: 0 };
      if (levelNumber <= 5) return { size: 9, minP: 8, maxP: 11, numWalls: 0, numBridges: 0 };
      return { size: 11, minP: 10, maxP: 14, numWalls: 0, numBridges: 0 };
    }

    if (mode.id === 'blockade') {
      if (levelNumber > 4000) return { size: 15, minP: 15, maxP: 22, numWalls: 6, numBridges: 0 };
      if (levelNumber > 2500) return { size: 13, minP: 12, maxP: 19, numWalls: 5, numBridges: 0 };
      if (levelNumber > 1000) return { size: 11, minP: 10, maxP: 15, numWalls: 4, numBridges: 0 };
      return { size: 9, minP: 8, maxP: 11, numWalls: 3, numBridges: 0 };
    }

    if (mode.id === 'bridges') {
      if (levelNumber > 3500) return { size: 13, minP: 13, maxP: 20, numWalls: 0, numBridges: 2 };
      if (levelNumber > 1500) return { size: 11, minP: 10, maxP: 16, numWalls: 0, numBridges: 2 };
      return { size: 9, minP: 8, maxP: 12, numWalls: 0, numBridges: 2 };
    }

    return {
      size: mode.gridSizes[0],
      minP: mode.minPairs,
      maxP: mode.maxPairs,
      numWalls: 0,
      numBridges: 0
    };
  }

  function countTurnsIdx(seg, N) {
    let turns = 0;
    for (let i = 1; i < seg.length - 1; i++) {
      const r0 = (seg[i - 1] / N) | 0;
      const c0 = seg[i - 1] % N;
      const r1 = (seg[i] / N) | 0;
      const c1 = seg[i] % N;
      const r2 = (seg[i + 1] / N) | 0;
      const c2 = seg[i + 1] % N;
      if (r1 - r0 !== r2 - r1 || c1 - c0 !== c2 - c1) turns++;
    }
    return turns;
  }

  function scoreChordlessSolution(paths, N) {
    let totalTurns = 0;
    let totalDist = 0;
    let totalLen = 0;
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      totalTurns += countTurnsIdx(p, N);
      totalDist += manhattanIdx(p[0], p[p.length - 1], N);
      totalLen += p.length;
    }
    const avgLen = totalLen / paths.length;
    let variance = 0;
    for (let i = 0; i < paths.length; i++) {
      const diff = paths[i].length - avgLen;
      variance += diff * diff;
    }
    return totalTurns * 14 + totalDist * 5 - variance * 0.4;
  }

  function solveChordlessAttempt(N, minP, maxP, numWalls, numBridges, rng, seen, q, stampObj) {
    const total = N * N;
    const cellType = new Uint8Array(total); // 0 normal, 1 wall, 2 bridge
    const walls = [];
    const bridges = [];

    // Place interior bridges (within [2, N-3] for N >= 7, spacing > 3)
    const minMargin = N >= 7 ? 2 : 1;
    const span = Math.max(1, N - minMargin * 2);
    let bTries = 0;
    while (bridges.length < numBridges && bTries++ < 80) {
      const r = minMargin + ((rng() * span) | 0);
      const c = minMargin + ((rng() * span) | 0);
      const idx = r * N + c;
      if (cellType[idx] !== 0) continue;
      let tooClose = false;
      for (let i = 0; i < bridges.length; i++) {
        if (Math.abs(bridges[i].r - r) + Math.abs(bridges[i].c - c) <= 3) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        cellType[idx] = 2;
        bridges.push({ r, c, idx });
      }
    }
    if (bridges.length < numBridges) return null;

    // Place walls away from corners, bridge 4-neighbors, and 8-adjacent wall clusters
    let wTries = 0;
    while (walls.length < numWalls && wTries++ < 120) {
      const r = (rng() * N) | 0;
      const c = (rng() * N) | 0;
      if ((r === 0 || r === N - 1) && (c === 0 || c === N - 1)) continue;
      const idx = r * N + c;
      if (cellType[idx] !== 0) continue;
      let blocked = false;
      for (let i = 0; i < bridges.length; i++) {
        if (Math.abs(bridges[i].r - r) + Math.abs(bridges[i].c - c) <= 1) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        for (let i = 0; i < walls.length; i++) {
          if (Math.abs(walls[i].r - r) <= 1 && Math.abs(walls[i].c - c) <= 1) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked) {
        cellType[idx] = 1;
        walls.push({ r, c, idx });
      }
    }
    if (walls.length < numWalls) return null;

    const grid = new Int16Array(total).fill(-1);
    const bridgeH = new Int16Array(total).fill(-1);
    const bridgeV = new Int16Array(total).fill(-1);
    for (let i = 0; i < walls.length; i++) grid[walls[i].idx] = -2;

    const targetSlots = total - walls.length + bridges.length;
    const maxLen = Math.ceil((targetSlots / minP) * 1.9);
    const targetLen = Math.max(4, Math.round(targetSlots / ((minP + maxP) * 0.5)));

    let filledSlots = 0;
    const paths = [];
    let steps = 0;
    const maxSteps = N >= 17 ? 1100 : N >= 13 ? 900 : 750;

    function isNormalEmpty(idx) {
      return cellType[idx] === 0 && grid[idx] === -1;
    }

    function canEnterFrom(r, c, dr, dc) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) return false;
      const nxt = nr * N + nc;
      if (cellType[nxt] === 1) return false;
      if (cellType[nxt] === 0) return grid[nxt] === -1;

      if (dr !== 0 ? bridgeV[nxt] !== -1 : bridgeH[nxt] !== -1) return false;
      const er = nr + dr;
      const ec = nc + dc;
      if (er < 0 || er >= N || ec < 0 || ec >= N) return false;
      const exitIdx = er * N + ec;
      return cellType[exitIdx] === 0 && grid[exitIdx] === -1;
    }

    function deg(idx) {
      const r = (idx / N) | 0;
      const c = idx % N;
      let d = 0;
      for (let i = 0; i < 4; i++) {
        if (canEnterFrom(r, c, DIRS[i][0], DIRS[i][1])) d++;
      }
      return d;
    }

    function validBoard() {
      for (let i = 0; i < bridges.length; i++) {
        const b = bridges[i];
        if (bridgeV[b.idx] === -1) {
          if (grid[(b.r - 1) * N + b.c] !== -1 || grid[(b.r + 1) * N + b.c] !== -1) {
            return false;
          }
        }
        if (bridgeH[b.idx] === -1) {
          if (grid[b.r * N + (b.c - 1)] !== -1 || grid[b.r * N + (b.c + 1)] !== -1) {
            return false;
          }
        }
      }

      const stamp = ++stampObj.val;
      for (let i = 0; i < total; i++) {
        if (cellType[i] !== 0 || grid[i] !== -1 || seen[i] === stamp) continue;
        let cnt = 0;
        let head = 0;
        let tail = 0;
        q[tail++] = i;
        seen[i] = stamp;

        while (head < tail) {
          const u = q[head++];
          cnt++;
          const ur = (u / N) | 0;
          const uc = u % N;
          for (let d = 0; d < 4; d++) {
            const dr = DIRS[d][0];
            const dc = DIRS[d][1];
            if (!canEnterFrom(ur, uc, dr, dc)) continue;
            const nr = ur + dr;
            const nc = uc + dc;
            const nxt = nr * N + nc;
            const v = cellType[nxt] === 2 ? (nr + dr) * N + (nc + dc) : nxt;
            if (seen[v] !== stamp) {
              seen[v] = stamp;
              q[tail++] = v;
            }
          }
        }
        if (cnt < 3) return false;
      }
      return true;
    }

    function pickStart() {
      // Claim unused bridge approaches early so surrounding cells don't seal them off
      for (let i = 0; i < bridges.length; i++) {
        const b = bridges[i];
        if (bridgeV[b.idx] === -1) {
          const up = (b.r - 1) * N + b.c;
          if (isNormalEmpty(up)) return up;
        }
        if (bridgeH[b.idx] === -1) {
          const lf = b.r * N + (b.c - 1);
          if (isNormalEmpty(lf)) return lf;
        }
      }

      let bestDeg = 99;
      let cands = [];
      for (let i = 0; i < total; i++) {
        if (!isNormalEmpty(i)) continue;
        const d = deg(i);
        if (d === 0) return -1;
        if (d < bestDeg) {
          bestDeg = d;
          cands = [i];
        } else if (d === bestDeg) {
          cands.push(i);
        }
      }
      return cands.length ? cands[(rng() * cands.length) | 0] : -1;
    }

    function violatesChordless(cur, candIdx, prevNormalIdx) {
      const cr = (candIdx / N) | 0;
      const cc = candIdx % N;
      for (let k = 0; k < cur.length; k++) {
        const cell = cur[k];
        if (cell === candIdx) return true;
        if (cell === prevNormalIdx) continue;
        if (cellType[cell] === 0 && cellType[candIdx] === 0) {
          const kr = (cell / N) | 0;
          const kc = cell % N;
          if (Math.abs(kr - cr) + Math.abs(kc - cc) === 1) return true;
        }
      }
      return false;
    }

    function solve() {
      if (++steps > maxSteps) return false;
      if (filledSlots === targetSlots) {
        return paths.length >= minP && paths.length <= maxP;
      }
      if (paths.length >= maxP) return false;
      if (targetSlots - filledSlots > (maxP - paths.length) * maxLen) return false;

      const start = pickStart();
      if (start === -1) return false;

      const pId = paths.length;
      const cur = [start];
      grid[start] = pId;
      filledSlots++;
      paths.push(cur);

      function extend() {
        if (++steps > maxSteps) return false;
        const head = cur[cur.length - 1];
        const hr = (head / N) | 0;
        const hc = head % N;

        const cands = [];
        for (let d = 0; d < 4; d++) {
          const dr = DIRS[d][0];
          const dc = DIRS[d][1];
          if (!canEnterFrom(hr, hc, dr, dc)) continue;
          const nr = hr + dr;
          const nc = hc + dc;
          const nxt = nr * N + nc;
          if (cellType[nxt] === 2) {
            const exitIdx = (nr + dr) * N + (nc + dc);
            if (bridgeH[nxt] !== pId && bridgeV[nxt] !== pId && !violatesChordless(cur, exitIdx, -1)) {
              cands.push({ bridge: nxt, next: exitIdx, vertical: dr !== 0 });
            }
          } else {
            if (!violatesChordless(cur, nxt, head)) {
              cands.push({ bridge: -1, next: nxt, vertical: false });
            }
          }
        }

        for (let i = cands.length - 1; i > 0; i--) {
          const j = (rng() * (i + 1)) | 0;
          const tmp = cands[i];
          cands[i] = cands[j];
          cands[j] = tmp;
        }
        cands.sort(
          (a, b) =>
            (b.bridge !== -1 ? 10 : 0) - (a.bridge !== -1 ? 10 : 0) ||
            deg(a.next) - deg(b.next)
        );

        const distEnd = manhattanIdx(cur[0], head, N);
        if (cur.length >= targetLen && distEnd >= 2 && validBoard() && solve()) {
          return true;
        }

        if (cur.length < maxLen) {
          for (let i = 0; i < cands.length; i++) {
            const mv = cands[i];
            if (mv.bridge !== -1) {
              if (mv.vertical) bridgeV[mv.bridge] = pId;
              else bridgeH[mv.bridge] = pId;
              grid[mv.next] = pId;
              cur.push(mv.bridge, mv.next);
              filledSlots += 2;
              if (extend()) return true;
              filledSlots -= 2;
              cur.pop();
              cur.pop();
              grid[mv.next] = -1;
              if (mv.vertical) bridgeV[mv.bridge] = -1;
              else bridgeH[mv.bridge] = -1;
            } else {
              grid[mv.next] = pId;
              cur.push(mv.next);
              filledSlots++;
              if (extend()) return true;
              filledSlots--;
              cur.pop();
              grid[mv.next] = -1;
            }
          }
        }

        if (cur.length >= 3 && cur.length < targetLen && distEnd >= 2 && validBoard() && solve()) {
          return true;
        }
        return false;
      }

      if (extend()) return true;
      paths.pop();
      filledSlots--;
      grid[start] = -1;
      return false;
    }

    if (!validBoard() || !solve()) return null;
    return {
      paths,
      walls: walls.map((w) => ({ r: w.r, c: w.c })),
      bridges: bridges.map((b) => ({ r: b.r, c: b.c }))
    };
  }

  function fallbackClassicLevel(size, minP, maxP, rng) {
    const path = [];
    for (let r = 0; r < size; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < size; c++) path.push(r * size + c);
      } else {
        for (let c = size - 1; c >= 0; c--) path.push(r * size + c);
      }
    }
    const L = path.length;
    const indexOfCell = new Int32Array(L);
    for (let i = 0; i < L; i++) indexOfCell[path[i]] = i;

    for (let s = 0; s < L * 10; s++) {
      if (rng() < 0.5) {
        path.reverse();
        for (let i = 0; i < L; i++) indexOfCell[path[i]] = i;
      }
      const tail = path[L - 1];
      const tr = (tail / size) | 0;
      const tc = tail % size;
      const cands = [];
      for (let d = 0; d < 4; d++) {
        const nr = tr + DIRS[d][0];
        const nc = tc + DIRS[d][1];
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const idx = indexOfCell[nr * size + nc];
          if (idx < L - 2) cands.push(idx);
        }
      }
      if (!cands.length) continue;
      const cut = cands[(rng() * cands.length) | 0];
      let lo = cut + 1;
      let hi = L - 1;
      while (lo < hi) {
        const tmp = path[lo];
        path[lo] = path[hi];
        path[hi] = tmp;
        indexOfCell[path[lo]] = lo;
        indexOfCell[path[hi]] = hi;
        lo++;
        hi--;
      }
    }

    const numPairs = minP + Math.floor(rng() * Math.max(1, maxP - minP + 1));
    const step = Math.floor(L / numPairs);
    const paths = [];
    let prev = 0;
    for (let i = 1; i < numPairs; i++) {
      paths.push(path.slice(prev, i * step));
      prev = i * step;
    }
    paths.push(path.slice(prev));
    return { paths, walls: [], bridges: [] };
  }

  function generateLevel(modeId, levelNumber, customSeed) {
    const mode = getMode(modeId);
    const seedKey =
      customSeed !== undefined
        ? String(customSeed)
        : mode.id + ':' + String(levelNumber);
    const rng = mulberry32(hashSeed(seedKey));
    const params = pickBoardParams(mode, levelNumber);

    const total = params.size * params.size;
    const seen = new Uint32Array(total);
    const q = new Int16Array(total);
    const stampObj = { val: 1 };

    const maxCandidates =
      params.size <= 9 && params.numWalls === 0 && params.numBridges === 0 ? 2 : 1;
    const maxAttempts = 180;
    const candidates = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const activeBridges =
        params.numBridges > 1 && attempt >= 120 ? params.numBridges - 1 : params.numBridges;
      const activeWalls =
        params.numWalls > 2 && attempt >= 120 ? params.numWalls - 1 : params.numWalls;
      const sol = solveChordlessAttempt(
        params.size,
        params.minP,
        params.maxP,
        activeWalls,
        activeBridges,
        rng,
        seen,
        q,
        stampObj
      );
      if (sol) {
        candidates.push(sol);
        if (candidates.length >= maxCandidates) break;
      }
    }

    let best = null;
    if (candidates.length > 0) {
      let bestScore = -Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const sc = scoreChordlessSolution(candidates[i].paths, params.size);
        if (sc > bestScore) {
          bestScore = sc;
          best = candidates[i];
        }
      }
    } else {
      best = fallbackClassicLevel(params.size, params.minP, params.maxP, rng);
    }

    const numPairs = best.paths.length;
    const colorOrder = [];
    for (let i = 0; i < numPairs; i++) colorOrder.push(i);
    for (let i = colorOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = colorOrder[i];
      colorOrder[i] = colorOrder[j];
      colorOrder[j] = tmp;
    }

    const solutionPaths = new Array(numPairs);
    const endpoints = new Array(numPairs);

    for (let i = 0; i < numPairs; i++) {
      const seg = best.paths[i].map((idx) => ({
        r: (idx / params.size) | 0,
        c: idx % params.size
      }));
      const colorIdx = colorOrder[i];
      solutionPaths[colorIdx] = seg;
      endpoints[colorIdx] = {
        color: colorIdx,
        start: { r: seg[0].r, c: seg[0].c },
        end: { r: seg[seg.length - 1].r, c: seg[seg.length - 1].c }
      };
    }

    return {
      modeId: mode.id,
      levelNumber: levelNumber,
      size: params.size,
      numPairs: numPairs,
      endpoints: endpoints,
      solutionPaths: solutionPaths,
      walls: best.walls || [],
      bridges: best.bridges || []
    };
  }

  global.DotsGenerator = {
    MODES,
    getMode,
    getClassicTierModes,
    getTwistModes,
    getTierModes,
    generateLevel
  };
})(window);
