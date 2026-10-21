const APP_VERSION=24;
// Release notes: add one entry per version. The popup shows RELEASE_NOTES[APP_VERSION].
const RELEASE_NOTES={
 24:['Share a playlist: swipe a playlist left in Playlists and tap Share. It sends the songs, their order, and speed and pitch in one file.','Import playlist, in Settings and at the top of Playlists, adds a shared playlist. Songs you already have are not copied twice, and new songs go in the Library folder Shared.'],
 23:['New Custom Clips playlist. Set an A-B loop and tap Save Custom Clip to save that part of the song as its own MP3. Your original song is not changed.','In Custom Clips, swipe a clip left to Save In another playlist, Send it, or Delete it.','New Backup section in Settings. Back up all your songs, clips, playlists and settings to the Files app, and restore them later.','Deleting the app from your Home Screen erases its songs and playlists. The app now reminds you to back up.'],
 22:['The Home Screen icon now uses a darker green. Icons already on your Home Screen keep their old color.','The welcome message now ends with an exclamation mark, like Welcome back, Todd!'],
 21:['The What\'s new window shows again after every update. Tap Close to dismiss it.','Music now stays paused when a phone call, a voice chat or another app takes over the sound. It starts again when you come back to the app, or you can tap play on the lock screen or CarPlay.','Screen lock and CarPlay keep playing as before.','The app can greet you by name. It asks for your first name once (you can skip), and you can change it in Settings. Your name stays on this device.'],
 20:['The app now remembers where you were. It opens on the same Library folder or playlist, and on Library or Playlists, that you had open last time.','If that folder or playlist is gone, it opens the nearest folder that still exists, or your list of playlists.','Nothing starts playing by itself when the app opens.'],
 19:['Music keeps playing when you switch apps, go to the Home Screen or lock your phone.','Songs with no pitch change now play as plain audio, which iPhone allows in the background.','If the phone pauses the music while the app is hidden, it picks up again when you come back.','App updates now wait until the music is paused, so an update never cuts off a song.','Better with CarPlay: after Siri, a navigation prompt or a call, the music tries to start again by itself. Pausing from CarPlay or the lock screen still pauses.','An A-B loop keeps repeating while the app is in the background, because the mic cannot listen there.'],
 18:['Removed the Open Help button from Settings. Help is still in its own tab.','Send is now only for individual songs, not folders.','Loop and practice settings now show the song you are changing, on the Settings card and at the top of the popup.','A Play/Pause button in the Loop and practice popup, so you can listen while you adjust speed and pitch.'],
 17:['Loop and practice settings now open in a popup.','Speed control from 50% to 150% that keeps the pitch.','Pitch control from -6 to +6 semitones.','Speed and pitch are saved per song, with an on/off toggle when you swipe left on a song and a badge on songs that have settings.','A Send button when you swipe left on a song or folder, to share the MP3 files with AirDrop, Messages or Mail.','This What\'s new button.']
};
var ED={open:false,ws:0,we:0,drag:null};
const $=id=>document.getElementById(id),L=Logic;let au=$('audio');
// v19: remember every listener on the audio element so it can be swapped for a fresh,
// plain <audio> when pitch goes back to 0 (an element routed into Web Audio can never be un-routed,
// and iOS stops Web Audio in the background).
const AUL=[],AUP=['onended','onloadedmetadata','onplay','onpause','ontimeupdate','onerror'];
function wireAudio(el){const add=el.addEventListener.bind(el);el.addEventListener=(t,f,o)=>{AUL.push([t,f,o]);add(t,f,o)};
 const pause=el.pause.bind(el);el.pause=()=>{S.intentPause=Date.now();return pause()}}
wireAudio(au);
function swapAudio(){const old=au,n=document.createElement('audio');n.id='audio';n.preload='metadata';wireAudio(n);
 const was=!old.paused&&!old.ended,t=old.currentTime,src=old.getAttribute('src')||old.src||old.currentSrc;AUP.forEach(p=>{n[p]=old[p]});
 const L2=AUL.splice(0);L2.forEach(([ty,f,o])=>n.addEventListener(ty,f,o));AUP.forEach(p=>{old[p]=null});L2.forEach(([ty,f,o])=>{try{HTMLMediaElement.prototype.removeEventListener.call(old,ty,f,o)}catch(e){}});
 try{HTMLMediaElement.prototype.pause.call(old)}catch(e){}old.replaceWith(n);au=n;
 if(src){n.src=src;const go=()=>{try{n.currentTime=t}catch(e){}if(typeof applyRate==='function')applyRate();if(was)n.play().catch(()=>{})};if(n.readyState>=1)go();else HTMLMediaElement.prototype.addEventListener.call(n,'loadedmetadata',go,{once:true})}}
const S={songs:[],pls:[],cwd:[],Q:null,shuffle:false,repeat:'off',A:null,B:null,ab:false,waiting:false,url:null,rec:null,timer:null,openPl:null};
async function load(){S.songs=await DB.allSongs();S.pls=(await DB.get('playlists'))||[];if(ensureClipsPl())savePls();const st=(await DB.get('settings'))||{};S.shuffle=!!st.shuffle;S.repeat=st.repeat||'off';$('autoRep').checked=!!st.autoRep;$('gap').value=st.gap??2;try{(await DB.allKV('pr:')).forEach(([k,v])=>{S.pr[k.slice(3)]=v})}catch(e){}const navTab=restoreNav();S.Q=L.upgradeQueue((await DB.get('queue'))||null);if(S.Q&&!S.Q.list.every(byId))S.Q=null;if(S.Q){if(S.Q.shuffle!==S.shuffle)L.setShuffle(S.Q,S.shuffle);loadCur(false)}renderAll();{let c=null;try{c=localStorage.getItem('accent')}catch(e){}applyAccent(c||(await DB.get('accent'))||L.PRESETS[0][1],false)}S.navReady=true;if(!(await DB.get('seenWelcome'))){tab('help');DB.set('seenWelcome',true)}else tab(navTab);S.loaded=true;if(typeof startGreeting==='function')startGreeting();if(typeof maybeWN==='function')maybeWN()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNav()});window.addEventListener('pagehide',saveNav);
const saveSet=()=>DB.set('settings',{shuffle:S.shuffle,repeat:S.repeat,autoRep:$('autoRep').checked,gap:+$('gap').value});
const savePls=()=>DB.set('playlists',S.pls);
function tab(t){setTimeout(saveNav,0);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('on',s.id===t));const set=t==='set',hide=set||t==='help';$('player').hidden=hide;$('card').hidden=hide;if(set){if(typeof exitAB=='function'&&(S.ab||S.waiting))exitAB();if(!au.paused)au.pause()}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
async function importFiles(list){let n=0;for(const f of list){if(!/\.(mp3|m4a|aac|wav)$/i.test(f.name)&&!/^audio\//.test(f.type))continue;const path=f.webkitRelativePath||f.name;const id=L.songId(path,f.size);const data=new Blob([await f.arrayBuffer()],{type:f.type||'audio/mpeg'});delete S.meta[id];await DB.del('meta:'+id);await DB.putSong({id,path,name:f.name.replace(/\.[^.]+$/,''),size:f.size,type:f.type||'audio/mpeg',added:Date.now()},data);n++}if(n)lsSet('pp-backupDirty','1');S.songs=await DB.allSongs();renderAll();alert('Imported '+n+' song(s).')}
$('inDir').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};$('inFiles').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e}
function btn(txt,fn){const b=el('button',txt);b.onclick=e=>{e.stopPropagation();fn()};return b}
// v20: remember the last tab, Library folder and open playlist
const NAV_K='pp-nav';S.navReady=false;
function saveNav(){if(!S.navReady)return;try{const on=document.querySelector('nav button.on');localStorage.setItem(NAV_K,JSON.stringify({tab:on?on.dataset.t:'lib',cwd:S.cwd||[],pl:S.openPl||null}))}catch(e){}}
function readNav(){try{return JSON.parse(localStorage.getItem(NAV_K)||'null')||{}}catch(e){return{}}}
function dirExists(parts){if(!parts.length)return true;const pre=parts.join('/')+'/';return libSongs().some(s=>!s.removed&&s.path.startsWith(pre))}
function restoreNav(){const n=readNav();let c=Array.isArray(n.cwd)?n.cwd.filter(x=>typeof x==='string'):[];while(c.length&&!dirExists(c))c=c.slice(0,-1);S.cwd=c;S.viewRemoved=false;
 S.openPl=n.pl&&S.pls.some(p=>p.id===n.pl)?n.pl:null;return n.tab==='pls'?'pls':'lib'}
function renderLib(){setTimeout(saveNav,0);if(S.viewRemoved)return renderRemoved();const live=libSongs().filter(s=>!s.removed),gone=libSongs().filter(s=>s.removed);const root=L.buildTree(live);let node=L.nodeAt(root,S.cwd);if(!node){S.cwd=[];node=root}
 const c=$('crumbs');c.innerHTML='';const h=el('a','Home');h.href='#';h.onclick=e=>{e.preventDefault();S.cwd=[];S.viewRemoved=false;renderLib()};c.append(h);S.cwd.forEach((d,i)=>{c.append(' / ');const a=el('a',d);a.href='#';a.onclick=e=>{e.preventDefault();S.cwd=S.cwd.slice(0,i+1);renderLib()};c.append(a)});
 const ul=$('tree');ul.innerHTML='';if(!live.length&&!gone.length)ul.append(el('li','No songs yet. Open Settings and tap Import folder or Import files under Your music to add songs from the Files app.'));
 Object.keys(node.dirs).sort().forEach(d=>{const fp=[...S.cwd,d].join('/');const li=el('li',null,'prow lrow frow');li._ox=-208;
  const ad=el('button','Add to list','padd');ad.onclick=e=>{e.stopPropagation();closeRow();addToPl(folderIds(fp))};const rm=el('button','Remove','prm');rm.onclick=e=>{e.stopPropagation();removeFolder(fp)};
  const fg=el('div',null,'pfg');fg.append(el('span','📁 '+d,'n'));rowActs(li,[ad,rm],null);li.append(fg);
  fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}S.cwd.push(d);renderLib()});attachRow(li,null);ul.append(li)});
 const songs=node.songs.sort((a,b)=>a.path.localeCompare(b.path));
 if(songs.length){const li=el('li');li.append(el('span','Play all in this folder','n'));li.onclick=()=>playList(songs.map(s=>s.id),0,fctx());ul.append(li)}
 songs.forEach((s,i)=>{const li=el('li',null,'prow lrow'+(cur()===s.id?' cur':''));li._ox=-208;
  const ad=el('button','Add to list','padd');ad.onclick=e=>{e.stopPropagation();closeRow();addToPl(s.id)};const dl=el('button','Remove','prm');dl.onclick=e=>{e.stopPropagation();softRemove(s)};
  const fg=el('div',null,'pfg');fg.append(el('span','♪ '+s.name,'n'));prBadge(fg,s.id);rowActs(li,[ad,sendBtn(()=>[s.id],s.name),dl],s.id);li._pre=()=>preSend([s.id]);li.append(fg);
  fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}playList(songs.map(x=>x.id),i,fctx())});attachRow(li,null);ul.append(li)});
 if(!S.cwd.length&&gone.length){const li=el('li',null,'remfolder');li.append(el('span','🗑 Removed ('+gone.length+')','n'));li.onclick=()=>{S.viewRemoved=true;closeRow();renderLib()};ul.append(li)}}
