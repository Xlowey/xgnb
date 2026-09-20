(function () {
  "use strict";
  function create() {
  var walls = [[0,0,1670,290],[0,0,42,942],[1625,0,45,942],
    [0,850,742,92],[925,850,745,92],[742,913,183,29],
    [45,330,165,520],[165,290,325,145],[580,285,210,76],
    [1200,290,265,225],[1190,485,90,80],[1290,475,140,122],[1440,545,185,310]];
  var objects = [
    {id:"tv",name:"电视",text:"盖着红布的电视。",x:685,y:395,mark:[680,275],crop:[570,175,240,220]},
    {id:"dvd",name:"影碟机",text:"一台影碟机。",x:1395,y:625,mark:[1540,600],crop:[1430,530,205,175]},
    {id:"desk",name:"木桌",text:"木桌上有被啃食的痕迹。",x:380,y:472,mark:[320,320],crop:[165,175,330,275]},
    {id:"bed",name:"床底",text:"床底好像有异响。",x:1155,y:465,mark:[1220,460],crop:[1180,360,300,220]},
    {id:"wardrobe",name:"更衣柜",x:252,y:625,mark:[155,605]}
  ];

    var rooms = {};
    var image = new Image(); image.src = window.MuseumAssets.url("dorm-map.webp", "maps");
    rooms["dorm-intro"] = {id:"dorm-intro",title:"员工宿舍 · 开场调查",chapter:"第二场",width:1670,height:942,spawn:{x:835,y:745},radius:15,speed:230,kind:"exploration",art:image,
      colliders:walls.map(function(r){return {x:r[0],y:r[1],w:r[2],h:r[3]};}),objects:objects.map(function(o){
        return Object.assign({},o,{type:"investigation",label:o.name,x:o.mark[0],y:o.mark[1],r:115,approach:{x:o.x,y:o.y}});
      })};
    var hospital = new Image(); hospital.src=window.MuseumAssets.url("病房场景黑夜版（电视机关闭）.webp","storyBackgrounds");
    rooms["investigation-hospital"]={id:"investigation-hospital",title:"病房展厅 · 定点调查",chapter:"第五场",kind:"hotspots",width:1648,height:954,spawn:{x:500,y:400},colliders:[],art:hospital,objects:[
      {id:"bed",type:"hotspot",label:"调查病床",x:428.48,y:667.8,r:15},
      {id:"tv",type:"hotspot",label:"打开电视",x:1417.28,y:677.34,r:15}
    ]};
    return rooms;
  }
  function resolve(id) {var rooms=create();window.MuseumMapLayout.applySaved(rooms);return rooms[id];}
  function blocked(room,x,y) {
    var r=room.radius || (room.id==="museum"?10:22);
    if(x<r||y<r||x>room.width-r||y>room.height-r)return true;
    if(room.walkable && room.walkable.length && ![[x-r,y],[x+r,y],[x,y-r],[x,y+r]].every(function(p){return room.walkable.some(function(a){return p[0]>=a.x&&p[0]<=a.x+a.w&&p[1]>=a.y&&p[1]<=a.y+a.h;});}))return true;
    return room.colliders.some(function(a){return x+r>a.x&&x-r<a.x+a.w&&y+r>a.y&&y-r<a.y+a.h;});
  }
  window.MuseumInteractionMaps={create:create,resolve:resolve,blocked:blocked};
}());
