(function () {
  "use strict";
  function enterStory(state, id) {
    state.returnRoom=state.roomId; state.returnX=state.playerX; state.returnY=state.playerY; state.returnFacing=state.facing;
    state.returnScene=null; state.mode="novel"; state.narrativeNode=id; state.narrativeIndex=0; state.narrativeChoice=null;
  }
  function leaveStory(state) {
    state.mode="explore"; state.narrativeNode=null; state.narrativeIndex=0; state.narrativeChoice=null; state.returnScene=null;
    if(state.returnRoom)state.roomId=state.returnRoom;
    if(Number.isFinite(state.returnX))state.playerX=state.returnX;
    if(Number.isFinite(state.returnY))state.playerY=state.returnY;
    if(state.returnFacing)state.facing=state.returnFacing;
    state.currentNode=state.roomId;
    state.returnRoom=null;state.returnX=null;state.returnY=null;state.returnFacing="down";
  }
  window.MuseumTransition={enterStory:enterStory,leaveStory:leaveStory};
}());
