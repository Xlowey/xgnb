(function(){
'use strict';
var user=MuseumAuth.getCurrentUser();
if(!user){window.location.href='login.html?next=saves';return;}
var state=MuseumState.load(user.id);
document.getElementById('save-page-user').textContent=user.username;
document.querySelector('.save-page-panel').hidden=true;
function open(){MuseumSaveDialog.open({user:user,state:function(){return state;},save:function(){return state?MuseumState.save(state,user.id):false;},pause:function(){},resume:function(){},load:function(loaded){if(!loaded||!MuseumState.save(loaded,user.id))return false;window.location.href='../index.html?fromSave=1';return true;}},'load');}
var button=document.createElement('button');button.className='button';button.textContent='打开存档管理';button.onclick=open;document.getElementById('save-page-message').after(button);open();
}());