const inDir=(s,fp)=>s.path.startsWith(fp+'/');
function folderIds(fp){return libSongs().filter(s=>!s.removed&&inDir(s,fp)).sort((a,b)=>a.path.localeCompare(b.path)).map(s=>s.id)}
function remRow(label,sub,onRestore,onDelete,onTap){const li=el('li',null,'prow lrow rrow');li._ox=-208;const rs=el('button','Restore','padd');rs.onclick=e=>{e.stopPropagation();onRestore()};
 const df=el('button','Delete forever','prm');df.onclick=e=>{e.stopPropagation();onDelete()};const fg=el('div',null,'pfg');const n=el('span',null,'n');n.append(el('span',label),el('small',sub,'orig'));fg.append(n);li.append(rs,df,fg);
 fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}onTap&&onTap()});attachRow(li,null);return li}
function renderRemoved(){const all=libSongs().filter(s=>s.removed).sort((a,b)=>a.path.localeCompare(b.path));const grp=S.viewRemoved&&S.viewRemoved.group;
 const gone=grp?all.filter(s=>s.removedGroup===grp):all;if(!all.length||(grp&&!gone.length)){if(all.length&&grp){S.viewRemoved=true;return renderRemoved()}S.viewRemoved=false;return renderLib()}
 const c=$('crumbs');c.innerHTML='';const h=el('a','Home');h.href='#';h.onclick=e=>{e.preventDefault();S.viewRemoved=false;S.cwd=[];renderLib()};c.append(h,' / ');
 if(grp){const r=el('a','Removed');r.href='#';r.onclick=e=>{e.preventDefault();S.viewRemoved=true;renderLib()};c.append(r,' / '+grp.split('/').pop())}else c.append('Removed');
 const ul=$('tree');ul.innerHTML='';ul.append(el('li','Removed songs are hidden but kept. Swipe left to Restore or Delete forever.','hint'));
 const dirOf=s=>s.path.split('/').slice(0,-1).join(' / ')||'Top level';
 if(!grp){const groups=[...new Set(all.filter(s=>s.removedGroup).map(s=>s.removedGroup))].sort();
  groups.forEach(g=>{const ss=all.filter(s=>s.removedGroup===g);ul.append(remRow('📁 '+g.split('/').pop()+' ('+ss.length+')','From: '+g.split('/').join(' / '),()=>restoreMany(ss),()=>deleteMany(ss,'the folder '+g.split('/').pop()+' ('+ss.length+' songs)'),()=>{S.viewRemoved={group:g};closeRow();renderLib()}))})}
 gone.filter(s=>grp||!s.removedGroup).forEach(s=>ul.append(remRow('♪ '+s.name,'From: '+dirOf(s),()=>restoreSong(s),()=>deleteForever(s))))}
async function removeFolder(fp){PG.open=null;const ss=libSongs().filter(s=>!s.removed&&inDir(s,fp));for(const s of ss){s.removed=true;s.removedAt=Date.now();s.removedGroup=fp;await DB.putMeta(s);if(S.Q)L.qRemoveId(S.Q,s.id)}if(S.Q)saveQ();renderAll()}
async function restoreMany(ss){PG.open=null;for(const s of ss){delete s.removed;delete s.removedAt;delete s.removedGroup;await DB.putMeta(s)}renderAll()}
async function deleteMany(ss,what){if(!confirm('Delete '+what+' forever? This erases the songs from the app and from your playlists.'))return;for(const s of ss)await eraseSong(s);savePls();renderAll()}
async function softRemove(s){PG.open=null;s.removed=true;s.removedAt=Date.now();await DB.putMeta(s);if(S.Q){L.qRemoveId(S.Q,s.id);saveQ()}renderAll()}
async function restoreSong(s){PG.open=null;delete s.removed;delete s.removedAt;delete s.removedGroup;await DB.putMeta(s);renderAll()}
async function deleteForever(s){if(!confirm('Delete '+s.name+' forever? This erases it from the app and from your playlists.'))return;await eraseSong(s);savePls();renderAll()}
async function eraseSong(s){PG.open=null;if(S.pr[s.id]){delete S.pr[s.id];await DB.del('pr:'+s.id)}await DB.delSong(s.id);await DB.del('meta:'+s.id);delete S.meta[s.id];
 S.songs=S.songs.filter(x=>x.id!==s.id);S.pls.forEach(p=>{const idx=[];p.ids.forEach((x,k)=>{if(x===s.id)idx.push(k)});idx.reverse().forEach(k=>{p.ids.splice(k,1);plSyncQ(p,q=>L.plRemove(q,k))})});if(S.Q){L.qRemoveId(S.Q,s.id);saveQ()}}
function addToPl(id){const many=Array.isArray(id)?id:[id];if(!many.length){alert('No songs to add.');return}const PL=S.pls.filter(x=>!isClips(x));if(!PL.length){alert('Create a playlist first in the Playlists tab.');return}const names=PL.map((p,i)=>(i+1)+'. '+p.name).join('\n');const k=prompt('Add to which playlist? Enter number:\n'+names,'1');const p=PL[(+k)-1];if(p){p.ids.push(...many);savePls();renderPls();if(many.length>1)alert('Added '+many.length+' songs to '+p.name+'.')}}
const fctx=()=>({type:'folder',id:S.cwd.join('/'),name:S.cwd.length?'Folder '+S.cwd.join(' / '):'Library'});
const playable=id=>{const x=S.songs.find(s=>s.id===id);return !!x&&!x.removed};
const byId=id=>S.songs.find(s=>s.id===id);
// v23 Custom Clips
const CLIPS_ID='clips';const libSongs=()=>S.songs.filter(s=>!s.clip);const isClips=p=>p&&p.id===CLIPS_ID;const clipsPl=()=>S.pls.find(isClips);
function ensureClipsPl(){let p=clipsPl();let ch=false;if(!p){p={id:CLIPS_ID,name:'Custom Clips',ids:[],builtin:true};S.pls.unshift(p);ch=true}
 if(p.name!=='Custom Clips'){p.name='Custom Clips';ch=true}p.builtin=true;if(S.pls[0]!==p){S.pls=[p,...S.pls.filter(x=>x!==p)];ch=true}
 // a clip that is in no playlist comes back to Custom Clips, so a clip file is never lost or hidden
 S.songs.filter(x=>x.clip).forEach(x=>{if(!S.pls.some(q=>q.ids.includes(x.id))){p.ids.push(x.id);ch=true}});
 p.ids=p.ids.filter(id=>{const x=byId(id);return x&&x.clip});return ch}
function renderPls(){setTimeout(saveNav,0);const ul=$('plList');ul.innerHTML='';S.pls.forEach(p=>{const li=el('li',null,'prow plrow');const fg=el('div',null,'pfg');fg.append(el('span',p.name+' ('+p.ids.length+')','n'));
 const sh=el('button','Share','padd');sh.onclick=e=>{e.stopPropagation();closeRow();openPlShare(p.id)};rowActs(li,[sh],null);li.append(fg);
 fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}S.openPl=p.id;renderPls()});attachRow(li,null);
 li.append=(...a)=>fg.append(...a);
 if(isClips(p)){li.classList.add('builtinPl');li.append(btn('▶',()=>playList(p.ids,0,{type:'pl',id:p.id,name:p.name})));ul.append(li);return}
 li.append(btn('▶',()=>playList(p.ids,0,{type:'pl',id:p.id,name:p.name})),btn('Rename',()=>{const n=prompt('New name',p.name);if(n){p.name=n;if(S.Q&&S.Q.ctx.id===p.id){S.Q.ctx.name=n;saveQ();renderFrom()}savePls();renderPls()}}),btn('Delete',()=>{if(confirm('Delete playlist '+p.name+'?')){S.pls=S.pls.filter(x=>x!==p);ensureClipsPl();savePls();renderPls()}}));ul.append(li)});
 const d=$('plDetail');d.innerHTML='';const p=S.pls.find(x=>x.id===S.openPl);if(!p)return;d.append(el('h3',p.name));const l=el('ul',null,'list');
 p.ids.forEach((id,i)=>{const s=byId(id);const li=el('li',null,'prow'+(S.Q&&S.Q.ctx.id===p.id&&cur()===id&&S.Q.items[S.Q.play[S.Q.qi]].k===i?' cur':''));li.dataset.i=i;
  const rm=el('button',isClips(p)?'Delete':'Remove','prm');rm.setAttribute('aria-label',isClips(p)?'Delete clip':'Remove from playlist');rm.onclick=e=>{e.stopPropagation();if(isClips(p))deleteClip(id);else{plRemoveAt(p,i);if(s&&s.clip&&ensureClipsPl()){savePls();renderPls();toast('The clip is in no other playlist, so it went back to Custom Clips')}}};
  const fg=el('div',null,'pfg');fg.append(el('span',s?s.name+(s.removed?' (removed)':''):'(missing)','n'));if(s&&s.removed)li.classList.add('gone');if(s)prBadge(fg,id);const g=el('span','≡','grip');g.setAttribute('aria-label','Drag to reorder');fg.append(g);
  const acts=[sendBtn(()=>[id],(byId(id)||{}).name),rm];if(s&&s.clip){if(isClips(p)){const sv=el('button','Save In','padd');sv.onclick=e=>{e.stopPropagation();closeRow();saveClipIn(id)};acts.unshift(sv)}else{const ad=el('button','Add to list','padd');ad.onclick=e=>{e.stopPropagation();closeRow();addToPl(id)};acts.unshift(ad)}}
  rowActs(li,acts,id);li._pre=()=>preSend([id]);li.append(fg);fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}playList(p.ids,i,{type:'pl',id:p.id,name:p.name})});attachRow(li,p);l.append(li)});
 if(!p.ids.length)l.append(el('li',isClips(p)?'No clips yet. Set an A-B loop on a song, then tap Save Custom Clip in the Loop editor or in Loop and practice settings.':'Empty. In the Library, swipe a song left and tap Add to list.'));else d.append(el('p',isClips(p)?'Drag ≡ to reorder. Swipe a clip left to Save In another playlist, Send or Delete it.':'Drag ≡ to reorder. Swipe a song left to remove it.','hint'));d.append(l)}
