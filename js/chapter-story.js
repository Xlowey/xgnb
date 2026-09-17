(function(){
  "use strict";
  var scenes=window.MuseumStory.scenes;
  function dialogue(line,background){return {type:/MOSS|系统/.test(line.speaker)?"system":"dialogue",speaker:line.speaker,text:line.text,background:background};}
  var hospital="病房场景黑夜版.webp";
  scenes["scene-05"].events=[{type:"investigate",background:"病房场景黑夜版（电视机关闭）.webp",title:"调查病房展厅",key:"hospital",intro:"病房里只有一张床和一台老电视。点击画面中的标记调查。",hotspots:[
    {id:"bed",label:"调查病床",afterLabel:"病床已调查",x:26,y:70,text:"床单下空无一物。床架内侧有几道很深的抓痕，像是有人被按在这里挣扎过。"},
    {id:"tv",label:"打开电视",afterLabel:"查看录像",x:86,y:71,text:"电视自己亮了。屏幕上是一段夜间监控录像。",background:hospital,video:"rabbits-recording.webp",videoLabel:"病房电视录像",videoCaption:"录像 · 巨型兔子在城市中横冲直撞"}
  ],action:"继续剧情"},{type:"cg",background:"hospital-resuscitation.webp",action:"继续",label:"录像画面 · 病房急救"}].concat(scenes["scene-05"].lines.map(function(l){return dialogue(l,/（录像）/.test(l.speaker)?"病房电视机.webp":hospital);}));
  // 剧情播放器只引用剧情背景；地图由探索页和地图数据单独加载。
  var backgrounds={"scene-04":null,"scene-06":null,"scene-07":"食堂走廊背景.webp","scene-08":null,"scene-08-a":null,"scene-08-b":null,"scene-08-c":null};
  Object.keys(backgrounds).forEach(function(id){
    scenes[id].events=scenes[id].lines.map(function(l){var bg=backgrounds[id];if(id==="scene-07" && scenes[id].lines.indexOf(l)>=11)bg="食堂门口背景.webp";return dialogue(l,bg);});
  });
  scenes["scene-06"].choices=null;
  scenes["scene-06"].nextScene=null;
  // 009 已删除「年轻保安被杀 / 纸人喷彩带」那段（大厅改成不死人）。
  // 原先这里靠 /废话多/ 定位插入点，锚点消失后 findIndex 返回 -1，
  // splice(0,0,...) 反而把它插到了馆长训话之前——2026-09-17 连同事件本身一起删除。
  // The office flag is earned by finishing a reply, never merely opening the choices.
  scenes["scene-08"].flag=null;
  // Scene defaults also apply to later chapters that use plain dialogue lines.
  // Keep this explicit: themes such as "nightmare" do not identify a location.
  var sceneBackgrounds = {
    "scene-05":"病房场景黑夜版（电视机关闭）.webp",
    "scene-07":"食堂走廊背景.webp",
    "scene-12":"食堂正常背景.webp",
    "scene-13":"蜡像馆背景（正常版）.webp",
    "scene-14":"蜡像馆背景（正常版）.webp",
    "scene-16":"银色的恋人展厅.webp",
    "scene-18":"食堂门口背景.webp",
    "scene-19":"食堂背景（含彩带版）.webp",
    "scene-20":"食堂背景（含彩带版）.webp",
    "scene-21":"食堂背景（含彩带版）.webp",
    "scene-27":"食堂门口背景.webp",
    "scene-28":"食堂门口背景.webp",
    "scene-29":"食堂门口背景.webp"
  };
  Object.keys(sceneBackgrounds).forEach(function(id){
    if(scenes[id])scenes[id].background=sceneBackgrounds[id];
  });
  // Existing scene IDs remain stable until the revised script is migrated.
  // Artwork is selected by the actual location, never by the new script's number.
  var supplementBackgrounds={
    "scene-01":"宿舍背景图.webp","scene-02":"宿舍背景图.webp","scene-03":"宿舍背景图.webp",
    "scene-04":"普通走廊.webp","scene-06":"大厅背景.webp",
    "scene-08":"馆长办公室背景.webp","scene-08-a":"馆长办公室背景.webp","scene-08-b":"馆长办公室背景.webp","scene-08-c":"馆长办公室背景.webp",
    // 新到的静态 CG 与第十场的“阴暗角落”正文对应；旧的同名地图图不再拿来当剧情背景。
    "scene-09":"dark-corner.webp","scene-11":"宿舍背景图.webp","scene-11-after":"宿舍背景图.webp","scene-10":"宿舍背景图.webp",
    "scene-15":"馆长办公室背景.webp","scene-17":"普通走廊.webp","scene-22":"馆长办公室背景.webp","scene-23":"宿舍背景图.webp",
    "scene-24":"普通走廊.webp","scene-24-reveal":"普通走廊.webp","scene-24-hide":"普通走廊.webp",
    "scene-25":"宿舍门带血迹.webp","scene-26":"走廊带血版.webp","scene-28":"出口图片.webp","scene-29":"出口图片.webp",
    "rules-inspect":"宿舍背景图.webp","note-inspect":"宿舍背景图.webp","tv-inspect":"宿舍背景图.webp",
    "wardrobe-repeat":"宿舍背景图.webp","note-repeat":"宿舍背景图.webp","mirror":"宿舍背景图.webp"
  };
  Object.keys(supplementBackgrounds).forEach(function(id){if(scenes[id])scenes[id].background=supplementBackgrounds[id];});
  function itemEvent(image){return {type:"document",item:image,side:"front",action:"继续"};}
  function prepend(id,events){var s=scenes[id];s.events=events.concat(s.events || s.lines.map(function(l){return dialogue(l);}));}
  function prependVideos(id, entries){
    var s=scenes[id];
    if(!s)return;
    var existing=s.events || s.lines.map(function(l){return dialogue(l,s.background);});
    s.events=entries.map(function(entry){return {type:"video",video:entry.video,label:entry.label,action:"继续"};}).concat(existing);
  }
  // 本轮新到的 CG 按场次接入。视频只是开场演出，正文仍由原对白数据推进。
  prependVideos("scene-01", [{video:"CG1：桃树梦中惊醒.mp4",label:"CG · 桃树梦中惊醒"}]);
  prependVideos("scene-08", [{video:"CG9.1.mp4",label:"CG · 馆长办公室"}]);
  // CG10.1.mp4 原本挂在这场，但画面是「红色食堂 + 梦魇台词『我说过，你走不了』」，
  // 与第九场（办公室门口的阴暗角落 / 赵灵与小女孩）内容不符，2026-09-17 摘除。
  // 素材仍在 assets/video/cg/CG10.1.mp4，若确认属于「食堂前方 · 梦魇拦路」那几场，可改挂到 scene-27 / scene-28。
  prependVideos("scene-11-after", [
    {video:"CG11.mp4",label:"CG · 禁忌失控"},
    {video:"CG11.2.mp4",label:"CG · 蜡像馆异象"}
  ]);
  prepend("scene-13",[{type:"cg",background:"床头柜.webp",action:"查看展台"},{type:"cg",background:"张明诚展台.webp",action:"继续"}]);
  prepend("scene-14",[{type:"cg",background:"赵灵展厅.webp",action:"继续"},{type:"cg",background:"赵灵展厅（含人物）.webp",action:"继续"}]);
  prepend("scene-22",[itemEvent("入职申请表.webp")]);
  // Discoveries are shown after the line that describes finding them, never
  // before: an item page that opens ahead of its own narration reads as a
  // duplicated or out-of-order scene.
  var uniform=scenes["scene-23"];
  uniform.events=[];
  // 009 的措辞是「照纸片的意思」（旧稿为「看纸片上的意思」），锚点跟着剧本走，否则这两件道具永远不发放。
  uniform.lines.forEach(function(l){uniform.events.push(dialogue(l));if(/纸片的意思/.test(l.text))uniform.events.push(itemEvent("银色的发卡.webp"),itemEvent("赵灵红色制服里的纸片2.webp"));});
  prepend("scene-26",[itemEvent("赵灵红色制服里的纸片.webp")]);
  var perfect=scenes["ending-c"];
  perfect.events=[];
  perfect.lines.forEach(function(l){perfect.events.push(dialogue(l));if(/梦魇不希望我进入/.test(l.text))perfect.events.push(itemEvent("张明诚契约.webp"));});
  // Repeat re-inspections (wardrobe-repeat / note-repeat / mirror) are wired to
  // the recorded inspection scenes in novel-prologue.js.  They are deliberately
  // not re-pointed here, because cloning scene-02 / scene-03 made "re-open the
  // wardrobe" show the staff rules and "re-read the note" restart half of scene 03.
  window.MuseumStory.textRevision=7;
}());
