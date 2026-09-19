/* 在 chapter-finalize.js 后加载，不修改原剧情对白和现有战斗入口。 */
(function () {
  "use strict";
  const scene=window.MuseumStory?.scenes["scene-28"];
  if(!scene) return;
  // 原播放器在打开场次时会标记 flag；追逐必须由成功结算才授予完成标记。
  scene.flag=null;
  scene.choices=[{id:"museum-runner-chase",label:"跟随 MOSS 路线，进入追逐",action:"runner",afterRunner:"scene-29",completionFlag:"scene28Seen"}];
  scene.returnToMap=false;
}());
