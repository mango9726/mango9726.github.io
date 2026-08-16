"use strict";
const test = require("node:test");
const assert = require("node:assert");

global.window = global;
require("../assets/js/vocab-i18n.js");

const STRINGS = global.window.VOCAB_STRINGS;

test("i18n: TH and EN tables exist", () => {
  assert.ok(STRINGS.th && typeof STRINGS.th === "object");
  assert.ok(STRINGS.en && typeof STRINGS.en === "object");
});

test("i18n: every TH key exists in EN (key parity)", () => {
  const th = STRINGS.th, en = STRINGS.en;
  const missing = Object.keys(th).filter(function (k) { return !(k in en); });
  assert.deepStrictEqual(missing, [], "TH keys missing in EN: " + missing.join(", "));
});

test("i18n: every EN key exists in TH (key parity)", () => {
  const th = STRINGS.th, en = STRINGS.en;
  const missing = Object.keys(en).filter(function (k) { return !(k in th); });
  assert.deepStrictEqual(missing, [], "EN keys missing in TH: " + missing.join(", "));
});

test("i18n: mode keys for all game modes present in TH", () => {
  const th = STRINGS.th;
  ["cards", "quiz", "boss", "pron", "fill", "match", "tf", "hang", "build", "cloze", "listen"].forEach(function (m) {
    assert.ok(th["mode." + m], "missing TH mode." + m);
  });
});

test("i18n: new CSV/pron keys exist in both languages", () => {
  ["cw.importCsv", "cw.csvFormat", "cw.importOk", "cw.importErr", "stats.modeAcc", "stats.days"].forEach(function (k) {
    assert.ok(STRINGS.th[k], "missing TH " + k);
    assert.ok(STRINGS.en[k], "missing EN " + k);
  });
});

test("i18n: profile edit keys exist in both languages", () => {
  ["auth.editProfile", "auth.saveChanges", "auth.profileSaved", "auth.displayName",
   "auth.bio", "auth.bioPlaceholder", "auth.chooseAvatar", "auth.avatarStyle",
   "auth.chooseBanner", "auth.nameTooShort", "auth.masteredWords",
   "auth.achievementsCount", "auth.levelProgress", "auth.cancel"].forEach(function (k) {
    assert.ok(STRINGS.th[k], "missing TH " + k);
    assert.ok(STRINGS.en[k], "missing EN " + k);
  });
});

test("i18n: account-management keys exist in both languages", () => {
  ["auth.ok", "auth.continue", "auth.account", "auth.socialRequiresBackend",
   "auth.githubPromptTitle", "auth.githubUsername", "auth.githubUsernamePlaceholder",
   "auth.applePromptTitle", "auth.appleEmail", "auth.appleEmailPlaceholder",
   "auth.fillField", "auth.resetTitle", "auth.resetCodeHint", "auth.resetCode",
   "auth.newPassword", "auth.resetPassword", "auth.resetDone", "auth.passwordTooShort",
   "auth.staticResetHint", "auth.userNotFound", "auth.changePassword",
   "auth.currentPassword", "auth.passwordChanged", "auth.changeUsername",
   "auth.newUsername", "auth.usernameChanged", "auth.usernameTaken",
   "auth.usernameChangeUnsupported", "auth.changeEmail", "auth.newEmail",
   "auth.emailChanged", "auth.verifyEmail", "auth.verifyEmailSent",
   "auth.invalidEmail", "auth.notLoggedIn", "auth.changeFailed",
   "auth.wrongCurrentPassword", "auth.emailNotSupported"].forEach(function (k) {
    assert.ok(STRINGS.th[k], "missing TH " + k);
    assert.ok(STRINGS.en[k], "missing EN " + k);
  });
});