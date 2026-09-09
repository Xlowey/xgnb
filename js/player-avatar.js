(function () {
  "use strict";
  var sheet = new Image();
  var ready = new Promise(function(resolve) { sheet.onload=function(){resolve(true);};sheet.onerror=function(){console.error("主角行走素材加载失败");resolve(false);}; });
  sheet.src=new URL("../assets/images/characters/hero-walk-sheet.png",document.currentScript.src).href;
  // Screen-up shows the back. Rectangles include the entire hat and boots.
  var frames={down:[326,43,192,434],up:[1018,44,187,437],left:[301,531,231,403],right:[1003,532,232,401]};
  function draw(ctx,x,y,facing,moving,travelled) {
    if(!sheet.complete || !sheet.naturalWidth)return;
    var frame=frames[facing] || frames.down;
    var height=100,width=height*frame[2]/frame[3];
    // One supplied pose per direction, with subtle motion while walking.
    var bob=moving?Math.abs(Math.sin((travelled || 0)/13))*2:0;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#111c244d";ctx.beginPath();ctx.ellipse(x,y,18,6,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(sheet,frame[0],frame[1],frame[2],frame[3],Math.round(x-width/2),Math.round(y-height-bob),width,height);
    ctx.restore();
  }
  window.MuseumPlayerAvatar={draw:draw,ready:ready};
}());
