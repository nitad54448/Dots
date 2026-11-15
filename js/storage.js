(function (global) {
  'use strict';

  const PREFIX = 'connect_dots_v1_';

  const DEFAULT_SETTINGS = {
    sound: true,
    haptics: true,
    skin: 'neon',
    bg: 'midnight',
    colorBlind: false
  };

  const DEFAULT_TIER_PROGRESS = {
    currentLevel: 1,
    maxUnlocked: 1,
    stars: {}
  };

  const DEFAULT_DAILY = {
    lastSolvedDate: null,
    streak: 0,
    bestTimeSec: null,
    completedDates: {}
  };

  const DEFAULT_TIMERUSH = {
    bestSolved: 0,
    bestScore: 0
  };

  function safeRead(key, fallback) {
    try {
      const raw = global.localStorage.getItem(PREFIX + key);
      if (raw === null) return clone(fallback);
      const parsed = JSON.parse(raw);
      return parsed !== null && typeof parsed === 'object'
        ? mergeDefaults(fallback, parsed)
        : parsed;
    } catch (_) {
      return clone(fallback);
    }
  }

  function safeWrite(key, value) {
    try {
      global.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (_) {
      // Ignore quota errors in restricted environments
    }
  }

  function clone(val) {
    if (val === null || typeof val !== 'object') return val;
    return JSON.parse(JSON.stringify(val));
  }

  function mergeDefaults(defaults, obj) {
    if (defaults === null || typeof defaults !== 'object' || Array.isArray(defaults)) {
      return obj;
    }
    const out = clone(defaults);
    for (const key of Object.keys(obj)) {
      out[key] = obj[key];
    }
    return out;
  }

  function getSettings() {
    return safeRead('settings', DEFAULT_SETTINGS);
  }

  function saveSettings(partial) {
    const next = Object.assign(getSettings(), partial);
    safeWrite('settings', next);
    return next;
  }

  function getTierProgress(tierId) {
    const progress = safeRead('tier_' + tierId, DEFAULT_TIER_PROGRESS);
    if (!progress.stars || typeof progress.stars !== 'object') {
      progress.stars = {};
    }
    return progress;
  }

  function saveTierProgress(tierId, progress) {
    safeWrite('tier_' + tierId, progress);
  }

  function setTierCurrentLevel(tierId, levelNum, maxLevels) {
    const limit = maxLevels || 5000;
    const prog = getTierProgress(tierId);
    prog.currentLevel = Math.max(1, Math.min(limit, levelNum));
    if (prog.currentLevel > prog.maxUnlocked) {
      prog.maxUnlocked = prog.currentLevel;
    }
    saveTierProgress(tierId, prog);
    return prog;
  }

  function recordTierWin(tierId, levelNum, starsEarned, maxLevels) {
    const limit = maxLevels || 5000;
    const prog = getTierProgress(tierId);
    const prevStars = prog.stars[levelNum] || 0;
    const isFirstClear = prevStars === 0;
    if (starsEarned > prevStars) {
      prog.stars[levelNum] = starsEarned;
    }
    const nextLevel = Math.min(limit, levelNum + 1);
    if (nextLevel > prog.maxUnlocked) {
      prog.maxUnlocked = nextLevel;
    }
    prog.currentLevel = nextLevel;
    saveTierProgress(tierId, prog);

    let bonusHint = false;
    if (isFirstClear) {
      const totalCleared = incrementTotalCleared();
      if (totalCleared % 3 === 0) {
        addHints(1);
        bonusHint = true;
      }
    }
    return { progress: prog, isFirstClear, bonusHint };
  }

  function getTierSummary(tierId) {
    const prog = getTierProgress(tierId);
    const keys = Object.keys(prog.stars);
    let totalStars = 0;
    let perfectCount = 0;
    for (let i = 0; i < keys.length; i++) {
      const s = Number(prog.stars[keys[i]]) || 0;
      totalStars += s;
      if (s === 3) perfectCount++;
    }
    return {
      currentLevel: prog.currentLevel,
      maxUnlocked: prog.maxUnlocked,
      solvedCount: keys.length,
      totalStars: totalStars,
      perfectCount: perfectCount
    };
  }

  function getGlobalStats(tierModes) {
    const modes = tierModes || (global.DotsGenerator ? global.DotsGenerator.getTierModes() : []);
    let totalSolved = 0;
    let totalLevels = 0;
    let totalStars = 0;
    let perfectClears = 0;

    for (let i = 0; i < modes.length; i++) {
      const m = modes[i];
      const sum = getTierSummary(m.id);
      totalSolved += sum.solvedCount;
      totalLevels += m.totalLevels || 5000;
      totalStars += sum.totalStars;
      perfectClears += sum.perfectCount;
    }

    const daily = getDailyState();
    const dailyTotalSolved = Object.keys(daily.completedDates || {}).length;
    const tr = getTimeRushState();

    return {
      totalSolved,
      totalLevels,
      totalStars,
      maxStars: totalLevels * 3,
      perfectClears,
      hints: getHints(),
      dailyStreak: daily.streak || 0,
      dailyBestTimeSec: daily.bestTimeSec,
      dailyTotalSolved,
      timeRushBestSolved: tr.bestSolved || 0,
      timeRushBestScore: tr.bestScore || 0
    };
  }

  function getTotalCleared() {
    try {
      const raw = global.localStorage.getItem(PREFIX + 'total_cleared');
      return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch (_) {
      return 0;
    }
  }

  function incrementTotalCleared() {
    const next = getTotalCleared() + 1;
    try {
      global.localStorage.setItem(PREFIX + 'total_cleared', String(next));
    } catch (_) {}
    return next;
  }

  function getHints() {
    try {
      const raw = global.localStorage.getItem(PREFIX + 'hints');
      if (raw === null) return 5;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 5;
    } catch (_) {
      return 5;
    }
  }

  function setHints(count) {
    const clean = Math.max(0, Math.floor(count));
    try {
      global.localStorage.setItem(PREFIX + 'hints', String(clean));
    } catch (_) {}
    return clean;
  }

  function addHints(delta) {
    return setHints(getHints() + delta);
  }

  function consumeHint() {
    const current = getHints();
    if (current > 0) {
      return { remaining: setHints(current - 1), refilled: false };
    }
    const next = setHints(2);
    return { remaining: next, refilled: true };
  }

  function getDailyState() {
    const state = safeRead('daily', DEFAULT_DAILY);
    if (!state.completedDates || typeof state.completedDates !== 'object') {
      state.completedDates = {};
    }
    return state;
  }

  function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function recordDailyWin(dateStr, moves, timeSec, stars) {
    const state = getDailyState();
    const alreadySolvedToday = Boolean(state.completedDates[dateStr]);

    const prevEntry = state.completedDates[dateStr];
    state.completedDates[dateStr] = {
      moves: prevEntry ? Math.min(prevEntry.moves, moves) : moves,
      timeSec: prevEntry ? Math.min(prevEntry.timeSec, timeSec) : timeSec,
      stars: prevEntry ? Math.max(prevEntry.stars, stars) : stars
    };

    if (!alreadySolvedToday) {
      const yesterday = getYesterdayDateString();
      if (state.lastSolvedDate === yesterday) {
        state.streak = (state.streak || 0) + 1;
      } else if (state.lastSolvedDate !== dateStr) {
        state.streak = 1;
      }
      state.lastSolvedDate = dateStr;
      addHints(1);
    }

    if (state.bestTimeSec === null || timeSec < state.bestTimeSec) {
      state.bestTimeSec = timeSec;
    }

    safeWrite('daily', state);
    return state;
  }

  function getTimeRushState() {
    return safeRead('timerush', DEFAULT_TIMERUSH);
  }

  function recordTimeRushResult(solvedCount, score) {
    const state = getTimeRushState();
    let isNewBest = false;
    if (solvedCount > state.bestSolved) {
      state.bestSolved = solvedCount;
      isNewBest = true;
    }
    if (score > state.bestScore) {
      state.bestScore = score;
      isNewBest = true;
    }
    safeWrite('timerush', state);
    return { state, isNewBest };
  }

  function getSavedBoard(modeId) {
    try {
      const raw = global.localStorage.getItem(PREFIX + 'save_' + modeId);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveBoard(modeId, boardState) {
    if (!boardState) {
      clearSavedBoard(modeId);
      return;
    }
    safeWrite('save_' + modeId, boardState);
  }

  function clearSavedBoard(modeId) {
    try {
      global.localStorage.removeItem(PREFIX + 'save_' + modeId);
    } catch (_) {}
  }

  global.DotsStorage = {
    getSettings,
    saveSettings,
    getTierProgress,
    setTierCurrentLevel,
    recordTierWin,
    getTierSummary,
    getGlobalStats,
    getHints,
    setHints,
    addHints,
    consumeHint,
    getDailyState,
    getTodayDateString,
    recordDailyWin,
    getTimeRushState,
    recordTimeRushResult,
    getSavedBoard,
    saveBoard,
    clearSavedBoard
  };
})(window);
