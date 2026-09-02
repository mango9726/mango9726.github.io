/* ============================================================
   mini-player.js — In-game Spotify-style Mini Music Player
   ------------------------------------------------------------
   A self-contained, dependency-free overlay. Drop the CSS + this
   file into any web project, call MiniMusicPlayer.init({...}),
   and you get:

     • Collapsed "hot zone" that expands on hover / click
     • Auto-collapse on mouse-leave + close-on-outside-click (toggle)
     • Transport: prev / play-pause / next  (playlist auto-advances)
     • Click + drag scrubber (current time vs. total duration)
     • Independent volume slider (does NOT touch game SFX)
     • Inline rename (alias) persisted to localStorage per track
     • "Up next" queue dropdown to jump between tracks
     • Input-blocking: while you hover/touch the player, game inputs
       are stopped from bubbling and MiniMusicPlayer.isInteracting
       is exposed for the game loop to poll.

   It is intentionally decoupled from any specific game. In THIS
   repo it auto-seeds from the existing song/ files and can optionally
   take over the built-in music (see MINI_PLAYER_GUIDE.md).

   Public API (after init):
     MiniMusicPlayer.init(opts)
     MiniMusicPlayer.play() / pause() / toggle()
     MiniMusicPlayer.next() / prev()
     MiniMusicPlayer.setVolume(0..1) / getVolume()
     MiniMusicPlayer.seek(fraction 0..1) / seekTo(seconds)
     MiniMusicPlayer.loadTrack(index) / setMode(name)
     MiniMusicPlayer.getState()
     MiniMusicPlayer.isInteracting            (live getter)
     MiniMusicPlayer.onInteract(cb)           (cb(bool))
     MiniMusicPlayer.destroy()
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Inline line-icons (stroke = currentColor) ---------- */
  const ICONS = {
    note:      '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    pencil:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    pushpin:   '<path d="M9 3h6l-1 7 4 3v2H6v-2l4-3z"/><path d="M12 15v6"/>',
    close:     '<path d="M6 6l12 12M18 6L6 18"/>',
    prev:      '<path d="M19 5v14l-9-7z"/><rect x="5" y="5" width="2.6" height="14" rx="1"/>',
    next:      '<path d="M5 5v14l9-7z"/><rect x="16.4" y="5" width="2.6" height="14" rx="1"/>',
    play:      '<path d="M8 5.5v13l11-6.5z"/>',
    pause:     '<rect x="7.2" y="5" width="3.4" height="14" rx="1.4"/><rect x="13.4" y="5" width="3.4" height="14" rx="1.4"/>',
    shuffle:   '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
    repeat:    '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    repeatOne: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" font-size="9" font-weight="700" text-anchor="middle" stroke="none" fill="currentColor">1</text>',
    list:      '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    volume:    '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    volumeLow: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>',
    volumeX:   '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }

  /* ---------- Small helpers ---------- */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function loadJSON(key, fallback) {
    if (window.SecureStore) return window.SecureStore.load(key, fallback);
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, val) {
    if (window.SecureStore) { window.SecureStore.save(key, val); return; }
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota / private mode */ }
  }

  /* Default playlists mirror the existing Vocab Trainer song/ files so the
     mini-player works out-of-the-box in this repo. Override via init({playlists}). */
  const DEFAULT_PLAYLISTS = {
    onpage: [
      "assets/music/onpage/alex-morgan-jazz-restaurant-music-556244.mp3",
      "assets/music/onpage/alex-morgan-late-night-jazz-midnight-club-music-564261.mp3",
      "assets/music/onpage/alex-morgan-lofi-jazz-retro-coffee-shop-560042.mp3",
      "assets/music/onpage/alex-morgan-lofi-jazz-soulful-midnight-club-560063.mp3",
      "assets/music/onpage/alex-morgan-lofi-jazz-study-music-564256.mp3",
      "assets/music/onpage/alex-morgan-smooth-jazz-lounge-relaxing-evening-537465.mp3",
      "assets/music/onpage/alex-morgan-sultry-jazz-sunny-cafe-music-564254.mp3",
      "assets/music/onpage/alex-morgan-trumpet-jazz-study-music-564260.mp3",
      "assets/music/onpage/atlasaudio-jazz-519632.mp3",
      "assets/music/onpage/lofiroomcafe-cafe-calma-lofi-chill-for-cozy-moments-352430.mp3"
    ],
    ingame: [
      "assets/music/ingame/ingamesong1.mp3", "assets/music/ingame/ingamesong2.mp3",
      "assets/music/ingame/ingamesong3.mp3", "assets/music/ingame/ingamesong4.mp3",
      "assets/music/ingame/ingamesong5.mp3", "assets/music/ingame/ingamesong6.mp3",
      "assets/music/ingame/ingamesong7.mp3", "assets/music/ingame/ingamesong8.mp3"
    ]
  };

  /** Turn a filename/path into a friendly label (mirrors the host app's songLabel). */
  function prettyName(src) {
    const file = src.split("/").pop();
    if (/^ingamesong/i.test(file)) {
      const n = file.replace(/[^0-9]/g, "") || "1";
      return "Game Track " + n;
    }
    return file.replace(/\.mp3$/i, "")
      .replace(/-\d{4,}$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ").trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || file;
  }

  /* ============================================================
     AudioController — the audio engine (no DOM, no UI)
     ============================================================ */
  function AudioController(opts) {
    opts = opts || {};
    this.audio = new Audio();
    this.audio.preload = "auto";
    // NOTE: loop is OFF on purpose. The host app's built-in player loops a
    // single track; here we want a real, seekable playlist that auto-advances
    // to the next song when one ends — which also makes the progress bar
    // meaningful (finite duration + scrubbing).
    this.audio.loop = false;
    this.audio.volume = clamp(opts.volume != null ? opts.volume : 0.6, 0, 1);

    this.tracks = [];          // [{ src, label, artist }]
    this.index = 0;
    this.shuffle = false;       // shuffle next track
    this.repeat = "off";        // "off" | "all" | "one"
    this.onUpdate = opts.onUpdate || function () {};
    this._wantPlay = false;     // desired play state (survives autoplay blocks)
    this._bind();
  }
  AudioController.prototype._bind = function () {
    const self = this, a = this.audio;
    const emit = function (type) { self.onUpdate(type, self.getState()); };
    a.addEventListener("timeupdate", function () { emit("progress"); });
    a.addEventListener("loadedmetadata", function () { emit("meta"); });
    a.addEventListener("durationchange", function () { emit("meta"); });
    a.addEventListener("play", function () { self._wantPlay = true; emit("play"); });
    a.addEventListener("pause", function () { emit("pause"); });
    a.addEventListener("volumechange", function () { emit("volume"); });
    a.addEventListener("error", function () { emit("error"); });
    a.addEventListener("ended", function () {
      // Auto-advance to the next track (wraps around).
      if (self.tracks.length > 1) self.next();
      else { self._wantPlay = false; emit("ended"); }
    });
  };
  AudioController.prototype.setTracks = function (list, startIndex) {
    this.tracks = (list || []).map(function (t) {
      if (typeof t === "string") return { src: t, label: prettyName(t), artist: "" };
      return { src: t.src, label: t.label || prettyName(t.src), artist: t.artist || "" };
    });
    this.index = clamp(startIndex || 0, 0, Math.max(0, this.tracks.length - 1));
    this._load(false);
    this.onUpdate("tracks", this.getState());
  };
  AudioController.prototype._load = function (autoplay) {
    const t = this.tracks[this.index];
    if (!t) return;
    if (this.audio.dataset.src !== t.src) {
      this.audio.src = t.src;
      this.audio.dataset.src = t.src;
      this.audio.load();
    }
    if (autoplay) this.play();
    this.onUpdate("track", this.getState());
  };
  AudioController.prototype._ensureLoaded = function () {
    if (this.audio.src && this.audio.dataset.src === this.tracks[this.index].src) return;
    this._load(false);
  };
  AudioController.prototype.play = function () {
    if (!this.tracks.length) return;
    this._ensureLoaded();
    const p = this.audio.play();
    if (p && p.catch) p.catch(function () { /* blocked until user gesture; kick will retry */ });
    this._wantPlay = true;
  };
  AudioController.prototype.pause = function () {
    this.audio.pause();
    this._wantPlay = false;
  };
  AudioController.prototype.toggle = function () {
    if (this.audio.paused) this.play(); else this.pause();
  };
  AudioController.prototype.next = function () {
    if (!this.tracks.length) return;
    if (this.repeat === "one") { this._load(true); return; }
    if (this.shuffle && this.tracks.length > 1) {
      let i;
      do { i = Math.floor(Math.random() * this.tracks.length); } while (i === this.index);
      this.index = i;
    } else {
      this.index = (this.index + 1) % this.tracks.length;
    }
    this._load(true);
  };
  AudioController.prototype.setShuffle = function (on) { this.shuffle = !!on; this.onUpdate("mode", this.getState()); };
  AudioController.prototype.setRepeat = function (mode) {
    this.repeat = (mode === "one" || mode === "all") ? mode : "off";
    this.onUpdate("mode", this.getState());
  };
  AudioController.prototype.prev = function () {
    if (!this.tracks.length) return;
    // Mirror common players: if we're >3s in, restart current; else go back.
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    this.index = (this.index - 1 + this.tracks.length) % this.tracks.length;
    this._load(true);
  };
  AudioController.prototype.loadTrack = function (i, autoplay) {
    if (!this.tracks.length) return;
    this.index = clamp(i, 0, this.tracks.length - 1);
    this._load(autoplay !== false);
  };
  AudioController.prototype.seekFraction = function (f) {
    const d = this.audio.duration;
    if (isFinite(d) && d > 0) this.audio.currentTime = clamp(f, 0, 1) * d;
  };
  AudioController.prototype.seekTo = function (sec) {
    this.audio.currentTime = clamp(sec, 0, this.audio.duration || sec);
  };
  AudioController.prototype.setVolume = function (v) {
    this.audio.volume = clamp(v, 0, 1); // independent of any Web-Audio SFX bus
  };
  AudioController.prototype.getVolume = function () { return this.audio.volume; };
  AudioController.prototype.getState = function () {
    const t = this.tracks[this.index] || { src: "", label: "", artist: "" };
    const d = this.audio.duration;
    return {
      index: this.index,
      count: this.tracks.length,
      src: t.src,
      label: t.label,
      artist: t.artist,
      playing: !this.audio.paused && !this.audio.ended,
      currentTime: this.audio.currentTime || 0,
      duration: isFinite(d) ? d : 0,
      fraction: (isFinite(d) && d > 0) ? (this.audio.currentTime || 0) / d : 0,
      volume: this.audio.volume
    };
  };

  /* ============================================================
     MiniMusicPlayer — UI + orchestration
     ============================================================ */
  const MiniMusicPlayer = {
    root: null,
    ctrl: null,
    opts: null,
    aliases: {},
    modeIndex: {},
    _interactCbs: [],
    _interacting: false,
    _pinned: false,
    _userPaused: false,   // becomes true once the user explicitly pauses
    _hideTimer: null,

    /* ---------- init ---------- */
    init: function (options) {
      if (this.root) return this; // already initialised
      const o = options || {};

      // Playlists: explicit > host-exposed (window.VOCAB_MUSIC) > built-in defaults.
      let playlists = o.playlists;
      if (!playlists && global.VOCAB_MUSIC) playlists = global.VOCAB_MUSIC;
      if (!playlists) playlists = DEFAULT_PLAYLISTS;

      // Fuse every source playlist into ONE combined library (on-page + in-game,
      // etc.) so the player shows a single queue. Playlist tabs are hidden
      // automatically because there is only one mode.
      let combined;
      if (Array.isArray(playlists)) {
        combined = playlists.slice();
      } else {
        const order = o.modeOrder || Object.keys(playlists);
        combined = [];
        order.forEach(function (k) {
          (playlists[k] || []).forEach(function (t) { combined.push(t); });
        });
      }
      // Load custom tracks
      const customTracks = loadJSON("vocab_custom_tracks_v1", []);
      customTracks.forEach(function (t) { combined.push(t); });

      this.opts = {
        playlists: { library: combined },
        modeOrder: ["library"],
        startMode: "library",
        volume: o.volume != null ? o.volume : 0.6,
        autoStart: o.autoStart !== false,           // start on first user gesture
        collapseOnOutsideClick: o.collapseOnOutsideClick !== false,
        aliasesKey: o.aliasesKey || "vocab_miniplayer_aliases_v1",
        mountTo: o.mountTo || document.body,
        // Single fused library — label it neutrally.
        playlistLabels: o.playlistLabels || { library: "Your Library" },
        onInteract: o.onInteract || null
      };
      if (this.opts.onInteract) this._interactCbs.push(this.opts.onInteract);

      this.aliases = loadJSON(this.opts.aliasesKey, {});
      this.modeIndex = {};
      this.opts.modeOrder.forEach(function (m) { this.modeIndex[m] = 0; }, this);

      this.ctrl = new AudioController({
        volume: this.opts.volume,
        onUpdate: this._onAudioUpdate.bind(this)
      });

      this._buildDOM();
      this._wireEvents();
      this._loadMode(this.opts.startMode, true);

      // Be polite: if the host app exposed a pause hook, stop its built-in music
      // so we don't end up with two tracks at once.
      if (global.VocabMusic && global.VocabMusic.pause) {
        try { global.VocabMusic.pause(); } catch (e) {}
      }

      // Autoplay kick: browsers block audio until a gesture. Arm it once.
      if (this.opts.autoStart) this._armAutoplayKick();

      global.MiniMusicPlayer = this;
      return this;
    },

    /* ---------- DOM construction ---------- */
    _buildDOM: function () {
      const root = el("div", "mmp");
      root.setAttribute("data-state", "collapsed");
      root.setAttribute("data-playing", "false");
      root.setAttribute("data-pinned", "false");
      root.setAttribute("role", "application");
      root.setAttribute("aria-label", "Mini music player");

      // --- Panel ---
      const panel = el("div", "mmp-panel");
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-label", "Music player");

      // Header
      const head = el("div", "mmp-head");
      const art = el("div", "mmp-art");
      art.innerHTML = '<span class="mmp-art-glyph">' + svg("note") + "</span>";
      const titles = el("div", "mmp-titles");
      const titleRow = el("div", "mmp-title-row");
      const title = el("span", "mmp-title"); title.setAttribute("tabindex", "0");
      const renameBtn = el("button", "mmp-icon-btn mmp-rename");
      renameBtn.setAttribute("type", "button"); renameBtn.title = "Rename this song";
      renameBtn.setAttribute("aria-label", "Rename this song"); renameBtn.innerHTML = svg("pencil");
      titleRow.appendChild(title); titleRow.appendChild(renameBtn);
      const artist = el("div", "mmp-artist");
      const renameInput = el("input", "mmp-rename-input");
      renameInput.setAttribute("type", "text"); renameInput.setAttribute("maxlength", "60");
      renameInput.setAttribute("aria-label", "Custom song name"); renameInput.hidden = true;
      titles.appendChild(titleRow); titles.appendChild(artist); titles.appendChild(renameInput);
      const headActions = el("div", "mmp-head-actions");
      const pinBtn = el("button", "mmp-icon-btn mmp-pin");
      pinBtn.setAttribute("type", "button"); pinBtn.title = "Keep open";
      pinBtn.setAttribute("aria-label", "Keep player open"); pinBtn.setAttribute("aria-pressed", "false");
      pinBtn.innerHTML = svg("pushpin");
      const closeBtn = el("button", "mmp-icon-btn mmp-close");
      closeBtn.setAttribute("type", "button"); closeBtn.title = "Close";
      closeBtn.setAttribute("aria-label", "Close player"); closeBtn.innerHTML = svg("close");
      headActions.appendChild(pinBtn); headActions.appendChild(closeBtn);
      head.appendChild(art); head.appendChild(titles); head.appendChild(headActions);

      // Playlist tabs (only if >1 playlist)
      const plWrap = el("div", "mmp-playlists"); plWrap.hidden = true;

      // Progress / scrubber
      const prog = el("div", "mmp-progress");
      const cur = el("span", "mmp-time mmp-cur"); cur.textContent = "0:00";
      const seek = this._sliderEl("mmp-seek");
      seek.root.setAttribute("aria-label", "Seek");
      const dur = el("span", "mmp-time mmp-dur"); dur.textContent = "0:00";
      prog.appendChild(cur); prog.appendChild(seek.root); prog.appendChild(dur);

      // Controls
      const ctrls = el("div", "mmp-controls");
      const shuffleBtn = el("button", "mmp-ctrl mmp-shuffle"); shuffleBtn.setAttribute("type", "button");
      shuffleBtn.title = "Shuffle"; shuffleBtn.setAttribute("aria-label", "Shuffle");
      shuffleBtn.setAttribute("aria-pressed", "false"); shuffleBtn.innerHTML = svg("shuffle");
      const prevBtn = el("button", "mmp-ctrl mmp-prev"); prevBtn.setAttribute("type", "button");
      prevBtn.title = "Previous"; prevBtn.setAttribute("aria-label", "Previous track"); prevBtn.innerHTML = svg("prev");
      const playBtn = el("button", "mmp-ctrl mmp-play"); playBtn.setAttribute("type", "button");
      playBtn.title = "Play / Pause"; playBtn.setAttribute("aria-label", "Play or pause"); playBtn.innerHTML = svg("play");
      const nextBtn = el("button", "mmp-ctrl mmp-next"); nextBtn.setAttribute("type", "button");
      nextBtn.title = "Next"; nextBtn.setAttribute("aria-label", "Next track"); nextBtn.innerHTML = svg("next");
      const repeatBtn = el("button", "mmp-ctrl mmp-repeat"); repeatBtn.setAttribute("type", "button");
      repeatBtn.title = "Repeat"; repeatBtn.setAttribute("aria-label", "Repeat");
      repeatBtn.setAttribute("aria-pressed", "false"); repeatBtn.innerHTML = svg("repeat");
      const queueBtn = el("button", "mmp-ctrl mmp-queue"); queueBtn.setAttribute("type", "button");
      queueBtn.title = "Up next"; queueBtn.setAttribute("aria-label", "Show queue");
      queueBtn.setAttribute("aria-expanded", "false"); queueBtn.innerHTML = svg("list");
      ctrls.appendChild(shuffleBtn); ctrls.appendChild(prevBtn); ctrls.appendChild(playBtn);
      ctrls.appendChild(nextBtn); ctrls.appendChild(repeatBtn); ctrls.appendChild(queueBtn);

      // Volume
      const vol = el("div", "mmp-volume");
      const volIco = el("span", "mmp-vol-ico"); volIco.innerHTML = svg("volume");
      const volSlider = this._sliderEl("mmp-vol");
      volSlider.root.setAttribute("aria-label", "Volume");
      vol.appendChild(volIco); vol.appendChild(volSlider.root);

      // Queue dropdown
      const queue = el("div", "mmp-queue-panel"); queue.hidden = true;
      const qHead = el("div", "mmp-queue-head");
      qHead.innerHTML = '<span>Up next</span><button class="mmp-add-track" type="button" title="Add song URL">+ Add Song</button>';
      const qList = el("ul", "mmp-queue-list");
      queue.appendChild(qHead); queue.appendChild(qList);

      panel.appendChild(head); panel.appendChild(plWrap); panel.appendChild(prog);
      panel.appendChild(ctrls); panel.appendChild(vol); panel.appendChild(queue);

      // --- Hot zone (collapsed) ---
      const hot = el("button", "mmp-hotzone");
      hot.setAttribute("type", "button"); hot.setAttribute("aria-label", "Open music player");
      hot.setAttribute("aria-expanded", "false");
      const hzIco = el("span", "mmp-hz-ico"); hzIco.innerHTML = svg("note");
      const hzEq = el("span", "mmp-hz-eq"); hzEq.appendChild(el("i")); hzEq.appendChild(el("i")); hzEq.appendChild(el("i"));
      const hzLabel = el("span", "mmp-hz-label"); hzLabel.textContent = "Music";
      hot.appendChild(hzIco); hot.appendChild(hzEq); hot.appendChild(hzLabel);

      // Toast
      const toast = el("div", "mmp-toast"); toast.setAttribute("role", "status");

      // --- Custom Songs Modal ---
      const modal = el("div", "mmp-modal-overlay"); modal.hidden = true;
      modal.innerHTML = `
        <div class="mmp-modal" role="dialog" aria-modal="true" aria-label="Manage Songs">
          <div class="mmp-modal-head">
            <h3>Upload &amp; Manage Music</h3>
            <button class="mmp-modal-close" type="button" aria-label="Close">${svg("close")}</button>
          </div>
          <div class="mmp-modal-body">
            <div class="mmp-add-box">
              <h4>Upload Local Music File</h4>
              <div class="mmp-form-row">
                <input type="file" accept="audio/*" class="mmp-input mmp-modal-file" />
              </div>
              <div class="mmp-form-row">
                <input type="text" class="mmp-input mmp-modal-title" placeholder="Song title (optional, auto-fills from filename)" />
              </div>
              <div class="mmp-form-row">
                <input type="file" accept="image/*" class="mmp-input mmp-modal-art" />
              </div>
              <button class="mmp-modal-btn mmp-modal-add" type="button">Upload &amp; Add Song</button>
              <div class="mmp-modal-io">
                <button class="mmp-ci-btn" type="button" id="mmpPlaylistExport">Export playlist (JSON)</button>
                <button class="mmp-ci-btn" type="button" id="mmpPlaylistImport">Import playlist</button>
                <input type="file" accept=".json,application/json" class="mmp-import-input" hidden />
              </div>
            </div>
            <div class="mmp-custom-list-wrap">
              <h4>Your Custom Songs</h4>
              <ul class="mmp-custom-list"></ul>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      root.appendChild(panel); root.appendChild(hot); root.appendChild(toast);
      this.opts.mountTo.appendChild(root);

      // Cache refs
      this.root = root;
      this.refs = {
        panel: panel, hot: hot, title: title, artist: artist, art: art,
        renameBtn: renameBtn, renameInput: renameInput,
        pinBtn: pinBtn, closeBtn: closeBtn, modal: modal,
        plWrap: plWrap,
        cur: cur, dur: dur, seek: seek,
        playBtn: playBtn, prevBtn: prevBtn, nextBtn: nextBtn, queueBtn: queueBtn,
        shuffleBtn: shuffleBtn, repeatBtn: repeatBtn,
        volIco: volIco, vol: volSlider,
        queue: queue, qList: qList,
        toast: toast
      };
    },

    /* Build a slider subtree: .mmp-slider > .mmp-slider-track > (fill + thumb). */
    _sliderEl: function (extraCls) {
      const root = el("div", "mmp-slider" + (extraCls ? " " + extraCls : ""));
      root.setAttribute("tabindex", "0");
      root.setAttribute("role", "slider");
      root.setAttribute("aria-valuemin", "0");
      root.setAttribute("aria-valuemax", "100");
      root.setAttribute("aria-valuenow", "0");
      const track = el("div", "mmp-slider-track");
      const fill = el("div", "mmp-slider-fill");
      const thumb = el("div", "mmp-slider-thumb");
      track.appendChild(fill); track.appendChild(thumb);
      root.appendChild(track);
      return { root: root, track: track, fill: fill, thumb: thumb, dragging: false };
    },

    /* ---------- Generic slider behaviour (seek + volume share it) ---------- */
    _wireSlider: function (slider, handlers) {
      const self = this;
      const track = slider.track;
      function frac(e) {
        const r = track.getBoundingClientRect();
        return clamp((e.clientX - r.left) / r.width, 0, 1);
      }
      function paint(f) {
        const pct = (f * 100).toFixed(2) + "%";
        slider.fill.style.width = pct;
        slider.thumb.style.left = pct;
        slider.root.setAttribute("aria-valuenow", Math.round(f * 100));
      }
      track.addEventListener("pointerdown", function (e) {
        e.stopPropagation();                 // never let this reach the game
        slider.dragging = true;
        slider.root.classList.add("is-dragging");
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
        const f = frac(e); paint(f); if (handlers.onScrub) handlers.onScrub(f);
      });
      track.addEventListener("pointermove", function (e) {
        if (!slider.dragging) return;
        e.stopPropagation();
        const f = frac(e); paint(f); if (handlers.onScrub) handlers.onScrub(f);
      });
      function end(e) {
        if (!slider.dragging) return;
        slider.dragging = false;
        slider.root.classList.remove("is-dragging");
        try { track.releasePointerCapture(e.pointerId); } catch (err) {}
        const f = frac(e); paint(f); if (handlers.onCommit) handlers.onCommit(f);
      }
      track.addEventListener("pointerup", end);
      track.addEventListener("pointercancel", end);
      // Keyboard a11y
      slider.root.addEventListener("keydown", function (e) {
        const cur = parseFloat(slider.root.getAttribute("aria-valuenow")) || 0;
        let f = cur / 100;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") f = clamp(f + 0.05, 0, 1);
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") f = clamp(f - 0.05, 0, 1);
        else if (e.key === "Home") f = 0;
        else if (e.key === "End") f = 1;
        else return;
        e.preventDefault(); e.stopPropagation();
        paint(f); if (handlers.onCommit) handlers.onCommit(f);
      });
      return { paint: paint, isDragging: function () { return slider.dragging; } };
    },

    /* ---------- Event wiring ---------- */
    _wireEvents: function () {
      const self = this, r = this.refs;

      // Playlist tabs (rebuilt when count > 1)
      this._renderPlaylistTabs();

      // Seek slider: live-preview while dragging, commit on release.
      this._seekApi = this._wireSlider(r.seek, {
        onScrub: function (f) {
          // Live seek for immediate feedback (guarded by finite duration in ctrl).
          self.ctrl.seekFraction(f);
          r.cur.textContent = formatTime(f * self.ctrl.getState().duration);
        },
        onCommit: function (f) { self.ctrl.seekFraction(f); }
      });
      // Volume slider: live, persisted on commit.
      this._volApi = this._wireSlider(r.vol, {
        onScrub: function (f) { self.ctrl.setVolume(f); self._paintVolIcon(f); },
        onCommit: function (f) { self.ctrl.setVolume(f); self._paintVolIcon(f); }
      });
      this._volApi.paint(this.ctrl.getVolume());
      this._paintVolIcon(this.ctrl.getVolume());

      // Transport
      r.playBtn.addEventListener("click", function (e) { e.stopPropagation(); self.ctrl.toggle(); });
      r.prevBtn.addEventListener("click", function (e) { e.stopPropagation(); self.ctrl.prev(); });
      r.nextBtn.addEventListener("click", function (e) { e.stopPropagation(); self.ctrl.next(); });
      r.shuffleBtn.addEventListener("click", function (e) {
        e.stopPropagation(); self.ctrl.setShuffle(!self.ctrl.shuffle);
        r.shuffleBtn.classList.toggle("is-active", self.ctrl.shuffle);
        r.shuffleBtn.setAttribute("aria-pressed", String(self.ctrl.shuffle));
      });
      r.repeatBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        const order = ["off", "all", "one"];
        const next = order[(order.indexOf(self.ctrl.repeat) + 1) % order.length];
        self.ctrl.setRepeat(next);
        r.repeatBtn.classList.toggle("is-active", next !== "off");
        r.repeatBtn.classList.toggle("is-one", next === "one");
        r.repeatBtn.setAttribute("aria-pressed", String(next !== "off"));
        r.repeatBtn.innerHTML = svg(next === "one" ? "repeatOne" : "repeat");
      });

      // Queue toggle & add track
      r.queueBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        const open = r.queue.hidden;
        r.queue.hidden = !open;
        r.queueBtn.setAttribute("aria-expanded", String(open));
      });
      r.queue.querySelector(".mmp-add-track").addEventListener("click", function (e) {
        e.stopPropagation();
        self._openSongsModal();
      });
      r.modal.querySelector(".mmp-modal-close").addEventListener("click", function (e) {
        e.stopPropagation();
        self._closeSongsModal();
      });
      r.modal.addEventListener("click", function (e) {
        e.stopPropagation();
        if (e.target === r.modal) self._closeSongsModal();
      });
      r.modal.querySelector(".mmp-modal-add").addEventListener("click", function (e) {
        e.stopPropagation();
        const fileInput = r.modal.querySelector(".mmp-modal-file");
        const titleInput = r.modal.querySelector(".mmp-modal-title");
        const artInput = r.modal.querySelector(".mmp-modal-art");
        const file = fileInput.files[0];
        if (!file) {
          self._toast("Please choose an audio file first");
          return;
        }
        const title = titleInput.value.trim() || file.name.replace(/\.[^/.]+$/, "");
        const blobUrl = URL.createObjectURL(file);

        const artFile = artInput && artInput.files && artInput.files[0];

        const readArt = artFile
          ? new Promise(function (resolve) {
              const ar = new FileReader();
              ar.onload = function (e) { resolve(e.target.result); };
              ar.readAsDataURL(artFile);
            })
          : Promise.resolve("");

        readArt.then(function (artData) {
          const reader = new FileReader();
          reader.onload = function (evt) {
            const base64Url = evt.target.result;
            let custom = loadJSON("vocab_custom_tracks_v1", []);
            custom.push({ label: title, src: base64Url, art: artData || "" });
            saveJSON("vocab_custom_tracks_v1", custom);
          };
          reader.readAsDataURL(file);

          self.addCustomTrackInstant({ label: title, src: blobUrl, art: artData || "" });
          titleInput.value = "";
          fileInput.value = "";
          if (artInput) artInput.value = "";
          self._renderCustomSongsModalList();
          self._closeSongsModal();
        });
      });

      // Playlist export / import (custom tracks only; built-ins come from the repo).
      r.modal.querySelector("#mmpPlaylistExport").addEventListener("click", function (e) {
        e.stopPropagation();
        self.exportPlaylist();
      });
      const importInput = r.modal.querySelector(".mmp-import-input");
      r.modal.querySelector("#mmpPlaylistImport").addEventListener("click", function (e) {
        e.stopPropagation();
        importInput.click();
      });
      importInput.addEventListener("change", function (e) {
        e.stopPropagation();
        const file = importInput.files[0];
        if (file) self.importPlaylist(file);
        importInput.value = "";
      });

      // Pin / close
      r.pinBtn.addEventListener("click", function (e) {
        e.stopPropagation(); self._setPinned(!self._pinned);
      });
      r.closeBtn.addEventListener("click", function (e) {
        e.stopPropagation(); self._setPinned(false); self._collapse();
      });

      // Rename (alias)
      r.renameBtn.addEventListener("click", function (e) { e.stopPropagation(); self._beginRename(); });
      r.title.addEventListener("dblclick", function (e) { e.stopPropagation(); self._beginRename(); });
      this._wireRenameInput();

      // Hover-to-expand on the hot zone AND the panel (panel sits directly above
      // the hot zone, so moving between them never triggers a collapse).
      const scheduleCollapse = function () { if (self._pinned) return; self._hideTimer = setTimeout(function () { self._collapse(); }, 220); };
      const cancelCollapse = function () { if (self._hideTimer) { clearTimeout(self._hideTimer); self._hideTimer = null; } };
      r.hot.addEventListener("mouseenter", function () { cancelCollapse(); self._expand(); });
      r.hot.addEventListener("mouseleave", scheduleCollapse);
      r.panel.addEventListener("mouseenter", function () { cancelCollapse(); self._expand(); });
      r.panel.addEventListener("mouseleave", scheduleCollapse);

      // Hot zone click = toggle pinned (great for touch / click-to-keep-open)
      r.hot.addEventListener("click", function (e) {
        e.stopPropagation();
        if (self._pinned) { self._setPinned(false); self._collapse(); }
        else { self._setPinned(true); self._expand(); }
      });

      // Input blocking: stop game-bound events that originate inside the player
      // from bubbling up to document/body-level game handlers.
      ["pointerdown", "mousedown", "click", "dblclick", "wheel",
       "touchstart", "touchmove", "contextmenu", "dragstart"].forEach(function (type) {
        self.root.addEventListener(type, function (ev) { ev.stopPropagation(); }, false);
      });
      // Track "interacting" for the game loop to poll.
      const enter = function () { self._setInteracting(true); };
      const leave = function () { self._setInteracting(false); };
      r.hot.addEventListener("pointerenter", enter); r.hot.addEventListener("pointerleave", leave);
      r.panel.addEventListener("pointerenter", enter); r.panel.addEventListener("pointerleave", leave);

      // Close-on-outside-click (configurable)
      document.addEventListener("click", function (e) {
        if (!self.opts.collapseOnOutsideClick) return;
        if (self._pinned) return;
        if (self.root.contains(e.target)) return;
        if (self.root.getAttribute("data-state") === "expanded") self._collapse();
      }, false);
    },

    /* ---------- Alias / rename ---------- */
    _displayTitle: function () {
      const st = this.ctrl.getState();
      if (st.src && this.aliases[st.src]) return this.aliases[st.src];
      return st.label || "Untitled";
    },
    _beginRename: function () {
      const r = this.refs, st = this.ctrl.getState();
      if (!st.src) return;
      r.title.style.display = "none";
      r.renameBtn.style.display = "none";
      r.renameInput.hidden = false;
      r.renameInput.value = this._displayTitle();
      r.renameInput.focus();
      r.renameInput.select();
    },
    _commitRename: function () {
      const r = this.refs, st = this.ctrl.getState();
      const val = r.renameInput.value.trim();
      if (st.src) {
        if (val && val !== st.label) this.aliases[st.src] = val;
        else delete this.aliases[st.src];
        saveJSON(this.opts.aliasesKey, this.aliases);
      }
      r.renameInput.hidden = true;
      r.renameInput.blur();
      r.title.style.display = "";
      r.renameBtn.style.display = "";
      this._renderTrack();
      this._renderQueue();
      this._toast(val ? "Renamed" : "Name reset");
    },
    _cancelRename: function () {
      const r = this.refs;
      r.renameInput.hidden = true;
      r.title.style.display = "";
      r.renameBtn.style.display = "";
    },
    _wireRenameInput: function () {
      const r = this.refs, self = this;
      r.renameInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); self._commitRename(); }
        else if (e.key === "Escape") { e.preventDefault(); self._cancelRename(); }
      });
      r.renameInput.addEventListener("blur", function () { if (!r.renameInput.hidden) self._commitRename(); });
      r.renameInput.addEventListener("click", function (e) { e.stopPropagation(); });
    },

    /* ---------- State: expand / collapse / pin / interacting ---------- */
    _expand: function () {
      this.root.setAttribute("data-state", "expanded");
      this.refs.hot.setAttribute("aria-expanded", "true");
    },
    _collapse: function () {
      this.root.setAttribute("data-state", "collapsed");
      this.refs.hot.setAttribute("aria-expanded", "false");
      // Also close the queue when collapsing
      this.refs.queue.hidden = true;
      this.refs.queueBtn.setAttribute("aria-expanded", "false");
    },
    _setPinned: function (v) {
      this._pinned = !!v;
      this.root.setAttribute("data-pinned", String(this._pinned));
      this.refs.pinBtn.setAttribute("aria-pressed", String(this._pinned));
      this.refs.pinBtn.title = this._pinned ? "Unpin" : "Keep open";
    },
    _setInteracting: function (v) {
      if (this._interacting === v) return;
      this._interacting = v;
      if (v) document.documentElement.setAttribute("data-mini-music-active", "true");
      else document.documentElement.removeAttribute("data-mini-music-active");
      // Notify listeners + dispatch a CustomEvent the game can listen for.
      for (let i = 0; i < this._interactCbs.length; i++) {
        try { this._interactCbs[i](v); } catch (e) {}
      }
      try {
        document.dispatchEvent(new CustomEvent("minimusic:interacting", { detail: { interacting: v } }));
      } catch (e) {}
    },

    /* ---------- Playlist / mode ---------- */
    _renderPlaylistTabs: function () {
      const self = this, r = this.refs;
      const order = this.opts.modeOrder;
      if (order.length <= 1) { r.plWrap.hidden = true; r.plWrap.innerHTML = ""; return; }
      r.plWrap.hidden = false; r.plWrap.innerHTML = "";
      order.forEach(function (m) {
        const b = el("button", "mmp-pl-tab");
        b.setAttribute("type", "button");
        b.setAttribute("data-pl", m);
        b.textContent = self._playlistLabel(m);
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          if (m === self._mode) return;
          self._loadMode(m, false);
        });
        r.plWrap.appendChild(b);
      });
    },
    _playlistLabel: function (m) {
      if (this.opts.playlistLabels && this.opts.playlistLabels[m]) return this.opts.playlistLabels[m];
      if (m === "onpage") return "On-page";
      if (m === "ingame") return "In-game";
      return m.charAt(0).toUpperCase() + m.slice(1);
    },
    _loadMode: function (mode, silent) {
      this._mode = mode;
      // Tolerate bare filenames (e.g. "song.mp3") by resolving them under the
      // playlist's folder — so the component works even if a source hands over
      // names without paths.
      const list = (this.opts.playlists[mode] || []).map(function (t) {
        if (typeof t === "string" && t.indexOf("/") === -1 && t.indexOf(":") === -1) {
          return "assets/music/" + mode + "/" + t;
        }
        return t;
      });
      const start = this.modeIndex[mode] || 0;
      this.ctrl.setTracks(list, start);
      // Highlight active tab
      const tabs = this.refs.plWrap.querySelectorAll(".mmp-pl-tab");
      for (let i = 0; i < tabs.length; i++) {
        tabs[i].setAttribute("aria-selected", String(tabs[i].getAttribute("data-pl") === mode));
      }
      this._renderTrack();
      this._renderQueue();
    },
    setMode: function (mode) { if (this.opts.playlists[mode]) this._loadMode(mode, false); },

    /* ---------- Audio → UI sync ---------- */
    _onAudioUpdate: function (type, st) {
      if (type === "track" || type === "tracks") { this._renderTrack(); this._renderQueue(); }
      this._renderTransport(st);
      if (type === "progress" && !this._seekApi.isDragging()) {
        const f = st.fraction;
        const pct = (f * 100).toFixed(2) + "%";
        this.refs.seek.fill.style.width = pct;
        this.refs.seek.thumb.style.left = pct;
        this.refs.seek.root.setAttribute("aria-valuenow", Math.round(f * 100));
      }
      if (type === "progress" || type === "meta") {
        this.refs.cur.textContent = formatTime(st.currentTime);
        this.refs.dur.textContent = formatTime(st.duration);
      }
      if (type === "volume") {
        this._volApi.paint(st.volume);
        this._paintVolIcon(st.volume);
      }
      // Keep root playing flag in sync for the equalizer animation
      this.root.setAttribute("data-playing", String(st.playing));
      // Track explicit pause so the autoplay "kick" never overrides it.
      if (type === "play") this._userPaused = false;
      if (type === "pause") this._userPaused = true;
    },
    _renderTransport: function (st) {
      this.refs.playBtn.innerHTML = svg(st.playing ? "pause" : "play");
      this.root.setAttribute("data-playing", String(st.playing));
    },
    _renderTrack: function () {
      const st = this.ctrl.getState();
      this.refs.title.textContent = this._displayTitle();
      this.refs.artist.textContent = st.artist || this._playlistLabel(this._mode || this.opts.startMode);
      // Deterministic gradient cover from the track label/index (no image assets needed).
      const label = (st.label || "") + "|" + st.index;
      let h = 0; for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
      const art = st.art || "";
      if (art) {
        this.refs.art.style.backgroundImage = "url(" + art + ")";
        this.refs.art.style.backgroundSize = "cover";
        this.refs.art.style.backgroundPosition = "center";
        this.refs.art.style.background = "";
      } else {
        this.refs.art.style.backgroundImage = "";
        this.refs.art.style.background =
          "linear-gradient(135deg, hsl(" + h + ",68%,56%), hsl(" + ((h + 38) % 360) + ",64%,42%))";
      }
      this._renderQueue();
    },
    _paintVolIcon: function (v) {
      const name = v <= 0 ? "volumeX" : v < 0.5 ? "volumeLow" : "volume";
      this.refs.volIco.innerHTML = svg(name);
    },
    _renderQueue: function () {
      const self = this, r = this.refs, st = this.ctrl.getState();
      r.qList.innerHTML = "";
      this.ctrl.tracks.forEach(function (t, i) {
        const li = el("li", "mmp-queue-item");
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        if (i === st.index) { li.setAttribute("aria-current", "true"); li.setAttribute("data-playing", String(st.playing)); }
        const idx = el("span", "mmp-qi-idx"); idx.textContent = (i === st.index) ? "" : (i + 1);
        const eq = el("span", "mmp-qi-eq"); eq.appendChild(el("i")); eq.appendChild(el("i")); eq.appendChild(el("i"));
        const name = el("span", "mmp-qi-name");
        name.textContent = (self.aliases[t.src]) || t.label;
        li.appendChild(idx); li.appendChild(eq); li.appendChild(name);
        li.addEventListener("click", function (e) { e.stopPropagation(); self.ctrl.loadTrack(i); self._renderQueue(); });
        li.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); self.ctrl.loadTrack(i); self._renderQueue(); }
        });
        r.qList.appendChild(li);
      });
    },

    _toast: function (msg) {
      const t = this.refs.toast;
      t.textContent = msg; t.setAttribute("data-show", "true");
      const self = this;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.setAttribute("data-show", "false"); }, 1400);
    },

    /* ---------- Autoplay kick ---------- */
    _armAutoplayKick: function () {
      const self = this;
      const kick = function () {
        if (self.ctrl && self.ctrl.tracks.length && !self._userPaused &&
            self.ctrl.getState().playing === false) {
          // user hasn't paused explicitly; give it a nudge now that we have a gesture
          self.ctrl.play();
        }
        document.removeEventListener("pointerdown", kick);
        document.removeEventListener("keydown", kick);
      };
      document.addEventListener("pointerdown", kick, { once: true });
      document.addEventListener("keydown", kick, { once: true });
    },

    /* ---------- Public API ---------- */
    _openSongsModal: function () {
      this.refs.modal.hidden = false;
      this._renderCustomSongsModalList();
    },
    _closeSongsModal: function () {
      this.refs.modal.hidden = true;
    },
    _renderCustomSongsModalList: function () {
      const self = this;
      const listEl = this.refs.modal.querySelector(".mmp-custom-list");
      listEl.innerHTML = "";
      const custom = loadJSON("vocab_custom_tracks_v1", []);
      if (!custom.length) {
        listEl.innerHTML = '<li class="mmp-custom-empty">No custom songs added yet.</li>';
        return;
      }
      custom.forEach(function (t, idx) {
        const li = el("li", "mmp-custom-item");
        const info = el("div", "mmp-ci-info");
        info.innerHTML = '<span class="mmp-ci-title">' + esc(t.label) + '</span><span class="mmp-ci-url">' + esc(t.src) + '</span>';
        const actions = el("div", "mmp-ci-actions");
        const renBtn = el("button", "mmp-ci-btn"); renBtn.textContent = "Rename";
        renBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          const newName = prompt("New song name:", t.label);
          if (newName) self.renameCustomTrack(idx, newName.trim());
        });
        const delBtn = el("button", "mmp-ci-btn mmp-ci-del"); delBtn.textContent = "Delete";
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (confirm("Delete custom song '" + t.label + "'?")) self.deleteCustomTrack(idx);
        });
        actions.appendChild(renBtn); actions.appendChild(delBtn);
        li.appendChild(info); li.appendChild(actions);
        listEl.appendChild(li);
      });
    },
    deleteCustomTrack: function (idx) {
      let custom = loadJSON("vocab_custom_tracks_v1", []);
      if (idx >= 0 && idx < custom.length) {
        custom.splice(idx, 1);
        saveJSON("vocab_custom_tracks_v1", custom);
        this._reloadFusedTracks();
        this._renderCustomSongsModalList();
        this._renderQueue();
        this._toast("Song deleted");
      }
    },
    renameCustomTrack: function (idx, newName) {
      let custom = loadJSON("vocab_custom_tracks_v1", []);
      if (idx >= 0 && idx < custom.length) {
        custom[idx].label = newName;
        saveJSON("vocab_custom_tracks_v1", custom);
        this._reloadFusedTracks();
        this._renderCustomSongsModalList();
        this._renderTrack();
        this._renderQueue();
        this._toast("Renamed to " + newName);
      }
    },
    _reloadFusedTracks: function () {
      let combined = [];
      const order = this.opts.modeOrder || ["library"];
      let playlists = DEFAULT_PLAYLISTS;
      if (global.VOCAB_MUSIC) playlists = global.VOCAB_MUSIC;
      order.forEach(function (k) {
        (playlists[k] || []).forEach(function (t) { combined.push(t); });
      });
      loadJSON("vocab_custom_tracks_v1", []).forEach(function (t) { combined.push(t); });
      this.opts.playlists.library = combined;

      const currentSrc = this.ctrl.getState().src;
      const formattedTracks = combined.map(function (t) {
        if (typeof t === "string") return { src: t, label: prettyName(t), artist: "" };
        return { src: t.src, label: t.label || prettyName(t.src), artist: t.artist || "" };
      });
      this.ctrl.tracks = formattedTracks;
      if (currentSrc) {
        const found = formattedTracks.findIndex(function (tr) { return tr.src === currentSrc; });
        if (found !== -1) this.ctrl.index = found;
        else this.ctrl.index = clamp(this.ctrl.index, 0, Math.max(0, formattedTracks.length - 1));
      }
      this.ctrl.onUpdate("tracks", this.ctrl.getState());
    },
    addCustomTrack: function (t) {
      let custom = loadJSON("vocab_custom_tracks_v1", []);
      custom.push(t);
      saveJSON("vocab_custom_tracks_v1", custom);
      this._reloadFusedTracks();
      const newIdx = this.ctrl.tracks.findIndex(function (tr) { return tr.src === t.src; });
      if (newIdx !== -1) {
        this.ctrl.loadTrack(newIdx, true);
      }
      this._renderQueue();
      this._toast("Added " + t.label);
    },
    addCustomTrackInstant: function (t) {
      const list = this.ctrl.tracks.concat([{ src: t.src, label: t.label, artist: "Local" }]);
      this.ctrl.setTracks(list, list.length - 1);
      this.ctrl.play();
      this._renderQueue();
      this._toast("Playing " + t.label);
    },
    exportPlaylist: function () {
      const custom = loadJSON("vocab_custom_tracks_v1", []);
      const payload = JSON.stringify({ app: "vocab-mini-player", version: 1, tracks: custom }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = el("a");
      a.href = url;
      a.download = "vocab-playlist-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      this._toast(custom.length + " song(s) exported");
    },
    importPlaylist: function (file) {
      const self = this;
      const reader = new FileReader();
      reader.onload = function (evt) {
        try {
          const data = JSON.parse(evt.target.result);
          const arr = (Array.isArray(data) ? data : data && data.tracks) || [];
          const valid = arr.filter(function (t) {
            return t && typeof t.src === "string" && typeof t.label === "string";
          }).map(function (t) { return { label: t.label, src: t.src, art: typeof t.art === "string" ? t.art : "" }; });
          if (!valid.length) { self._toast("No valid tracks in file"); return; }
          const existing = loadJSON("vocab_custom_tracks_v1", []);
          const seen = {};
          existing.forEach(function (t) { seen[t.src] = 1; });
          valid.forEach(function (t) { if (!seen[t.src]) { existing.push(t); seen[t.src] = 1; } });
          saveJSON("vocab_custom_tracks_v1", existing);
          self._reloadFusedTracks();
          self._renderCustomSongsModalList();
          self._renderQueue();
          self._toast("Imported " + valid.length + " song(s)");
        } catch (err) {
          self._toast("Import failed — not a valid playlist JSON");
        }
      };
      reader.onerror = function () { self._toast("Could not read file"); };
      reader.readAsText(file);
    },
    pause: function () { this.ctrl.pause(); },
    toggle: function () { this.ctrl.toggle(); },
    next: function () { this.ctrl.next(); },
    prev: function () { this.ctrl.prev(); },
    setVolume: function (v) { this.ctrl.setVolume(v); },
    getVolume: function () { return this.ctrl.getVolume(); },
    seek: function (f) { this.ctrl.seekFraction(f); },
    seekTo: function (s) { this.ctrl.seekTo(s); },
    loadTrack: function (i) { this.ctrl.loadTrack(i); },
    getState: function () { return this.ctrl.getState(); },
    get isInteracting() { return this._interacting; },
    onInteract: function (cb) { if (typeof cb === "function") this._interactCbs.push(cb); },
    destroy: function () {
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      if (this.refs && this.refs.modal && this.refs.modal.parentNode) this.refs.modal.parentNode.removeChild(this.refs.modal);
      this.root = null; this.ctrl = null; this.refs = null;
      if (global.MiniMusicPlayer === this) delete global.MiniMusicPlayer;
    }
  };

  // Auto-init if the host page set window.MINI_PLAYER_CONFIG before this script.
  if (global.MINI_PLAYER_CONFIG) {
    document.addEventListener("DOMContentLoaded", function () { MiniMusicPlayer.init(global.MINI_PLAYER_CONFIG); });
  }

  global.MiniMusicPlayer = MiniMusicPlayer;
})(typeof window !== "undefined" ? window : this);
