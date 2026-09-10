(function () {
  "use strict";
  var step = {
    seed: document.getElementById("setupSeed"),
    form: document.getElementById("setupForm"),
    done: document.getElementById("setupDone"),
    accName: document.getElementById("accName"),
    accUser: document.getElementById("accUser"),
    accPass: document.getElementById("accPass")
  };

  function ready(cb) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.VocabAuth && window.VocabAuth.register && window.SecureStore) {
        clearInterval(iv); cb();
      } else if (tries > 400) { clearInterval(iv); showError("App scripts did not finish loading."); }
    }, 50);
  }

  function showError(msg) {
    var el = document.getElementById("setupError");
    if (el) { el.textContent = msg; el.classList.remove("hidden"); }
  }

  function setBusy(b) {
    var btn = document.getElementById("setupCreate");
    if (btn) { btn.disabled = b; btn.textContent = b ? "กำลังสร้างบัญชี…" : "สร้างบัญชีพร้อมข้อมูล demo"; }
  }

  function closeOverlay() {
    var o = document.getElementById("setupOverlay");
    if (o) { o.classList.remove("open"); o.setAttribute("aria-hidden", "true"); }
  }
  var closeBtn = document.getElementById("setupClose");
  if (closeBtn) closeBtn.addEventListener("click", closeOverlay);
  var seedNote = document.getElementById("setupSeed");
  if (seedNote) seedNote.classList.add("hidden");

  ready(function () {
    step.form.classList.remove("hidden");

    function doRegister(e) {
      e.preventDefault();
      showError("");
      var username = step.accUser.value.trim();
      var password = step.accPass.value;
      if (username.length < 3) { showError("ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร"); return; }
      if (password.length < 4) { showError("รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร"); return; }
      var name = step.accName.value.trim() || username;
      setBusy(true);
      window.VocabAuth.register(username, password, true)
        .then(function () {
          try {
            var u = window.VocabAuth.getUser();
            if (u) {
              u.username = name;
              window.VocabAuth.setUser && window.VocabAuth.setUser(u);
            }
          } catch (err) {}
          step.form.classList.add("hidden");
          step.done.classList.remove("hidden");
          document.getElementById("doneUser").textContent = username;
          document.getElementById("doneName").textContent = name;
        })
        .catch(function (err) {
          showError((err && err.message) ? err.message : "สร้างบัญชีไม่สำเร็จ โปรดลองใหม่");
          setBusy(false);
        });
    }

    step.form.addEventListener("submit", doRegister);
  });
})();
