(function () {
  "use strict";
  var root = document.getElementById("scene-events");
  var modal = document.getElementById("item-modal");
  var currentHooks, currentEvent, disposeExploration, backdrop, backdropObserver, previewObserver;
  function node(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function button(label, action, cls) { var b = node("button", cls || "event-button", label); b.type = "button"; b.addEventListener("click", action); return b; }
  function asset(name, category) { return window.MuseumAssets.url(name, category); }
  function picture(name, alt, category) { var img = node("img"); img.src = asset(name, category); img.alt = alt || ""; img.draggable = false; return img; }
  // Display a region of the supplied artwork without changing the source file.
  function focusedPicture(name, title, crop) {
    var frame=node("span","focused-picture"),img=picture(name,title);
    frame.style.aspectRatio=crop[2]+" / "+crop[3];
    Object.assign(img.style,{width:(1670/crop[2]*100)+"%",left:(-crop[0]/crop[2]*100)+"%",top:(-crop[1]/crop[3]*100)+"%"});
    frame.appendChild(img);return frame;
  }
  function syncRoomBackdrop(event,hooks) {
    var inDorm=hooks.scene && /员工宿舍/.test(hooks.scene.location || "");
    var visible=inDorm && !(hooks.scene && hooks.scene.background) && event && (!event.background || event.background === "dorm-map.webp") && (["item","document"].includes(event.type) || (["dialogue","television"].includes(event.type) && hooks.state.flags.dormExplorationPosition));
    document.body.classList.toggle("has-room-backdrop",!!visible);
    if(!visible){if(backdropObserver)backdropObserver.disconnect();if(backdrop)backdrop.remove();backdrop=null;return;}
    if(backdrop)return;
    backdrop=node("div","investigation-backdrop");backdrop.setAttribute("aria-hidden","true");
    var frame=node("div","investigation-still");frame.appendChild(picture("dorm-map.webp","","maps"));
    var canvas=node("canvas","exploration-character");canvas.width=1670;canvas.height=942;
    var source=root.querySelector(".exploration-character");
    if(source)canvas.getContext("2d").drawImage(source,0,0);
    else {var p=hooks.state.flags.dormExplorationPosition || {x:835,y:745};window.MuseumPlayerAvatar.ready.then(function(){if(canvas.isConnected)window.MuseumPlayerAvatar.draw(canvas.getContext("2d"),p.x,p.y,p.facing || "down",false,0,"dorm");});}
    frame.appendChild(canvas);backdrop.appendChild(frame);document.querySelector(".novel-stage").prepend(backdrop);
    function fit(){var b=backdrop.getBoundingClientRect(),scale=Math.min(b.width/1670,Math.max(0,b.height-38)/942);frame.style.width=(1670*scale)+"px";frame.style.height=(942*scale)+"px";}
    backdropObserver=new ResizeObserver(fit);backdropObserver.observe(backdrop);fit();
  }
  // 录像播放：宿舍电视事件与病房的"打开电视"热点共用同一段演出。
  // 以前只有电视事件能播，病房的调查热点只能把按钮文字改成"查看录像"，素材用不上。
  function playRecording(options) {
    var opts = options || {};
    var existing = document.getElementById("recording");
    if (existing) existing.remove();
    var recording = node("div", "recording-overlay"); recording.id = "recording";
    var screen = node("div", "recording-screen");
    screen.appendChild(picture(opts.image || "rabbits-recording.webp", opts.label || "录像"));
    screen.appendChild(node("span", "recording-light", "● REC"));
    screen.appendChild(node("span", "recording-caption", opts.caption || "录像正在播放"));
    var close = button("关闭录像", function () { recording.remove(); });
    recording.appendChild(screen); recording.appendChild(close);
    // 录像浮层自己处理 Esc，不依赖 novel.js 的 Esc 分支顺序。
    recording.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); recording.remove(); }
      if (event.key === "Tab") {
        // 浮层内只有一个按钮，Tab 不该把焦点丢到背后的工具栏。
        event.preventDefault(); close.focus();
      }
    });
    document.querySelector(".novel-stage").appendChild(recording);
    close.focus();
    return recording;
  }

  // 独立 CG 视频：与录像浮层分开，避免把剧情动画误当作调查录像。
  // 2026-09-20 改为**默认有声**（此前默认静音）。六个 CG 素材都带 AAC 音轨，
  // 静音等于白做。风险是浏览器会以"没有用户手势"为由拒绝**有声**自动播放，
  // 所以下面保留了"被拒就退回静音再播一次"的兜底：画面照样能看，只是要玩家自己开声音。
  function playCutscene(options, hooks) {
    var opts = options || {};
    document.body.classList.remove("video-ready");
    var videoEvent = node("section", "video-cg");
    var title = node("small", "video-cg-title", opts.label || "剧情动画");
    var player = document.createElement("video");
    player.className = "video-cg-player";
    player.src = window.MuseumAssets.video(opts.video);
    player.autoplay = true; player.muted = false; player.controls = true; player.playsInline = true;
    player.setAttribute("aria-label", opts.label || "剧情动画");
    var footer = node("div", "video-cg-footer");
    var hint = node("span", "video-cg-hint", "动画播放中 · 可用控件调整音量");
    var skip = button("跳过动画", finish, "video-cg-skip");
    footer.appendChild(hint); footer.appendChild(skip);
    videoEvent.appendChild(title); videoEvent.appendChild(player); videoEvent.appendChild(footer);
    root.appendChild(videoEvent);
    hooks.setAdvance(false);
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      player.pause();
      videoEvent.classList.add("is-finished");
      hint.textContent = "动画已结束";
      document.body.classList.add("video-ready");
      // 2026-09-20：CG 一结束就**直接翻到下一页**，不再让玩家点一次「继续」。
      // 顺序是先把「继续」摆好、再推进——自动推进万一被挡下（有弹窗开着，或后面
      // 没有下一页），按钮还在，玩家仍能手动继续，不会卡在最后一帧。
      // 「跳过动画」走的也是这里，所以跳过同样是一次点击到位。
      hooks.setAdvance(true, opts.action || "继续");
      skip.textContent = "继续";
      if (typeof hooks.advance === "function") hooks.advance();
    }
    player.addEventListener("ended", finish);
    player.addEventListener("error", function () {
      hint.textContent = "动画素材暂时无法播放，可直接继续";
      finish();
    });
    // 默认有声；被自动播放策略拦下时退回静音再播一次，不让画面卡死。
    var playback = player.play();
    if (playback && playback.catch) playback.catch(function () {
      player.muted = true;
      hint.textContent = "浏览器拦下了自动播放 · 可用控件打开声音";
      player.play().catch(function () {
        hint.textContent = "点击播放动画；也可以直接跳过";
      });
    });
    skip.focus();
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
    text.tabIndex = 0; text.setAttribute("aria-label", item.name + "清晰文字");
    var transcript = node("details", "document-transcript");
    transcript.appendChild(node("summary", "", "查看清晰文字"));
    transcript.appendChild(text);
    transcript.addEventListener("click", function (event) { event.stopPropagation(); });
    detail.appendChild(transcript);
    if (inModal && item.reverseImage) detail.appendChild(button(side === "back" ? "翻到正面" : "翻到背面", function () { openItem(item, side === "back" ? "front" : "back"); }));
    if (inModal && item.turnImage) detail.appendChild(button("查看翻页过程", function () { showZoom(item.turnImage, item.name + " · 翻页过程"); }));
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
  function setBackground(name, category) { document.querySelector(".novel-background").style.setProperty("--scene-background", 'url("'+asset(name,category || "storyBackgrounds")+'")'); }
  // 长页对白（目前只有结局 C 用）：把整场台词铺在一页里上下滑动读完，
  // 读完点「继续」推进到下一页（结局 C 的下一页是通关界面）。
  // 之所以不逐行点过去：这一段是"听赵灵把话说完"，逐页点会把一段连续的话切碎。
  // 无说话人的行（`画面：△ …`）按舞台提示样式渲染，不去改作者的措辞。
  function renderEndingLetter(event, hooks) {
    var sheet = node("article", "ending-letter");
    sheet.setAttribute("role", "document");
    sheet.setAttribute("aria-label", event.title || "完整对白");
    sheet.tabIndex = 0;
    var head = node("header", "ending-letter-head");
    head.appendChild(node("h2", "", event.title || "完整对白"));
    head.appendChild(node("p", "ending-letter-hint", "上下滑动读完 · 读完点「继续」"));
    sheet.appendChild(head);
    (event.entries || []).forEach(function (entry) {
      if (entry.image) {
        var figure = node("figure", "ending-letter-figure");
        var img = document.createElement("img");
        img.src = asset(entry.image);
        img.alt = entry.caption || "";
        img.loading = "lazy";
        figure.appendChild(img);
        if (entry.caption) figure.appendChild(node("figcaption", "", entry.caption));
        sheet.appendChild(figure);
        return;
      }
      var paragraph = node("p", "ending-letter-line" + (entry.speaker ? "" : " is-stage"));
      if (entry.speaker) paragraph.appendChild(node("strong", "ending-letter-speaker", entry.speaker + "："));
      paragraph.appendChild(document.createTextNode(String(entry.text || "")));
      sheet.appendChild(paragraph);
    });
    root.appendChild(sheet);
    hooks.setAdvance(true, event.action || "继续");
  }
  function render(event, hooks) {
    syncRoomBackdrop(event,hooks);
    if (previewObserver) { previewObserver.disconnect(); previewObserver=null; }
    if (disposeExploration) { disposeExploration(); disposeExploration = null; }
    currentHooks = hooks;currentEvent = event;root.textContent = "";root.hidden = !event;
    document.body.dataset.event = event ? event.type : "dialogue";
    // 事件级换曲：只有标了 bgm 的事件才切（目前只有结局 C 的完整对白页用 cEnding）。
    // 没标就维持当前曲子——场次级的默认由 novel.js 的 loadScene() 负责。
    if (event && event.bgm && window.MuseumAudio && window.MuseumAudio.play) window.MuseumAudio.play(event.bgm);
    root.className = "scene-events";
    var background = event && event.background || hooks.scene && hooks.scene.background;
    document.querySelector(".novel-background").style.backgroundSize=event && event.backgroundFit === "contain" ? "contain" : "";
    // Let the scene theme provide the room background when an event has no
    // explicit artwork.  A hard-coded dorm image here used to replace the
    // patrol and office backgrounds on every dialogue line.
    if (background) {
      var backgroundKind = event && event.type === "explore" ? "maps" : window.MuseumAssets.categoryFor(background,"root");
      if ((!event || event.type !== "explore") && backgroundKind === "maps") {
        // A map accidentally placed in a dialogue event must never become a
        // full-screen visual-novel backdrop.
        console.warn("已忽略剧情事件中的地图背景：" + background);
        document.querySelector(".novel-background").style.removeProperty("--scene-background");
      } else setBackground(background,backgroundKind);
    } else document.querySelector(".novel-background").style.removeProperty("--scene-background");
    if (!event) return;
    if (event.type === "investigate") { window.MuseumInvestigation.mount(root,event,hooks);return; }
    if (event.type === "incident") {
      root.classList.add("ribbon-incident");
      var ribbons=node("div","falling-ribbons");ribbons.setAttribute("aria-hidden","true");
      for(var i=0;i<32;i++){var ribbon=node("i");ribbon.style.left=(12+(i*29)%77)+"%";ribbon.style.setProperty("--delay",(i%7)*.13+"s");ribbon.style.background=["#b75a66","#d5b667","#6f99bd","#7eab88"][i%4];ribbons.appendChild(ribbon);}
      root.appendChild(ribbons);root.appendChild(node("p","incident-caption",event.text));return;
    }
    if (event.type === "dialogue") {
      if(event.visual){var visual=node("figure","dialogue-prop");visual.appendChild(picture(event.visual,"血字纸条"));root.appendChild(visual);}return;
    }
    if (event.type === "system") {var system=node("section","system-message");system.setAttribute("role","status");system.appendChild(node("small","","系统"));system.appendChild(node("p","",event.text));root.appendChild(system);return;}
    if (event.type === "video") {root.className="scene-events video-event";playCutscene(event,hooks);return;}
    if (event.type === "letter") {root.className="scene-events letter-event";renderEndingLetter(event,hooks);return;}
    if (event.type === "cg") {root.className="scene-events "+(event.effect || "");return;}
    root.className="scene-events";
    if (event.type === "document") {
      window.MuseumInventory.acquire(hooks.state,event.item,{save:hooks.save});
      if (event.item === "note" && window.MuseumTutorial && !window.MuseumTutorial.isDone("inventory")) window.MuseumTutorial.show("inventory", { kind: "inventory", title: "纸条已经收好", body: "它已经放入背包。打开一次背包，就能随时重看纸条的正面和背面。", action: function () { window.MuseumInventory.open(); }, actionLabel: "打开背包" });
      root.appendChild(showDocument(window.MuseumStory.items[event.item],event.side));hooks.save();return;
    }
    if (event.type === "item") {
      if(event.collect)window.MuseumInventory.acquire(hooks.state,event.collect,{save:hooks.save});
      if (event.collect === "note" && window.MuseumTutorial && !window.MuseumTutorial.isDone("inventory")) window.MuseumTutorial.show("inventory", { kind: "inventory", title: "纸条已经收好", body: "它已经放入背包。打开一次背包，就能随时重看纸条的正面和背面。", action: function () { window.MuseumInventory.open(); }, actionLabel: "打开背包" });
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
        var crop=node("div","observation-closeup"), photo=picture("dorm-map.webp",o.name+"特写","maps");
        crop.style.aspectRatio=o.crop[2]+" / "+o.crop[3];
        Object.assign(photo.style,{width:(1670/o.crop[2]*100)+"%",left:(-o.crop[0]/o.crop[2]*100)+"%",top:(-o.crop[1]/o.crop[3]*100)+"%"});crop.appendChild(photo);box.appendChild(crop);
        box.appendChild(node("h2","",o.name));box.appendChild(node("p","",o.text));box.appendChild(button("返回房间",closeModal));modal.appendChild(box);box.querySelector("button").focus();
      });hooks.setAdvance(false);return;
    }
    if (event.type === "television") {
      var tv=node("div","television-set"),screen=node("div","television-screen");tv.appendChild(screen);root.appendChild(tv);
      var playing=hooks.state.flags.prologueVideoPlaying;
      if(playing){screen.classList.add("playing");screen.appendChild(picture("rabbits-recording.webp","巨型兔子在城市中横冲直撞，民众四散逃离"));screen.appendChild(node("span","recording-light","● REC"));hooks.setAdvance(true,"关闭电视");}
      else{screen.classList.add("static");screen.appendChild(button("播放录像",function(){hooks.state.flags.prologueVideoPlaying=true;hooks.save();render(event,hooks);}));hooks.setAdvance(false);}
      return;
    }
  }
  modal.addEventListener("click",function(e){if(e.target===modal)closeModal();});
  modal.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var controls=Array.from(modal.querySelectorAll('button, [tabindex="0"]'));var first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  window.MuseumStage={render:render,bag:bag,close:closeModal,playRecording:playRecording,isOpen:function(){return (window.MuseumSaveDialog && window.MuseumSaveDialog.isOpen()) || !modal.hidden || window.MuseumInventory.isOpen() || window.MuseumAchievements.isOpen();}};
}());
