/* ============================================================
   CEFR LEVEL SELECTOR — User level choice + filtered vocabulary
   ------------------------------------------------------------
   Provides:
   - getEffectiveCefrLevel() — resolves user's active level
   - getFilteredItems() — vocabulary filtered by active level
   - UI rendering for level selector (Settings + Home)
   - Integration with auth (login/logout/placement)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Dependencies (loaded before this script) ---------- */
  // window.VOCAB_DAYS, window.CEFR_LEVELS, window.CEFR_ORDER
  // window.cefrLevelForDay, window.cefrDaysForLevel, window.CEFR_PROGRESS_PATH
  // window.getCefrLevel, window.setCefrLevel, window.hasTakenPlacementTest
  // window.SecureStore (load/save)
  // window.VocabAuth (isLoggedIn, getUser)
  // window.VocabItems (getAll, setFiltered) — defined in app.js, accessed lazily

  /* ---------- Storage Keys ---------- */
  const K_SETTINGS = "vocab_settings_v1";
  const K_PROGRESS = "vocab_progress_v1";

  /* ---------- Helpers ---------- */

  function loadProgress() {
    try {
      return window.SecureStore?.load(K_PROGRESS, {}) || {};
    } catch (e) { return {}; }
  }

  /* ---------- i18n helpers (delegate to app's translator) ---------- */
  function t(key) {
    return (window.VocabApp && typeof window.VocabApp.t === "function")
      ? window.VocabApp.t(key)
      : key;
  }
  function currentLang() {
    try {
      const s = window.SecureStore?.load(K_SETTINGS, {}) || {};
      return s.lang === "th" ? "th" : "en";
    } catch (e) { return "en"; }
  }
  /* Localized level name: EN name or Thai name. */
  function levelName(info) {
    return currentLang() === "th" ? (info.th || info.name) : info.name;
  }
  function wordLabel(count) {
    return count + " " + t("stories.wordsCount");
  }

  /* ---------- Lazy dependency getters ---------- */
  function getAllItems() {
    return window.VocabItems?.getAll?.() || [];
  }

  function setFilteredItems(items) {
    window.VocabItems?.setFiltered?.(items);
  }

  function resetFilteredItems() {
    window.VocabItems?.resetFilter?.();
  }

  /* ---------- Core Logic ---------- */

  /**
   * Get the user's effective CEFR level.
   * The level comes ONLY from the placement test result (or the "A1" fallback).
   * Manual selection has been removed.
   */
  function getEffectiveCefrLevel() {
    const hasPlacement = window.hasTakenPlacementTest?.() ?? false;
    if (hasPlacement) {
      return window.getCefrLevel?.() || "A1";
    }
    return "A1";
  }

  /**
   * Get vocabulary items filtered by CEFR level.
   * Uses the global VocabItems.getAll() (built from VOCAB_DAYS).
   */
  function getFilteredItems() {
    const level = getEffectiveCefrLevel();
    return getItemsForLevel(level);
  }

  /**
   * Get all items belonging to a specific CEFR level.
   * @param {"A1"|"A2"|"B1"|"B2"|"C1"|"C2"} level
   */
  function getItemsForLevel(level) {
    const allItems = getAllItems();
    if (!allItems.length || !window.cefrDaysForLevel) return [];

    const targetLevel = level; // Each level now has 60 days of vocabulary
    const days = window.cefrDaysForLevel(targetLevel);
    if (!days.length) return [];

    const dayList = days.map(Number).sort((a, b) => a - b);
    const dayMap = {};
    dayList.forEach((origDay, index) => {
      dayMap[origDay] = index + 1; // Remap days to start from Day 1 (1, 2, 3...)
    });

    const daySet = new Set(dayList.map(String));
    const filtered = allItems.filter(item => daySet.has(String(item.day)));

    return filtered.map(item => {
      const origDay = Number(item.day);
      const newDay = dayMap[origDay] || 1;
      return {
        ...item,
        originalDay: origDay,
        day: newDay,
        id: newDay + "-" + item.type + "-" + (item.id.split("-").slice(2).join("-") || "0")
      };
    });
  }

  /**
   * Get word count for a level (for UI display).
   */
  function getLevelWordCount(level) {
    return getItemsForLevel(level).length;
  }

  /**
   * Get level info for UI (name, color, word count).
   */
  function getLevelInfo(level) {
    const info = window.CEFR_LEVELS?.[level] || { name: level, th: "", color: "#6366f1" };
    return {
      level,
      name: info.name,
      th: info.th,
      color: info.color,
      wordCount: getLevelWordCount(level),
      label: levelName(info)
    };
  }

  /* ---------- UI Rendering ---------- */

  /**
   * Render the CEFR level display (for Settings view).
   * The level comes from the placement test only — no manual selection.
   * @param {HTMLElement} container - Element to render into
   */
  function renderLevelSelector(container) {
    if (!container) return;

    const currentLevel = getEffectiveCefrLevel();
    const hasPlacement = window.hasTakenPlacementTest?.() ?? false;
    const isLoggedIn = window.VocabAuth?.isLoggedIn?.() ?? false;
    const currentInfo = getLevelInfo(currentLevel);

    const takeBtn = (hasPlacement || !isLoggedIn)
      ? ""
      : '<button class="btn btn-sm btn-secondary" id="cefrTakePlacementSettings">' +
          (currentLang() === "th" ? "เริ่มแบบทดสอบวัดระดับ" : "Take the placement test") +
        "</button>";

    const html = `
      <div class="cefr-current-display" style="--lv-color:${currentInfo.color}">
        <span class="cefr-current-label" data-i18n="cefr.currentLevel">ระดับปัจจุบัน:</span>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <span class="cefr-current-badge" style="color:${currentInfo.color}">
            ${currentInfo.level} — ${currentInfo.label}
          </span>
          ${takeBtn}
        </div>
      </div>
      <p class="hint" data-i18n="cefr.fromPlacementOnly">ระดับมาจากแบบทดสอบวัดระดับเท่านั้น</p>
    `;

    container.innerHTML = html;
    if (window.VocabApp?.applyI18n) window.VocabApp.applyI18n();

    // Bind "take placement test" (only when the user has no result yet)
    const takeBtnEl = container.querySelector("#cefrTakePlacementSettings");
    if (takeBtnEl) {
      takeBtnEl.addEventListener("click", () => {
        if (window.VocabPlacement?.init) {
          window.VocabPlacement.init();
          const placementPanel = document.getElementById("placementTest");
          if (placementPanel) placementPanel.style.display = "block";
        }
      });
    }
  }

  /**
   * Render the current level badge (for Home view CEFR panel).
   * The level comes from the placement test only — no manual change button.
   * @param {HTMLElement} container
   */
  function renderCefrBadge(container) {
    if (!container) return;

    const currentLevel = getEffectiveCefrLevel();
    const info = getLevelInfo(currentLevel);
    const hasPlacement = window.hasTakenPlacementTest?.() ?? false;

    // Progress to next level (from placement test confidence)
    let progressHtml = "";
    if (hasPlacement) {
      const progress = loadProgress();
      const progressToNext = progress.cefrProgressToNext || 0;
      const nextLevel = window.CEFR_ORDER[window.CEFR_ORDER.indexOf(currentLevel) + 1];
      if (nextLevel) {
        const nextInfo = window.CEFR_LEVELS[nextLevel];
        progressHtml = `
          <div class="cefr-progress-mini">
            <div class="cefr-progress-bar">
              <div class="cefr-progress-fill" style="width:${progressToNext * 100}%"></div>
            </div>
            <span class="cefr-progress-text">${Math.round(progressToNext * 100)}% ${currentLang() === "th" ? "ไปสู่" : "towards"} ${nextLevel} (${nextInfo ? levelName(nextInfo) : nextLevel})</span>
          </div>
        `;
      } else {
        progressHtml = '<div class="cefr-progress-maxed" data-i18n="cefr.maxLevel">ระดับสูงสุดแล้ว!</div>';
      }
    }

    container.innerHTML = `
      <div class="cefr-badge-current" style="--lv-color:${info.color}">
        <div class="cefr-badge-main">
          <span class="cefr-badge-level" style="color:${info.color}">${info.level}</span>
          <div class="cefr-badge-info">
            <span class="cefr-badge-name">${info.label}</span>
            <span class="cefr-badge-count">${wordLabel(info.wordCount)}</span>
          </div>
        </div>
        ${progressHtml}
      </div>
    `;
  }

  /**
   * Show placement test prompt for logged-in users without placement result.
   * @param {HTMLElement} container
   */
  function renderPlacementPrompt(container) {
    if (!container) return;

    const hasPlacement = window.hasTakenPlacementTest?.() ?? false;
    const isLoggedIn = window.VocabAuth?.isLoggedIn?.() ?? false;

    if (hasPlacement || !isLoggedIn) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;
    container.innerHTML = `
      <div class="placement-prompt-panel">
        <div class="placement-prompt-icon"><span class="ico" data-icon="test"></span></div>
        <div class="placement-prompt-text">
          <h3 data-i18n="cefr.noPlacementTitle">ยังไม่ได้ทำแบบทดสอบวัดระดับ</h3>
          <p data-i18n="cefr.noPlacementDesc">ทำแบบทดสอบ 2-4 นาที เพื่อให้ระบบจัดแผนเรียนที่เหมาะกับคุณ</p>
        </div>
        <div class="placement-prompt-actions">
          <button class="btn btn-primary" id="takePlacementBtn" data-i18n="cefr.takePlacement">เริ่มแบบทดสอบ</button>
          <button class="btn btn-secondary" id="skipPlacementBtn" data-i18n="cefr.skipPlacement">ข้าม (ใช้ระดับ A1)</button>
        </div>
      </div>
    `;

    // Inject icons
    container.querySelectorAll("[data-icon]").forEach(n => {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });

    container.querySelector("#takePlacementBtn")?.addEventListener("click", () => {
      container.hidden = true;
      if (window.VocabPlacement?.init) {
        window.VocabPlacement.init();
        // The placement test will render in #placementTest
        const placementPanel = document.getElementById("placementTest");
        if (placementPanel) placementPanel.style.display = "block";
      }
    });

    container.querySelector("#skipPlacementBtn")?.addEventListener("click", () => {
      container.hidden = true;
      // Set default level without placement test
      window.setCefrLevel?.("A1");
      if (window.VocabApp?.onCefrLevelChange) {
        window.VocabApp.onCefrLevelChange("A1");
      }
    });
  }

  /**
   * Initialize the CEFR system on app startup.
   * Call this after loadInitialState() in app.js
   */
  function initCefrSystem() {
    try {
      const effectiveLevel = getEffectiveCefrLevel();
      const hasPlacement = window.hasTakenPlacementTest?.() ?? false;

      // Store globally for games to access
      window.CURRENT_CEFR_LEVEL = effectiveLevel;
      const filteredItems = getFilteredItems();

      // Update global item list for games
      if (window.VocabItems?.setFiltered) {
        window.VocabItems.setFiltered(filteredItems);
      }

      // Render Home CEFR badge
      const badgeContainer = document.getElementById("cefrCurrentBadge") || document.getElementById("cefrBadges");
      if (badgeContainer) renderCefrBadge(badgeContainer);

      // Render Settings level selector (if settings view is active)
      const settingsContainer = document.getElementById("cefrLevelSelector");
      if (settingsContainer) renderLevelSelector(settingsContainer);

      // Show placement prompt for logged-in users without placement
      const promptContainer = document.getElementById("placementPrompt");
      if (promptContainer) renderPlacementPrompt(promptContainer);

      // Hide placement test panel once the user has a placement result
      const placementPanel = document.getElementById("placementTest");
      if (placementPanel && hasPlacement) {
        placementPanel.style.display = "none";
      }

      console.log("[cefr-selector] Initialized — effective level:", effectiveLevel,
        "| filtered items:", filteredItems.length);
    } catch (e) {
      console.error("[cefr-selector] initCefrSystem failed:", e);
    }
  }

  /* Re-render CEFR UI when the app language changes. */
  function onLanguageChanged() {
    try {
      const badgeContainer = document.getElementById("cefrCurrentBadge") || document.getElementById("cefrBadges");
      if (badgeContainer) renderCefrBadge(badgeContainer);
      const settingsContainer = document.getElementById("cefrLevelSelector");
      if (settingsContainer) renderLevelSelector(settingsContainer);
      const promptContainer = document.getElementById("placementPrompt");
      if (promptContainer) renderPlacementPrompt(promptContainer);
      if (window.VocabApp?.applyI18n) window.VocabApp.applyI18n();
    } catch (e) {
      console.error("[cefr-selector] onLanguageChanged failed:", e);
    }
  }
  document.addEventListener("vocab-lang-changed", onLanguageChanged);

  /**
   * Called when CEFR level changes (user selection or placement complete).
   * Refreshes all views that depend on vocabulary.
   */
  function onCefrLevelChange(newLevel) {
    window.CURRENT_CEFR_LEVEL = newLevel;
    const filteredItems = getFilteredItems();

    // Update global item list for games
    setFilteredItems(filteredItems);

    // Refresh Home badge
    const badgeContainer = document.getElementById("cefrCurrentBadge") || document.getElementById("cefrBadges");
    if (badgeContainer) renderCefrBadge(badgeContainer);

    // Refresh Settings selector
    const settingsContainer = document.getElementById("cefrLevelSelector");
    if (settingsContainer) renderLevelSelector(settingsContainer);

    // Refresh Browse view if active
    if (document.getElementById("view-browse")?.classList.contains("active")) {
      if (window.VocabApp?.renderBrowse) window.VocabApp.renderBrowse();
    }

    // Refresh game controls (re-populate type/day filters)
    refreshGameControls(filteredItems);

    // Notify games to refresh their item pools
    if (window.VocabGames?.refreshItems) {
      window.VocabGames.refreshItems(filteredItems);
    }

    console.log("[cefr-selector] Level changed to:", newLevel, "| items:", filteredItems.length);
  }

  function refreshGameControls(filteredItems) {
    // Rebuild type filters for all game modes
    const types = [...new Set(filteredItems.map(i => i.type))];
    const days = [...new Set(filteredItems.map(i => i.day))].sort((a, b) => a - b);

    // Helper to rebuild a chip group
    function rebuildChipGroup(containerId, options, currentValue, onChange) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = options.map(opt => `
        <button class="chip ${opt.value === currentValue ? "active" : ""}" data-value="${opt.value}">
          ${opt.label} <span class="chip-count">${opt.count || ""}</span>
        </button>
      `).join("");
      container.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => onChange(chip.dataset.value));
      });
    }

    // This would need to be customized per game mode's filter structure
    // For now, just trigger a generic refresh event
    document.dispatchEvent(new CustomEvent("vocab-items-changed", {
      detail: { items: filteredItems, types, days }
    }));
  }

  /* ---------- Auth Integration Hooks ---------- */

  /**
   * Call on successful login.
   */
  function onLogin() {
    initCefrSystem();
    // If logged in but no placement and no manual selection → show prompt
    const hasPlacement = window.hasTakenPlacementTest?.() ?? false;
    if (!hasPlacement) {
      const promptContainer = document.getElementById("placementPrompt");
      if (promptContainer) renderPlacementPrompt(promptContainer);
    }
  }

  /**
   * Call on logout.
   */
  function onLogout() {
    window.CURRENT_CEFR_LEVEL = null;
    // Reset to all items (unfiltered)
    resetFilteredItems();
    // Placement test will show automatically via its own init logic
  }

  /* ---------- Export API ---------- */
  window.CefrSelector = {
    // Core
    getEffectiveCefrLevel,
    getFilteredItems,
    getItemsForLevel,
    getLevelWordCount,
    getLevelInfo,

    // UI
    renderLevelSelector,
    renderCefrBadge,
    renderPlacementPrompt,

    // Lifecycle
    initCefrSystem,
    onCefrLevelChange,
    onLogin,
    onLogout
  };
})();