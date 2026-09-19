(function(){
'use strict';
var dialog=document.createElement('dialog');dialog.className='story-save-dialog';dialog.setAttribute('aria-label','存档管理');document.body.appendChild(dialog);
function button(text,fn){var b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
function open(options,mode){
 var returnFocus=document.activeElement;options.pause();
 function entries(){if(!options.preview)return MuseumState.listSlots(options.user.id);try{return JSON.parse(sessionStorage.getItem('museum_preview_slots')||'[]');}catch(_){return [];}}
 function checkpoint(){if(options.preview){try{var raw=sessionStorage.getItem('museum_preview_checkpoint');return raw?JSON.parse(raw):null;}catch(_){return null;}}return MuseumState.loadCheckpoint(options.user.id);}
 function close(){dialog.close();options.resume();if(returnFocus&&returnFocus.isConnected)returnFocus.focus();}
 function error(message){var old=dialog.querySelector('.story-save-error');if(old)old.remove();var p=document.createElement('p');p.className='story-save-error';p.textContent=message;dialog.querySelector('header').after(p);}
 function load(loaded){if(!loaded){error('这个存档无法读取。');return;}if(options.load(loaded)===false){error('读取失败，进度未切换，请重试。');return;}dialog.close();}
 function render(){dialog.replaceChildren();var header=document.createElement('header');var title=document.createElement('h2');title.textContent=mode==='save'?'保存游戏':'读取存档';header.append(title,button('关闭',close));header.prepend(document.createTextNode('当前档案 · '+options.user.username));dialog.append(header);
 var tabs=document.createElement('nav');tabs.append(button('保存',()=>{mode='save';render();}),button('读取',()=>{mode='load';render();}));dialog.append(tabs);
 var help=document.createElement('p');help.textContent=options.preview?'课堂预览存档仅保留在本次浏览会话中。':'与地图共用 20 个手动存档位；选择前检查点会单独保留，保存位置包含剧情、背包和探索进度。';dialog.append(help);
 var grid=document.createElement('div');grid.className='story-save-grid';dialog.append(grid);
 function card(label,entry,index){var item=document.createElement('article');var info=document.createElement('div');var st=entry&&entry.state;info.textContent=label+' · '+(st?((((st.mode==='novel'||st.mode==='ending')&&st.narrativeNode)?'剧情 '+st.narrativeNode+' · 第 '+(Number(st.narrativeIndex)+1)+' 段':({museum:'博物馆',canteen:'食堂',canteenPassage:'食堂门前走廊',dorm:'员工宿舍',hall:'大厅',corridor:'走廊',office:'办公室',wax:'蜡像馆'}[st.roomId]||st.roomId))+' · '+(entry.savedAt||st.savedAt?new Date(entry.savedAt||st.savedAt).toLocaleString():"当前进度")):'空存档位');item.append(info);
 var action=button(mode==='save'&&index>=0?(entry?'覆盖':'保存'):'读取',function(){
  if(mode==='save'&&index>=0){if(entry&&!confirm('确定覆盖存档位 '+(index+1)+' 吗？'))return;
   var ok=options.save()!==false;if(!ok){error('存档写入失败，请检查浏览器存储空间后重试。');return;}
   if(window.MuseumTutorial)window.MuseumTutorial.complete('save');
   if(options.preview){var all=entries();all[index]={savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(options.state()))};try{sessionStorage.setItem('museum_preview_slots',JSON.stringify(all));}catch(_){error('预览存档写入失败。');return;}}
   else if(!MuseumState.saveSlot(options.state(),options.user.id,index)){error('存档写入失败，请重试。');return;}
   render();
  }else{var loaded=options.preview?JSON.parse(JSON.stringify(entry.state)):(index<0?MuseumState.load(options.user.id):MuseumState.loadSlot(options.user.id,index));load(loaded);}
 });action.disabled=(mode==='load'&&!entry)||(mode==='save'&&(index<0||!options.state()));item.append(action);
 if(index>=0&&entry)item.append(button('删除',function(){if(!confirm('确定删除存档位 '+(index+1)+' 吗？'))return;if(options.preview){var all=entries();all[index]=null;try{sessionStorage.setItem('museum_preview_slots',JSON.stringify(all));}catch(_){error('删除失败。');return;}}else if(!MuseumState.deleteSlot(options.user.id,index)){error('删除失败。');return;}render();}));grid.append(item);}
 var auto=options.preview?options.state():MuseumState.load(options.user.id);card('自动存档',auto?{state:auto,savedAt:auto.savedAt}:null,-1);
 var cp=checkpoint();if(cp){var cpItem=document.createElement('article');cpItem.className='story-save-checkpoint';var cpInfo=document.createElement('div');var cpMeta=cp.checkpoint||{};cpInfo.textContent='选择前检查点 · '+(cpMeta.label||'重要选择')+' · '+(cpMeta.summary||'');var cpButton=button(mode==='load'?'读取':'仅供读取',function(){if(mode!=='load')return;load(options.preview?checkpoint():MuseumState.loadCheckpoint(options.user.id));});cpButton.disabled=mode!=='load';cpItem.append(cpInfo,cpButton);grid.append(cpItem);}
 var all=entries();for(var i=0;i<20;i++)card('存档位 '+(i+1),all[i],i);
 }
 dialog.onkeydown=function(event){event.stopPropagation();};dialog.oncancel=function(event){event.preventDefault();close();};render();if(!dialog.open)dialog.showModal();
}
document.addEventListener('keydown',function(e){if(dialog.open)e.stopImmediatePropagation();},true);
window.MuseumSaveDialog={open:open,isOpen:()=>dialog.open};
})();

