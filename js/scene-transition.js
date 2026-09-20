(function () {
  "use strict";
  function finite(value) { return value !== null && value !== undefined && Number.isFinite(Number(value)); }
  function point(value, fallback) {
    var source = value || {};
    return { x: finite(source.x) ? Number(source.x) : fallback.x, y: finite(source.y) ? Number(source.y) : fallback.y, facing: source.facing || fallback.facing || "down" };
  }
  function defaultEntry(from, target, rooms) {
    // Every cross-room edge has a deterministic landing point.  This is only a
    // migration fallback for old map data; new doors should carry `entry`.
    var museum = {
      corridor: {x:345,y:352,facing:"right"}, hall: {x:615,y:465,facing:"down"},
      wax: {x:799,y:300,facing:"down"}, office: {x:345,y:480,facing:"right"},
      canteenPassage: {x:769,y:430,facing:"left"}
    };
    if (target === "museum" && museum[from]) return museum[from];
    return rooms && rooms[target] ? Object.assign({}, rooms[target].spawn, {facing:"down"}) : {x:0,y:0,facing:"down"};
  }
  function resolveEntry(state, target, entry, rooms) {
    var fallback = defaultEntry(state && state.roomId, target, rooms);
    return point(entry, fallback);
  }
  function enterRoom(state, target, entry, rooms) {
    if (!state || !rooms || !rooms[target]) return false;
    var destination = resolveEntry(state, target, entry, rooms);
    state.roomId = target; state.currentNode = target; state.chapter = rooms[target].chapter;
    state.playerX = destination.x; state.playerY = destination.y; state.facing = destination.facing;
    state.mode = "explore"; state.mapReturnPoint = null;
    return true;
  }
  function enterStory(state, id, options) {
    options = options || {};
    state.returnRoom=options.returnRoom || state.roomId; state.returnX=finite(options.returnX) ? Number(options.returnX) : state.playerX;
    state.returnY=finite(options.returnY) ? Number(options.returnY) : state.playerY; state.returnFacing=options.returnFacing || state.facing || "down";
    state.returnScene=null; state.mode="novel"; state.narrativeNode=id; state.narrativeIndex=0; state.narrativeChoice=null;
  }
  function leaveStory(state, options) {
    options = options || {};
    state.mode="explore"; state.narrativeNode=null; state.narrativeIndex=0; state.narrativeChoice=null; state.returnScene=null;
    if(options.roomId) state.roomId=options.roomId;
    else if(state.returnRoom)state.roomId=state.returnRoom;
    if(finite(options.x)) state.playerX=Number(options.x);
    else if(finite(state.returnX))state.playerX=Number(state.returnX);
    if(finite(options.y)) state.playerY=Number(options.y);
    else if(finite(state.returnY))state.playerY=Number(state.returnY);
    if(options.facing || state.returnFacing)state.facing=options.facing || state.returnFacing;
    state.currentNode=state.roomId;
    state.returnRoom=null;state.returnX=null;state.returnY=null;state.returnFacing="down"; state.mapReturnPoint=null;
  }
  window.MuseumTransition={enterStory:enterStory,leaveStory:leaveStory,enterRoom:enterRoom,resolveEntry:resolveEntry};
}());