$('newPl').onclick=()=>{const n=prompt('Playlist name','Playlist '+(S.pls.length+1));if(n){S.pls.push({id:'p'+Date.now(),name:n,ids:[]});savePls();renderPls()}};
function saveClipIn(id){const PL=S.pls.filter(x=>!isClips(x));if(!PL.length){alert('Create a playlist first in the Playlists tab, then use Save In to move the clip there.');return}
 const k=prompt('Move this clip to which playlist? Enter number:\n'+PL.map((p,i)=>(i+1)+'. '+p.name).join('\n'),'1');const p=PL[(+k)-1];if(!p)return;
 if(!p.ids.includes(id))p.ids.push(id);const c=clipsPl();const i=c.ids.indexOf(id);if(i>=0){PG.open=null;c.ids.splice(i,1);plSyncQ(c,q=>L.plRemove(q,i))}savePls();renderPls();toast('Moved to '+p.name)}
async function deleteClip(id){const s=byId(id);if(!s)return;if(!confirm('Delete the clip "'+s.name+'" for good? This deletes the clip file. The original song is not changed.'))return;await eraseSong(s);savePls();renderAll();toast('Clip deleted')}
function tc(t){t=Math.max(0,t||0);const m=Math.floor(t/60),r=t-m*60,ss=Math.floor(r),fr=Math.round((r-ss)*10);return m+':'+String(ss).padStart(2,'0')+(fr?'.'+fr:'')}
function clipReady(){const cs=byId(cur());return !!cs&&S.A!=null&&S.B!=null&&S.B-S.A>=0.2&&!S.loadFailed}
function syncClipBtns(){const ok=clipReady();['edClip','prClip'].forEach(k=>{const b=$(k);if(b)b.disabled=!ok});const h=$('prClipHint');if(h)h.hidden=ok}
function openClip(){if(!clipReady())return;const cs=byId(cur()),m=S.meta[cs.id];const title=(m&&m.title)||cs.name;S.clipAB=[S.A,S.B];
 $('clipName').value=title+' clip '+tc(S.A)+'-'+tc(S.B);$('clipInfo').textContent='From '+title+', '+tc(S.A)+' to '+tc(S.B)+' ('+(S.B-S.A).toFixed(1)+' s)';$('clipModal').hidden=false;document.body.classList.add('modalOpen');setTimeout(()=>{try{$('clipName').select()}catch(e){}},50)}
function closeClip(){$('clipModal').hidden=true;if($('prModal').hidden&&$('wnModal').hidden&&$('nameModal').hidden)document.body.classList.remove('modalOpen')}
async function makeClip(srcId,a,b,name){const src=byId(srcId);if(!src)throw new Error('no song');const blob=await DB.blob(srcId);if(!blob)throw new Error('could not read the song');
 const u=new Uint8Array(await blob.arrayBuffer());let m=S.meta[srcId];if(!m)try{m=await getMeta(src)}catch(e){}
 const r=MP3Clip.clip(u,a,b,{title:name,artist:(m&&m.artist)||'',album:(m&&m.album)||'',year:(m&&m.year)||'',comment:'Clip from '+((m&&m.title)||src.name)+', '+tc(a)+' to '+tc(b)});
 if(!r)throw new Error('Clips can only be made from MP3 songs.');
 const id='clip-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),safe=name.replace(/[\/\\:*?"<>|]/g,'-').slice(0,80);
 const rec={id,path:'Custom Clips/'+safe+'.mp3',name,size:r.bytes.length,type:'audio/mpeg',added:Date.now(),clip:true,src:srcId,srcPath:src.path,a:r.start,b:r.end};
 await DB.putSong(rec,new Blob([r.bytes],{type:'audio/mpeg'}));S.songs.push(rec);
 if(S.pr[srcId]){S.pr[id]=Object.assign({},S.pr[srcId]);await savePR(id)}
 if(!clipsPl())ensureClipsPl();clipsPl().ids.push(id);ensureClipsPl();await savePls();return rec}
$('edClip').onclick=openClip;$('prClip').onclick=openClip;$('clipCancel').onclick=closeClip;$('clipModal').addEventListener('click',e=>{if(e.target===$('clipModal'))closeClip()});
$('clipSave').onclick=async()=>{const name=$('clipName').value.trim()||$('clipName').placeholder||'Clip';const cs=byId(cur());if(!cs||!S.clipAB)return closeClip();$('clipSave').disabled=true;
 try{const rec=await makeClip(cs.id,S.clipAB[0],S.clipAB[1],name);closeClip();renderPls();toast('Saved "'+rec.name+'" to Custom Clips')}catch(e){alert('Could not save the clip. '+(e&&e.message||''))}finally{$('clipSave').disabled=false}};
$('clipName').addEventListener('keydown',e=>{if(e.key==='Enter')$('clipSave').click()});

// ---- v23 Backup and restore (zip, STORE). Parts of about 200 MB. ----
const BK={PART_MB:200,parts:null,LAST:'pp-lastBackup',DIRTY:'pp-backupDirty',SNOOZE:'pp-backupSnooze',PREFS:['accent','pp-pre','pp-post','pp-name']};
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}}
function bkRender(){const t=+lsGet(BK.LAST)||0;$('bkLast').textContent='Last backup: '+(t?new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'never');
 const has=S.songs.length>0,old=!t||Date.now()-t>30*864e5,dirty=lsGet(BK.DIRTY)==='1',snz=+lsGet(BK.SNOOZE)||0;const show=has&&(old||dirty)&&Date.now()>snz;
 $('bkBanner').hidden=!show;if(show)$('bkBannerText').textContent=dirty?'You added new songs. Back up so you do not lose them.':(t?'It has been over 30 days since your last backup.':'Your songs are only in this app. Back them up to Files.')}
function bkFile(s){const p=(s.path||s.name||s.id).replace(/^\/+/,'').replace(/\.\.+/g,'.');return 'music/'+p}
async function bkBuild(){const songs=S.songs.slice(),pr={};Object.keys(S.pr).forEach(k=>pr[k]=S.pr[k]);const prefs={};BK.PREFS.forEach(k=>{const v=lsGet(k);if(v!=null)prefs[k]=v});
 const used={},files=[];for(const s of songs){let f=bkFile(s);if(used[f]){const m=f.match(/^(.*?)(\.[^./]*)?$/);f=m[1]+'-'+s.id.slice(-6)+(m[2]||'')}used[f]=1;files.push({s,f})}
 const meta={app:'Practice Player',format:1,version:APP_VERSION,created:new Date().toISOString(),
  songs:files.map(({s,f})=>Object.assign({},s,{file:f})),playlists:S.pls,pr,settings:(await DB.get('settings'))||{},accent:(await DB.get('accent'))||null,prefs,
  loop:(cur()&&S.A!=null&&S.B!=null)?{song:cur(),a:S.A,b:S.B}:null,queue:S.Q||null};
 // split into parts of about PART_MB by file size; backup.json goes in part 1 and lists every part's files
 const lim=BK.PART_MB*1048576,groups=[[]];let acc=0;for(const x of files){const sz=x.s.size||0;if(acc>0&&acc+sz>lim){groups.push([]);acc=0}groups[groups.length-1].push(x);acc+=sz}
 meta.parts=groups.length;meta.partFiles=groups.map(g=>g.map(x=>x.f));const day=ymd(new Date()),out=[];let done=0;
 for(let gi=0;gi<groups.length;gi++){const ents=[];if(gi===0)ents.push({name:'backup.json',blob:new Blob([JSON.stringify(meta)],{type:'application/json'})});
  ents.push({name:'part.json',blob:new Blob([JSON.stringify({app:'Practice Player',part:gi+1,of:groups.length,created:meta.created})])});
  for(const x of groups[gi]){const b=await DB.blob(x.s.id);if(b)ents.push({name:x.f,blob:b});$('bkStatus').textContent='Preparing backup... '+(++done)+' of '+files.length+' songs'}
  const z=await Zip.build(ents);const nm='PracticePlayer-backup-'+day+(groups.length>1?'-part'+(gi+1):'')+'.zip';out.push(new File([z],nm,{type:'application/zip'}))}
 return out}
$('bkMake').onclick=async()=>{if(!S.songs.length){alert('There are no songs to back up yet.');return}$('bkMake').disabled=true;$('bkReady').hidden=true;$('bkStatus').textContent='Preparing backup...';
 try{BK.parts=await bkBuild();const mb=BK.parts.reduce((a,f)=>a+f.size,0)/1048576;
  $('bkMsg').textContent=BK.parts.length>1?'Your backup is '+Math.round(mb)+' MB, so it is split into '+BK.parts.length+' parts of about '+BK.PART_MB+' MB. Save all '+BK.parts.length+' files together in the same folder.':'Your backup is ready ('+(mb<1?'under 1':Math.round(mb))+' MB).';
  $('bkSave').textContent=BK.parts.length>1?'Save backup ('+BK.parts.length+' files)':'Save backup';$('bkReady').hidden=false;$('bkStatus').textContent='Tap Save backup, then choose Save to Files.'}
 catch(e){$('bkStatus').textContent='Backup failed: '+(e&&e.message||e)}finally{$('bkMake').disabled=false}};
function bkDone(){lsSet(BK.LAST,String(Date.now()));lsSet(BK.DIRTY,null);$('bkReady').hidden=true;$('bkStatus').textContent='Backup saved.';bkRender()}
function bkDownload(files){files.forEach((f,i)=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.className='sendDl';document.body.append(a);setTimeout(()=>{a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},60000)},i*600)})}
// must run straight from the tap: the files are already built
$('bkSave').onclick=()=>{const files=BK.parts;if(!files)return;
 if(navigator.share&&navigator.canShare&&navigator.canShare({files})){navigator.share({files,title:'Practice Player backup'}).then(bkDone).catch(e=>{if(e&&e.name==='AbortError'){$('bkStatus').textContent='Backup not saved. Tap Save backup to try again.';return}bkDownload(files);bkDone()});return}
 bkDownload(files);bkDone()};
