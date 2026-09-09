(function () {
  "use strict";
  window.MuseumMapArt = function (rooms) {
    function room(id,title,image,spawn,colliders,objects) {
      var img=new Image();img.src="assets/images/"+image;
      rooms[id]={id:id,title:title,chapter:"第一幕",width:1670,height:942,spawn:spawn,colliders:colliders,objects:objects,art:img};
    }
    function gate(id,label,x,y,target){return{id:id,type:"travel",label:label,x:x,y:y,r:90,target:target};}
    function scene(id,label,x,y,target,flag){return{id:id,type:"scene",label:label,x:x,y:y,r:100,scene:target,requiredFlag:flag};}
    room("dorm","员工宿舍","dorm-map.png",{x:830,y:750},[
      {x:0,y:0,w:1670,h:280},{x:0,y:0,w:40,h:942},{x:1630,y:0,w:40,h:942},{x:0,y:850,w:740,h:92},{x:930,y:850,w:740,h:92},
      {x:45,y:300,w:165,h:550},{x:160,y:270,w:330,h:160},{x:575,y:260,w:220,h:100},{x:1190,y:275,w:280,h:300},{x:1440,y:540,w:200,h:315}
    ],[scene("dorm-wardrobe","更衣柜",240,570,"rules-inspect"),scene("dorm-note","血字纸条",285,805,"note-inspect"),scene("dorm-tv","电视",690,400,"tv-inspect"),gate("dorm-exit","走廊",835,860,"corridor")]);
    room("hall","博物馆大厅","hall-map.png",{x:835,y:700},[
      {x:0,y:0,w:1670,h:525},{x:0,y:0,w:110,h:942},{x:1555,y:0,w:115,h:942},{x:0,y:875,w:735,h:67},{x:945,y:875,w:725,h:67}
    ],[gate("hall-corridor","走廊",835,870,"corridor"),scene("hall-ward","病房展厅",235,630,"scene-05"),scene("hall-class","教室展厅",1430,630,"scene-06","scene05Seen"),scene("hall-meeting","大厅集合",835,595,"scene-07","scene06Seen")]);
    room("corridor","博物馆走廊","corridor-map.png",{x:835,y:760},[
      {x:0,y:0,w:1670,h:185},{x:0,y:0,w:500,h:942},{x:1170,y:0,w:500,h:942}
    ],[gate("corridor-hall","大厅",835,240,"hall"),gate("corridor-dorm","员工宿舍",545,750,"dorm"),gate("corridor-office","馆长办公室",1120,470,"office"),scene("corridor-canteen","食堂门前",545,470,"scene-08","scene07Seen"),gate("corridor-wax","蜡像馆",1120,750,"wax")]);
    room("office","馆长办公室","office-map.png",{x:830,y:780},[
      {x:0,y:0,w:1670,h:315},{x:0,y:0,w:180,h:942},{x:1455,y:0,w:215,h:942},{x:550,y:300,w:520,h:180},{x:440,y:495,w:780,h:125},{x:0,y:885,w:730,h:57},{x:935,y:885,w:735,h:57}
    ],[scene("office-director","馆长",1130,390,"scene-09","scene08Seen"),gate("office-exit","走廊",835,865,"corridor")]);
  };
}());
