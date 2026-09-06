(function () {
  /* Exam screenshot harness — navigate to a view based on location.hash. */
  var target = (location.hash || "#exam").slice(1);
  window.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      try {
        if (window.VocabApp && window.VocabApp.showView) {
          window.VocabApp.showView(target);
        }
      } catch (e) { /* ignore */ }
    }, 900);
  });
})();