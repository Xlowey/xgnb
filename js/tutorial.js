(function () {
  "use strict";

  var DEFAULTS = {
    movement: false,
    investigation: false,
    dialogue: false,
    inventory: false,
    itemRead: false,
    save: false,
    branch: false
  };
  var context = null;
  var cue = null;
  var activeId = null;
  var dismissed = {};

  function state() {
    return context && context.getState ? context.getState() : null;
  }

  function ensure(target) {
    if (!target) return DEFAULTS;
    target.tutorial = Object.assign({}, DEFAULTS, target.tutorial || {});
    return target.tutorial;
  }

  function buildCue() {
    if (cue) return cue;
    cue = document.createElement("aside");
    cue.className = "tutorial-cue";
    cue.setAttribute("role", "status");
    cue.setAttribute("aria-live", "polite");
    cue.hidden = true;
    document.body.appendChild(cue);
    return cue;
  }

  function hide(id) {
    if (!cue) return;
    if (id && activeId !== id) return;
    cue.hidden = true;
    cue.textContent = "";
    activeId = null;
  }

  function complete(id) {
    var target = state();
    if (!target || !id) return;
    var flags = ensure(target);
    if (flags[id]) {
      if (activeId === id) hide(id);
      return;
    }
    flags[id] = true;
    if (context && context.save) context.save();
    hide(id);
  }

  function isDone(id) {
    var target = state();
    return Boolean(target && ensure(target)[id]);
  }

  function show(id, options) {
    options = options || {};
    var target = state();
    if (!target || !id || isDone(id) || dismissed[id]) return;
    if (activeId === id && cue && !cue.hidden) return;
    if (activeId && cue && !cue.hidden) return;
    var box = buildCue();
    activeId = id;
    box.className = "tutorial-cue tutorial-cue-" + (options.kind || id);
    box.textContent = "";
    var kicker = document.createElement("small");
    kicker.className = "tutorial-cue-kicker";
    kicker.textContent = options.kicker || "第一次遇到";
    var title = document.createElement("strong");
    title.className = "tutorial-cue-title";
    title.textContent = options.title || "小提示";
    var body = document.createElement("p");
    body.className = "tutorial-cue-body";
    body.textContent = options.body || "";
    var actions = document.createElement("div");
    actions.className = "tutorial-cue-actions";
    if (options.action) {
      var action = document.createElement("button");
      action.type = "button";
      action.className = "tutorial-cue-action";
      action.textContent = options.actionLabel || "现在试试";
      action.addEventListener("click", function (event) {
        event.stopPropagation();
        options.action();
      });
      actions.appendChild(action);
    }
    var later = document.createElement("button");
    later.type = "button";
    later.className = "tutorial-cue-later";
    later.textContent = "稍后提醒";
    later.addEventListener("click", function (event) {
      event.stopPropagation();
      dismissed[id] = true;
      hide(id);
    });
    actions.appendChild(later);
    box.append(kicker, title, body, actions);
    box.hidden = false;
  }

  function bind(options) {
    context = options || null;
    if (context && context.getState) ensure(context.getState());
  }

  function resetDismissed() {
    dismissed = {};
  }

  window.MuseumTutorial = {
    bind: bind,
    ensure: ensure,
    show: show,
    hide: hide,
    complete: complete,
    isDone: isDone,
    resetDismissed: resetDismissed
  };
}());
