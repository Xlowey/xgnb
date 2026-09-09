(function () {
  "use strict";
  var definitions=[],context,dialog,list,summary,receipt,returnFocus,timer,filter="all",queue=[];
  function node(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
  function button(text,fn,cls){var b=node("button",cls || "achievement-button",text);b.type="button";b.addEventListener("click",fn);return b;}
  function emblem(){
    var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 64 64");svg.setAttribute("aria-hidden","true");svg.classList.add("achievement-emblem");
    var path=document.createElementNS(svg.namespaceURI,"path");path.setAttribute("d","M20 10h24v16c0 9-5 15-12 15s-12-6-12-15V10Zm0 6H10v6c0 8 5 12 12 12m22-18h10v6c0 8-5 12-12 12M32 41v12m-12 3h24M24 53h16");svg.appendChild(path);return svg;
  }
  function register(def){
    if(!def || typeof def.id!=="string" || !def.id.trim() || typeof def.name!=="string" || !def.name.trim() || definitions.some(function(d){return d.id===def.id;}))return false;
    var target=def.target===undefined?1:Number(def.target);if(!Number.isFinite(target)||target<1)return false;
    definitions.push({id:def.id,name:def.name,description:String(def.description || ""),target:Math.floor(target),hidden:!!def.hidden});refresh();return true;
  }
  function normalize(state){
    state.achievements=Array.from(new Set((Array.isArray(state.achievements)?state.achievements:[]).filter(function(id){return typeof id==="string" && id.length>0;})));
    var previous=state.achievementRecords,next={};
    if(previous && typeof previous==="object" && !Array.isArray(previous))Object.keys(previous).forEach(function(id){
      var record=previous[id];if(!record || typeof record!=="object")return;
      var progress=Number(record.progress);next[id]={progress:Number.isFinite(progress)?Math.max(0,Math.floor(progress)):0,unlockedAt:typeof record.unlockedAt==="string" && Number.isFinite(Date.parse(record.unlockedAt))?record.unlockedAt:null};
    });state.achievementRecords=next;return state;
  }
  function find(id){return definitions.find(function(d){return d.id===id;});}
  function status(state,id){
    normalize(state);var def=find(id);if(!def)return null;
    var unlocked=state.achievements.includes(id),record=state.achievementRecords[id] || {};
    return {unlocked:unlocked,progress:unlocked?def.target:Math.min(def.target,record.progress || 0),target:def.target,unlockedAt:record.unlockedAt || null};
  }
  function persist(state,options){if(options && options.save)options.save();else if(context && context.getState()===state)context.save();refresh();}
  function nextNotice(){
    if(!queue.length){receipt.hidden=true;timer=null;return;}
    var name=queue.shift();receipt.textContent="成就解锁 · "+name;receipt.hidden=false;timer=setTimeout(nextNotice,3000);
  }
  function unlock(state,id,options){
    var def=find(id);if(!def)return false;normalize(state);if(state.achievements.includes(id))return false;
    state.achievements.push(id);state.achievementRecords[id]={progress:def.target,unlockedAt:new Date().toISOString()};persist(state,options);
    if(!options || options.notify!==false){ensureUI();queue.push(def.name);if(!timer)nextNotice();}return true;
  }
  function setProgress(state,id,value,options){
    var def=find(id),number=Number(value);if(!def || !Number.isFinite(number)||number<0)return false;
    var current=status(state,id);if(current.unlocked)return false;var progress=Math.min(def.target,Math.max(current.progress,Math.floor(number)));
    if(progress===def.target)return unlock(state,id,options);if(progress===current.progress)return false;
    state.achievementRecords[id]={progress:progress,unlockedAt:null};persist(state,options);return true;
  }
  function increment(state,id,amount,options){var current=status(state,id),delta=amount===undefined?1:Number(amount);if(!current || !Number.isFinite(delta)||delta<=0)return false;return setProgress(state,id,current.progress+delta,options);}
  function isOpen(){return !!(dialog && dialog.open);}
  function counts(state){return {unlocked:definitions.filter(function(d){return state.achievements.includes(d.id);}).length,total:definitions.length};}
  function render(){
    var state=normalize(context.getState()),count=counts(state);summary.textContent="已解锁 "+count.unlocked+" / "+count.total;
    dialog.querySelectorAll("[data-achievement-filter]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.achievementFilter===filter));});list.textContent="";
    var visible=definitions.filter(function(d){var unlocked=state.achievements.includes(d.id);return filter==="all" || (filter==="unlocked"?unlocked:!unlocked);});
    if(!visible.length){var empty=node("div","achievement-empty");empty.appendChild(emblem());empty.appendChild(node("h3","",definitions.length?"这里还没有成就":"暂无成就"));empty.appendChild(node("p","",definitions.length?"可以切换分类查看其他成就。":"解锁的成就会记录在这里。"));list.appendChild(empty);return;}
    visible.forEach(function(def){var result=status(state,def.id),concealed=def.hidden&&!result.unlocked;
      var card=node("article","achievement-card"+(result.unlocked?" is-unlocked":""));card.appendChild(emblem());var copy=node("div","achievement-copy");copy.appendChild(node("h3","",concealed?"隐藏成就":def.name));copy.appendChild(node("p","",concealed?"解锁后显示详情。":def.description));
      if(def.target>1&&!concealed){var progress=node("progress");progress.max=def.target;progress.value=result.progress;progress.setAttribute("aria-label",def.name+"进度");copy.appendChild(progress);copy.appendChild(node("small","",result.progress+" / "+def.target));}
      card.appendChild(copy);var info=node("div","achievement-status",result.unlocked?"已解锁":"未解锁");if(result.unlockedAt && result.unlocked){var time=node("time","",new Date(result.unlockedAt).toLocaleDateString("zh-CN"));time.dateTime=result.unlockedAt;info.appendChild(time);}card.appendChild(info);list.appendChild(card);
    });
  }
  function refresh(){
    if(!context || !context.getState())return;var state=normalize(context.getState()),count=counts(state);
    document.querySelectorAll("[data-achievements-open]").forEach(function(b){b.title="成就 · J";b.setAttribute("aria-label","成就（已解锁 "+count.unlocked+" / "+count.total+"）");});if(isOpen())render();
  }
  function ensureUI(){
    if(dialog)return;dialog=node("dialog","achievements-dialog");dialog.setAttribute("aria-labelledby","achievements-title");
    var header=node("header","achievements-header"),title=node("div");title.appendChild(node("small","","探索足迹"));var h=node("h2","","成就");h.id="achievements-title";title.appendChild(h);header.appendChild(title);summary=node("span","achievements-summary");header.appendChild(summary);header.appendChild(button("关闭",close,"achievement-button achievements-close"));dialog.appendChild(header);
    var tabs=node("nav","achievements-filters");tabs.setAttribute("aria-label","成就分类");[["all","全部"],["unlocked","已解锁"],["locked","未解锁"]].forEach(function(pair){var b=button(pair[1],function(){filter=pair[0];render();});b.dataset.achievementFilter=pair[0];tabs.appendChild(b);});dialog.appendChild(tabs);
    list=node("div","achievements-list");list.setAttribute("aria-label","成就列表");dialog.appendChild(list);dialog.appendChild(node("footer","achievements-footer","J / Esc 关闭"));document.body.appendChild(dialog);
    receipt=node("div","achievement-receipt");receipt.hidden=true;receipt.setAttribute("role","status");document.body.appendChild(receipt);
    dialog.addEventListener("cancel",function(e){e.preventDefault();close();});dialog.addEventListener("click",function(e){if(e.target===dialog)close();});
  }
  function open(){
    if(!context || !context.getState() || (context.canOpen && !context.canOpen()) || isOpen())return;
    ensureUI();returnFocus=document.activeElement;filter="all";context.onOpen();render();dialog.showModal();dialog.querySelector(".achievements-close").focus();
  }
  function close(){if(!isOpen())return;dialog.close();if(context.onClose)context.onClose();if(returnFocus && returnFocus.isConnected)returnFocus.focus({preventScroll:true});}
  function bind(options){context=options;refresh();}
  document.addEventListener("keydown",function(e){
    if(isOpen()){e.stopImmediatePropagation();if(e.key==="Escape" || e.key.toLowerCase()==="j"){e.preventDefault();if(!e.repeat)close();}return;}
    if(e.key.toLowerCase()!=="j" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,textarea,select,[contenteditable=true]"))return;
    if(context && context.getState() && (!context.canOpen || context.canOpen())){e.preventDefault();e.stopImmediatePropagation();open();}
  },true);
  (window.MuseumAchievementDefinitions || []).forEach(register);
  window.MuseumAchievements={bind:bind,open:open,close:close,isOpen:isOpen,register:register,normalize:normalize,refresh:refresh,status:status,unlock:unlock,setProgress:setProgress,increment:increment};
}());
