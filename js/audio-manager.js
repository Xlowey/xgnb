(function () {
  "use strict";

  var STORAGE_KEY = "museum_audio_settings_v1";
  var DEFAULT_VOLUME = 0.42;
  var PERSIST_INTERVAL = 1500;
  var script = document.currentScript;
  var source = new URL("../assets/audio/music/整体bgm暂定.mp3", script && script.src || document.baseURI).href;
  var audio = new Audio(source);
  var settings = { enabled: true, volume: DEFAULT_VOLUME, position: 0 };
  var startedOnce = false;
  var lastSavedAt = 0;
  var positionRestored = false;
  var positionRestorePending = false;
  var playPending = false;
  var resumeTarget = null;

  audio.loop = true;
  audio.preload = "auto";

  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      settings.enabled = saved.enabled !== false;
      settings.volume = Number.isFinite(Number(saved.volume)) ? Math.min(1, Math.max(0, Number(saved.volume))) : DEFAULT_VOLUME;
      settings.position = Number.isFinite(Number(saved.position)) ? Math.max(0, Number(saved.position)) : 0;
    }
  } catch (error) {
    // 无痕模式或禁用 localStorage 时仍允许本页播放。
  }
  audio.volume = settings.volume;

  function restorePosition() {
    if (positionRestored || !settings.position || !Number.isFinite(Number(settings.position))) {
      positionRestored = true;
      return;
    }
    var apply = function () {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      // 循环音乐到尾部时从头继续，但不会因为换页面而从头开始。
      resumeTarget = Number(settings.position) % audio.duration;
      audio.currentTime = resumeTarget;
      positionRestored = true;
      positionRestorePending = false;
    };
    if (audio.readyState >= 1) apply();
    else if (!positionRestorePending) {
      positionRestorePending = true;
      audio.addEventListener("loadedmetadata", apply, { once: true });
    }
  }

  function persist(force) {
    // 新页面的 Audio 元数据加载前 currentTime 通常是 0。此时不能把上一页
    // 已保存的播放位置覆盖掉，否则切页后 BGM 会被重置到开头。
    if (settings.position > 0 && !positionRestored) return;
    var now = Date.now();
    if (!force && now - lastSavedAt < PERSIST_INTERVAL) return;
    lastSavedAt = now;
    var currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : settings.position;
    // 某些浏览器在新页面的媒体元数据刚到达时会短暂回报 0；不要用这个
    // 瞬时值覆盖上一页的有效进度，否则切页后看起来就像 BGM 重头播放。
    if (resumeTarget !== null && settings.position > 1) {
      var distance = Math.abs(currentTime - resumeTarget);
      if (Number.isFinite(audio.duration) && audio.duration > 0) distance = Math.min(distance, Math.abs(audio.duration - distance));
      if (distance > 2) return;
      resumeTarget = null;
    }
    if (settings.position > 1 && currentTime < 1) return;
    settings.position = currentTime;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (error) { /* ignore */ }
  }

  function syncControls() {
    document.querySelectorAll("[data-audio-toggle]").forEach(function (button) {
      button.textContent = settings.enabled ? "音乐 · 开" : "音乐 · 关";
      button.setAttribute("aria-pressed", String(settings.enabled));
      button.setAttribute("aria-label", settings.enabled ? "关闭背景音乐" : "打开背景音乐");
      button.title = settings.enabled ? "关闭背景音乐" : "打开背景音乐";
    });
  }

  function start() {
    if (!settings.enabled) return Promise.resolve(false);
    restorePosition();
    // 移动、调查等键盘输入不会反复触碰正在播放的音频，避免每次按键卡顿。
    if (!audio.paused) return Promise.resolve(true);
    if (playPending) return Promise.resolve(true);
    playPending = true;
    var result = audio.play();
    startedOnce = true;
    if (result && typeof result.catch === "function") {
      result.catch(function () {
        // 浏览器尚未获得用户手势时会拒绝播放；下一次点击/按键会重试。
      }).finally(function () { playPending = false; });
    } else playPending = false;
    return result || Promise.resolve(true);
  }

  function stop() {
    audio.pause();
    persist(true);
    syncControls();
  }

  function toggle() {
    settings.enabled = !settings.enabled;
    if (settings.enabled) start();
    else stop();
    persist(true);
    syncControls();
  }

  function bind() {
    document.querySelectorAll("[data-audio-toggle]").forEach(function (button) {
      button.addEventListener("click", toggle);
    });

    // 自动播放被浏览器拦截时，用玩家第一次真实操作补启动。
    document.addEventListener("pointerdown", function () {
      if (audio.paused) start();
    }, { passive: true });
    document.addEventListener("keydown", function (event) {
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (audio.paused) start();
    }, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && settings.enabled) start();
      if (document.hidden) persist(true);
    });
    audio.addEventListener("timeupdate", function () { persist(false); });
    window.addEventListener("pagehide", function () { persist(true); });
    window.addEventListener("beforeunload", function () { persist(true); });
    syncControls();
    start();
  }

  window.MuseumAudio = {
    audio: audio,
    start: start,
    stop: stop,
    toggle: toggle,
    isEnabled: function () { return settings.enabled; },
    hasStarted: function () { return startedOnce; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
}());
