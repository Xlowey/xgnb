(function () {
  "use strict";
  var sheet=new Image();
  var ready=new Promise(function(resolve){sheet.onload=function(){resolve(true);};sheet.onerror=function(){console.error("主角行走素材加载失败");resolve(false);};});
  sheet.src=window.MuseumAssets ? window.MuseumAssets.url("hero-walk-cycle.png","characters") : new URL("../assets/images/characters/walk/hero-walk-cycle.png",document.currentScript.src).href;
  var frames=[{"height": 325, "frames": [[124, 28, 151, 325, 77.0], [470, 26, 145, 324, 73.0], [810, 28, 150, 322, 74.5]]}, {"height": 331, "frames": [[123, 380, 153, 331, 78.5], [470, 380, 145, 326, 73.0], [810, 380, 150, 331, 74.0]]}, {"height": 314, "frames": [[108, 736, 178, 310, 81.0], [464, 735, 134, 314, 67.0], [794, 736, 184, 307, 82.0]]}, {"height": 319, "frames": [[106, 1080, 179, 315, 96.5], [479, 1080, 137, 319, 68.5], [794, 1080, 189, 316, 98.5]]}];
  var directions={down:0,up:1,left:2,right:3};
  // World-space heights match the furniture scale of each room, then scale with its camera.
  // Heights are measured in each source map's pixels, not viewport pixels.
  // Calibrate against furniture/doors; overview art has a much smaller scale.
  // Both the standalone map and the novel investigation use this same table.
  var roomHeights=Object.freeze({
    // 馆内总览的走廊在画面里只有 24-30px 宽（见 js/map-art.js 的 walkable），
    // 所以 48 会让角色比走廊还高、看起来在穿墙。按画面比例取 26。
    museum:26,       // Overview corridors are ~24-30px wide in the artwork.
    dorm:210,        // Desk/chair and single bed: 100 made the hero toy-sized.
    hall:140,       // Large reception counter and stairs.
    corridor:135,   // Side doors are approximately 150 px tall.
    office:190,     // Armchairs and desk are larger than the hall furniture.
    wax:90,         // Legacy procedural room, not the unused wax artwork.
    classroom:165,  // School desks and the entrance at the bottom.
    canteenPassage:100 // Narrow corridor, door approximately 120 px tall.
  });
  function draw(ctx,x,y,facing,moving,travelled,roomId){
    if(!sheet.complete || !sheet.naturalWidth)return;
    var row=frames[directions[facing] === undefined ? 0 : directions[facing]];
    // Three drawn poses: left contact, neutral stance, right contact.
    // Only real movement advances the cycle. Stopping uses a narrow passing pose.
    var index=moving ? Math.floor(Math.max(0,travelled || 0)/27.5)%4 : 1;
    var height=roomHeights[roomId] || 145;
    var f=row.frames[[0,1,2,1][index]],scale=height/row.height,w=f[2]*scale,h=f[3]*scale;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#111c244d";ctx.beginPath();ctx.ellipse(x,y,18*height/100,6*height/100,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(sheet,f[0],f[1],f[2],f[3],Math.round(x-f[4]*scale),Math.round(y-h),w,h);
    ctx.restore();
  }
  window.MuseumPlayerAvatar={draw:draw,ready:ready};
}());