$('bkIn').onchange=async e=>{const fl=[...e.target.files];e.target.value='';if(!fl.length)return;$('bkStatus').textContent='Reading backup...';try{const r=await bkRestore(fl);$('bkStatus').textContent=r;alert(r)}catch(err){$('bkStatus').textContent='Restore failed: '+(err&&err.message||err);alert('Restore failed. '+(err&&err.message||''))}};
async function bkRestore(fileList){const ents={};let meta=null;const parts=[];
 for(const f of fileList){const list=await Zip.read(f);for(const x of list){if(x.name==='backup.json')meta=JSON.parse(await x.blob.text());else if(x.name==='part.json')parts.push(JSON.parse(await x.blob.text()));else ents[x.name]=x}}
 if(!meta)throw new Error('backup.json was not found. Pick part 1 of the backup (you can pick all parts at once).');
 const have=new Set(S.songs.map(s=>s.id));let added=0,skipped=0,missing=0,n=0;
 for(const rec of meta.songs){n++;$('bkStatus').textContent='Restoring '+n+' of '+meta.songs.length+'...';if(have.has(rec.id)){skipped++;continue}const x=ents[rec.file];if(!x){missing++;continue}
  const r=Object.assign({},rec);delete r.file;const data=new Blob([await x.blob.arrayBuffer()],{type:r.type||'audio/mpeg'});await DB.putSong(r,data);have.add(r.id);added++}
 S.songs=await DB.allSongs();
 for(const p of meta.playlists||[]){const ex=S.pls.find(q=>q.id===p.id);if(ex){const extra=ex.ids.filter(id=>!p.ids.includes(id));ex.ids=p.ids.filter(id=>byId(id)).concat(extra)}else S.pls.push({id:p.id,name:p.name,ids:p.ids.slice(),builtin:p.builtin})}
 S.pls.forEach(p=>{p.ids=p.ids.filter(id=>byId(id))});ensureClipsPl();await savePls();
 for(const [id,st] of Object.entries(meta.pr||{})){if(!S.pr[id]&&byId(id)){S.pr[id]=st;await savePR(id)}}
 if(meta.settings&&!(await DB.get('settings'))){await DB.set('settings',meta.settings)}
 for(const [k,v] of Object.entries(meta.prefs||{})){if(lsGet(k)==null)lsSet(k,v)}if(meta.accent&&!(await DB.get('accent')))await DB.set('accent',meta.accent);
 if(lsGet('accent'))applyAccent(lsGet('accent'),false);
 if(meta.loop&&!cur()&&byId(meta.loop.song)){}
 renderAll();bkRender();const total=meta.parts||1,got=new Set(parts.map(p=>p.part)).size||1;
 let msg='Restored '+added+' song'+(added===1?'':'s')+'.';if(skipped)msg+=' '+skipped+' already in the app were skipped.';
 if(missing)msg+=' '+missing+' could not be found'+(total>got?' because only '+got+' of '+total+' backup parts were picked. Restore again and pick all parts.':'.');return msg}
$('bkBannerGo').onclick=()=>{tab('set');setTimeout(()=>{$('bkMake').scrollIntoView({block:'center'})},50)};
$('bkBannerLater').onclick=()=>{lsSet(BK.SNOOZE,String(Date.now()+7*864e5));bkRender()};
function renderAll(){const lc=document.getElementById('libCount');if(lc){const LS=libSongs(),n=LS.filter(x=>!x.removed).length,r=LS.length-n;lc.textContent=(LS.length?n+' song'+(n===1?'':'s')+' in the app now.':'No songs yet.')+(r?' '+r+' in Removed.':'')}typeof renderCard=='function'&&renderCard();try{bkRender()}catch(e){}renderLib();renderPls();renderCtl()}
const cur=()=>S.Q&&S.Q.list[S.Q.qi];
const saveQ=()=>DB.set('queue',S.Q);
function playList(ids,i,ctx){const q=L.makeQueue(ctx||{type:'all',name:'All songs'},ids,i,S.shuffle,playable);if(!q)return;S.Q=q;saveQ();loadCur(true)}
function renderFrom(){$('from').textContent=S.Q?'Playing from: '+S.Q.ctx.name:'';renderCard()}
// Now playing card with ID3 metadata (cached in IndexedDB)
const META_V=1;S.meta={};
async function getMeta(s){const k='meta:'+s.id;let m=null;try{m=await DB.get(k)}catch(e){}if(m&&m.v===META_V)return m;
 const b=await DB.blob(s.id);if(!b)return null;const h10=new Uint8Array(await b.slice(0,10).arrayBuffer());const ts=ID3.tagSize(h10);
 const head=new Uint8Array(await b.slice(0,Math.min(b.size,ts+65536)).arrayBuffer()),tail=new Uint8Array(await b.slice(Math.max(0,b.size-128)).arrayBuffer());
 let r={};try{r=ID3.parse(head,tail)}catch(e){}m={v:META_V,title:r.title||'',artist:r.artist||r.albumArtist||'',album:r.album||'',year:r.year||'',track:r.track||'',kbps:r.kbps||0,vbr:!!r.vbr,art:r.pic?new Blob([r.pic.data],{type:r.pic.mime}):null};
 try{await DB.set(k,m)}catch(e){}return m}
function fmtSize(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'}
let artUrl=null,artFor=null;
function renderCard(){if(typeof renderPR==="function"&&$("prModal").hidden)try{renderPR()}catch(e){}const s=byId(cur());const c=$('card');if(!s){c.classList.add('empty');if(!S.loadFailed)$('now').textContent='Nothing playing';setArt(null,null);return}
 c.classList.remove('empty');const m=S.meta[s.id];const status=$('now').dataset.status;$('now').textContent=((m&&m.title)||s.name)+(status?' ('+status+')':'');
 $('cSub').textContent=m?[m.artist,m.album,m.year].filter(Boolean).join(' · '):'';
 const parts=[];if(m&&m.track)parts.push('Track '+m.track.split('/')[0]);if(S.Q)parts.push((S.Q.qi+1)+' of '+S.Q.list.length);if(au.duration&&isFinite(au.duration)&&au.src)parts.push(L.fmt(au.duration));if(s.size)parts.push(fmtSize(s.size));if(m&&m.kbps)parts.push(m.kbps+' kbps'+(m.vbr?' VBR':''));
 $('cMeta').textContent=parts.join(' · ');const dir=s.path.split('/').slice(0,-1).join(' / ');$('cPath').textContent='📁 '+(dir||'Top level');setArt(s.id,m&&m.art)}
function setArt(id,blob){if(artFor===id&&(blob?!!artUrl:!artUrl))return;artFor=id;if(artUrl){URL.revokeObjectURL(artUrl);artUrl=null}const a=$('cArt');a.innerHTML='';
 if(blob&&blob.size){artUrl=URL.createObjectURL(blob);const i=new Image();i.alt='Album art';i.src=artUrl;i.onerror=()=>{a.innerHTML='<span>♪</span>'};a.append(i)}else a.innerHTML='<span>♪</span>'}
async function loadMeta(s){if(S.meta[s.id])return;try{const m=await getMeta(s);if(m){S.meta[s.id]=m;if(cur()===s.id){renderCard();updateMS(s,m)}}}catch(e){}}
function updateMS(s,m){if(!('mediaSession' in navigator))return;const art=m&&m.art&&artUrl?[{src:artUrl,sizes:'512x512',type:m.art.type}]:[{src:'icons/icon-512.png',sizes:'512x512',type:'image/png'}];
 try{navigator.mediaSession.metadata=new MediaMetadata({title:(m&&m.title)||s.name,artist:(m&&m.artist)||'',album:(m&&m.album)||s.path.split('/').slice(0,-1).join(' / '),artwork:art})}catch(e){}}
async function loadCur(play){const s=byId(cur());if(!s)return;const tok=S.loadTok=(S.loadTok||0)+1;exitAB();clearAB();$('now').dataset.status='';renderFrom();let b=null;try{b=await DB.blob(s.id)}catch(e){}if(tok!==S.loadTok)return;
 if(!b||!b.size){S.loadFailed=true;$('now').dataset.status='could not read file, please import it again';renderCard();return}S.loadFailed=false;if(S.url)URL.revokeObjectURL(S.url);S.url=URL.createObjectURL(b);au.src=S.url;loadMeta(s);prApplySong(s.id);renderFrom();
 updateMS(s,S.meta[s.id]);
 if(play)au.play().catch(playBlocked);renderLib()}
function step(dir,auto){const n=L.stepQueue(S.Q,dir,S.repeat,auto);if(n<0){au.pause();return}saveQ();loadCur(true)}
au.onended=()=>{if(S.repeat==='one'){au.currentTime=0;au.play();return}step(1,true)};
$('play').onclick=()=>{if(!au.src||S.loadFailed){if(S.Q&&byId(cur()))loadCur(true);else if(libSongs().some(x=>!x.removed))playList(libSongs().filter(x=>!x.removed).map(s=>s.id),0);return}au.paused?au.play().catch(playBlocked):au.pause()};
function playBlocked(e){if(e&&e.name==='NotAllowedError'){$('now').dataset.status='tap Play to start';renderCard()}}
$('prev').onclick=()=>{if(au.currentTime>3)au.currentTime=0;else step(-1)};$('next').onclick=()=>step(1);
$('shuf').onclick=()=>{S.shuffle=!S.shuffle;if(S.Q){L.setShuffle(S.Q,S.shuffle);saveQ()}saveSet();renderCtl()};
$('rep').onclick=()=>{S.repeat={off:'all',all:'one',one:'off'}[S.repeat];saveSet();renderCtl()};
function renderCtl(){$('shuf').textContent='Shuffle: '+(S.shuffle?'on':'off');$('rep').textContent='Repeat: '+{off:'off',all:'playlist',one:'one song'}[S.repeat];$('play').textContent=au.paused?'▶':'⏸';typeof syncTog=='function'&&syncTog();renderMarks()}
au.onplay=au.onpause=()=>{if(!au.paused&&$('now').dataset.status){$('now').dataset.status='';renderCard()}renderCtl();if('mediaSession' in navigator)navigator.mediaSession.playbackState=au.paused?'paused':'playing'};
let seeking=false;$('seek').oninput=()=>{seeking=true;$('tCur').textContent=L.fmt($('seek').value/1000*(au.duration||0))};$('seek').onchange=()=>{if(au.duration)au.currentTime=$('seek').value/1000*au.duration;seeking=false};
au.ontimeupdate=()=>{if(!seeking&&au.duration)$('seek').value=au.currentTime/au.duration*1000;$('tCur').textContent=L.fmt(au.currentTime);$('tDur').textContent=L.fmt(au.duration||0);checkB()};
au.onloadedmetadata=()=>{renderCard();renderMarks();$('tDur').textContent=L.fmt(au.duration)};
// A-B loop
function renderMarks(){try{syncClipBtns()}catch(e){}const d=au.duration||0;const pos=(t,e)=>{e.style.display=t!=null&&d?'block':'none';if(d&&t!=null)e.style.left=(t/d*100)+'%'};pos(S.A,$('mA'));pos(S.B,$('mB'));const band=$('abBand');if(d&&S.A!=null&&S.B!=null){band.style.display='block';band.style.left=S.A/d*100+'%';band.style.width=(S.B-S.A)/d*100+'%'}else band.style.display='none';
 $('edOpen').hidden=!(S.A!=null&&S.B!=null);typeof edRender=='function'&&edRender();$('abState').textContent=(S.A!=null?'A '+S.A.toFixed(1):'')+(S.B!=null?'  B '+S.B.toFixed(1):'')+(S.ab?'  (on)':'');$('abOn').textContent=S.ab?'Stop loop':'Start loop';typeof syncTog=='function'&&syncTog()}
function setAB(a,b){[S.A,S.B]=L.clampAB(a,b,au.duration);renderMarks()}
$('setA').onclick=()=>setAB(au.currentTime,S.B!=null&&S.B>au.currentTime?S.B:null);$('setB').onclick=()=>{if(S.A==null)S.A=0;setAB(S.A,au.currentTime)};
$('aM').onclick=()=>S.A!=null&&setAB(S.A-0.5,S.B);$('aP').onclick=()=>S.A!=null&&setAB(S.A+0.5,S.B);$('bM').onclick=()=>S.B!=null&&setAB(S.A,S.B-0.5);$('bP').onclick=()=>S.B!=null&&setAB(S.A,S.B+0.5);
function clearAB(){S.A=S.B=null;renderMarks()}
$('abClear').onclick=()=>{exitAB();clearAB()};
$('abOn').onclick=()=>{if(S.ab){exitAB();return}if(S.A==null||S.B==null){alert('Set A and B first.');return}S.ab=true;au.currentTime=S.A;au.play().catch(playBlocked);renderMarks();if(!$('autoRep').checked)beginVoice()};
$('autoRep').onchange=$('gap').onchange=saveSet;
let raf=null;function checkB(){if(S.ab&&!S.waiting&&S.B!=null&&au.currentTime>=S.B){au.pause();au.currentTime=S.B;waitCue()}}
(function tick(){checkB();ED.open&&!ED.drag&&edTick();raf=requestAnimationFrame(tick)})();
const SRC=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
const ERR_HINT={'not-allowed':'Microphone not allowed. Turn it on in Settings > Apps > Safari > Microphone, then tap Tap to listen.','service-not-allowed':'Speech service not allowed. Turn on Dictation in Settings > General > Keyboard.','no-speech':'No speech heard. Still listening.','network':'Speech needs an internet connection. Tap Again instead.','audio-capture':'No microphone found or it is in use by another app.','unsupported':'Voice is not available in this browser. Tap Again instead.','aborted':'Listening stopped. Tap Tap to listen.'};
function setListen(t){$('listenTxt').textContent=t}
function showErr(code){setListen('Voice: '+code+'. '+(ERR_HINT[code]||'Tap Again instead.'))}
// Called from the Start loop tap (user gesture): ask for mic, then start one recognizer for the whole loop
function beginVoice(){if(!SRC()){S.voiceErr='unsupported';return}
 try{startRec()}catch(e){}
 if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)navigator.mediaDevices.getUserMedia({audio:true}).then(st=>{st.getTracks().forEach(t=>t.stop());if(S.ab&&!S.rec)try{startRec()}catch(e){}}).catch(e=>{S.voiceErr=(e&&e.name==='NotAllowedError')?'not-allowed':'audio-capture';if(S.waiting)showErr(S.voiceErr)})}
