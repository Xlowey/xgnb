(function () {
  "use strict";
  var script=document.currentScript,assetBase=new URL("../assets/images/items/",script.src).href;
  var dialog,windowPanel,grid,detail,zoom,receipt,receiptTimer,context,selected,side="front",returnFocus;
  function node(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
  function button(text,fn,cls){var b=node("button",cls || "inventory-button",text);b.type="button";b.addEventListener("click",fn);return b;}
  function normalize(state){
    state.flags=state.flags || {};
    state.inventory=Array.from(new Set((Array.isArray(state.inventory)?state.inventory:[]).filter(function(id){return typeof id==="string";}).map(function(id){return id==="blood-note"?"note":id;})));
    // Recover actual acquisitions from older saves without granting unseen objects.
    if(state.flags["item-rules"] && !state.inventory.includes("rules"))state.inventory.push("rules");
    if((state.flags["item-note"] || state.flags.readNote || (state.clues || []).includes("blood-note")) && !state.inventory.includes("note"))state.inventory.push("note");
    return state.inventory;
  }
  function definition(id){return window.MuseumItems[id] || {name:id==="dorm-key"?"宿舍钥匙":"未标注物品",kind:"随身物品",description:id==="dorm-key"?"旧存档中保留的宿舍钥匙。":"已保存在背包中。",text:""};}
  function refresh(){
    if(!context || !context.getState())return;
    var count=normalize(context.getState()).length;
    document.querySelectorAll("[data-inventory-open]").forEach(function(b){b.title="背包（"+count+" 件） · B";b.setAttribute("aria-label","背包（"+count+" 件物品）");});
  }
  function acquire(state,id,options){
    options=options || {};var ids=normalize(state);if(ids.includes(id))return false;
    if(!window.MuseumItems[id])return false;
    ids.push(id);state.flags["item-"+id]=true;
    if(id==="note"){state.flags.readNote=true;state.clues=Array.isArray(state.clues)?state.clues:[];if(!state.clues.includes("blood-note"))state.clues.push("blood-note");}
    if(options.save)options.save();refresh();
    if(options.notify!==false){ensureUI();receipt.textContent=(id==="rules"?"已收录：":"已放入背包：")+definition(id).name;receipt.hidden=false;clearTimeout(receiptTimer);receiptTimer=setTimeout(function(){receipt.hidden=true;},2600);}
    return true;
  }
  function art(item,back){
    var figure=node("span","inventory-art"),name=back?item.reverseImage:item.image,crop=back?item.reverseCrop:item.crop;
    if(!name){figure.classList.add("inventory-placeholder");figure.textContent="◇";return figure;}
    var img=node("img");img.src=window.MuseumAssets ? window.MuseumAssets.url(name) : assetBase+name;img.alt=item.name+(back?"背面":"");img.draggable=false;
    if(crop){figure.style.aspectRatio=crop[2]+" / "+crop[3];figure.style.setProperty("--art-ratio",crop[2]/crop[3]);Object.assign(img.style,{width:(1670/crop[2]*100)+"%",left:(-crop[0]/crop[2]*100)+"%",top:(-crop[1]/crop[3]*100)+"%"});}
    else figure.classList.add("inventory-full-art");figure.appendChild(img);return figure;
  }
  function closeZoom(){zoom.hidden=true;zoom.textContent="";windowPanel.inert=false;var b=detail.querySelector(".inventory-enlarge");if(b)b.focus();}
  function showZoom(item){
    if(window.MuseumTutorial && !window.MuseumTutorial.isDone("itemRead"))window.MuseumTutorial.complete("itemRead");
    zoom.textContent="";zoom.hidden=false;windowPanel.inert=true;
    var back=button("返回物品",closeZoom);zoom.appendChild(back);zoom.appendChild(art(item,side==="back"));back.focus();
  }
  function renderDetail(){
    detail.textContent="";if(!selected){var empty=node("div","inventory-empty");empty.appendChild(node("span","","◇"));empty.appendChild(node("h3","","背包还是空的"));empty.appendChild(node("p","","探索中获得的物品和记录会保存在这里。"));detail.appendChild(empty);return;}
    var state=context.getState(),item=definition(selected);state.flags["inventory-seen-"+selected]=true;context.save();
    var head=node("header","inventory-detail-head");head.appendChild(node("small","",item.kind || "随身物品"));head.appendChild(node("h3","",item.name));head.appendChild(node("p","",item.description || ""));detail.appendChild(head);
    var content=node("div","inventory-reading"),visual=node("div","inventory-visual");
    var enlarge=button("",function(){showZoom(item);},"inventory-enlarge");enlarge.setAttribute("aria-label","放大查看"+item.name);enlarge.appendChild(art(item,side==="back"));if(!item.image)enlarge.disabled=true;visual.appendChild(enlarge);
    if(item.reverseImage){var flip=button(side==="back"?"翻到正面":"翻到背面",function(){side=side==="back"?"front":"back";renderDetail();detail.querySelector(".inventory-flip").focus();},"inventory-button inventory-flip");visual.appendChild(flip);}
    content.appendChild(visual);
    var copy=node("section","inventory-copy"),text=side==="back"?item.reverseText:item.text;
    copy.appendChild(node("small","",item.reverseImage?(side==="back"?"背面":"正面"):"内容"));
    var transcript=node("div","inventory-transcript",String(text || "这件物品没有附带文字。").replace(/([一二三四五六七八九十]+)，/g,"\n$1，").replace(/」「/g,"」\n「").trim());transcript.tabIndex=0;transcript.setAttribute("aria-label",item.name+"内容");copy.appendChild(transcript);content.appendChild(copy);detail.appendChild(content);
  }
  function renderGrid(){
    var state=context.getState(),ids=normalize(state);grid.textContent="";
    windowPanel.querySelector(".inventory-count").textContent=ids.length+" 件物品";
    ids.forEach(function(id){var item=definition(id),b=button("",function(){selected=id;side="front";renderDetail();renderGrid();var current=grid.querySelector('[aria-pressed="true"]');if(current)current.focus();},"inventory-slot");b.setAttribute("aria-label",item.name);b.setAttribute("aria-pressed",String(id===selected));b.appendChild(art(item,false));b.appendChild(node("span","inventory-item-name",item.name));if(!state.flags["inventory-seen-"+id])b.appendChild(node("small","inventory-new","新"));grid.appendChild(b);});
    if(!ids.length)grid.appendChild(node("p","inventory-grid-empty","尚未获得物品"));
  }
  function ensureUI(){
    if(dialog)return;
    dialog=node("dialog","inventory-dialog");dialog.setAttribute("aria-labelledby","inventory-title");
    windowPanel=node("div","inventory-window");var header=node("header","inventory-header");var title=node("div");title.appendChild(node("small","","随身物品"));var heading=node("h2","","背包");heading.id="inventory-title";title.appendChild(heading);header.appendChild(title);header.appendChild(node("span","inventory-count"));header.appendChild(button("收起背包",close,"inventory-button inventory-close"));windowPanel.appendChild(header);
    var body=node("div","inventory-body");grid=node("nav","inventory-grid");grid.setAttribute("aria-label","已获得的物品");detail=node("article","inventory-detail");body.appendChild(grid);body.appendChild(detail);windowPanel.appendChild(body);windowPanel.appendChild(node("footer","inventory-footer","B / Esc 收起背包 · 点击物品查看"));dialog.appendChild(windowPanel);
    zoom=node("div","inventory-zoom");zoom.hidden=true;dialog.appendChild(zoom);document.body.appendChild(dialog);
    receipt=node("div","inventory-receipt");receipt.hidden=true;receipt.setAttribute("role","status");document.body.appendChild(receipt);
    dialog.addEventListener("cancel",function(e){e.preventDefault();if(!zoom.hidden)closeZoom();else close();});
    dialog.addEventListener("click",function(e){if(e.target===dialog)close();});
  }
  function isOpen(){return !!(dialog && dialog.open);}
  function open(){
    if(!context || !context.getState() || (context.canOpen && !context.canOpen()))return;
    ensureUI();if(isOpen())return;returnFocus=document.activeElement;
    var ids=normalize(context.getState());selected=ids.includes(selected)?selected:(ids[0] || null);side="front";
    context.onOpen();renderDetail();renderGrid();refresh();dialog.showModal();windowPanel.querySelector(".inventory-close").focus();
  }
  function close(){
    if(!isOpen())return;zoom.hidden=true;zoom.textContent="";windowPanel.inert=false;dialog.close();
    if(context.onClose)context.onClose();if(returnFocus && returnFocus.isConnected)returnFocus.focus({preventScroll:true});
  }
  function bind(options){context=options;refresh();}
  document.addEventListener("keydown",function(e){
    if(isOpen()){
      e.stopImmediatePropagation();
      if(e.key==="Escape" || e.key.toLowerCase()==="b"){e.preventDefault();if(!e.repeat){if(e.key==="Escape"&&!zoom.hidden)closeZoom();else close();}}
      return;
    }
    if(e.key.toLowerCase()!=="b" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,textarea,select,[contenteditable=true]"))return;
    if(context && context.getState() && (!context.canOpen || context.canOpen())){e.preventDefault();e.stopImmediatePropagation();open();}
  },true);
  window.MuseumInventory={bind:bind,open:open,close:close,isOpen:isOpen,acquire:acquire,normalize:normalize,refresh:refresh};
}());
