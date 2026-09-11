/*
 * 按需加载的地图图片。
 *
 * 原来 js/map-art.js 在脚本求值阶段就给**每个**房间建 `new Image()` 并设置 src，
 * 于是开局（还在主菜单）就把全部 9 张地图拉下来——实测 14.5 MB，而其中只有 1 张会被画出来。
 *
 * 这里的做法：`Image` 对象立刻建好（房间数据里 `art` 的形状不变，任何按图片用的代码都不用改），
 * 只在它上面挂一个 `load()`。`src` 推迟到真正要画这个房间时才设置；加载完成或失败后调用一次
 * onReady（用来重绘）。绘制代码本来就在检查 `art.complete && art.naturalWidth`，所以未加载时
 * 只会先显示底色，不会画错。
 */
(function () {
  "use strict";
  if (window.MuseumLazyImage) return;

  var pending = [];

  function urlFor(name, category) {
    if (window.MuseumAssets) return window.MuseumAssets.url(name, category || "maps");
    return "assets/images/maps/" + name;
  }

  function attach(image, name, category, onReady) {
    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      if (typeof onReady === "function") { try { onReady(image); } catch (error) { console.warn("地图重绘回调失败：", error); } }
    }
    image.onload = settle;
    image.onerror = function () { console.warn("地图素材加载失败：" + name); settle(); };
    // 同一个房间的加载请求合并：每帧调用也只会真正发一次。
    image.load = function () {
      if (!image.src) { image.src = urlFor(name, category); pending.push(image); }
      return image;
    };
    image.lazyName = name;
    return image;
  }

  // 立刻返回一个 Image（形状与原来一致），但 src 为空。
  function create(name, category, onReady) {
    return attach(new Image(), name, category, onReady);
  }

  // 已经存在的 Image（例如某处已经设过 src）也接上同一个 load()，避免重复加载。
  function adopt(image, name, category, onReady) {
    if (!image) return create(name, category, onReady);
    if (image.load) return image;
    return attach(image, name, category, onReady);
  }

  window.MuseumLazyImage = { create: create, adopt: adopt, urlFor: urlFor, pending: pending };
}());
