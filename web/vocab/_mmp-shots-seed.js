/* Shots harness: init the mini-player with the real songs, seed a couple of
   favorites + history so the Favorites / Recently Played stations have content,
   then expand the panel and open the queue for the screenshot. */
(function () {
  "use strict";
  function seedFavsAndExpand() {
    if (!window.MiniMusicPlayer) return;
    var p = window.MiniMusicPlayer;

    // Seed persisted data through SecureStore (or localStorage fallback) so the
    // dynamic stations show content.
    var store = window.SecureStore || {
      load: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
      save: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
    // Favorites: two lowfi/jazz tracks from the "all" library (indices 0 and 2).
    store.save("vocab_miniplayer_favs_v1", [
      "assets/music/onpage/alex-morgan-jazz-restaurant-music-556244.mp3",
      "assets/music/onpage/alex-morgan-lofi-jazz-retro-coffee-shop-560042.mp3"
    ]);
    store.save("vocab_miniplayer_history_v1", [
      { srcKey: "assets/music/onpage/alex-morgan-lofi-jazz-study-music-564256.mp3", src: "assets/music/onpage/alex-morgan-lofi-jazz-study-music-564256.mp3", label: "Lofi Jazz Study Music", at: Date.now() },
      { srcKey: "assets/music/ingame/ingamesong4.mp3", src: "assets/music/ingame/ingamesong4.mp3", label: "Game Track 4", at: Date.now() - 60000 }
    ]);

    // Re-read the seeded data into the player object.
    p.favs = store.load("vocab_miniplayer_favs_v1", []);
    p.history = store.load("vocab_miniplayer_history_v1", []);

    // Rebuild + open the "all" station, then expand the panel and queue.
    p._loadMode("all", true);
    p._setPinned(true);
    p._expand();
    var queue = document.querySelector(".mmp-queue-panel");
    var qBtn = document.querySelector(".mmp-ctrl.mmp-queue");
    if (queue) queue.hidden = false;
    if (qBtn) qBtn.setAttribute("aria-expanded", "true");
    p._refreshTabCounts();
    p._renderFavBtn();
    p._renderQueue();
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (window.MiniMusicPlayer) {
      window.MiniMusicPlayer.init({ autoStart: false });
      seedFavsAndExpand();
    }
  });
})();
