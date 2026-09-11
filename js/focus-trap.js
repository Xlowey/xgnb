/*
 * 浮层焦点管理。
 *
 * 项目里有 6 个浮层声明了 aria-modal="true"，但打开时既不把焦点移进去，也不把 Tab
 * 限制在里面。实测（桌面 1366x768）Tab 会跑到浮层背后的控件上：
 *   地图暂停 5/14 次、地图存档 3/16、回顾 11/12、规则小游戏 9/10、剧情暂停 7/10、剧情回顾 9/10。
 * 对屏幕阅读器和键盘用户来说，这等于"对话框打开了，但焦点还在页面上"。
 *
 * 本模块只做三件事：打开时把焦点移到浮层内第一个可聚焦控件；Tab / Shift+Tab 在浮层
 * 内循环；关闭时把焦点还给打开它的那个控件。原生 <dialog>（背包 / 成就 / 故事存档）
 * 由浏览器自己管，不在这里处理。
 *
 * 用法：mark(el, {onClose: fn, initial: selector})。用轮询而不是 MutationObserver，
 * 因为浮层是改 `hidden` 属性来开关的，属性变化在各浏览器上的记录并不可靠。
 */
(function () {
  "use strict";
  if (window.MuseumFocus) return;

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var traps = [];
  var lastFocus = new WeakMap();

  function isOpen(el) { return el && !el.hidden; }

  function focusable(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (node) {
      if (node.hasAttribute("inert") || node.closest("[inert]")) return false;
      var rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 || node === document.activeElement;
    });
  }

  function mark(el, options) {
    if (!el) return null;
    var config = options || {};
    var trap = { el: el, onClose: config.onClose || null, initial: config.initial || null, wasOpen: false };
    traps.push(trap);
    return trap;
  }

  function activeTrap() {
    // 最内层、最后标记的浮层优先。
    for (var i = traps.length - 1; i >= 0; i -= 1) if (isOpen(traps[i].el)) return traps[i];
    return null;
  }

  function sync() {
    var current = activeTrap();
    traps.forEach(function (trap) {
      var open = isOpen(trap.el);
      if (open && !trap.wasOpen) {
        // 打开：记住来源，把焦点移进去。若浮层是键盘快捷键调起的（比如 Esc 暂停），
        // 当时焦点常在 body 上，归还到 body 没有意义，改记为触发用的控件。
        var from = document.activeElement;
        if (!from || from === document.body) from = trap.el.__trigger || null;
        lastFocus.set(trap.el, from);
        var target = (trap.initial && trap.el.querySelector(trap.initial)) || focusable(trap.el)[0] || trap.el;
        if (target === trap.el && !trap.el.hasAttribute("tabindex")) trap.el.setAttribute("tabindex", "-1");
        try { target.focus({ preventScroll: true }); } catch (error) { /* 忽略不可聚焦的元素 */ }
      } else if (!open && trap.wasOpen) {
        // 关闭：把焦点还给打开它的控件；没有来源时回到页面第一个可聚焦元素。
        var back = lastFocus.get(trap.el);
        if (!back || !document.contains(back) || back.closest("[hidden]")) back = focusable(document.body)[0] || null;
        if (back && !trap.el.contains(back)) { try { back.focus({ preventScroll: true }); } catch (error) { /* noop */ } }
      }
      trap.wasOpen = open;
    });
    // 内层浮层关闭后，焦点可能落在被压住的上一层之外，拉回来。
    if (current) {
      var inside = current.el.contains(document.activeElement);
      if (!inside && document.activeElement !== document.body) {
        var first = focusable(current.el)[0];
        if (first) { try { first.focus({ preventScroll: true }); } catch (error) { /* noop */ } }
      }
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    var trap = activeTrap();
    if (!trap) return;
    var items = focusable(trap.el);
    if (!items.length) { event.preventDefault(); return; }
    var first = items[0], last = items[items.length - 1];
    var active = document.activeElement;
    // 焦点在浮层之外，或走到两端，就绕回浮层内。
    if (!trap.el.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); return; }
    if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }, true);

  window.setInterval(sync, 120);
  window.MuseumFocus = { mark: mark, sync: sync, focusable: focusable };
}());
