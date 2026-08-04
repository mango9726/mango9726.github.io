/* Boot the mini music player once the secure storage layer is ready
   (mini-player reads/writes its aliases through window.SecureStore). */
(function () {
  "use strict";
  function boot() {
    if (window.MiniMusicPlayer) window.MiniMusicPlayer.init({ autoStart: true });
  }
  if (window.SecureStore && window.SecureStore.ready) {
    window.SecureStore.ready.then(boot).catch(boot);
  } else {
    boot();
  }
})();
