(function(){
  "use strict";
  var scenes=window.MuseumStory.scenes;
  function dialogue(line,background){return {type:/MOSS|系统/.test(line.speaker)?"system":"dialogue",speaker:line.speaker,text:line.text,background:background};}
  var hospital="病房展厅（电视机打开）.jpeg";
  scenes["scene-05"].events=[{type:"investigate",background:"病房展厅(电视机关闭）.jpeg",title:"调查病房展厅",key:"hospital",hotspots:[
    {id:"bed",label:"调查病床",afterLabel:"病床已调查",x:26,y:70,text:"床单下空无一物。"},
    {id:"tv",label:"打开电视",afterLabel:"查看录像",x:86,y:71,text:"电视正在播放一段录像。",background:hospital}
  ],action:"继续剧情"}].concat(scenes["scene-05"].lines.map(function(l){return dialogue(l,hospital);}));
  // 剧情播放器只引用剧情背景；地图由探索页和地图数据单独加载。
  var backgrounds={"scene-04":null,"scene-06":null,"scene-07":null,"scene-08":"食堂走廊背景.png","scene-09":null,"scene-09-a":null,"scene-09-b":null,"scene-09-c":null};
  Object.keys(backgrounds).forEach(function(id){
    scenes[id].events=scenes[id].lines.map(function(l){var bg=backgrounds[id];if(id==="scene-08" && scenes[id].lines.indexOf(l)>=11)bg="食堂门口背景.png";return dialogue(l,bg);});
  });
  scenes["scene-07"].choices=null;
  scenes["scene-07"].nextScene=null;
  var strikeAt=scenes["scene-07"].events.findIndex(function(e){return /废话多/.test(e.text);});
  scenes["scene-07"].events.splice(strikeAt+1,0,{type:"incident",action:"继续",text:"纸人的手臂洞穿年轻保安的胸膛。没有血，只有五颜六色的彩带。"});
  // The office flag is earned by finishing a reply, never merely opening the choices.
  scenes["scene-09"].flag=null;
  // Scene defaults also apply to later chapters that use plain dialogue lines.
  // Keep this explicit: themes such as "nightmare" do not identify a location.
  var sceneBackgrounds = {
    "scene-05":"病房展厅(电视机关闭）.jpeg",
    "scene-08":"食堂走廊背景.png",
    "scene-14":"食堂正常背景.jpeg",
    "scene-15":"蜡像馆背景（正常版）.jpeg",
    "scene-16":"蜡像馆背景（正常版）.jpeg",
    "scene-18":"银色的恋人展厅.jpeg",
    "scene-20":"食堂门口背景.png",
    "scene-21":"食堂背景（含彩带版）.jpeg",
    "scene-22":"食堂背景（含彩带版）.jpeg",
    "scene-23":"食堂背景（含彩带版）.jpeg",
    "scene-29":"食堂门口背景.png",
    "scene-30":"食堂门口背景.png",
    "scene-31":"食堂门口背景.png"
  };
  Object.keys(sceneBackgrounds).forEach(function(id){
    if(scenes[id])scenes[id].background=sceneBackgrounds[id];
  });
  window.MuseumStory.textRevision=5;
}());