function startRec(){const SR=SRC();if(!SR)throw new Error('unsupported');stopRec();const r=new SR();S.rec=r;S.used={};S.recFails=0;r.lang=navigator.language||'en-US';r.continuous=true;r.interimResults=true;
 r.onresult=e=>{if(S.rec!==r)return;for(let i=e.resultIndex||0;i<e.results.length;i++){const tr=e.results[i][0].transcript||'',u=S.used[i];const fresh=(u&&tr.startsWith(u))?tr.slice(u.length):tr;const c=L.cue(fresh);if(!c)continue;S.used[i]=tr;if(!S.waiting)continue;c==='stop'?exitAB():again();return}};
 r.onstart=()=>{S.voiceErr=null;S.recFails=0;if(S.waiting)setListen('Listening... say "again" or "stop"')};
 r.onerror=e=>{const code=e.error||'unknown';if(code==='no-speech'||code==='aborted')return;S.voiceErr=code;if(code==='not-allowed'||code==='service-not-allowed'||code==='audio-capture'){S.rec=null;if(S.waiting){showErr(code);$('tapListen').hidden=false}}else if(S.waiting)showErr(code)};
 r.onend=()=>{if(S.rec!==r||!S.ab)return;if(document.hidden){S.rec=null;return}// can't listen in background; keep waiting, restart on return
 S.used={};if(++S.recFails>5){S.rec=null;if(S.waiting){showErr(S.voiceErr||'aborted');$('tapListen').hidden=false}return}
  setTimeout(()=>{if(S.rec!==r||!S.ab)return;try{r.start()}catch(err){S.rec=null;S.voiceErr='not-allowed';if(S.waiting){showErr('not-allowed');$('tapListen').hidden=false}}},200)};
 r.start()}
function waitCue(){S.waiting=true;$('abBox').open=true;$('listen').hidden=false;$('tapListen').hidden=true;
 if(document.hidden&&!$('autoRep').checked){// mic can't listen in the background (CarPlay, locked): keep the loop going instead of going silent
  const g=Math.max(1,+$('gap').value||0);setListen('App in background, repeating in '+g+'s...');S.timer=setTimeout(again,g*1000);return}
 if($('autoRep').checked){const g=Math.max(0,+$('gap').value||0);setListen('Repeating in '+g+'s...');S.timer=setTimeout(again,g*1000);return}
 if(!SRC()){showErr('unsupported');return}
 if(S.rec&&!S.voiceErr){setListen('Listening... say "again" or "stop"');return}
 if(S.voiceErr&&S.voiceErr!=='no-speech'){showErr(S.voiceErr);$('tapListen').hidden=false;return}
 try{startRec();setListen('Listening... say "again" or "stop"')}catch(e){showErr('not-allowed');$('tapListen').hidden=false}}
$('tapListen').onclick=()=>{S.voiceErr=null;$('tapListen').hidden=true;setListen('Starting mic...');beginVoice()};
function stopRec(){const r=S.rec;S.rec=null;if(r)try{r.abort()}catch(e){}}
function again(){clearTimeout(S.timer);S.waiting=false;$('listen').hidden=true;if(!S.ab)return;au.currentTime=S.A;au.play().catch(playBlocked)}
function exitAB(){clearTimeout(S.timer);stopRec();S.voiceErr=null;S.ab=false;S.waiting=false;$('listen').hidden=true;renderMarks()}
$('again').onclick=again;
if('mediaSession' in navigator){const m=navigator.mediaSession;[['play',()=>{S.bgWant=false;if(PR.ctx&&PR.ctx.state!=='running')PR.ctx.resume().catch(()=>{});if(S.waiting&&typeof again==='function'){again();return}au.play().catch(()=>{})}],['pause',()=>{S.bgWant=false;au.pause()}],['stop',()=>{S.bgWant=false;au.pause()}],['seekbackward',d=>{au.currentTime=Math.max(0,au.currentTime-((d&&d.seekOffset)||10))}],['seekforward',d=>{au.currentTime=Math.min(au.duration||1e9,au.currentTime+((d&&d.seekOffset)||10))}],['previoustrack',()=>$('prev').onclick()],['nexttrack',()=>step(1)],['seekto',d=>{au.currentTime=d.seekTime}]].forEach(([a,f])=>{try{m.setActionHandler(a,f)}catch(e){}})}
// Help + share

