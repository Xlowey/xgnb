(function () {
  "use strict";
  var MAX_PLAYER_HP = 25;
  var MAX_ENEMY_HP = 30;
  var RESULT_KEY = "museum_pending_battle_v1";
  var query = new URLSearchParams(window.location.search);
  var preview = query.get("preview") === "1";
  var resultStorage = preview ? sessionStorage : localStorage;
  var returnScene = query.get("returnScene") || "guard-after-battle";
  var enemyPatterns = ["observe", "attack", "attack", "heavyAttack"];
  var enemyActionLabels = { observe: "观察", attack: "攻击", heavyAttack: "重击" };
  var state;
  var elements = {
    turn: document.getElementById("turn-value"), enemyHpText: document.getElementById("enemy-hp-text"), playerHpText: document.getElementById("player-hp-text"),
    enemyHpBar: document.getElementById("enemy-hp-bar"), playerHpBar: document.getElementById("player-hp-bar"), enemyIntent: document.getElementById("enemy-intent"),
    playerStatus: document.getElementById("player-status"), ruleText: document.getElementById("rule-text"), log: document.getElementById("battle-log"), returnLink: document.getElementById("return-link")
  };
  // hitsTaken：013 §3.2 的战斗损耗是「基础 14 + 每被击中一次 ×6」，所以要把挨打次数单独记下来
  // 一起回传（见 makeResult）。不能拿 MAX_PLAYER_HP - playerHp 反推——观察回合不掉血、
  // 防御回合伤害减半，掉血量与挨打次数不是一回事。
  function initialState() { return { playerHp:MAX_PLAYER_HP, enemyHp:MAX_ENEMY_HP, turn:1, defending:false, observed:false, ruleSolved:false, finished:false, hitsTaken:0 }; }
  function addLog(message) { var line=document.createElement("p"); line.textContent="· "+message; elements.log.appendChild(line); elements.log.scrollTop=elements.log.scrollHeight; }
  function setButtonsDisabled(disabled) { document.querySelectorAll(".action-button").forEach(function (button) { button.disabled=disabled; }); }
  function updateView() {
    elements.turn.textContent=state.turn; elements.enemyHpText.textContent=state.enemyHp+" / "+MAX_ENEMY_HP; elements.playerHpText.textContent=state.playerHp+" / "+MAX_PLAYER_HP;
    elements.enemyHpBar.style.width=Math.max(0,state.enemyHp/MAX_ENEMY_HP*100)+"%"; elements.playerHpBar.style.width=Math.max(0,state.playerHp/MAX_PLAYER_HP*100)+"%";
    var nextAction = enemyPatterns[state.turn % enemyPatterns.length];
    elements.enemyIntent.textContent=state.observed ? "已观察：下一次行动是“"+(enemyActionLabels[nextAction] || "未知行动")+"”。" : "正在观察你的表情。";
    elements.ruleText.textContent=state.ruleSolved ? "规则已破解：你已看穿馆长的虚实，他本回合停止行动。" : "馆长深不可测。先观察，才能发现他的弱点。";
  }
  function makeResult(status) {
    return {
      status: status,
      // remainingHp 按**人性值的 0–100 量纲**给出——本文件里的 MAX_PLAYER_HP 只是这一战的
      // 内部血条（25 点，同时驱动屏幕上的血条宽度和这场 demo 的节奏，所以不动它）。
      // ⚠️ 主游戏**不再用它算损耗**：013 §3.2 的公式改用下面的 hitsTaken。
      //    它留着只是给结算界面和测试看。
      remainingHp: Math.round(state.playerHp / MAX_PLAYER_HP * 100),
      hitsTaken: state.hitsTaken || 0,
      battleAttempt: query.get("battleAttempt") || null,
      source: "battle",
      rewards: status === "win" ? ["director_account"] : [],
      flags: status === "win" ? ["director_defeated"] : ["battle_failed"]
    };
  }
  function finish(status,message) {
    if (state.finished) return;
    if(status === "win" && window.MuseumSfx)window.MuseumSfx.play("victory");
    state.finished=true;
    setButtonsDisabled(true);
    elements.playerStatus.textContent=status === "win" ? "战斗胜利。" : "战斗失败。";
    addLog(message);
    var result=makeResult(status); result.userId=query.get("user") || null;
    window.lastBattleResult=result;
    resultStorage.setItem(RESULT_KEY,JSON.stringify(result));
    if (elements.returnLink) {
      elements.returnLink.href = preview ? "../../pages/novel.html?scene=" + encodeURIComponent(returnScene) + "&preview=1&resume=1" : "../../index.html?fromBattle=1";
      elements.returnLink.textContent="← 返回剧情";
      elements.returnLink.classList.add("ready");
    }
    console.log("Battle result:",window.lastBattleResult);
    if (window.parent !== window) window.parent.postMessage({ type:"battle-result", result:window.lastBattleResult }, "*");
  }
  function enemyTurn() {
    if (state.ruleSolved) { addLog("馆长一时语塞，本回合停止行动。"); return; }
    var action=enemyPatterns[state.turn % enemyPatterns.length]; var damage=action === "heavyAttack" ? 9 : 4;
    if (action === "observe") { addLog("馆长靠近了一步，没有造成伤害。"); return; }
    if (state.defending) damage=Math.ceil(damage/2); state.playerHp=Math.max(0,state.playerHp-damage);
    // 只有真的挨了这一下才计数。上面的 observe 分支已经 return 了，所以「观察回合」天然不计。
    state.hitsTaken+=1;
    addLog("馆长发动"+(action === "heavyAttack" ? "重击" : "攻击")+"，你受到 "+damage+" 点伤害。");
  }
  function takeAction(action) {
    if (state.finished) return; state.defending=false;
    if (action === "attack") { var damage=4+Math.floor(Math.random()*4); state.enemyHp=Math.max(0,state.enemyHp-damage); addLog("你发动攻击，造成 "+damage+" 点伤害。"); }
    else if (action === "defend") { state.defending=true; addLog("你摆出防御姿态，本回合受到的伤害减半。"); }
    else if (action === "observe") { state.observed=true; elements.playerStatus.textContent="你看见了它的行动规律。"; addLog("观察结果：它每四回合会发动一次重击。"); }
    else if (action === "smile") {
      if (!state.observed) { addLog("你还没有找到正确时机。先使用“观察”。"); updateView(); return; }
      state.ruleSolved=true; addLog("你步步紧逼。馆长停下了，他无法自圆其说。");
      updateView();
      finish("win","馆长不再辩解，交涉成功。");
      return;
    }
    if (state.enemyHp <= 0) { updateView(); finish("win","馆长被打服了，你获得线索：馆长的口供。"); return; }
    setButtonsDisabled(true);
    window.setTimeout(function () { enemyTurn(); state.turn+=1; updateView(); setButtonsDisabled(state.finished); if (state.playerHp <= 0) finish("lose","你的生存点归零，战斗结束。"); },260);
    updateView();
  }
  function restart() {
    state=initialState(); elements.log.textContent=""; elements.playerStatus.textContent="等待你的行动。"; setButtonsDisabled(false); addLog("战斗开始。系统建议：先观察目标。"); updateView(); window.lastBattleResult=null;
    resultStorage.removeItem(RESULT_KEY);
    if (elements.returnLink) {
      elements.returnLink.href = preview ? "../../pages/novel.html?scene=" + encodeURIComponent(returnScene) + "&preview=1&resume=1" : "../../index.html";
      elements.returnLink.textContent = preview ? "← 返回剧情" : "← 返回项目入口";
      elements.returnLink.classList.remove("ready");
    }
  }
  document.querySelectorAll(".action-button").forEach(function (button) { button.addEventListener("click",function () { takeAction(button.dataset.action); }); });
  document.getElementById("restart-button").addEventListener("click",restart); restart();
}());
