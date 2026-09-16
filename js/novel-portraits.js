(function () {
  "use strict";
  var base=new URL("../assets/images/characters/",document.currentScript.src).href;
  var layer=document.createElement("div");layer.className="novel-portraits";layer.hidden=true;layer.setAttribute("aria-hidden","true");document.querySelector(".novel-stage").appendChild(layer);
  var portraits={};
  // 立绘素材有独立缓存版本；更新立绘时必须同步递增，否则浏览器会继续显示旧图。
  var assetVersion="50";

  // id, 图片, 无障碍名称, 是否作为"在场倾听者"显示（主角始终显示；其他人只在说话或本场有台词时出现）
  var CAST=[
    ["hero","portraits/hero-portrait.webp","主角立绘",false],
    ["zhaoling","portraits/zhaoling-portrait.webp","赵灵立绘",true],
    ["director","portraits/director-portrait.webp","馆长立绘",true],
    ["paperman","portraits/paper-man-portrait.webp","纸人立绘",true],
    ["girl","portraits/masked-girl-portrait.webp","小女孩（面具）立绘",true],
    ["maskedguard","portraits/masked-guard-portrait.webp","保安（面具）立绘",true],
    ["nightmare","portraits/nightmare-portrait.webp","梦魇立绘",true],
    ["doctor","portraits/doctor-portrait.webp","医生立绘",true],
    ["oldman","portraits/old-man-portrait.webp","老人立绘",true],
    ["son","portraits/son-portrait.webp","儿子立绘",true]
  ];
  CAST.forEach(function(entry){
    var img=document.createElement("img");
    img.src=base+entry[1]+"?v="+assetVersion;
    img.alt=entry[2];img.draggable=false;img.className="novel-portrait portrait-"+entry[0];img.hidden=true;
    layer.appendChild(img);
    portraits[entry[0]]={img:img,listener:entry[3]};
  });

  function character(speaker){
    if(/^主角|^玩家|^你(?:（|$)/.test(speaker))return "hero";
    // 剧本同时使用“馆长”“聂馆长”和带语气提示的“馆长（……）”。
    // “馆长的日记本”是物件旁白，不能误判成馆长本人。
    if(/^(?:聂馆长|馆长)(?:（|$)/.test(speaker))return "director";
    if(/^赵灵/.test(speaker))return "zhaoling";
    // 纸人的手臂 / 纸人 都是同一具执行体。
    if(/纸人/.test(speaker))return "paperman";
    if(/小女孩/.test(speaker))return "girl";
    if(/梦魇|神灵|神明/.test(speaker))return "nightmare";
    if(/^医生/.test(speaker))return "doctor";
    if(/^老人/.test(speaker))return "oldman";
    if(/^儿子/.test(speaker))return "son";
    // 戴面具的保安是反派；无脸保安也归到这里，因为立绘是同一"保安"形象。
    if(/保安/.test(speaker))return "maskedguard";
    return null;
  }

  function render(scene,line){
    var speaker=String(line.speaker || ""),active=character(speaker);
    var dialogue=(!line.type || line.type==="dialogue") && !!line.text && !/^(旁白|画面|场景|舞台|MOSS|系统)/.test(speaker);
    layer.hidden=!dialogue;document.body.classList.toggle("has-portraits",dialogue);
    Object.keys(portraits).forEach(function(id){
      portraits[id].img.hidden=true;
      portraits[id].img.classList.remove("is-speaking");
      portraits[id].img.style.removeProperty("--portrait-offset");
    });
    if(!dialogue)return;
    var monologue=/独白|自白|内心/.test(speaker);
    // 本场有台词的角色作为在场倾听者，除非这是主角独白。
    var cast=new Set((scene.events || scene.lines || []).map(function(l){return character(String(l.speaker || ""));}));
    var others=0, visibleListeners=[];
    Object.keys(portraits).forEach(function(id){
      if(id==="hero")return;
      var show=(id===active) || (!monologue && cast.has(id) && portraits[id].listener);
      if(id===active)show=true;
      portraits[id].img.hidden=!show;
      portraits[id].img.classList.toggle("is-speaking",id===active);
      if(show){
        others+=1;
        visibleListeners.push(portraits[id].img);
      }
    });
    // Multiple listeners share the right side. Spread them into stable slots so
    // a group scene cannot stack every portrait on the same pixel column.
    if (visibleListeners.length > 1) {
      var step = window.innerWidth <= 700 ? Math.min(window.innerWidth * .2, 112) : Math.min(window.innerWidth * .13, 172);
      visibleListeners.forEach(function(img, index){ img.style.setProperty("--portrait-offset", (index * step) + "px"); });
    }
    // 主角始终在场；独白时不摆出其他人。
    var heroOnly=monologue || others===0;
    portraits.hero.img.hidden=false;
    portraits.hero.img.classList.toggle("is-speaking",active==="hero"&&!monologue);
    layer.dataset.speaker=active || "other";
    layer.classList.toggle("has-prop",!!line.visual);
    layer.classList.toggle("is-pair",!heroOnly && others===1);
    layer.classList.toggle("is-crowd",others>=2);
  }
  window.MuseumPortraits={render:render,character:character};
}());