{const ab=el('div',null,'setCard about');ab.id='aboutCard';ab.innerHTML=`<h3>About</h3><p><b>Practice Player</b><br>Created by Todd W Harris, Hamler, Ohio<br>Version ${APP_VERSION}<br>© 2026 Todd W Harris</p><p class="muted">Your songs and playlists stay on this device. They are not part of the app and are never uploaded.</p>`;const wn=el('button',null,'btn colorBtn');wn.id='wnBtn';wn.setAttribute('aria-haspopup','dialog');wn.innerHTML='<span class="csw prIcon">★</span><span class="clab">What\'s new in Version '+APP_VERSION+'<small>See what changed in this update</small></span><span class="chev">›</span>';wn.onclick=()=>openWN();const nb=el('button',null,'btn colorBtn');nb.id='nameBtn';nb.setAttribute('aria-haspopup','dialog');nb.innerHTML='<span class="csw prIcon">☺</span><span class="clab">Your name<small id="nameSum"></small></span><span class="chev">›</span>';nb.onclick=()=>openName();$('set').append(nb,wn,ab);const t=el('p','Practice Player, Version '+APP_VERSION,'ver');t.style.margin='0 0 12px';$('set').prepend(t)}
$('helpVer').textContent=APP_VERSION;document.querySelectorAll('.verNum').forEach(x=>x.textContent=APP_VERSION);
{const toc=$('toc');document.querySelectorAll('#helpBody h2[id]').forEach(h=>{if(h.id==='h-top')return;const b=el('button',h.textContent,'tocb');b.onclick=()=>{h.scrollIntoView({block:'start'})};toc.append(b);const up=el('button','Back to topics','toTop');up.onclick=()=>$('h-top').scrollIntoView({block:'start'});let n=h.nextElementSibling;while(n&&!(n.tagName==='H2'||n.classList.contains('hintline')))n=n.nextElementSibling;h.parentNode.insertBefore(up,n||null)})}
const SHARE={title:'Practice Player',text:'A free music practice player with A-B loop and voice cues. Open this link in Safari on iPhone (or Chrome on Android), then add it to your Home Screen.',url:'https://toddwharris.github.io/practice-player/'};
function toast(msg){let t=document.getElementById('toast');if(!t){t=el('div',null,'toast');t.id='toast';t.setAttribute('role','status');document.body.append(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2500)}
function showLink(){const box=$('shareLink'),i=$('shareUrl');i.value=SHARE.url;box.hidden=false;tab('help');box.scrollIntoView({block:'center'});i.focus();i.select();try{i.setSelectionRange(0,999)}catch(e){}}
async function shareApp(){if(navigator.share){try{await navigator.share(SHARE);return}catch(e){if(e&&e.name==='AbortError')return}}
 try{if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error('no clipboard');await navigator.clipboard.writeText(SHARE.url);toast('Link copied')}catch(e){showLink()}}
document.querySelectorAll('.shareBtn').forEach(b=>b.onclick=shareApp);
function applyAccent(c,save=true){c=L.normHex(c)||L.PRESETS[0][1];const r=document.documentElement.style;r.setProperty('--ac',c);r.setProperty('--on-ac',L.textOn(c));r.setProperty('--ac-soft',c+'55');
 document.querySelector('meta[name=theme-color]').setAttribute('content',c);$('customColor').value=c;document.querySelectorAll('.sw').forEach(b=>b.classList.toggle('sel',b.dataset.c===c));if(save){try{localStorage.setItem('accent',c)}catch(e){}DB.set('accent',c)}const pr=L.PRESETS.find(x=>x[1]===c);$('colorSw').style.background=c;$('colorName').textContent=pr?pr[0]:'Custom '+c}
L.PRESETS.forEach(([n,c])=>{const b=el('button',n,'sw');b.dataset.c=c;b.style.background=c;b.style.color=L.textOn(c);b.setAttribute('aria-label',n+' color');b.onclick=()=>applyAccent(c,false);$('swatches').append(b)});
$('customColor').oninput=e=>applyAccent(e.target.value,false);
const CM={orig:null};function curAccent(){return getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()}
function openColor(){CM.orig=curAccent();$('colorModal').hidden=false;document.body.classList.add('modalOpen');const sel=document.querySelector('.sw.sel')||document.querySelector('.sw');sel&&sel.focus()}
function closeColor(keep){if($('colorModal').hidden)return;if(keep)applyAccent(curAccent(),true);else applyAccent(CM.orig,false);$('colorModal').hidden=true;document.body.classList.remove('modalOpen');$('colorBtn').focus()}
$('colorBtn').onclick=openColor;$('colorDone').onclick=()=>closeColor(true);$('colorCancel').onclick=()=>closeColor(false);
$('colorModal').addEventListener('click',e=>{if(e.target===$('colorModal'))closeColor(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('colorModal').hidden)closeColor(false)});
try{const c=localStorage.getItem('accent');if(c)applyAccent(c,false)}catch(e){}
function syncTog(){$('shuf').classList.toggle('tog',S.shuffle);$('rep').classList.toggle('tog',S.repeat!=='off');$('abOn').classList.toggle('tog',S.ab)}

// Loop editor
const ctxGet=k=>{const v=parseFloat(localStorage.getItem(k));return isFinite(v)&&v>=0?v:10};
function edWin(){[ED.ws,ED.we]=L.editorWindow(S.A,S.B,au.duration,ctxGet('pp-pre'),ctxGet('pp-post'));if(ED.we<=ED.ws)ED.we=ED.ws+1}
function edX(t){return (t-ED.ws)/(ED.we-ED.ws)*100}
function edRender(){if(!ED.open||S.A==null||S.B==null)return;$('hA').style.left=edX(S.A)+'%';$('hB').style.left=edX(S.B)+'%';$('edBand').style.left=edX(S.A)+'%';$('edBand').style.width=(edX(S.B)-edX(S.A))+'%';
 $('edA').textContent=L.fmt(S.A);$('edB').textContent=L.fmt(S.B);$('edLen').textContent=(Math.round((S.B-S.A)*10)/10)+' s';$('edWs').textContent=L.fmt(ED.ws);$('edWe').textContent=L.fmt(ED.we);edTick()}
function edTick(){if(!ED.open)return;const t=au.currentTime;const h=$('edHead');h.style.display=t>=ED.ws&&t<=ED.we?'block':'none';h.style.left=edX(t)+'%';
 $('edStatus').textContent=S.waiting?$('listenTxt').textContent:(S.ab&&!au.paused?'Playing loop':'');$('edAgain').hidden=!S.waiting;$('edPlay').textContent=S.ab?'Restart from A':'Play loop from A'}
function edOpen(){if(S.A==null||S.B==null)return;ED.open=true;edWin();$('ed').hidden=false;edRender()}
function edClose(){ED.open=false;$('ed').hidden=true;renderMarks()}
$('edOpen').onclick=edOpen;$('edDone').onclick=edClose;
$('edPlay').onclick=()=>{if(!S.ab)$('abOn').click();else again()};$('edAgain').onclick=again;
(function(){const tl=$('edTl');const tAt=x=>{const r=tl.getBoundingClientRect();return ED.ws+(x-r.left)/r.width*(ED.we-ED.ws)};const pxOf=t=>{const r=tl.getBoundingClientRect();return r.left+edX(t)/100*r.width};
 const setDrag=w=>{ED.drag=w;$('h'+w).classList.add('drag')};
 tl.addEventListener('pointerdown',e=>{if(S.A==null)return;e.preventDefault();const dA=Math.abs(e.clientX-pxOf(S.A)),dB=Math.abs(e.clientX-pxOf(S.B));ED.x0=e.clientX;
  if(Math.abs(dA-dB)<10&&Math.min(dA,dB)<40){ED.drag='?'}else setDrag(dA<dB?'A':'B');try{tl.setPointerCapture(e.pointerId)}catch(_){}});
 tl.addEventListener('pointermove',e=>{if(!ED.drag)return;if(ED.drag==='?'){if(Math.abs(e.clientX-ED.x0)<3)return;setDrag(e.clientX<ED.x0?'A':'B')}
  [S.A,S.B]=L.dragHandle(ED.drag,tAt(e.clientX),S.A,S.B,au.duration);renderMarks()});
 const up=()=>{if(!ED.drag)return;ED.drag=null;$('hA').classList.remove('drag');$('hB').classList.remove('drag');edWin();renderMarks()};tl.addEventListener('pointerup',up);tl.addEventListener('pointercancel',up)})();
// Loop and practice settings popup: before/after, speed (playbackRate, pitch kept), pitch (Web Audio worklet)
var PR={speed:1,pitch:0,orig:null,ctx:null,src:null,node:null,ready:null,err:null};
const numLS=(k,d,lo,hi)=>{const v=parseFloat(localStorage.getItem(k));return isFinite(v)?Math.max(lo,Math.min(hi,v)):d};
S.pr=S.pr||{};
// Per-song speed/pitch: S.pr[id]={speed,pitch,enabled}, stored in IndexedDB as 'pr:'+id
const prFmt=(sp,pi)=>{const a=[];if(sp!==1)a.push(Math.round(sp*100)+'%');if(pi)a.push((pi>0?'+':'')+pi+' st');return a.join(' · ')};
function prBadge(fg,id){const st=S.pr[id];if(!st)return;fg.append(el('span',prFmt(st.speed,st.pitch),'prBadge'+(st.enabled?'':' off')))}
// ---- Send songs (share the actual MP3 files) ----
const SEND={blobs:new Map(),BIG_MB:200,BIG_N:50};
function preSend(ids){return Promise.all(ids.filter(id=>!SEND.blobs.has(id)).map(id=>DB.blob(id).then(b=>{if(b)SEND.blobs.set(id,b)}).catch(()=>{})))}
function sendName(s){let n=(s.path||s.name||'song').split('/').pop();if(!/\.mp3$/i.test(n))n+='.mp3';return n}
function sendBtn(getIds,label){const b=el('button','Send','psend');b.onclick=e=>{e.stopPropagation();sendSongs(getIds(),label)};return b}
function sendSongs(ids,label){ids=ids.filter(id=>{const s=byId(id);return s&&!s.removed});if(!ids.length){toast('No songs to send');return}
 const miss=ids.filter(id=>!SEND.blobs.has(id));if(miss.length){toast('Getting songs ready, tap Send again');preSend(miss);return}
 const blobs=ids.map(id=>SEND.blobs.get(id)),tot=blobs.reduce((a,b)=>a+b.size,0);
 if(ids.length>SEND.BIG_N||tot>SEND.BIG_MB*1048576){if(!confirm('This sends '+ids.length+' songs ('+Math.round(tot/1048576)+' MB). Big sends can fail. Sending smaller folders works better. Send anyway?'))return}
 const files=ids.map((id,i)=>new File([blobs[i]],sendName(byId(id)),{type:'audio/mpeg'}));closeRow();
 if(navigator.share&&navigator.canShare&&navigator.canShare({files})){navigator.share({files,title:label||'Songs'}).catch(e=>{if(e&&e.name==='AbortError')return;sendFallback(files)});return}
 sendFallback(files)}
function sendFallback(files){try{files.forEach((f,i)=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.className='sendDl';document.body.append(a);setTimeout(()=>{a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)},i*400)});toast(files.length>1?'Sharing not supported here. Downloading '+files.length+' files':'Sharing not supported here. Downloading the file')}catch(e){toast('Sending files is not supported in this browser')}}
function rowActs(li,btns,id){const st=S.pr[id];if(st){const t=el('button',null,'ptog'+(st.enabled?' on':''));t.innerHTML='<b>Speed '+(st.enabled?'On':'Off')+'</b><small>'+prFmt(st.speed,st.pitch).replace(/ · /g,' ').replace(/ st$/,'')+'</small>';
  t.setAttribute('aria-label','Speed and pitch for this song: '+(st.enabled?'on':'off')+'. Tap to turn '+(st.enabled?'off':'on'));t.onclick=e=>{e.stopPropagation();togglePR(id)};btns=[t,...btns]}
 const bw=btns.length>=3?86:104;const box=el('div',null,'acts');box.style.setProperty('--bw',bw+'px');btns.forEach(b=>box.append(b));li.append(box);li._ox=-bw*btns.length;li.style.setProperty('--ox',(bw*btns.length)+'px')}
