(function () {
  "use strict";
  var root = new URL("../assets/audio/sfx/", document.currentScript.src);
  var files = {cabinet:"cabinet.mp3",system:"system.mp4",victory:"victory.mp3",advance:"advance.mp3",collect:"collect.mp3",transition:"transition.mp3"};
  var clips = {}, last = {}, enabled = true, pending = null;
  try { enabled = localStorage.getItem("museum_sfx_enabled_v1") !== "false"; } catch (_) {}
  function play(name) {
    if (!enabled || !files[name] || document.hidden) return;
    var now = Date.now();
    if (last[name] && now - last[name] < 100) return;
    last[name] = now;
    var clip = clips[name];
    if (!clip) { clip = clips[name] = new Audio(new URL(files[name], root).href); clip.preload = "auto"; clip.volume = name === "advance" ? 0.28 : 0.55; }
    clip.currentTime = 0;
    var result = clip.play();
    if (result && result.catch) result.catch(function (error) {
      if (error.name === "NotAllowedError" && (name === "system" || name === "transition")) pending = {name:name, at:Date.now()};
    });
  }
  function queueTransition() { try { sessionStorage.setItem("museum_sfx_transition_v1", String(Date.now())); } catch (_) {} }
  function unlock() { var p = pending; pending = null; if (p && Date.now()-p.at < 10000) play(p.name); }
  function sync() { document.querySelectorAll("[data-sfx-toggle]").forEach(function (b) { b.textContent = "音效 · " + (enabled ? "开" : "关"); b.setAttribute("aria-pressed", String(enabled)); }); }
  function toggle() {
    enabled = !enabled; pending = null;
    if (!enabled) Object.keys(clips).forEach(function (key) { clips[key].pause(); });
    try { localStorage.setItem("museum_sfx_enabled_v1", String(enabled)); } catch (_) {}
    sync();
  }
  function bind() {
    document.querySelectorAll("[data-audio-toggle]").forEach(function (b) {
      var control = document.createElement("button"); control.type = "button"; control.className = b.className; control.setAttribute("data-sfx-toggle", ""); control.addEventListener("click",toggle); b.after(control);
    });
    sync();
    document.addEventListener("pointerdown", unlock, {passive:true});
    document.addEventListener("keydown", unlock, {passive:true});
    document.addEventListener("visibilitychange", function () { if (document.hidden) { pending = null; Object.keys(clips).forEach(function (key) { clips[key].pause(); }); } });
    try { var at = Number(sessionStorage.getItem("museum_sfx_transition_v1")); sessionStorage.removeItem("museum_sfx_transition_v1"); if (at && Date.now()-at < 10000) play("transition"); } catch (_) {}
  }
  window.MuseumSfx = {play:play,queueTransition:queueTransition,toggle:toggle,isEnabled:function(){return enabled;}};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",bind,{once:true}); else bind();
}());
