/* Seed test state BEFORE the app loads (first defer script in _plantest.html). */
(function () {
  var qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = { get: function () { return null; } }; }
  var sc = qs.get("scenario") || "b1";

  function todayStr() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    function p(x) { return String(x).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  try { localStorage.clear(); } catch (e) {}
  // Guest-session marker → resetGuestDataIfNewSession() จะไม่ล้าง data ของเรา
  try { sessionStorage.setItem("vocab_guest_session", "1"); } catch (e) {}

  var p = { day: 1, xp: 0 };
  var s = { lang: "en" };
  if (sc === "b1" || sc === "b1-day4" || sc === "change-level") {
    p.cefrLevel = "B1"; p.cefrConfidence = 0.9; p.placementDate = todayStr();
  }
  if (sc === "b1-day4") { s.planStartDate = daysAgo(3); }
  if (sc === "b1" || sc === "change-level") { s.planStartDate = todayStr(); }
  try {
    localStorage.setItem("vocab_progress_v1", JSON.stringify(p));
    localStorage.setItem("vocab_settings_v1", JSON.stringify(s));
  } catch (e) {}
})();