async function savePR(id){const st=S.pr[id];if(st)await DB.set('pr:'+id,st);else await DB.del('pr:'+id)}
async function togglePR(id){const st=S.pr[id];if(!st)return;st.enabled=!st.enabled;PG.open=null;await savePR(id);if(cur()===id)prApplySong(id);renderLib();renderPls()}
function prApplySong(id){const st=id&&S.pr[id];const sp=st&&st.enabled?st.speed:1,pi=st&&st.enabled?st.pitch:0;setSpeed(sp);if(pi!==PR.pitch||PR.ctx)setPitch(pi);else renderPR()}
au.addEventListener('play',()=>{if(PR.pend)applyPitch()});
function applyRate(){au.defaultPlaybackRate=PR.speed;au.playbackRate=PR.speed;au.preservesPitch=true;au.webkitPreservesPitch=true;au.mozPreservesPitch=true}
async function ensureGraph(){if(PR.ready)return PR.ready;const AC=window.AudioContext||window.webkitAudioContext;if(!AC||!(AC.prototype&&'audioWorklet' in AC.prototype)){PR.err='Pitch shift is not available in this browser.';return null}
 PR.ready=(async()=>{const ctx=new AC();PR.ctx=ctx;ctx.onstatechange=()=>{if(PR.ctx===ctx&&(ctx.state==='suspended'||ctx.state==='interrupted')&&!au.paused)ctx.resume().catch(()=>{})};await ctx.audioWorklet.addModule('pitch-worklet.js');PR.src=ctx.createMediaElementSource(au);PR.node=new AudioWorkletNode(ctx,'pitch-shift',{outputChannelCount:[2]});PR.node.connect(ctx.destination);return ctx})().catch(e=>{PR.err='Pitch shift could not start.';PR.ready=null;return null});return PR.ready}
async function teardownGraph(){const c=PR.ctx;PR.ctx=null;PR.ready=null;PR.src=null;PR.node=null;PR.pend=false;swapAudio();if(c)try{await c.close()}catch(e){}}
async function applyPitch(){const st=PR.pitch;if(!st&&!PR.ctx){return}if(!st&&PR.ctx&&!PR.live){await teardownGraph();return}/* pitch 0: back to plain audio, no Web Audio at all */if(!PR.ctx&&au.paused&&!PR.live){PR.pend=true;return}PR.pend=false;// pitch 0 and no graph yet: leave plain playback alone
 const ctx=await ensureGraph();if(!ctx){if(st){PR.pitch=0;renderPR();toast&&toast(PR.err||'Pitch shift not available')}return}
 try{PR.src.disconnect()}catch(e){}if(PR.pitch){PR.src.connect(PR.node);PR.node.port.postMessage({semitones:PR.pitch})}else PR.src.connect(ctx.destination);if(ctx.state!=='running')ctx.resume().catch(()=>{})}
function prLabel(){const parts=[];if(PR.speed!==1)parts.push(Math.round(PR.speed*100)+'%');if(PR.pitch)parts.push((PR.pitch>0?'+':'')+PR.pitch+' st');return parts.join(' · ')}
function renderPR(){try{syncClipBtns()}catch(e){}const cs=byId(cur()),m=cs&&S.meta[cs.id];$('prSong').textContent=cs?((m&&m.title)||cs.name):'';$('prSect').disabled=!cs;$('prNoSong').hidden=!!cs;$('prSongLine').hidden=!cs;const pct=Math.round(PR.speed*100);$('spdVal').textContent=pct+'%';$('spd').value=pct;$('pitVal').textContent=(PR.pitch>0?'+':'')+PR.pitch+' st';$('pit').value=PR.pitch;
 document.querySelectorAll('.spdq').forEach(b=>b.classList.toggle('tog',+b.dataset.v===pct));const ind=$('prInd'),l=cs?prLabel():'';ind.hidden=!l;ind.textContent=l;
 const ttl=cs?((m&&m.title)||cs.name):'',art=m&&m.artist;$('prFor').textContent=cs?'Settings for: '+ttl+(art?' by '+art:''):'No song selected';prSyncPlay();
 $('prSum').textContent=(cs?ttl+': '+pct+'%, '+(PR.pitch>0?'+':'')+PR.pitch+' st · ':'No song selected · ')+'Loop view '+ctxGet('pp-pre')+' s / '+ctxGet('pp-post')+' s'}
function setSpeed(v){PR.speed=Math.max(0.5,Math.min(1.5,Math.round(v*20)/20));applyRate();renderPR()}
function setPitch(v){PR.pitch=Math.max(-6,Math.min(6,Math.round(v)));renderPR();applyPitch()}

