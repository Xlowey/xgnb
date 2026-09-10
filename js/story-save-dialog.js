(function(){
'use strict';
var dialog=document.createElement('dialog');dialog.className='story-save-dialog';dialog.setAttribute('aria-label','存档管理');document.body.appendChild(dialog);
function button(text,fn){var b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
function open(options,mode){
 options.pause();
 function entries(){if(!options.preview)return MuseumState.listSlots(options.user.id);try{return JSON.parse(sessionStorage.getItem('museum_preview_slots')||'[]');}catch(_){return [];}}
 function close(){dialog.close();options.resume();}
 function render(){dialog.replaceChildren();var header=document.createElement('header');var title=document.createElement('h2');title.textContent=mode==='save'?'保存游戏':'读取存档';header.append(title,button('关闭',close));dialog.append(header);
 var tabs=document.createElement('nav');tabs.append(button('保存',()=>{mode='save';render();}),button('读取',()=>{mode='load';render();}));dialog.append(tabs);
 var help=document.createElement('p');help.textContent=options.preview?'课堂预览存档仅保留在本次浏览会话中。':'与地图共用 20 个手动存档位；保存位置包含剧情、背包和探索进度。';dialog.append(help);
 var grid=document.createElement('div');grid.className='story-save-grid';dialog.append(grid);
 function card(label,entry,index){var item=document.createElement('article');var info=document.createElement('div');var st=entry&&entry.state;info.textContent=label+' · '+(st?((st.narrativeNode?'剧情 '+st.narrativeNode+' · 第 '+(Number(st.narrativeIndex)+1)+' 段':({dorm:'员工宿舍',hall:'大厅',corridor:'走廊',office:'办公室',wax:'蜡像馆'}[st.roomId]||st.roomId))+' · '+(entry.savedAt||st.savedAt?new Date(entry.savedAt||st.savedAt).toLocaleString():"当前进度")):'空存档位');item.append(info);
 var action=button(mode==='save'&&index>=0?(entry?'覆盖':'保存'):'读取',function(){
  if(mode==='save'&&index>=0){if(entry&&!confirm('确定覆盖存档位 '+(index+1)+' 吗？'))return;
   options.save();if(options.preview){var all=entries();all[index]={savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(options.state()))};sessionStorage.setItem('museum_preview_slots',JSON.stringify(all));}else MuseumState.saveSlot(options.state(),options.user.id,index);if(window.MuseumTutorial)window.MuseumTutorial.complete('save');render();
  }else{var loaded=options.preview?JSON.parse(JSON.stringify(entry.state)):(index<0?MuseumState.load(options.user.id):MuseumState.loadSlot(options.user.id,index));if(!loaded)return;dialog.close();options.load(loaded);}
 });action.disabled=(mode==='load'&&!entry)||(mode==='save'&&index<0);item.append(action);grid.append(item);}
 var auto=options.preview?options.state():MuseumState.load(options.user.id);card('自动存档',auto?{state:auto,savedAt:auto.savedAt}:null,-1);var all=entries();for(var i=0;i<20;i++)card('存档位 '+(i+1),all[i],i);
 }
 dialog.oncancel=function(){options.resume();};render();if(!dialog.open)dialog.showModal();
}
window.MuseumSaveDialog={open:open,isOpen:()=>dialog.open};
})();

