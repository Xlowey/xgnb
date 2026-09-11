(function(){
  "use strict";
  window.MuseumChapterMaps=function(rooms){
    function art(name){var image=new Image();image.src=window.MuseumAssets ? window.MuseumAssets.url(name,"maps") : "assets/images/maps/"+name;return image;}
    function travel(id,label,x,y,target){return {id:id,label:label,x:x,y:y,r:75,type:"travel",target:target};}
    var classroom={id:"classroom",title:"教室展厅",chapter:"第一幕",width:1647,height:955,spawn:{x:820,y:740},art:art("教室展厅背景.jpeg"),colliders:[
      {x:0,y:0,w:1647,h:280},{x:0,y:0,w:130,h:955},{x:1540,y:0,w:107,h:955},
      {x:0,y:780,w:760,h:175},{x:880,y:780,w:767,h:175},{x:0,y:900,w:1647,h:55},
      {x:1070,y:330,w:115,h:170},{x:1430,y:590,w:130,h:200}
    ],objects:[{id:"classroom-recording",type:"scene",scene:"scene-06",requiredFlag:"scene05Seen",label:"查看电视录像",x:1190,y:315,r:85},travel("classroom-exit","返回馆内",820,845,"museum")]};
    [200,400,600].forEach(function(x){classroom.colliders.push({x:x,y:320,w:145,h:425});});
    rooms.classroom=classroom;
    rooms.canteenPassage={id:"canteenPassage",title:"食堂门前走廊",chapter:"第一幕",width:1508,height:1043,spawn:{x:755,y:880},cameraZoom:1.15,art:art("食堂走廊地图.png"),colliders:[],walkable:[{x:635,y:205,w:245,h:715},{x:720,y:880,w:80,h:105}],objects:[
      {id:"canteen-door-story",type:"scene",scene:"scene-08",requiredFlag:"scene07Seen",label:"食堂铁门",x:755,y:240,r:75},travel("canteen-return","返回馆内",755,950,"museum")
    ]};
    function change(id,props){Object.values(rooms).forEach(function(r){r.objects.forEach(function(o){if(o.id===id)Object.assign(o,props);});});}
    change("overview-class",{type:"travel",target:"classroom"});
    change("overview-canteen",{type:"travel",target:"canteenPassage"});
    change("hall-class",{type:"travel",target:"classroom"});
    change("corridor-canteen",{type:"travel",target:"canteenPassage"});
    change("overview-hospital",{requiredFlag:"scene04Seen"});
    change("hall-ward",{requiredFlag:"scene04Seen"});
    change("overview-office",{requiredFlag:"scene08Seen"});
  };
}());
