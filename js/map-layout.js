(function () {
  "use strict";

  var KEY = "museum_map_layout_v1";
  var ROOM_KEYS = ["id", "title", "chapter", "width", "height", "spawn", "walkable", "colliders", "objects"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function point(value, fallback) {
    value = value || {};
    fallback = fallback || { x: 0, y: 0 };
    return { x: number(value.x, fallback.x), y: number(value.y, fallback.y) };
  }

  function rects(value) {
    return Array.isArray(value) ? value.map(function (rect) {
      return { x: number(rect.x, 0), y: number(rect.y, 0), w: number(rect.w, 0), h: number(rect.h, 0) };
    }).filter(function (rect) { return rect.w > 0 && rect.h > 0; }) : [];
  }

  function objects(value) {
    return Array.isArray(value) ? value.map(function (object) {
      var copy = clone(object || {});
      copy.x = number(copy.x, 0);
      copy.y = number(copy.y, 0);
      copy.r = number(copy.r, 48);
      return copy;
    }).filter(function (object) { return object.id; }) : [];
  }

  function serializeRoom(room) {
    var result = {};
    ROOM_KEYS.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(room, key)) return;
      if (key === "spawn") result.spawn = point(room.spawn);
      else if (key === "walkable" || key === "colliders") result[key] = rects(room[key]);
      else if (key === "objects") result.objects = objects(room.objects);
      else if (room[key] !== undefined) result[key] = room[key];
    });
    return result;
  }

  function capture(rooms) {
    var result = { version: 1, savedAt: new Date().toISOString(), rooms: {} };
    Object.keys(rooms || {}).forEach(function (id) {
      result.rooms[id] = serializeRoom(rooms[id]);
      if (!result.rooms[id].walkable) result.rooms[id].walkable = [];
    });
    return result;
  }

  function normalize(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    if (payload.version !== undefined && payload.version !== 1) return null;
    var source = payload.rooms && typeof payload.rooms === "object" ? payload.rooms : payload;
    if (Array.isArray(source)) return null;
    var invalid = Object.keys(source).some(function (id) {
      if (["__proto__", "constructor", "prototype"].indexOf(id) !== -1) return true;
      var room = source[id];
      function finite(n) { return typeof n === "number" && Number.isFinite(n); }
      function position(p) { return p && finite(p.x) && finite(p.y); }
      if (!room || typeof room !== "object" || Array.isArray(room)) return true;
      if (room.spawn !== undefined && !position(room.spawn)) return true;
      if (["width", "height"].some(function (k) { return room[k] !== undefined && (!finite(room[k]) || room[k] <= 0); })) return true;
      if (["walkable", "colliders"].some(function (k) {
        return room[k] !== undefined && (!Array.isArray(room[k]) || room[k].some(function (r) {
          return !position(r) || !finite(r.w) || !finite(r.h) || r.w <= 0 || r.h <= 0;
        }));
      })) return true;
      var ids = new Set();
      return room.objects !== undefined && (!Array.isArray(room.objects) || room.objects.some(function (o) {
        if (!position(o) || typeof o.id !== "string" || !o.id || ids.has(o.id)) return true;
        ids.add(o.id);
        return (o.r !== undefined && (!finite(o.r) || o.r <= 0)) || (o.entry && !position(o.entry)) || (o.approach && !position(o.approach));
      }));
    });
    if (invalid) return null;
    var result = { version: 1, savedAt: payload.savedAt || new Date().toISOString(), rooms: {} };
    Object.keys(source).forEach(function (id) {
      var room = source[id];
      if (!room || typeof room !== "object") return;
      result.rooms[id] = serializeRoom(room);
    });
    return Object.keys(result.rooms).length ? result : null;
  }

  function apply(rooms, payload) {
    var normalized = normalize(payload);
    if (!normalized) return false;
    var applied = false;
    Object.keys(normalized.rooms).forEach(function (id) {
      if (!rooms || !Object.prototype.hasOwnProperty.call(rooms, id)) return;
      var target = rooms && rooms[id], source = normalized.rooms[id];
      if (!target) return;
      applied = true;
      if (source.spawn) target.spawn = point(source.spawn, target.spawn);
      if (source.walkable) {
        if (source.walkable.length) target.walkable = rects(source.walkable);
        else delete target.walkable;
      }
      if (source.colliders) target.colliders = rects(source.colliders);
      if (source.objects) target.objects = objects(source.objects);
      if (source.width) target.width = number(source.width, target.width);
      if (source.height) target.height = number(source.height, target.height);
      if (source.title) target.title = source.title;
      if (source.chapter) target.chapter = source.chapter;
    });
    return applied;
  }

  function read() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || "null")); }
    catch (error) { return null; }
  }

  function write(payload) {
    var normalized = normalize(payload);
    if (!normalized) return false;
    try { localStorage.setItem(KEY, JSON.stringify(normalized)); return true; }
    catch (error) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); return true; }
    catch (error) { return false; }
  }

  function applySaved(rooms) {
    var projectApplied = window.MuseumMapLayoutData ? apply(rooms, window.MuseumMapLayoutData) : false;
    var payload = read();
    return payload ? apply(rooms, payload) : projectApplied;
  }

  function download(payload, filename) {
    var blob = new Blob([JSON.stringify(normalize(payload) || payload, null, 2)], { type: "application/json;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename || "museum-map-layout.json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
  }

  window.MuseumMapLayout = {
    KEY: KEY,
    capture: capture,
    normalize: normalize,
    apply: apply,
    read: read,
    write: write,
    clear: clear,
    applySaved: applySaved,
    download: download
  };
}());
