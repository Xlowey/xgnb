(function(){
  "use strict";
  window.MuseumInvestigation={mount:function(root,event,hooks){
    var panel=document.createElement("section");panel.className="hotspot-investigation";panel.setAttribute("aria-label",event.title);
    var image=document.createElement("img");image.src=window.MuseumAssets.url(event.background,"storyBackgrounds");image.alt=event.title;panel.appendChild(image);
    var feedback=document.createElement("p");feedback.className="investigation-feedback";feedback.setAttribute("role","status");
    function key(o){return "investigation:"+event.key+":"+o.id;}
    function completedCount(){return event.hotspots.filter(function(o){return hooks.state.flags[key(o)];}).length;}
    function update(){
      var count=completedCount(),done=count===event.hotspots.length;
      feedback.textContent=done ? "调查完成，可以继续剧情。" : "已调查 "+count+" / "+event.hotspots.length+"。点击尚未调查的标记。";
      feedback.classList.toggle("complete",done);
      hooks.setAdvance(done,event.action || "继续剧情");
    }
    event.hotspots.forEach(function(o){
      if(hooks.state.flags[key(o)] && o.background)image.src=window.MuseumAssets.url(o.background,"storyBackgrounds");
      var examined=!!hooks.state.flags[key(o)];
      var button=document.createElement("button");button.type="button";button.textContent=examined ? (o.afterLabel || "已调查") : o.label;button.style.left=o.x+"%";button.style.top=o.y+"%";button.dataset.hotspot=o.id;
      button.classList.toggle("examined",!!hooks.state.flags[key(o)]);
      button.addEventListener("click",function(e){
        e.stopPropagation();
        if(!hooks.state.flags[key(o)]){
          hooks.state.flags[key(o)]=true;
      if(o.background)image.src=window.MuseumAssets.url(o.background,"storyBackgrounds");
          feedback.textContent=o.text || "调查记录已更新。";
          button.textContent=o.afterLabel || "已调查";
          button.classList.add("examined");
          hooks.save();
        }
        update();
      });
      panel.appendChild(button);
    });
    root.appendChild(panel);root.appendChild(feedback);update();
  }};
}());
