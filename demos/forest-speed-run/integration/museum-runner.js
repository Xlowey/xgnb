/* 放到 xgnb/js/，在主入口及 pages/novel.html 中、MuseumState 之后加载。 */
(function () {
  "use strict";
  const RESULT_KEY = "museum_pending_runner_v1";
  const root = new URL("../", document.currentScript.src);
  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview") === "1";
  function getUser() { return preview ? {id:"class-preview",username:"体验者"} : window.MuseumAuth.getCurrentUser(); }
  function getState(user) {
    if (preview) { const raw=sessionStorage.getItem("museum_class_preview");return raw ? JSON.parse(raw) : window.MuseumState.create(user); }
    return window.MuseumState.load(user.id);
  }
  function save(state,user) {
    if (preview) { sessionStorage.setItem("museum_class_preview",JSON.stringify(state));return true; }
    return window.MuseumState.save(state,user.id) !== false;
  }
  const storage = preview ? sessionStorage : localStorage;
  function launch(options = {}) {
    try {
      const user=getUser();if(!user) return false;
      const state=JSON.parse(JSON.stringify(options.state || getState(user)));
      if(!state || !Number.isFinite(Number(state.hp)) || Number(state.hp) <= 0) return false;
      const sourceScene=options.sourceScene || params.get("scene") || "scene-28";
      const returnScene=options.returnScene || "scene-29";
      if(!/^[\w-]+$/.test(sourceScene) || !/^[\w-]+$/.test(returnScene)) return false;
      const runId=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
      state.runnerContext={runId,userId:user.id,sourceScene,returnScene,
        sourceIndex:Number(state.narrativeIndex)||0,
        completionFlag:options.completionFlag || (sourceScene === "scene-28" ? "scene28Seen" : null),
        roomId:state.roomId,x:state.playerX,y:state.playerY};
      if(!save(state,user)) return false;
      const url=new URL("demos/forest-speed-run/index.html",root);
      const query={from:"novel",user:user.id,runId,returnScene,cancelScene:sourceScene};
      if(preview) query.preview="1";
      Object.entries(query).forEach(([key,value])=>url.searchParams.set(key,value));
      window.location.href=url.href;return true;
    } catch(error) { console.warn("追逐入口未能保存。",error);return false; }
  }
  function consume() {
    try {
      const raw=storage.getItem(RESULT_KEY);if(!raw) return false;
      const result=JSON.parse(raw),user=getUser();if(!user || result.userId !== user.id) return false;
      const state=getState(user),context=state && state.runnerContext;
      if(!context || context.userId !== user.id || result.runId !== context.runId || result.kind !== "museum-runner" || result.version !== 1 || !["win","lose","cancel"].includes(result.status)) return false;
      if(result.status === "win" && (!Number.isFinite(Number(result.elapsed)) || Number(result.elapsed) < 180)) return false;
      state.flags=state.flags || {};
      let next=context.sourceScene;
      if(result.status === "win") {
        state.flags.museumRunnerCompleted=true;
        if(context.completionFlag) state.flags[context.completionFlag]=true;
        window.MuseumState.completeScene(state,context.sourceScene);
        window.MuseumChapterProgress?.complete(state,context.sourceScene);
        state.runnerRecord={score:Math.max(0,Number(result.score)||0),coins:Math.max(0,Number(result.coins)||0),elapsed:180};
        next=context.returnScene;
      } else if(result.status === "lose") { state.hp=0;next="ending-d"; }
      state.roomId=context.roomId;state.playerX=context.x;state.playerY=context.y;
      state.mode="novel";state.narrativeNode=next;
      state.narrativeIndex=result.status === "cancel" ? context.sourceIndex : 0;
      state.narrativeChoice=null;state.returnScene=null;delete state.runnerContext;
      if(!save(state,user)) return false;
      storage.removeItem(RESULT_KEY);
      const destination=new URL("pages/novel.html",root);destination.searchParams.set("scene",next);
      if(preview) { destination.searchParams.set("preview","1");destination.searchParams.set("resume","1"); }
      window.location.href=destination.href;return true;
    } catch(error) { console.warn("追逐记录未能结算，记录已保留。",error);return false; }
  }
  window.MuseumRunner={launch,consume};
  if(params.get("fromRunner") === "1") consume();
}());
