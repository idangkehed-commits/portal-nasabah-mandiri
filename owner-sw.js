'use strict';
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification('Portal Nasabah',{body:payload.body||'Ada permintaan akses baru.',tag:'portal-access-request',data:{url:'/__access/approvals'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('/__access/approvals',self.location.origin).href;
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const window of windows)if(window.url===target){await window.focus();return;}
  await clients.openWindow(target);
 })());
});
