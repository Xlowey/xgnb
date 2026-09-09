(function () {
  "use strict";
  var root = document.getElementById("scene-events");
  var modal = document.getElementById("item-modal");
  var currentHooks, currentEvent, disposeExploration, backdrop, backdropObserver, previewObserver;
  function node(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function button(label, action, cls) { var b = node("button", cls || "event-button", label); b.type = "button"; b.addEventListener("click", action); return b; }
  function asset(name) { return "../assets/images/" + name; }
  function picture(name, alt) { var img = node("img"); img.src = asset(name); img.alt = alt || ""; img.draggable = false; return img; }
  // Display a region of the supplied artwork without changing the source file.
  function focusedPicture(name, title, crop) {
    var frame=node("span","focused-picture"),img=picture(name,title);
    frame.style.aspectRatio=crop[2]+" / "+crop[3];
    Object.assign(img.style,{width:(1670/crop[2]*100)+"%",left:(-crop[0]/crop[2]*100)+"%",top:(-crop[1]/crop[3]*100)+"%"});
    frame.appendChild(img);return frame;
  }
  function syncRoomBackdrop(event,hooks) {
    var visible=event && (["item","document"].includes(event.type) || (["dialogue","television"].includes(event.type) && hooks.state.flags.dormExplorationPosition));
    document.body.classList.toggle("has-room-backdrop",!!visible);
    if(!visible){if(backdropObserver)backdropObserver.disconnect();if(backdrop)backdrop.remove();backdrop=null;return;}
    if(backdrop)return;
    backdrop=node("div","investigation-backdrop");backdrop.setAttribute("aria-hidden","true");
    var frame=node("div","investigation-still");frame.appendChild(picture("dorm-map.png",""));
    var canvas=node("canvas","exploration-character");canvas.width=1670;canvas.height=942;
    var source=root.querySelector(".exploration-character");
    if(source)canvas.getContext("2d").drawImage(source,0,0);
    else {var p=hooks.state.flags.dormExplorationPosition || {x:835,y:745};window.MuseumPlayerAvatar.ready.then(function(){if(canvas.isConnected)window.MuseumPlayerAvatar.draw(canvas.getContext("2d"),p.x,p.y,p.facing || "down",false,0);});}
    frame.appendChild(canvas);backdrop.appendChild(frame);document.querySelector(".novel-stage").prepend(backdrop);
    function fit(){var b=backdrop.getBoundingClientRect(),scale=Math.min(b.width/1670,Math.max(0,b.height-38)/942);frame.style.width=(1670*scale)+"px";frame.style.height=(942*scale)+"px";}
    backdropObserver=new ResizeObserver(fit);backdropObserver.observe(backdrop);fit();
  }
  function paragraphText(value) { return String(value || "").replace(/([一二三四五六七八九十]+)，/g, "\n$1，").replace(/」「/g, "」\n「").trim(); }
  function closeModal() { modal.hidden = true; modal.textContent = ""; if (currentHooks) currentHooks.resume(); }
  function showDocument(item, side, inModal) {
    var card = node("article", "item-card");
    var imageName = side === "back" ? item.reverseImage : item.image;
    var imageButton = button("", function () { showZoom(imageName, item.name); }, "item-image-button");
    imageButton.setAttribute("aria-label", "放大查看" + item.name);
    imageButton.appendChild(picture(imageName, item.name + (side === "back" ? "背面" : "")));
    card.appendChild(imageButton);
    var detail = node("div", "item-details"); detail.appendChild(node("small", "item-kicker", side === "back" ? "背面" : "物品调查"));
    detail.appendChild(node("h2", "", item.name));
    if (item.description) detail.appendChild(node("p", "item-description", item.description));
    var text = node("div", "item-transcript", paragraphText(side === "back" ? item.reverseText : item.text));
    text.tabIndex = 0; text.setAttribute("aria-label", item.name + "清晰文字"); detail.appendChild(text);
    if (inModal && item.reverseImage) detail.appendChild(button(side === "back" ? "翻到正面" : "翻到背面", function () { openItem(item, side === "back" ? "front" : "back"); }));
    card.appendChild(detail); return card;
  }
  function showZoom(name, title, crop) {
    currentHooks.pause(); modal.hidden = false; modal.textContent = "";
    var panel = node("div", "zoom-panel");panel.appendChild(button("关闭", closeModal));
    var img = crop ? focusedPicture(name,title,crop) : picture(name, title); panel.appendChild(img); modal.appendChild(panel);
    panel.querySelector("button").focus();
  }
  function openItem(item, side) {
    currentHooks.pause();modal.hidden = false;modal.textContent = "";
    var panel = node("div", "document-modal"); panel.appendChild(button("关闭", closeModal));panel.appendChild(showDocument(item, side || "front", true));modal.appendChild(panel);panel.querySelector("button").focus();
  }
  function bag() {
    window.MuseumInventory.open();
  }
  function setBackground(name) { document.querySelector(".novel-background").style.setProperty("--scene-background", 'url("'+asset(name)+'")'); }
  function render(event, hooks) {
    syncRoomBackdrop(event,hooks);
    if (previewObserver) { previewObserver.disconnect(); previewObserver=null; }
    if (disposeExploration) { disposeExploration(); disposeExploration = null; }
    currentHooks = hooks;currentEvent = event;root.textContent = "";root.hidden = !event;
    document.body.dataset.event = event ? event.type : "dialogue";
    root.className = "scene-events";
    if (!event) { document.querySelector(".novel-background").style.removeProperty("--scene-background");return; }
    if (event.background) setBackground(event.background);else setBackground("dorm-map.png");
    if (event.type === "dialogue") {
      if(event.visual){var visual=node("figure","dialogue-prop");visual.appendChild(picture(event.visual,"血字纸条"));root.appendChild(visual);}return;
    }
    if (event.type === "system") {var system=node("section","system-message");system.setAttribute("role","status");system.appendChild(node("small","","系统"));system.appendChild(node("p","",event.text));root.appendChild(system);return;}
    if (event.type === "cg") {root.className="scene-events "+(event.effect || "");return;}
    root.className="scene-events";
    if (event.type === "document") {
      window.MuseumInventory.acquire(hooks.state,event.item,{save:hooks.save});
      root.appendChild(showDocument(window.MuseumStory.items[event.item],event.side));hooks.save();return;
    }
    if (event.type === "item") {
      if(event.collect)window.MuseumInventory.acquire(hooks.state,event.collect,{save:hooks.save});
      var crop=event.crop || [0,0,1670,942];
      var card=node("article","item-preview");var imageButton=button("",function(){showZoom(event.image,event.title,crop);},"item-focus-button");imageButton.setAttribute("aria-label","放大查看"+event.title);imageButton.appendChild(focusedPicture(event.image,event.title,crop));card.appendChild(imageButton);
      var detail=node("div","item-caption");detail.appendChild(node("h2","",event.title));detail.appendChild(node("p","",event.description));card.appendChild(detail);root.appendChild(card);
      function fitPreview(){var b=root.getBoundingClientRect(),stacked=b.width<900 && (window.innerHeight>550 || window.innerWidth<650),availableHeight=b.height-(stacked?130:32),availableWidth=stacked?b.width-24:b.width-460;var width=Math.max(1,Math.min(620,availableWidth,availableHeight*crop[2]/crop[3]));card.style.setProperty("--object-width",width+"px");}
      previewObserver=new ResizeObserver(fitPreview);previewObserver.observe(root);fitPreview();return;
    }
    if (event.type === "explore") {
      document.getElementById("novel-location").textContent="员工宿舍";
      disposeExploration=window.MuseumDormExploration.mount(root,hooks,function(o){
        hooks.state.flags["examined-"+o.id]=true;hooks.save();hooks.pause();modal.hidden=false;modal.textContent="";
        var box=node("article","observation-panel");
        var crop=node("div","observation-closeup"), photo=picture("dorm-map.png",o.name+"特写");
        crop.style.aspectRatio=o.crop[2]+" / "+o.crop[3];
        Object.assign(photo.style,{width:(1670/o.crop[2]*100)+"%",left:(-o.crop[0]/o.crop[2]*100)+"%",top:(-o.crop[1]/o.crop[3]*100)+"%"});crop.appendChild(photo);box.appendChild(crop);
        box.appendChild(node("h2","",o.name));box.appendChild(node("p","",o.text));box.appendChild(button("返回房间",closeModal));modal.appendChild(box);box.querySelector("button").focus();
      });hooks.setAdvance(false);return;
    }
    if (event.type === "television") {
      var tv=node("div","television-set"),screen=node("div","television-screen");tv.appendChild(screen);root.appendChild(tv);
      var playing=hooks.state.flags.prologueVideoPlaying;
      if(playing){screen.classList.add("playing");screen.appendChild(picture("rabbits-recording.png","巨型兔子在城市中横冲直撞，民众四散逃离"));screen.appendChild(node("span","recording-light","● REC"));hooks.setAdvance(true,"关闭电视");}
      else{screen.classList.add("static");screen.appendChild(button("播放录像",function(){hooks.state.flags.prologueVideoPlaying=true;hooks.save();render(event,hooks);}));hooks.setAdvance(false);}
      return;
    }
  }
  modal.addEventListener("click",function(e){if(e.target===modal)closeModal();});
  modal.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var controls=Array.from(modal.querySelectorAll('button, [tabindex="0"]'));var first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  window.MuseumStage={render:render,bag:bag,close:closeModal,isOpen:function(){return !modal.hidden || window.MuseumInventory.isOpen() || window.MuseumAchievements.isOpen();}};
}());
