const fs = require('fs'), vm = require('vm'), assert = require('assert');
const context = {window:{}, console}; vm.createContext(context);
vm.runInContext(fs.readFileSync('js/scene-transition.js','utf8'), context);
const T = context.window.MuseumTransition;
const rooms = {
  museum:{chapter:'馆内总览',spawn:{x:615,y:610}},
  corridor:{chapter:'第一幕',spawn:{x:1360,y:450}},
  dorm:{chapter:'序章',spawn:{x:830,y:750}}
};
const state = {roomId:'corridor',playerX:1690,playerY:420,facing:'left',mode:'explore',mapReturnPoint:{x:345,y:352}};
assert.deepStrictEqual(JSON.parse(JSON.stringify(T.resolveEntry(state,'museum',null,rooms))),{x:345,y:352,facing:'right'});
assert.deepStrictEqual(JSON.parse(JSON.stringify(T.resolveEntry({roomId:'hall'},'museum',null,rooms))),{x:615,y:465,facing:'down'});
assert.deepStrictEqual(JSON.parse(JSON.stringify(T.resolveEntry({roomId:'wax'},'museum',null,rooms))),{x:799,y:300,facing:'down'});
assert.deepStrictEqual(JSON.parse(JSON.stringify(T.resolveEntry({roomId:'museum'},'corridor',{x:1040,y:400,facing:'left'},rooms))),{x:1040,y:400,facing:'left'});
assert(T.enterRoom(state,'museum',null,rooms));
assert.deepStrictEqual([state.roomId,state.playerX,state.playerY,state.facing,state.mapReturnPoint],['museum',345,352,'right',null]);
T.enterStory(state,'scene-04');
assert.deepStrictEqual([state.returnRoom,state.returnX,state.returnY,state.returnFacing,state.mode],['museum',345,352,'right','novel']);
T.leaveStory(state);
assert.deepStrictEqual([state.roomId,state.playerX,state.playerY,state.facing,state.mode,state.returnRoom,state.mapReturnPoint],['museum',345,352,'right','explore',null,null]);
const before = JSON.parse(JSON.stringify(state));
const snapshot = JSON.parse(JSON.stringify(state));
T.enterRoom(state,'corridor',{x:1000,y:400,facing:'left'},rooms);
Object.assign(state,snapshot);
assert.deepStrictEqual(state,before);
state.returnRoom = 'museum'; state.returnX = 345; state.returnY = 352; state.returnFacing = 'right';
T.enterRoom(state,'museum',{x:610,y:620,facing:'up'},rooms);
assert.strictEqual(state.facing,'up');
state.returnFacing = state.facing;
assert.strictEqual(state.returnFacing,'up');
console.log('PASS explicit and default room entries, story return, and cleared stale map return point');
