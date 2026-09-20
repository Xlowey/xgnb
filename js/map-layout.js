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
        return (o.r !== undefined && (!finite(o.r) || o.r <= 0)) || (o.entry && (!position(o.entry) || (o.entry.doorId !== undefined && (typeof o.entry.doorId !== "string" || !finite(o.entry.dx) || !finite(o.entry.dy))))) || (o.approach && !position(o.approach));
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
    // Investigation IDs are referenced by story completion flags. Do not allow
    // an import to remove a required step or insert an unhandled interaction.
    if (Object.keys(normalized.rooms).some(function (id) {
      var target=rooms && rooms[id], source=normalized.rooms[id];
      return target && target.kind && source.objects &&
        (source.objects.length!==target.objects.length || source.objects.some(function(o){return !target.objects.some(function(t){return t.id===o.id;});}));
    })) return false;
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
      if (source.objects) target.objects = target.kind ? target.objects.map(function(o){
        var edited=source.objects.find(function(p){return p.id===o.id;});
        var next=clone(o);
        ["x","y","r","label","approach"].forEach(function(k){if(edited[k]!==undefined)next[k]=clone(edited[k]);});
        return next;
      }) : objects(source.objects);
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

  function connectDoors(rooms) {
    function get(r,id){return rooms[r] && rooms[r].objects.find(function(o){return o.id===id;});}
    if(rooms.canteenPassage){
      var gate=get("canteenPassage","canteen-door-story"),old=get("canteenPassage","canteen-enter");
      if(gate){Object.assign(gate,{type:"travel",target:"canteen",scene:"scene-07",requiredFlag:"scene06Seen",gateFlag:"scene11Seen"});
        rooms.canteenPassage.objects=rooms.canteenPassage.objects.filter(function(o){return o.id!=="canteen-enter";});}
      else if(old)Object.assign(old,{id:"canteen-door-story",scene:"scene-07",gateFlag:"scene11Seen",requiredFlag:"scene06Seen"});
    }
    function pair(a,ai,b,bi,ax,ay,bx,by){
      var left=get(a,ai),right=get(b,bi);if(!left||!right)return;
      function bind(o,door,dx,dy){if(o.entry && (o.entry.doorId || o.entry.detached))return;
        o.entry={x:door.x+dx,y:door.y+dy,doorId:door.id,dx:dx,dy:dy,facing:dx<0?"left":dx>0?"right":dy<0?"up":"down"};}
      bind(left,right,bx,by);bind(right,left,ax,ay);
    }
    pair("museum","overview-dorm","corridor","corridor-hall",0,22,-90,0);
    pair("dorm","dorm-door","corridor","corridor-dorm",0,-60,65,0);
    pair("museum","overview-wax","wax","wax-return",0,0,0,-10);
    pair("museum","overview-hall","hall","hall-corridor",0,0,0,-65);
    pair("museum","overview-office","office","office-exit",0,0,0,-65);
    pair("museum","overview-canteen","canteenPassage","canteen-return",0,0,0,-70);
    pair("canteenPassage","canteen-door-story","canteen","canteen-exit",0,110,0,-110);
  }

  function applySaved(rooms) {
    var projectApplied = window.MuseumMapLayoutData ? apply(rooms, window.MuseumMapLayoutData) : false;
    var payload = read();
    var applied=payload ? apply(rooms,payload) : projectApplied;
    connectDoors(rooms);return applied;
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
    connectDoors: connectDoors,
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
