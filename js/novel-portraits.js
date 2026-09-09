(function () {
  "use strict";
  var base=new URL("../assets/images/characters/",document.currentScript.src).href;
  var layer=document.createElement("div");layer.className="novel-portraits";layer.hidden=true;layer.setAttribute("aria-hidden","true");document.querySelector(".novel-stage").appendChild(layer);
  var portraits={};
  [["hero","hero-portrait.png","主角立绘"],["zhaoling","zhaoling-portrait.png","赵灵立绘"]].forEach(function(entry){var img=document.createElement("img");img.src=base+entry[1];img.alt=entry[2];img.draggable=false;img.className="novel-portrait portrait-"+entry[0];img.hidden=true;layer.appendChild(img);portraits[entry[0]]=img;});
  function character(speaker){if(/^主角|^玩家|^你(?:（|$)/.test(speaker))return "hero";if(/^赵灵/.test(speaker))return "zhaoling";return null;}
  function render(scene,line){
    var speaker=String(line.speaker || ""),active=character(speaker);
    var dialogue=(!line.type || line.type==="dialogue") && !!line.text && !/^(旁白|画面|场景|舞台|MOSS|系统)/.test(speaker);
    layer.hidden=!dialogue;document.body.classList.toggle("has-portraits",dialogue);
    Object.values(portraits).forEach(function(img){img.hidden=true;img.classList.remove("is-speaking");});
    if(!dialogue)return;
    var monologue=/独白|自白|内心/.test(speaker);
    var cast=new Set((scene.events || scene.lines || []).map(function(l){return character(String(l.speaker || ""));}));
    // Keep known participants listening; never use a supplied portrait for a different NPC.
    var showZhao=active==="zhaoling" || (!monologue && cast.has("zhaoling"));
    portraits.hero.hidden=false;portraits.hero.classList.toggle("is-speaking",active==="hero");
    portraits.zhaoling.hidden=!showZhao;portraits.zhaoling.classList.toggle("is-speaking",active==="zhaoling");
    layer.dataset.speaker=active || "other";layer.classList.toggle("has-prop",!!line.visual);layer.classList.toggle("is-pair",showZhao);
  }
  window.MuseumPortraits={render:render};
}());