// Play/Pause inside the Loop and practice popup (allowed while Settings is open)
function prT(t){t=Math.max(0,Math.floor(t||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
function prSyncPlay(){const b=$('prPlay');if(!b)return;const cs=byId(cur()),ok=!!cs&&!S.loadFailed;b.disabled=!ok;const playing=ok&&!au.paused;b.textContent=ok?(playing?'❚❚':'▶'):'No song selected';b.classList.toggle('none',!ok);b.setAttribute('aria-label',playing?'Pause':'Play');b.setAttribute('aria-pressed',playing?'true':'false');
 $('prTime').textContent=ok?prT(au.currentTime)+(isFinite(au.duration)?' / '+prT(au.duration):''):'';$('prTime').hidden=!ok}
$('prPlay').onclick=async()=>{const cs=byId(cur());if(!cs)return;if(!au.src){await loadCur(false)}
 if(au.paused){if(S.waiting&&typeof again==='function'){again();return}if(PR.ctx&&PR.ctx.state!=='running')PR.ctx.resume().catch(()=>{});au.play().catch(()=>{})}else au.pause()};
['play','pause','timeupdate','loadedmetadata','ended','emptied'].forEach(ev=>au.addEventListener(ev,prSyncPlay));
// v19: losing focus never pauses. If iOS paused us while hidden (not our own pause), resume on return.
S.bgWant=false;
au.addEventListener('pause',()=>{if(document.hidden&&!au.ended&&Date.now()-(S.intentPause||0)>300&&!S.waiting){S.bgWant=true}/* interrupted (call, voice chat, another app): resume only when the app is visible again */});
// iOS / CarPlay interruptions (Siri, navigation prompts, calls, route changes) pause the element without our code asking.
// Try again a few times while hidden; a pause from our UI or the lock screen / CarPlay controls never sets bgWant.
function msPos(){try{if(navigator.mediaSession&&navigator.mediaSession.setPositionState&&isFinite(au.duration)&&au.duration>0)navigator.mediaSession.setPositionState({duration:au.duration,playbackRate:au.playbackRate||1,position:Math.min(au.currentTime,au.duration)})}catch(e){}}
['loadedmetadata','ratechange','seeked','play','pause'].forEach(t=>au.addEventListener(t,msPos));
au.addEventListener('play',()=>{S.bgWant=false;});
function onReturn(){if(PR.ctx&&PR.ctx.state!=='running')PR.ctx.resume().catch(()=>{});if(document.hidden)return;
 if(S.bgWant&&au.paused&&au.src){S.bgWant=false;au.play().catch(()=>{})}
 if(S.ab&&S.waiting&&!S.rec&&!$('autoRep').checked&&typeof startRec==='function'){S.recFails=0;try{startRec()}catch(e){}}}
document.addEventListener('visibilitychange',onReturn);window.addEventListener('pageshow',onReturn);window.addEventListener('focus',onReturn);
function openPR(){PR.live=true;PR.orig={speed:PR.speed,pitch:PR.pitch,id:cur()};PR.resetPending=false;$('ctxPre').value=ctxGet('pp-pre');$('ctxPost').value=ctxGet('pp-post');renderPR();$('prModal').hidden=false;document.body.classList.add('modalOpen');if(PR.ctx&&PR.ctx.state!=='running')PR.ctx.resume().catch(()=>{})}
async function closePR(keep){PR.live=false;if($('prModal').hidden)return;setTimeout(()=>{if(!PR.pitch&&PR.ctx&&!PR.live)teardownGraph()},0);if($('set').classList.contains('on')&&!au.paused)au.pause();$('prModal').hidden=true;document.body.classList.remove('modalOpen');
 if(keep){const cl=id=>Math.max(0,Math.min(120,Math.round(+$(id).value||0)));localStorage.setItem('pp-pre',cl('ctxPre'));localStorage.setItem('pp-post',cl('ctxPost'));if(ED.open){edWin();edRender()}
  const id=PR.orig.id;if(id&&id===cur()){const changed=PR.speed!==PR.orig.speed||PR.pitch!==PR.orig.pitch;
   if(PR.resetPending&&PR.speed===1&&!PR.pitch){delete S.pr[id];await savePR(id)}
   else if(changed||PR.resetPending){if(PR.speed===1&&!PR.pitch)delete S.pr[id];else S.pr[id]={speed:PR.speed,pitch:PR.pitch,enabled:true};await savePR(id)}}}
 else{setSpeed(PR.orig.speed);if(PR.pitch!==PR.orig.pitch)setPitch(PR.orig.pitch)}renderPR();renderLib();renderPls()}
$('prBtn').onclick=openPR;$('prInd').onclick=openPR;$('prDone').onclick=()=>closePR(true);$('prCancel').onclick=()=>closePR(false);
$('prModal').addEventListener('click',e=>{if(e.target===$('prModal'))closePR(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('prModal').hidden)closePR(false)});
$('spd').oninput=e=>setSpeed(e.target.value/100);document.querySelectorAll('.spdq').forEach(b=>b.onclick=()=>setSpeed(b.dataset.v/100));$('spdReset').onclick=()=>setSpeed(1);$('prSongReset').onclick=()=>{PR.resetPending=true;setSpeed(1);setPitch(0)};
$('pit').oninput=e=>setPitch(+e.target.value);$('pitM').onclick=()=>setPitch(PR.pitch-1);$('pitP').onclick=()=>setPitch(PR.pitch+1);$('pitReset').onclick=()=>setPitch(0);
au.addEventListener('loadedmetadata',applyRate);au.addEventListener('play',()=>{applyRate();if(PR.ctx&&PR.ctx.state!=='running')PR.ctx.resume().catch(()=>{})});
applyRate();renderPR();
addEventListener('resize',()=>edRender());
// Playlist rows: drag to reorder (grip or long press), swipe left to reveal Remove
var PG={open:null,suppress:false,g:null};
const OPEN_X=-104;
function closeRow(){if(PG.open){const f=PG.open.querySelector('.pfg');f.style.transition='transform .2s';f.style.transform='';PG.open.classList.remove('open');PG.open=null}}
function plSyncQ(p,fn){if(S.Q&&S.Q.ctx&&S.Q.ctx.type==='pl'&&S.Q.ctx.id===p.id&&S.Q.items&&S.Q.items.every(it=>it.k!=null)){fn(S.Q);saveQ();renderCard()}}
function plRemoveAt(p,i){PG.open=null;p.ids.splice(i,1);plSyncQ(p,q=>L.plRemove(q,i));savePls();renderPls()}
function plMoveTo(p,from,to){if(from===to)return;const [x]=p.ids.splice(from,1);p.ids.splice(to,0,x);plSyncQ(p,q=>L.plMove(q,from,to));savePls()}
document.addEventListener('touchmove',e=>{if(PG.g&&(PG.g.mode==='drag'||PG.g.mode==='swipe'))e.preventDefault()},{passive:false});
document.addEventListener('pointerdown',e=>{PG.suppress=false;clearTimeout(PG.st);if(PG.open&&!PG.open.contains(e.target)){closeRow();PG.suppress=true;clearTimeout(PG.st);PG.st=setTimeout(()=>PG.suppress=false,600)}},true);
function attachRow(li,p){const fg=li.querySelector('.pfg'),grip=li.querySelector('.grip'),OX=li._ox||OPEN_X;
 const start=(e,viaGrip,fromActs)=>{if(PG.g)return;if(e.button>0)return;const sc=$('main')||document.querySelector('main');
  PG.g={li,fg,p,id:e.pointerId,x0:e.clientX,y0:e.clientY,y:e.clientY,mode:viaGrip?'drag':'pending',sc,st:sc.scrollTop,openAt:li.classList.contains('open')?OX:0,t0:Date.now()};
  if(viaGrip){e.preventDefault();beginDrag()}else if(grip)PG.g.timer=setTimeout(()=>{if(PG.g&&PG.g.mode==='pending'&&!li.classList.contains('open')){PG.g.mode='drag';beginDrag();if(navigator.vibrate)navigator.vibrate(10)}},350);
  if(!fromActs)try{(viaGrip?grip:fg).setPointerCapture(e.pointerId)}catch(_){}};
 if(grip)grip.addEventListener('pointerdown',e=>{e.stopPropagation();start(e,true)});
 fg.addEventListener('pointerdown',e=>start(e,false));
 {const ac=li.querySelector('.acts');if(ac)ac.addEventListener('pointerdown',e=>{if(li.classList.contains('open'))start(e,false,true)})}
 const move=e=>{const g=PG.g;if(!g||g.li!==li||e.pointerId!==g.id)return;const dx=e.clientX-g.x0,dy=e.clientY-g.y0;g.y=e.clientY;
  if(g.mode==='pending'){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){clearTimeout(g.timer);g.mode='swipe';try{fg.setPointerCapture(e.pointerId)}catch(_){}if(PG.open&&PG.open!==li)closeRow();fg.style.transition='none'}else if(Math.abs(dy)>8){clearTimeout(g.timer);g.mode='scroll'}}
  if(g.mode==='swipe'){const x=Math.max(OX-30,Math.min(0,g.openAt+dx));fg.style.transform='translateX('+x+'px)';g.dx=x}
  if(g.mode==='drag'){e.preventDefault();dragMove()}};
 const end=e=>{const g=PG.g;if(!g||g.li!==li||e.pointerId!==g.id)return;clearTimeout(g.timer);PG.g=null;
  if(g.mode==='swipe'){PG.suppress=true;setTimeout(()=>PG.suppress=false,400);fg.style.transition='transform .2s';const thr=g.openAt?OX*0.75:Math.max(OX/2,-110);const open=(g.dx||0)<thr&&e.type!=='pointercancel';
   if(open){fg.style.transform='translateX('+OX+'px)';li.classList.add('open');PG.open=li;if(li._pre)li._pre()}else{fg.style.transform='';li.classList.remove('open');if(PG.open===li)PG.open=null}}
  else if(g.mode==='drag'){PG.suppress=true;setTimeout(()=>PG.suppress=false,400);endDrag(g)}};
 [fg,grip,li.querySelector('.acts')].filter(Boolean).forEach(n=>{n.addEventListener('pointermove',move);n.addEventListener('pointerup',end);n.addEventListener('pointercancel',end)})}
function beginDrag(){const g=PG.g;closeRow();const ul=g.li.parentNode;g.rows=[...ul.querySelectorAll('li.prow')];g.from=g.rows.indexOf(g.li);g.to=g.from;
 g.tops=g.rows.map(r=>r.offsetTop);g.h=g.li.offsetHeight;g.li.classList.add('lift');g.rows.forEach(r=>{if(r!==g.li)r.style.transition='transform .15s'});ul.classList.add('dragging');autoScroll()}
function dragMove(){const g=PG.g;const dy=g.y-g.y0+(g.sc.scrollTop-g.st);g.li.style.transform='translateY('+dy+'px)';const c=g.tops[g.from]+dy+g.h/2;let to=0;for(let k=0;k<g.rows.length;k++){if(k!==g.from&&c>g.tops[k]+g.rows[k].offsetHeight/2)to++}
 g.to=to;g.rows.forEach((r,k)=>{if(r===g.li)return;let sh=0;if(g.from<to&&k>g.from&&k<=to)sh=-g.h;if(g.from>to&&k>=to&&k<g.from)sh=g.h;r.style.transform=sh?'translateY('+sh+'px)':''})}
function autoScroll(){const g=PG.g;if(!g||g.mode!=='drag')return;const r=g.sc.getBoundingClientRect(),edge=56;let v=0;if(g.y<r.top+edge)v=-Math.ceil((r.top+edge-g.y)/4);else if(g.y>r.bottom-edge)v=Math.ceil((g.y-(r.bottom-edge))/4);
 if(v){const b=g.sc.scrollTop;g.sc.scrollTop+=v;if(g.sc.scrollTop!==b)dragMove()}requestAnimationFrame(autoScroll)}
function endDrag(g){g.rows.forEach(r=>{r.style.transition='';r.style.transform=''});g.li.classList.remove('lift');g.li.parentNode&&g.li.parentNode.classList.remove('dragging');plMoveTo(g.p,g.from,g.to);renderPls()}
function markWNSeen(){S.wnPending=false;try{localStorage.setItem('pp-lastVersion',String(APP_VERSION))}catch(e){}}
function maybeWN(){if(S.wnPending&&$('wnModal').hidden&&!S.greeting&&$('nameModal').hidden)openWN()}
// v21: first name, device only. First launch asks; later launches greet, then What's new.
const NAME_K='pp-name',ASK_K='pp-nameAsked';
function getName(){try{return (localStorage.getItem(NAME_K)||'').trim()}catch(e){return''}}
function firstWord(n){return (n||'').trim().split(/\s+/)[0]||''}
function nameSum(){const n=getName();$('nameSum').textContent=n?n:'Not set'}
function openName(){$('nameIn').value=getName();$('nameModal').hidden=false;document.body.classList.add('modalOpen');setTimeout(()=>{try{$('nameIn').focus()}catch(e){}},50)}
function closeName(save){if(save){const v=$('nameIn').value.trim().slice(0,40);try{if(v)localStorage.setItem(NAME_K,v);else localStorage.removeItem(NAME_K)}catch(e){}}
 try{localStorage.setItem(ASK_K,'1')}catch(e){}$('nameModal').hidden=true;document.body.classList.remove('modalOpen');nameSum();maybeWN()}
$('nameSave').onclick=()=>closeName(true);$('nameSkip').onclick=()=>closeName(false);
$('nameIn').addEventListener('keydown',e=>{if(e.key==='Enter')closeName(true)});
$('nameModal').addEventListener('click',e=>{if(e.target===$('nameModal'))closeName(false)});
function greet(){const w=firstWord(getName());if(!w)return false;const h=$('hello');h.textContent='Welcome back, '+w+'!';h.hidden=false;h.classList.remove('out');S.greeting=true;
 const done=()=>{if(!S.greeting)return;S.greeting=false;clearTimeout(S.helloT);h.classList.add('out');setTimeout(()=>{h.hidden=true;h.classList.remove('out')},350);maybeWN()};
 h.onclick=done;S.helloT=setTimeout(done,2000);return true}
function startGreeting(){let asked=null;try{asked=localStorage.getItem(ASK_K)}catch(e){}nameSum();if(!asked){openName();return}greet()}
function openWN(){const notes=RELEASE_NOTES[APP_VERSION]||['Small fixes and improvements.'];$('wnTitle').textContent="What's new in Version "+APP_VERSION;const ul=$('wnList');ul.innerHTML='';notes.forEach(n=>ul.append(el('li',n)));$('wnModal').hidden=false;document.body.classList.add('modalOpen')}
function closeWN(){markWNSeen();$('wnModal').hidden=true;document.body.classList.remove('modalOpen')}
$('wnClose').onclick=closeWN;$('wnModal').addEventListener('click',e=>{if(e.target===$('wnModal'))closeWN()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('wnModal').hidden)closeWN()});
// What's new after an update. v21 fix: the version is marked as seen only when the popup is closed,
// not at startup, so the service worker reload right after an update can no longer swallow it.
(function(){let last=null;try{last=localStorage.getItem('pp-lastVersion');if(!last)localStorage.setItem('pp-lastVersion',String(APP_VERSION))}catch(e){}S.wnPending=!!(last&&last!==String(APP_VERSION));if(S.loaded)maybeWN()})();
if('serviceWorker' in navigator){const sw=navigator.serviceWorker;const hadCtl=!!sw.controller;
 sw.register('sw.js',{updateViaCache:'none'}).then(reg=>{reg.update().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})})}).catch(()=>{});
 sw.addEventListener('controllerchange',()=>{if(!hadCtl)return;const k='pp-reloaded-v';if(sessionStorage.getItem(k)===String(Date.now()/60000|0))return;sessionStorage.setItem(k,String(Date.now()/60000|0));const go=()=>location.reload();if(au.paused&&!document.hidden)go();else{const w=()=>{if(au.paused&&!document.hidden){au.removeEventListener('pause',w);document.removeEventListener('visibilitychange',w);go()}};au.addEventListener('pause',w);document.addEventListener('visibilitychange',w)}})}
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
load();
