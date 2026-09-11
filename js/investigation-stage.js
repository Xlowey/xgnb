(function(){
  "use strict";
  /*
   * 定点调查画面（病房那张）。
   *
   * 之前两个问题：
   *  1. 点热点只改按钮文字，反馈被 update() 立刻覆盖成"已调查 x / y"，玩家看不到
   *     那句描述，也没有任何跳转；录像素材没有被播放。
   *  2. 调查进度存在 flags["investigation:..."] 里并随存档保存，所以第二次进同一场景
   *     时按钮直接显示"已调查"，看起来像"这次的调查没有反馈"。
   * 现在：进度仍随存档保存（合法的断点续玩），但每次进入都会明确重播一遍描述，
   * 已查看过的热点会标注"（本次已查看）"；带 video 的热点会播放录像。
   */
  window.MuseumInvestigation={mount:function(root,event,hooks){
    var panel=document.createElement("section");panel.className="hotspot-investigation";panel.setAttribute("aria-label",event.title);
    var image=document.createElement("img");image.src=window.MuseumAssets.url(event.background,"storyBackgrounds");image.alt=event.title;panel.appendChild(image);

    // 本次进入这一场时点击过的热点。与存档里的完成度分开，避免"这次点了没反应"的错觉。
    var viewedThisVisit={};
    var status=document.createElement("p");status.className="investigation-progress";status.setAttribute("role","status");
    var feedback=document.createElement("p");feedback.className="investigation-feedback";feedback.setAttribute("role","status");
    feedback.textContent=event.intro || "点击画面中的标记进行调查。";

    function key(o){return "investigation:"+event.key+":"+o.id;}
    function completedCount(){return event.hotspots.filter(function(o){return hooks.state.flags[key(o)];}).length;}
    function update(){
      var count=completedCount(),done=count===event.hotspots.length;
      status.textContent=done ? "调查完成，可以继续剧情。" : "已调查 "+count+" / "+event.hotspots.length+"。点击尚未调查的标记。";
      status.classList.toggle("complete",done);
      hooks.setAdvance(done,event.action || "继续剧情");
    }

    event.hotspots.forEach(function(o){
      var saved=!!hooks.state.flags[key(o)];
      if(saved && o.background)image.src=window.MuseumAssets.url(o.background,"storyBackgrounds");
      var button=document.createElement("button");button.type="button";
      button.textContent=saved ? (o.afterLabel || "已调查") : o.label;
      button.style.left=o.x+"%";button.style.top=o.y+"%";button.dataset.hotspot=o.id;
      button.classList.toggle("examined",saved);
      button.addEventListener("click",function(e){
        e.stopPropagation();
        var text=o.text || "调查记录已更新。";
        if(!hooks.state.flags[key(o)]){
          hooks.state.flags[key(o)]=true;
          if(o.background)image.src=window.MuseumAssets.url(o.background,"storyBackgrounds");
          button.textContent=o.afterLabel || "已调查";
          button.classList.add("examined");
          hooks.save();
        } else if(viewedThisVisit[o.id]){
          text+="（本次已查看）";
        }
        viewedThisVisit[o.id]=true;
        // 描述写进固定的反馈行，不再被进度文字覆盖。
        feedback.textContent=text;
        feedback.classList.add("fresh");
        window.setTimeout(function(){feedback.classList.remove("fresh");},600);
        update();
        // 带录像的热点：直接播放，而不是只把按钮改成"查看录像"。
        if(o.video && window.MuseumStage && window.MuseumStage.playRecording){
          window.MuseumStage.playRecording({image:o.video,label:o.videoLabel || "录像"});
        }
      });
      panel.appendChild(button);
    });
    root.appendChild(panel);
    var bar=document.createElement("div");bar.className="investigation-bar";
    bar.appendChild(status);bar.appendChild(feedback);
    root.appendChild(bar);update();
  }};
}());
