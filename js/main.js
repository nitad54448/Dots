(function (global) {
  'use strict';

  const HELP_SECTIONS = [
    {
      id: 'rules',
      label: 'Core Rules',
      title: 'Connect Every Matching Pair',
      bullets: [
        'Touch or drag from any colored dot to its matching partner horizontally or vertically.',
        'Normal squares hold only one pipe — crossing another color cuts it (right-click clears a pipe on desktop).',
        'Bridges (🌉): Pipes pass straight across bridges horizontally or vertically without cutting perpendicular pipes!',
        'Win by linking all pairs AND filling 100% of every playable square.'
      ]
    },
    {
      id: 'modes',
      label: 'Game Modes',
      title: '35,000+ Levels & Twists',
      bullets: [
        '5 Classic Tiers: Beginner (7×7), Intermediate (9×9), Hard (15×15), Extreme (17×17), and Insane (19×19) — 5,000 levels each.',
        'Twist Modes: Blockade (🧱 9×9–15×15 obstacle tiles) and Bridges (🌉 9×9–13×13 dual-layer overpasses), 5,000 levels each.',
        'Daily Puzzle & Time Rush: Fresh daily 11×11 grid with streak tracking, plus a 120s rapid-fire Time Rush arcade mode.'
      ]
    },
    {
      id: 'tools',
      label: 'Controls',
      title: 'Tools, Feedback & Keys',
      bullets: [
        '💡 Hint: Solves one color pipe and locks it against accidental cuts (tap its dot to override).',
        '↶ Undo: Step backward through drags and cuts.',
        'Windows Keyboard Shortcuts: Z (Undo), H (Hint), R (Clear), ← / → (Prev/Next Level), Enter (Next on Win), Esc (Close/Home).'
      ]
    }
  ];

  let activeModeId = 'beginner';
  let activeLevelNum = 1;
  let activeLevel = null;
  let levelSelectorModeId = 'beginner';
  let levelChapterStart = 1;
  let levelRangeStart = 1;
  let activeHelpId = 'rules';

  let dailyElapsedSec = 0;
  let timeRushRemainingSec = 120;
  let timeRushSolved = 0;
  let timeRushScore = 0;
  let timerIntervalId = null;
  let deferredInstallPrompt = null;
  let bannerTimerId = null;

  const $ = (id) => document.getElementById(id);

  function init() {
    applySavedSettings();
    setupGameEngine();
    bindUIEvents();
    registerServiceWorker();
    renderHub();
    renderThemesModal();
    renderHelpModal();
  }

  function applySavedSettings() {
    const settings = DotsStorage.getSettings();
    DotsThemes.applyTheme(settings);
    updateSoundButtons(settings.sound);
    updateSkinBadge(settings);
  }

  function updateSoundButtons(soundOn) {
    const icon = soundOn ? '🔊' : '🔇';
    if ($('hub-btn-sound')) $('hub-btn-sound').textContent = icon;
    if ($('game-btn-sound')) $('game-btn-sound').textContent = icon;
  }

  function updateSkinBadge(settings) {
    const skin = DotsThemes.getSkin(settings.skin);
    const bg = DotsThemes.getBackground(settings.bg);
    const badge = $('hub-skin-badge');
    if (badge) {
      badge.textContent = skin.name + ' • ' + bg.name.split(' ')[0];
    }
  }

  function setupGameEngine() {
    DotsGame.init($('game-canvas'), $('board-wrap'), {
      onStatsChange: handleStatsChange,
      onLevelComplete: handleLevelComplete,
      onShowBanner: showBanner
    });
  }

  function showBanner(text, ms) {
    const el = $('mode-banner');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    if (bannerTimerId) clearTimeout(bannerTimerId);
    bannerTimerId = setTimeout(() => {
      el.classList.remove('visible');
    }, ms || 2400);
  }

  function hideBanner() {
    const el = $('mode-banner');
    if (el) el.classList.remove('visible');
    if (bannerTimerId) {
      clearTimeout(bannerTimerId);
      bannerTimerId = null;
    }
  }

  function stopTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return mm + ':' + ss;
  }

  function startModeTimer() {
    stopTimer();
    const mode = DotsGenerator.getMode(activeModeId);
    if (mode.isDaily) {
      timerIntervalId = setInterval(() => {
        dailyElapsedSec++;
        updateMoveOrTimerCard();
      }, 1000);
    } else if (mode.isTimeRush) {
      timerIntervalId = setInterval(() => {
        timeRushRemainingSec--;
        updateMoveOrTimerCard();
        if (timeRushRemainingSec <= 0) {
          stopTimer();
          handleTimeRushEnd();
        }
      }, 1000);
    }
  }

  function updateMoveOrTimerCard() {
    const mode = DotsGenerator.getMode(activeModeId);
    const card = $('card-moves');
    const lbl = $('stat-moves-label');
    const val = $('stat-moves-val');
    if (!card || !lbl || !val) return;

    if (mode.isTimeRush) {
      lbl.textContent = 'Time';
      val.textContent = formatTime(timeRushRemainingSec);
      card.classList.toggle('timer-warn', timeRushRemainingSec <= 15);
    } else if (mode.isDaily) {
      lbl.textContent = 'Time';
      val.textContent = formatTime(dailyElapsedSec);
      card.classList.remove('timer-warn');
    } else {
      lbl.textContent = 'Moves';
      const stats = DotsGame.getStats();
      val.textContent = String(stats.moves);
      card.classList.remove('timer-warn');
    }
  }

  function handleStatsChange(stats, serializable) {
    const mode = DotsGenerator.getMode(activeModeId);
    if (mode.isTimeRush) {
      $('stat-pairs-label').textContent = 'Solved';
      $('stat-pairs-val').textContent = String(timeRushSolved);
    } else {
      $('stat-pairs-label').textContent = 'Pairs';
      $('stat-pairs-val').textContent = stats.connectedPairs + '/' + stats.totalPairs;
    }

    $('stat-pipe-val').textContent = stats.coveragePct + '%';
    $('card-pipe').classList.toggle('highlight', stats.coveragePct === 100);
    $('card-pairs').classList.toggle(
      'highlight',
      !mode.isTimeRush && stats.connectedPairs === stats.totalPairs
    );

    const covFill = $('coverage-bar-fill');
    if (covFill) {
      covFill.style.width = stats.coveragePct + '%';
      covFill.classList.toggle('complete', stats.coveragePct === 100);
    }

    updateMoveOrTimerCard();

    $('hint-count').textContent = String(DotsStorage.getHints());
    $('undo-count').textContent = String(stats.undoCount);
    $('btn-undo').disabled = stats.undoCount === 0;

    if (!mode.isTimeRush && serializable) {
      const saveKey = mode.isDaily ? 'daily_' + DotsStorage.getTodayDateString() : mode.id;
      const hasAnyPipe = serializable.paths.some((p) => p.length > 0);
      if (hasAnyPipe && !stats.isSolved) {
        if (mode.isDaily) serializable.elapsedSec = dailyElapsedSec;
        DotsStorage.saveBoard(saveKey, serializable);
      } else if (!hasAnyPipe) {
        DotsStorage.clearSavedBoard(saveKey);
      }
    }
  }

  function startLevel(modeId, levelNum, forceFresh) {
    activeModeId = modeId;
    const mode = DotsGenerator.getMode(modeId);
    hideBanner();
    stopTimer();

    if (mode.isDaily) {
      const today = DotsStorage.getTodayDateString();
      activeLevelNum = 1;
      activeLevel = DotsGenerator.generateLevel('daily', 1, 'daily_' + today);
      const saved = forceFresh ? null : DotsStorage.getSavedBoard('daily_' + today);
      dailyElapsedSec = saved && saved.elapsedSec ? saved.elapsedSec : 0;
      DotsGame.loadLevel(activeLevel, saved);
      startModeTimer();
    } else if (mode.isTimeRush) {
      if (forceFresh || timeRushRemainingSec <= 0) {
        timeRushRemainingSec = 120;
        timeRushSolved = 0;
        timeRushScore = 0;
      }
      activeLevelNum = levelNum || 1;
      const runSeed = 'timerush_' + Date.now() + '_' + activeLevelNum;
      activeLevel = DotsGenerator.generateLevel('timerush', activeLevelNum, runSeed);
      DotsGame.loadLevel(activeLevel, null);
      startModeTimer();
    } else {
      activeLevelNum = Math.max(1, Math.min(mode.totalLevels, levelNum || 1));
      DotsStorage.setTierCurrentLevel(modeId, activeLevelNum, mode.totalLevels);
      activeLevel = DotsGenerator.generateLevel(modeId, activeLevelNum);
      const saved = forceFresh ? null : DotsStorage.getSavedBoard(modeId);
      const matchingSave = saved && saved.levelNum === activeLevelNum ? saved : null;
      DotsGame.loadLevel(activeLevel, matchingSave);
    }

    updateGameChrome();
    showScreen('game');
    setTimeout(() => DotsGame.resizeCanvas(), 20);
  }

  function updateGameChrome() {
    const mode = DotsGenerator.getMode(activeModeId);
    const prevBtn = $('btn-prev-level');
    const nextBtn = $('btn-next-level');
    const levelsLabel = $('btn-levels-label');
    const hintBtn = $('btn-hint');

    if (mode.isDaily) {
      $('active-mode-badge').textContent =
        '📅 Daily • ' + DotsStorage.getTodayDateString();
      prevBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
      levelsLabel.textContent = '📅 Today';
      $('btn-levels').disabled = true;
      hintBtn.disabled = false;
    } else if (mode.isTimeRush) {
      $('active-mode-badge').textContent =
        '⏱️ Time Rush • #' + activeLevelNum + ' (' + activeLevel.size + '×' + activeLevel.size + ')';
      prevBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
      levelsLabel.textContent = '⏭ Skip';
      $('btn-levels').disabled = false;
      hintBtn.disabled = false;
    } else {
      $('active-mode-badge').textContent =
        mode.icon + ' ' + mode.name + ' • Lv. ' + activeLevelNum;
      prevBtn.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
      prevBtn.disabled = activeLevelNum <= 1;
      nextBtn.disabled = activeLevelNum >= mode.totalLevels;
      levelsLabel.textContent = '🔢 Levels';
      $('btn-levels').disabled = false;
      hintBtn.disabled = false;
    }
    $('hint-count').textContent = String(DotsStorage.getHints());
    updateMoveOrTimerCard();
  }

  function handleLevelComplete(result) {
    const mode = DotsGenerator.getMode(activeModeId);

    if (mode.isTimeRush) {
      timeRushSolved++;
      timeRushScore += activeLevel.size * 20 + result.stars * 10;
      timeRushRemainingSec = Math.min(150, timeRushRemainingSec + 12);
      showBanner('+12s Bonus! Board #' + timeRushSolved + ' Solved!', 1400);
      setTimeout(() => {
        if (timeRushRemainingSec > 0 && !$('game-screen').classList.contains('hidden')) {
          activeLevelNum++;
          const runSeed = 'timerush_' + Date.now() + '_' + activeLevelNum;
          activeLevel = DotsGenerator.generateLevel('timerush', activeLevelNum, runSeed);
          DotsGame.loadLevel(activeLevel, null);
          updateGameChrome();
        }
      }, 420);
      return;
    }

    stopTimer();

    if (mode.isDaily) {
      const today = DotsStorage.getTodayDateString();
      DotsStorage.clearSavedBoard('daily_' + today);
      const dailyState = DotsStorage.recordDailyWin(
        today,
        result.moves,
        dailyElapsedSec,
        result.stars
      );
      openWinModal({
        badge: '★ DAILY PUZZLE SOLVED ★',
        stars: result.stars,
        title: 'Daily Complete!',
        sub: 'Streak: ' + dailyState.streak + ' day(s). +1 Bonus Hint earned!',
        stats: [
          { lbl: 'Time', val: formatTime(dailyElapsedSec) },
          { lbl: 'Moves', val: String(result.moves) },
          { lbl: 'Streak', val: dailyState.streak + '🔥' }
        ],
        nextLabel: 'Play Beginner ▶',
        isDaily: true
      });
      return;
    }

    DotsStorage.clearSavedBoard(mode.id);
    const winRecord = DotsStorage.recordTierWin(
      mode.id,
      activeLevelNum,
      result.stars,
      mode.totalLevels
    );
    const bonusMsg = winRecord.bonusHint ? ' +1 Bonus Hint unlocked!' : '';

    openWinModal({
      badge: '★ LEVEL ' + activeLevelNum + ' COMPLETE ★',
      stars: result.stars,
      title: result.stars === 3 ? 'Flawless Flow!' : 'Puzzle Solved!',
      sub: 'All pairs connected and 100% of the grid covered.' + bonusMsg,
      stats: [
        { lbl: 'Moves', val: String(result.moves) },
        { lbl: 'Pipe', val: '100%' },
        { lbl: 'Grid', val: activeLevel.size + '×' + activeLevel.size }
      ],
      nextLabel:
        activeLevelNum < mode.totalLevels
          ? 'Next Level (' + (activeLevelNum + 1) + ') ▶'
          : 'Back to Hub ⌂',
      isDaily: false
    });
  }

  function handleTimeRushEnd() {
    const res = DotsStorage.recordTimeRushResult(timeRushSolved, timeRushScore);
    openWinModal({
      badge: res.isNewBest ? '★ NEW TIME RUSH RECORD ★' : '⏱ TIME IS UP',
      stars: timeRushSolved >= 5 ? 3 : timeRushSolved >= 2 ? 2 : 1,
      title: 'Time Rush Finished!',
      sub:
        'You cleared ' +
        timeRushSolved +
        ' board' +
        (timeRushSolved === 1 ? '' : 's') +
        ' in 120 seconds.',
      stats: [
        { lbl: 'Cleared', val: String(timeRushSolved) },
        { lbl: 'Score', val: String(timeRushScore) },
        { lbl: 'Best', val: String(res.state.bestSolved) }
      ],
      nextLabel: 'Play Again ↻',
      isTimeRushEnd: true
    });
  }

  function openWinModal(cfg) {
    $('win-badge').textContent = cfg.badge;
    const filled = '★'.repeat(cfg.stars);
    const empty = '☆'.repeat(3 - cfg.stars);
    $('win-stars').textContent = (filled + empty).split('').join(' ');
    $('win-title').textContent = cfg.title;
    $('win-sub').textContent = cfg.sub;

    $('win-stat-1-lbl').textContent = cfg.stats[0].lbl;
    $('win-stat-1-val').textContent = cfg.stats[0].val;
    $('win-stat-2-lbl').textContent = cfg.stats[1].lbl;
    $('win-stat-2-val').textContent = cfg.stats[1].val;
    $('win-stat-3-lbl').textContent = cfg.stats[2].lbl;
    $('win-stat-3-val').textContent = cfg.stats[2].val;

    $('btn-win-next').textContent = cfg.nextLabel;
    $('btn-win-next').dataset.action = cfg.isTimeRushEnd
      ? 'timerush-retry'
      : cfg.isDaily
        ? 'daily-next'
        : 'tier-next';

    openModal('win-modal');
  }

  function showScreen(name) {
    if (name === 'hub') {
      stopTimer();
      $('game-screen').classList.add('hidden');
      $('hub-screen').classList.remove('hidden');
      renderHub();
    } else {
      $('hub-screen').classList.add('hidden');
      $('game-screen').classList.remove('hidden');
    }
  }

  function renderHub() {
    renderFeaturedModes();
    renderCampaignSection(DotsGenerator.getTwistModes(), $('twist-grid'));
    renderCampaignSection(DotsGenerator.getClassicTierModes(), $('mode-grid'));

    const allCampaign = DotsGenerator.getTierModes();
    let totalStars = 0;
    let totalSolved = 0;
    allCampaign.forEach((t) => {
      const s = DotsStorage.getTierSummary(t.id);
      totalStars += s.totalStars;
      totalSolved += s.solvedCount;
    });
    $('hub-total-badge').textContent = '★ ' + totalStars + ' • ' + totalSolved + ' Solved';

    const twistModes = DotsGenerator.getTwistModes();
    let twistSolved = 0;
    let twistTotal = 0;
    twistModes.forEach((t) => {
      twistSolved += DotsStorage.getTierSummary(t.id).solvedCount;
      twistTotal += t.totalLevels;
    });
    if ($('hub-twist-badge')) {
      $('hub-twist-badge').textContent = twistSolved + ' / ' + twistTotal + ' Solved';
    }
  }

  function renderFeaturedModes() {
    const grid = $('featured-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const today = DotsStorage.getTodayDateString();
    const daily = DotsStorage.getDailyState();
    const solvedToday = Boolean(daily.completedDates[today]);
    const hasDailySave = Boolean(DotsStorage.getSavedBoard('daily_' + today));

    const dailyCard = document.createElement('article');
    dailyCard.className = 'mode-card' + (hasDailySave && !solvedToday ? ' has-save' : '');
    dailyCard.innerHTML =
      '<div class="mode-card-top">' +
      '  <div style="display:flex;gap:10px;align-items:center;">' +
      '    <div class="mode-emblem">📅</div>' +
      '    <div class="mode-info">' +
      '      <h2>Daily Puzzle</h2>' +
      '      <p>Fresh 11×11 grid • ' + today + '</p>' +
      '    </div>' +
      '  </div>' +
      (solvedToday
        ? '<span class="mode-save-tag">Solved ✓</span>'
        : hasDailySave
          ? '<span class="mode-save-tag">Saved</span>'
          : '') +
      '</div>' +
      '<div class="mode-stats">' +
      '  <div class="mode-stat-pill"><span class="lbl">Streak</span><span class="val gold">' + (daily.streak || 0) + ' Days</span></div>' +
      '  <div class="mode-stat-pill"><span class="lbl">Best Time</span><span class="val">' + (daily.bestTimeSec !== null ? formatTime(daily.bestTimeSec) : '--:--') + '</span></div>' +
      '</div>' +
      '<div class="mode-actions">' +
      '  <button class="mode-play-btn" type="button" data-play-daily="1">' +
      (solvedToday ? 'Replay Today' : hasDailySave ? 'Resume Daily' : 'Play Today') +
      '  </button>' +
      '</div>';
    grid.appendChild(dailyCard);

    const tr = DotsStorage.getTimeRushState();
    const trCard = document.createElement('article');
    trCard.className = 'mode-card';
    trCard.innerHTML =
      '<div class="mode-card-top">' +
      '  <div style="display:flex;gap:10px;align-items:center;">' +
      '    <div class="mode-emblem">⏱️</div>' +
      '    <div class="mode-info">' +
      '      <h2>Time Rush</h2>' +
      '      <p>Solve rapid-fire grids in 120s</p>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="mode-stats">' +
      '  <div class="mode-stat-pill"><span class="lbl">Best Boards</span><span class="val gold">' + (tr.bestSolved || 0) + '</span></div>' +
      '  <div class="mode-stat-pill"><span class="lbl">High Score</span><span class="val">' + (tr.bestScore || 0) + '</span></div>' +
      '</div>' +
      '<div class="mode-actions">' +
      '  <button class="mode-play-btn" type="button" data-play-timerush="1">Start 120s Rush</button>' +
      '</div>';
    grid.appendChild(trCard);

    grid.querySelector('[data-play-daily]').addEventListener('click', () => {
      startLevel('daily', 1, solvedToday);
    });
    grid.querySelector('[data-play-timerush]').addEventListener('click', () => {
      timeRushRemainingSec = 120;
      startLevel('timerush', 1, true);
    });
  }

  function renderCampaignSection(modesList, grid) {
    if (!grid) return;
    grid.innerHTML = '';

    modesList.forEach((tier) => {
      const sum = DotsStorage.getTierSummary(tier.id);
      const saved = DotsStorage.getSavedBoard(tier.id);
      const hasSave = Boolean(saved && saved.levelNum === sum.currentLevel);
      const pct = Math.min(100, (sum.solvedCount / tier.totalLevels) * 100);

      const card = document.createElement('article');
      card.className = 'mode-card' + (hasSave ? ' has-save' : '');
      card.innerHTML =
        '<div class="mode-card-top">' +
        '  <div style="display:flex;gap:10px;align-items:center;">' +
        '    <div class="mode-emblem">' + tier.icon + '</div>' +
        '    <div class="mode-info">' +
        '      <h2>' + tier.name + '</h2>' +
        '      <p>' + tier.subtitle + '</p>' +
        '    </div>' +
        '  </div>' +
        (hasSave ? '<span class="mode-save-tag">Saved</span>' : '') +
        '</div>' +
        '<div class="mode-stats">' +
        '  <div class="mode-stat-pill"><span class="lbl">Solved</span><span class="val">' + sum.solvedCount + '/' + tier.totalLevels + '</span></div>' +
        '  <div class="mode-stat-pill"><span class="lbl">Stars</span><span class="val gold">★ ' + sum.totalStars + '</span></div>' +
        '  <div class="mode-stat-pill"><span class="lbl">Current</span><span class="val">Lv. ' + sum.currentLevel + '</span></div>' +
        '</div>' +
        '<div class="card-prog-track"><div class="card-prog-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="mode-actions">' +
        '  <button class="mode-play-btn" type="button" data-tier-play="' + tier.id + '">' +
        (hasSave ? 'Resume Lv. ' + sum.currentLevel : 'Play Lv. ' + sum.currentLevel) +
        '  </button>' +
        '  <button class="mode-new-btn" type="button" data-tier-levels="' + tier.id + '" title="Select Level" aria-label="Select Level">🔢</button>' +
        '</div>';
      grid.appendChild(card);

      card.querySelector('[data-tier-play]').addEventListener('click', () => {
        startLevel(tier.id, sum.currentLevel, false);
      });
      card.querySelector('[data-tier-levels]').addEventListener('click', () => {
        openLevelSelector(tier.id);
      });
    });
  }

  function openLevelSelector(tierId) {
    levelSelectorModeId = tierId;
    const mode = DotsGenerator.getMode(tierId);
    const progress = DotsStorage.getTierProgress(tierId);
    $('levels-modal-title').textContent = mode.icon + ' ' + mode.name + ' Levels';
    const jumpInput = $('jump-level-input');
    jumpInput.max = String(mode.totalLevels);
    jumpInput.placeholder = 'Jump to level (1–' + mode.totalLevels + ')';
    jumpInput.value = String(progress.currentLevel);

    const chapterIdx = Math.floor((progress.currentLevel - 1) / 500);
    levelChapterStart = chapterIdx * 500 + 1;
    const blockIdx = Math.floor((progress.currentLevel - 1) / 100);
    levelRangeStart = blockIdx * 100 + 1;
    renderLevelSelectorBody();
    openModal('levels-modal');
  }

  function renderLevelSelectorBody() {
    const mode = DotsGenerator.getMode(levelSelectorModeId);
    const progress = DotsStorage.getTierProgress(levelSelectorModeId);
    const chaptersEl = $('level-chapter-tabs');
    const tabsEl = $('level-range-tabs');
    const gridEl = $('level-grid');

    if (chaptersEl) {
      chaptersEl.innerHTML = '';
      for (let chStart = 1; chStart <= mode.totalLevels; chStart += 500) {
        const chEnd = Math.min(mode.totalLevels, chStart + 499);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'range-tab' + (chStart === levelChapterStart ? ' active' : '');
        btn.textContent = chStart + '–' + chEnd;
        btn.addEventListener('click', () => {
          levelChapterStart = chStart;
          levelRangeStart = chStart;
          renderLevelSelectorBody();
        });
        chaptersEl.appendChild(btn);
      }
    }

    tabsEl.innerHTML = '';
    const chapterEnd = Math.min(mode.totalLevels, levelChapterStart + 499);
    for (let start = levelChapterStart; start <= chapterEnd; start += 100) {
      const end = Math.min(chapterEnd, start + 99);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'range-tab' + (start === levelRangeStart ? ' active' : '');
      btn.textContent = start + '–' + end;
      btn.addEventListener('click', () => {
        levelRangeStart = start;
        renderLevelSelectorBody();
      });
      tabsEl.appendChild(btn);
    }

    gridEl.innerHTML = '';
    const endRange = Math.min(mode.totalLevels, levelRangeStart + 99);
    for (let lv = levelRangeStart; lv <= endRange; lv++) {
      const stars = progress.stars[lv] || 0;
      const isCurrent = lv === progress.currentLevel;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className =
        'level-tile' +
        (stars > 0 ? ' solved' : '') +
        (isCurrent ? ' current' : '');
      const starText = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '☆☆☆';
      tile.innerHTML =
        '<span class="lvl-num">' + lv + '</span>' +
        '<span class="lvl-stars' + (stars === 0 ? ' empty' : '') + '">' + starText + '</span>';
      tile.addEventListener('click', () => {
        closeModal('levels-modal');
        startLevel(levelSelectorModeId, lv, false);
      });
      gridEl.appendChild(tile);
    }
  }

  function renderThemesModal() {
    const settings = DotsStorage.getSettings();
    const skinWrap = $('skin-choices');
    const bgWrap = $('bg-choices');

    skinWrap.innerHTML = '';
    DotsThemes.SKINS.forEach((skin) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-card' + (settings.skin === skin.id ? ' selected' : '');
      btn.innerHTML =
        '<span class="swatch" style="background:' + skin.swatch + '"></span>' +
        '<span><div class="name">' + skin.name + '</div><div class="desc">' + skin.desc + '</div></span>';
      btn.addEventListener('click', () => {
        const next = DotsStorage.saveSettings({ skin: skin.id });
        updateSkinBadge(next);
        renderThemesModal();
        DotsGame.render();
      });
      skinWrap.appendChild(btn);
    });

    bgWrap.innerHTML = '';
    DotsThemes.BACKGROUNDS.forEach((bg) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-card' + (settings.bg === bg.id ? ' selected' : '');
      btn.innerHTML =
        '<span class="swatch" style="background:' + bg.swatch + '"></span>' +
        '<span><div class="name">' + bg.name + '</div><div class="desc">' + bg.desc + '</div></span>';
      btn.addEventListener('click', () => {
        const next = DotsStorage.saveSettings({ bg: bg.id });
        DotsThemes.applyTheme(next);
        updateSkinBadge(next);
        renderThemesModal();
        DotsGame.render();
      });
      bgWrap.appendChild(btn);
    });

    const cbBtn = $('btn-toggle-colorblind');
    const cbPill = $('colorblind-pill');
    if (cbBtn && cbPill) {
      cbBtn.classList.toggle('active', Boolean(settings.colorBlind));
      cbPill.textContent = settings.colorBlind ? 'ON' : 'OFF';
    }

    const hapBtn = $('btn-toggle-haptics');
    const hapPill = $('haptics-pill');
    if (hapBtn && hapPill) {
      const hapOn = settings.haptics !== false;
      hapBtn.classList.toggle('active', hapOn);
      hapPill.textContent = hapOn ? 'ON' : 'OFF';
    }
  }

  function renderStatsModal() {
    const campaignModes = DotsGenerator.getTierModes();
    const gs = DotsStorage.getGlobalStats(campaignModes);
    const summaryEl = $('stats-summary-grid');
    const listEl = $('stats-mode-list');
    if (!summaryEl || !listEl) return;

    summaryEl.innerHTML =
      '<div class="stats-box"><span class="lbl">Levels Solved</span><span class="val">' + gs.totalSolved + ' / ' + gs.totalLevels + '</span></div>' +
      '<div class="stats-box"><span class="lbl">Total Stars</span><span class="val" style="color:var(--gold);">★ ' + gs.totalStars + '</span></div>' +
      '<div class="stats-box"><span class="lbl">★★★ Perfects</span><span class="val" style="color:var(--success);">' + gs.perfectClears + '</span></div>' +
      '<div class="stats-box"><span class="lbl">Daily Streak</span><span class="val">' + gs.dailyStreak + ' 🔥 (' + gs.dailyTotalSolved + ' total)</span></div>' +
      '<div class="stats-box"><span class="lbl">Time Rush Best</span><span class="val">' + gs.timeRushBestSolved + ' Boards</span></div>' +
      '<div class="stats-box"><span class="lbl">Available Hints</span><span class="val" style="color:var(--accent);">💡 ' + gs.hints + '</span></div>';

    listEl.innerHTML = '';
    campaignModes.forEach((m) => {
      const sum = DotsStorage.getTierSummary(m.id);
      const pct = Math.min(100, (sum.solvedCount / m.totalLevels) * 100);
      const row = document.createElement('div');
      row.className = 'stats-mode-row';
      row.innerHTML =
        '<div class="stats-mode-head">' +
        '  <span>' + m.icon + ' ' + m.name + '</span>' +
        '  <span style="color:var(--muted);">' + sum.solvedCount + '/' + m.totalLevels + ' • ★ ' + sum.totalStars + '</span>' +
        '</div>' +
        '<div class="card-prog-track"><div class="card-prog-fill" style="width:' + pct.toFixed(1) + '%"></div></div>';
      listEl.appendChild(row);
    });
  }

  function renderHelpModal() {
    const tabsEl = $('help-tabs');
    const bodyEl = $('help-body');
    if (!tabsEl || !bodyEl) return;

    tabsEl.innerHTML = '';
    HELP_SECTIONS.forEach((sec) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'help-tab' + (sec.id === activeHelpId ? ' active' : '');
      btn.textContent = sec.label;
      btn.addEventListener('click', () => {
        activeHelpId = sec.id;
        renderHelpModal();
      });
      tabsEl.appendChild(btn);
    });

    const current = HELP_SECTIONS.find((s) => s.id === activeHelpId) || HELP_SECTIONS[0];
    bodyEl.innerHTML =
      '<h3>' + current.title + '</h3>' +
      '<ul>' + current.bullets.map((b) => '<li>' + b + '</li>').join('') + '</ul>';
  }

  function openModal(id) {
    const el = $(id);
    if (el) el.classList.add('open');
  }

  function closeModal(id) {
    const el = $(id);
    if (el) el.classList.remove('open');
  }

  function toggleSound() {
    const cur = DotsStorage.getSettings();
    const next = DotsStorage.saveSettings({ sound: !cur.sound });
    updateSoundButtons(next.sound);
  }

  function isStandaloneApp() {
    const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
    if (typeof global.matchMedia === 'function') {
      for (let i = 0; i < modes.length; i++) {
        try {
          if (global.matchMedia('(display-mode: ' + modes[i] + ')').matches) {
            return true;
          }
        } catch (_) {}
      }
    }
    if (global.navigator && global.navigator.standalone === true) {
      return true;
    }
    if (document.referrer && document.referrer.indexOf('android-app://') === 0) {
      return true;
    }
    return false;
  }

  function removeInstallButton() {
    deferredInstallPrompt = null;
    const btn = $('hub-btn-install');
    if (btn) btn.remove();
  }

  function setupAppInstall() {
    if (isStandaloneApp()) {
      removeInstallButton();
      return;
    }

    if (typeof global.matchMedia === 'function') {
      try {
        const mq = global.matchMedia('(display-mode: standalone)');
        const onDisplayModeChange = (ev) => {
          if (ev.matches || isStandaloneApp()) {
            removeInstallButton();
          }
        };
        if (typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', onDisplayModeChange);
        } else if (typeof mq.addListener === 'function') {
          mq.addListener(onDisplayModeChange);
        }
      } catch (_) {}
    }

    global.addEventListener('beforeinstallprompt', (e) => {
      if (isStandaloneApp()) return;
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = $('hub-btn-install');
      if (btn) btn.classList.remove('hidden');
    });

    const installBtn = $('hub-btn-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        let outcome = 'dismissed';
        try {
          const choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome) outcome = choice.outcome;
        } catch (_) {}
        deferredInstallPrompt = null;
        if (outcome === 'accepted') {
          removeInstallButton();
        } else {
          const btn = $('hub-btn-install');
          if (btn) btn.classList.add('hidden');
        }
      });
    }

    global.addEventListener('appinstalled', () => {
      removeInstallButton();
    });
  }

  function bindUIEvents() {
    $('hub-btn-themes').addEventListener('click', () => {
      renderThemesModal();
      openModal('themes-modal');
    });
    $('game-btn-themes').addEventListener('click', () => {
      renderThemesModal();
      openModal('themes-modal');
    });

    if ($('hub-btn-stats')) {
      $('hub-btn-stats').addEventListener('click', () => {
        renderStatsModal();
        openModal('stats-modal');
      });
    }

    $('hub-btn-help').addEventListener('click', () => openModal('help-modal'));
    $('game-btn-help').addEventListener('click', () => openModal('help-modal'));

    $('hub-btn-sound').addEventListener('click', toggleSound);
    $('game-btn-sound').addEventListener('click', toggleSound);

    $('btn-toggle-colorblind').addEventListener('click', () => {
      const cur = DotsStorage.getSettings();
      DotsStorage.saveSettings({ colorBlind: !cur.colorBlind });
      renderThemesModal();
      DotsGame.render();
    });

    if ($('btn-toggle-haptics')) {
      $('btn-toggle-haptics').addEventListener('click', () => {
        const cur = DotsStorage.getSettings();
        const nextVal = cur.haptics === false;
        DotsStorage.saveSettings({ haptics: nextVal });
        renderThemesModal();
        if (nextVal && global.DotsAudio) global.DotsAudio.vibrate(15);
      });
    }

    $('btn-home').addEventListener('click', () => showScreen('hub'));

    $('btn-prev-level').addEventListener('click', () => {
      if (activeLevelNum > 1) startLevel(activeModeId, activeLevelNum - 1, false);
    });

    $('btn-next-level').addEventListener('click', () => {
      const mode = DotsGenerator.getMode(activeModeId);
      if (activeLevelNum < mode.totalLevels) startLevel(activeModeId, activeLevelNum + 1, false);
    });

    $('btn-restart').addEventListener('click', () => {
      const stats = DotsGame.getStats();
      if (stats.moves === 0 && stats.filledCells === 0) return;
      openModal('confirm-modal');
    });

    $('btn-cancel-restart').addEventListener('click', () => closeModal('confirm-modal'));
    $('btn-confirm-restart').addEventListener('click', () => {
      closeModal('confirm-modal');
      DotsGame.clearBoard();
      hideBanner();
    });

    $('btn-undo').addEventListener('click', () => {
      DotsGame.undo();
    });

    $('btn-hint').addEventListener('click', () => {
      const stats = DotsGame.getStats();
      if (stats.isSolved) return;
      const hintCheck = DotsStorage.consumeHint();
      const applied = DotsGame.applyHint();
      if (!applied.applied) {
        DotsStorage.addHints(1);
        return;
      }
      $('hint-count').textContent = String(hintCheck.remaining);
      if (hintCheck.refilled) {
        showBanner('+3 Free Hints refilled!', 2000);
      }
    });

    $('btn-levels').addEventListener('click', () => {
      const mode = DotsGenerator.getMode(activeModeId);
      if (mode.isTimeRush) {
        activeLevelNum++;
        const runSeed = 'timerush_' + Date.now() + '_' + activeLevelNum;
        activeLevel = DotsGenerator.generateLevel('timerush', activeLevelNum, runSeed);
        DotsGame.loadLevel(activeLevel, null);
        updateGameChrome();
        return;
      }
      if (!mode.isDaily) {
        openLevelSelector(activeModeId);
      }
    });

    $('btn-jump-level').addEventListener('click', () => {
      const mode = DotsGenerator.getMode(levelSelectorModeId);
      const raw = parseInt($('jump-level-input').value, 10);
      if (!Number.isFinite(raw)) return;
      const clamped = Math.max(1, Math.min(mode.totalLevels, raw));
      closeModal('levels-modal');
      startLevel(levelSelectorModeId, clamped, false);
    });

    $('jump-level-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        $('btn-jump-level').click();
      }
    });

    $('btn-win-next').addEventListener('click', () => {
      const action = $('btn-win-next').dataset.action;
      closeModal('win-modal');
      if (action === 'timerush-retry') {
        timeRushRemainingSec = 120;
        startLevel('timerush', 1, true);
      } else if (action === 'daily-next') {
        const sum = DotsStorage.getTierSummary('beginner');
        startLevel('beginner', sum.currentLevel, false);
      } else {
        const mode = DotsGenerator.getMode(activeModeId);
        if (activeLevelNum < mode.totalLevels) {
          startLevel(activeModeId, activeLevelNum + 1, false);
        } else {
          showScreen('hub');
        }
      }
    });

    $('btn-win-replay').addEventListener('click', () => {
      closeModal('win-modal');
      startLevel(activeModeId, activeLevelNum, true);
    });

    $('btn-win-home').addEventListener('click', () => {
      closeModal('win-modal');
      showScreen('hub');
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
      });
    });

    // Keyboard shortcuts for desktop play
    global.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const openModals = document.querySelectorAll('.modal-backdrop.open');
      if (e.key === 'Escape') {
        if (openModals.length > 0) {
          openModals.forEach((m) => m.classList.remove('open'));
        } else if (!$('game-screen').classList.contains('hidden')) {
          showScreen('hub');
        }
        return;
      }

      if ($('win-modal').classList.contains('open')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          $('btn-win-next').click();
        }
        return;
      }

      if (openModals.length > 0) return;
      if ($('game-screen').classList.contains('hidden')) return;

      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        DotsGame.undo();
      } else if (key === 'h') {
        e.preventDefault();
        $('btn-hint').click();
      } else if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        $('btn-restart').click();
      } else if (e.key === 'ArrowLeft' || e.key === '[') {
        if (!$('btn-prev-level').classList.contains('hidden') && !$('btn-prev-level').disabled) {
          $('btn-prev-level').click();
        }
      } else if (e.key === 'ArrowRight' || e.key === ']') {
        if (!$('btn-next-level').classList.contains('hidden') && !$('btn-next-level').disabled) {
          $('btn-next-level').click();
        }
      }
    });

    setupAppInstall();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && global.location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
