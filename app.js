const APP_VERSION=15;
var ED={open:false,ws:0,we:0,drag:null};
const $=id=>document.getElementById(id),L=Logic,au=$('audio');
const S={songs:[],pls:[],cwd:[],Q:null,shuffle:false,repeat:'off',A:null,B:null,ab:false,waiting:false,url:null,rec:null,timer:null,openPl:null};
async function load(){S.songs=await DB.allSongs();S.pls=(await DB.get('playlists'))||[];const st=(await DB.get('settings'))||{};S.shuffle=!!st.shuffle;S.repeat=st.repeat||'off';$('autoRep').checked=!!st.autoRep;$('gap').value=st.gap??2;S.Q=L.upgradeQueue((await DB.get('queue'))||null);if(S.Q&&!S.Q.list.every(byId))S.Q=null;if(S.Q){if(S.Q.shuffle!==S.shuffle)L.setShuffle(S.Q,S.shuffle);loadCur(false)}renderAll();{let c=null;try{c=localStorage.getItem('accent')}catch(e){}applyAccent(c||(await DB.get('accent'))||L.PRESETS[0][1],false)}if(!(await DB.get('seenWelcome'))){tab('help');DB.set('seenWelcome',true)}}
const saveSet=()=>DB.set('settings',{shuffle:S.shuffle,repeat:S.repeat,autoRep:$('autoRep').checked,gap:+$('gap').value});
const savePls=()=>DB.set('playlists',S.pls);
function tab(t){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('on',s.id===t));const set=t==='set',hide=set||t==='help';$('player').hidden=hide;$('card').hidden=hide;if(set){if(typeof exitAB=='function'&&(S.ab||S.waiting))exitAB();if(!au.paused)au.pause()}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
async function importFiles(list){let n=0;for(const f of list){if(!/\.(mp3|m4a|aac|wav)$/i.test(f.name)&&!/^audio\//.test(f.type))continue;const path=f.webkitRelativePath||f.name;const id=L.songId(path,f.size);const data=new Blob([await f.arrayBuffer()],{type:f.type||'audio/mpeg'});delete S.meta[id];await DB.del('meta:'+id);await DB.putSong({id,path,name:f.name.replace(/\.[^.]+$/,''),size:f.size,type:f.type||'audio/mpeg',added:Date.now()},data);n++}S.songs=await DB.allSongs();renderAll();alert('Imported '+n+' song(s).')}
$('inDir').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};$('inFiles').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e}
function btn(txt,fn){const b=el('button',txt);b.onclick=e=>{e.stopPropagation();fn()};return b}
function renderLib(){if(S.viewRemoved)return renderRemoved();const live=S.songs.filter(s=>!s.removed),gone=S.songs.filter(s=>s.removed);const root=L.buildTree(live);let node=L.nodeAt(root,S.cwd);if(!node){S.cwd=[];node=root}
 const c=$('crumbs');c.innerHTML='';const h=el('a','Home');h.href='#';h.onclick=e=>{e.preventDefault();S.cwd=[];S.viewRemoved=false;renderLib()};c.append(h);S.cwd.forEach((d,i)=>{c.append(' / ');const a=el('a',d);a.href='#';a.onclick=e=>{e.preventDefault();S.cwd=S.cwd.slice(0,i+1);renderLib()};c.append(a)});
 const ul=$('tree');ul.innerHTML='';if(!live.length&&!gone.length)ul.append(el('li','No songs yet. Open Settings and tap Import folder or Import files under Your music to add songs from the Files app.'));
 Object.keys(node.dirs).sort().forEach(d=>{const fp=[...S.cwd,d].join('/');const li=el('li',null,'prow lrow frow');li._ox=-208;
  const ad=el('button','Add to list','padd');ad.onclick=e=>{e.stopPropagation();closeRow();addToPl(folderIds(fp))};const rm=el('button','Remove','prm');rm.onclick=e=>{e.stopPropagation();removeFolder(fp)};
  const fg=el('div',null,'pfg');fg.append(el('span','📁 '+d,'n'));li.append(ad,rm,fg);
  fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}S.cwd.push(d);renderLib()});attachRow(li,null);ul.append(li)});
 const songs=node.songs.sort((a,b)=>a.path.localeCompare(b.path));
 if(songs.length){const li=el('li');li.append(el('span','Play all in this folder','n'));li.onclick=()=>playList(songs.map(s=>s.id),0,fctx());ul.append(li)}
 songs.forEach((s,i)=>{const li=el('li',null,'prow lrow'+(cur()===s.id?' cur':''));li._ox=-208;
  const ad=el('button','Add to list','padd');ad.onclick=e=>{e.stopPropagation();closeRow();addToPl(s.id)};const dl=el('button','Remove','prm');dl.onclick=e=>{e.stopPropagation();softRemove(s)};
  const fg=el('div',null,'pfg');fg.append(el('span','♪ '+s.name,'n'));li.append(ad,dl,fg);
  fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}playList(songs.map(x=>x.id),i,fctx())});attachRow(li,null);ul.append(li)});
 if(!S.cwd.length&&gone.length){const li=el('li',null,'remfolder');li.append(el('span','🗑 Removed ('+gone.length+')','n'));li.onclick=()=>{S.viewRemoved=true;closeRow();renderLib()};ul.append(li)}}
const inDir=(s,fp)=>s.path.startsWith(fp+'/');
function folderIds(fp){return S.songs.filter(s=>!s.removed&&inDir(s,fp)).sort((a,b)=>a.path.localeCompare(b.path)).map(s=>s.id)}
function remRow(label,sub,onRestore,onDelete,onTap){const li=el('li',null,'prow lrow rrow');li._ox=-208;const rs=el('button','Restore','padd');rs.onclick=e=>{e.stopPropagation();onRestore()};
 const df=el('button','Delete forever','prm');df.onclick=e=>{e.stopPropagation();onDelete()};const fg=el('div',null,'pfg');const n=el('span',null,'n');n.append(el('span',label),el('small',sub,'orig'));fg.append(n);li.append(rs,df,fg);
 fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}onTap&&onTap()});attachRow(li,null);return li}
function renderRemoved(){const all=S.songs.filter(s=>s.removed).sort((a,b)=>a.path.localeCompare(b.path));const grp=S.viewRemoved&&S.viewRemoved.group;
 const gone=grp?all.filter(s=>s.removedGroup===grp):all;if(!all.length||(grp&&!gone.length)){if(all.length&&grp){S.viewRemoved=true;return renderRemoved()}S.viewRemoved=false;return renderLib()}
 const c=$('crumbs');c.innerHTML='';const h=el('a','Home');h.href='#';h.onclick=e=>{e.preventDefault();S.viewRemoved=false;S.cwd=[];renderLib()};c.append(h,' / ');
 if(grp){const r=el('a','Removed');r.href='#';r.onclick=e=>{e.preventDefault();S.viewRemoved=true;renderLib()};c.append(r,' / '+grp.split('/').pop())}else c.append('Removed');
 const ul=$('tree');ul.innerHTML='';ul.append(el('li','Removed songs are hidden but kept. Swipe left to Restore or Delete forever.','hint'));
 const dirOf=s=>s.path.split('/').slice(0,-1).join(' / ')||'Top level';
 if(!grp){const groups=[...new Set(all.filter(s=>s.removedGroup).map(s=>s.removedGroup))].sort();
  groups.forEach(g=>{const ss=all.filter(s=>s.removedGroup===g);ul.append(remRow('📁 '+g.split('/').pop()+' ('+ss.length+')','From: '+g.split('/').join(' / '),()=>restoreMany(ss),()=>deleteMany(ss,'the folder '+g.split('/').pop()+' ('+ss.length+' songs)'),()=>{S.viewRemoved={group:g};closeRow();renderLib()}))})}
 gone.filter(s=>grp||!s.removedGroup).forEach(s=>ul.append(remRow('♪ '+s.name,'From: '+dirOf(s),()=>restoreSong(s),()=>deleteForever(s))))}
async function removeFolder(fp){PG.open=null;const ss=S.songs.filter(s=>!s.removed&&inDir(s,fp));for(const s of ss){s.removed=true;s.removedAt=Date.now();s.removedGroup=fp;await DB.putMeta(s);if(S.Q)L.qRemoveId(S.Q,s.id)}if(S.Q)saveQ();renderAll()}
async function restoreMany(ss){PG.open=null;for(const s of ss){delete s.removed;delete s.removedAt;delete s.removedGroup;await DB.putMeta(s)}renderAll()}
async function deleteMany(ss,what){if(!confirm('Delete '+what+' forever? This erases the songs from the app and from your playlists.'))return;for(const s of ss)await eraseSong(s);savePls();renderAll()}
async function softRemove(s){PG.open=null;s.removed=true;s.removedAt=Date.now();await DB.putMeta(s);if(S.Q){L.qRemoveId(S.Q,s.id);saveQ()}renderAll()}
async function restoreSong(s){PG.open=null;delete s.removed;delete s.removedAt;delete s.removedGroup;await DB.putMeta(s);renderAll()}
async function deleteForever(s){if(!confirm('Delete '+s.name+' forever? This erases it from the app and from your playlists.'))return;await eraseSong(s);savePls();renderAll()}
async function eraseSong(s){PG.open=null;await DB.delSong(s.id);await DB.del('meta:'+s.id);delete S.meta[s.id];
 S.songs=S.songs.filter(x=>x.id!==s.id);S.pls.forEach(p=>{const idx=[];p.ids.forEach((x,k)=>{if(x===s.id)idx.push(k)});idx.reverse().forEach(k=>{p.ids.splice(k,1);plSyncQ(p,q=>L.plRemove(q,k))})});if(S.Q){L.qRemoveId(S.Q,s.id);saveQ()}}
function addToPl(id){const many=Array.isArray(id)?id:[id];if(!many.length){alert('No songs to add.');return}if(!S.pls.length){alert('Create a playlist first in the Playlists tab.');return}const names=S.pls.map((p,i)=>(i+1)+'. '+p.name).join('\n');const k=prompt('Add to which playlist? Enter number:\n'+names,'1');const p=S.pls[(+k)-1];if(p){p.ids.push(...many);savePls();renderPls();if(many.length>1)alert('Added '+many.length+' songs to '+p.name+'.')}}
const fctx=()=>({type:'folder',id:S.cwd.join('/'),name:S.cwd.length?'Folder '+S.cwd.join(' / '):'Library'});
const playable=id=>{const x=S.songs.find(s=>s.id===id);return !!x&&!x.removed};
const byId=id=>S.songs.find(s=>s.id===id);
function renderPls(){const ul=$('plList');ul.innerHTML='';S.pls.forEach(p=>{const li=el('li');li.append(el('span',p.name+' ('+p.ids.length+')','n'));li.onclick=()=>{S.openPl=p.id;renderPls()};
 li.append(btn('▶',()=>playList(p.ids,0,{type:'pl',id:p.id,name:p.name})),btn('Rename',()=>{const n=prompt('New name',p.name);if(n){p.name=n;if(S.Q&&S.Q.ctx.id===p.id){S.Q.ctx.name=n;saveQ();renderFrom()}savePls();renderPls()}}),btn('Delete',()=>{if(confirm('Delete playlist '+p.name+'?')){S.pls=S.pls.filter(x=>x!==p);savePls();renderPls()}}));ul.append(li)});
 const d=$('plDetail');d.innerHTML='';const p=S.pls.find(x=>x.id===S.openPl);if(!p)return;d.append(el('h3',p.name));const l=el('ul',null,'list');
 p.ids.forEach((id,i)=>{const s=byId(id);const li=el('li',null,'prow'+(S.Q&&S.Q.ctx.id===p.id&&cur()===id&&S.Q.items[S.Q.play[S.Q.qi]].k===i?' cur':''));li.dataset.i=i;
  const rm=el('button','Remove','prm');rm.setAttribute('aria-label','Remove from playlist');rm.onclick=e=>{e.stopPropagation();plRemoveAt(p,i)};
  const fg=el('div',null,'pfg');fg.append(el('span',s?s.name+(s.removed?' (removed)':''):'(missing)','n'));if(s&&s.removed)li.classList.add('gone');const g=el('span','≡','grip');g.setAttribute('aria-label','Drag to reorder');fg.append(g);
  li.append(rm,fg);fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}playList(p.ids,i,{type:'pl',id:p.id,name:p.name})});attachRow(li,p);l.append(li)});
 if(!p.ids.length)l.append(el('li','Empty. In the Library, swipe a song left and tap Add to list.'));else d.append(el('p','Drag ≡ to reorder. Swipe a song left to remove it.','hint'));d.append(l)}
$('newPl').onclick=()=>{const n=prompt('Playlist name','Playlist '+(S.pls.length+1));if(n){S.pls.push({id:'p'+Date.now(),name:n,ids:[]});savePls();renderPls()}};
function renderAll(){const lc=document.getElementById('libCount');if(lc){const n=S.songs.filter(x=>!x.removed).length,r=S.songs.length-n;lc.textContent=(S.songs.length?n+' song'+(n===1?'':'s')+' in the app now.':'No songs yet.')+(r?' '+r+' in Removed.':'')}typeof renderCard=='function'&&renderCard();renderLib();renderPls();renderCtl()}
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
function renderCard(){const s=byId(cur());const c=$('card');if(!s){c.classList.add('empty');if(!S.loadFailed)$('now').textContent='Nothing playing';setArt(null,null);return}
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
 if(!b||!b.size){S.loadFailed=true;$('now').dataset.status='could not read file, please import it again';renderCard();return}S.loadFailed=false;if(S.url)URL.revokeObjectURL(S.url);S.url=URL.createObjectURL(b);au.src=S.url;loadMeta(s);renderFrom();
 updateMS(s,S.meta[s.id]);
 if(play)au.play().catch(playBlocked);renderLib()}
function step(dir,auto){const n=L.stepQueue(S.Q,dir,S.repeat,auto);if(n<0){au.pause();return}saveQ();loadCur(true)}
au.onended=()=>{if(S.repeat==='one'){au.currentTime=0;au.play();return}step(1,true)};
$('play').onclick=()=>{if(!au.src||S.loadFailed){if(S.Q&&byId(cur()))loadCur(true);else if(S.songs.some(x=>!x.removed))playList(S.songs.filter(x=>!x.removed).map(s=>s.id),0);return}au.paused?au.play().catch(playBlocked):au.pause()};
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
function renderMarks(){const d=au.duration||0;const pos=(t,e)=>{e.style.display=t!=null&&d?'block':'none';if(d&&t!=null)e.style.left=(t/d*100)+'%'};pos(S.A,$('mA'));pos(S.B,$('mB'));const band=$('abBand');if(d&&S.A!=null&&S.B!=null){band.style.display='block';band.style.left=S.A/d*100+'%';band.style.width=(S.B-S.A)/d*100+'%'}else band.style.display='none';
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
 r.onend=()=>{if(S.rec!==r||!S.ab)return;S.used={};if(++S.recFails>5){S.rec=null;if(S.waiting){showErr(S.voiceErr||'aborted');$('tapListen').hidden=false}return}
  setTimeout(()=>{if(S.rec!==r||!S.ab)return;try{r.start()}catch(err){S.rec=null;S.voiceErr='not-allowed';if(S.waiting){showErr('not-allowed');$('tapListen').hidden=false}}},200)};
 r.start()}
function waitCue(){S.waiting=true;$('abBox').open=true;$('listen').hidden=false;$('tapListen').hidden=true;
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
if('mediaSession' in navigator){const m=navigator.mediaSession;[['play',()=>au.play()],['pause',()=>au.pause()],['previoustrack',()=>$('prev').onclick()],['nexttrack',()=>step(1)],['seekto',d=>{au.currentTime=d.seekTime}]].forEach(([a,f])=>{try{m.setActionHandler(a,f)}catch(e){}})}
// Help + share

{const v=el('p','Version '+APP_VERSION,'ver');$('set').append(v);const t=el('p','Practice Player, Version '+APP_VERSION,'ver');t.style.margin='0 0 12px';$('set').prepend(t)}
$('helpVer').textContent=APP_VERSION;$('openHelp').onclick=()=>{tab('help');document.querySelector('main').scrollTop=0};
{const toc=$('toc');document.querySelectorAll('#helpBody h2[id]').forEach(h=>{if(h.id==='h-top')return;const b=el('button',h.textContent,'tocb');b.onclick=()=>{h.scrollIntoView({block:'start'})};toc.append(b);const up=el('button','Back to topics','toTop');up.onclick=()=>$('h-top').scrollIntoView({block:'start'});let n=h.nextElementSibling;while(n&&!(n.tagName==='H2'||n.classList.contains('hintline')))n=n.nextElementSibling;h.parentNode.insertBefore(up,n||null)})}
const SHARE={title:'Practice Player',text:'A free music practice player with A-B loop and voice cues. Open this link in Safari on iPhone (or Chrome on Android), then add it to your Home Screen.',url:'https://toddwharris.github.io/practice-player/'};
function toast(msg){let t=document.getElementById('toast');if(!t){t=el('div',null,'toast');t.id='toast';t.setAttribute('role','status');document.body.append(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2500)}
function showLink(){const box=$('shareLink'),i=$('shareUrl');i.value=SHARE.url;box.hidden=false;tab('help');box.scrollIntoView({block:'center'});i.focus();i.select();try{i.setSelectionRange(0,999)}catch(e){}}
async function shareApp(){if(navigator.share){try{await navigator.share(SHARE);return}catch(e){if(e&&e.name==='AbortError')return}}
 try{if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error('no clipboard');await navigator.clipboard.writeText(SHARE.url);toast('Link copied')}catch(e){showLink()}}
document.querySelectorAll('.shareBtn').forEach(b=>b.onclick=shareApp);
function applyAccent(c,save=true){c=L.normHex(c)||L.PRESETS[0][1];const r=document.documentElement.style;r.setProperty('--ac',c);r.setProperty('--on-ac',L.textOn(c));r.setProperty('--ac-soft',c+'55');
 document.querySelector('meta[name=theme-color]').setAttribute('content',c);$('customColor').value=c;document.querySelectorAll('.sw').forEach(b=>b.classList.toggle('sel',b.dataset.c===c));try{localStorage.setItem('accent',c)}catch(e){}if(save)DB.set('accent',c)}
L.PRESETS.forEach(([n,c])=>{const b=el('button',n,'sw');b.dataset.c=c;b.style.background=c;b.style.color=L.textOn(c);b.setAttribute('aria-label',n+' color');b.onclick=()=>applyAccent(c);$('swatches').append(b)});
$('customColor').oninput=e=>applyAccent(e.target.value);
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
(function(){const box=el('div');box.innerHTML='<h2 class="acc">Loop editor</h2><p>Time shown before and after the loop in the Loop editor.</p><div class="setrow"><label>Before <input id="ctxPre" type="number" min="0" max="120" step="1"> s</label><label>After <input id="ctxPost" type="number" min="0" max="120" step="1"> s</label></div>';
 const sw=$('customRow');sw.after(box);[['ctxPre','pp-pre'],['ctxPost','pp-post']].forEach(([id,k])=>{const i=$(id);i.value=ctxGet(k);i.onchange=()=>{const v=Math.max(0,Math.min(120,Math.round(+i.value||0)));i.value=v;localStorage.setItem(k,v);if(ED.open){edWin();edRender()}}})})();
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
 const start=(e,viaGrip)=>{if(PG.g)return;if(e.button>0)return;const sc=$('main')||document.querySelector('main');
  PG.g={li,fg,p,id:e.pointerId,x0:e.clientX,y0:e.clientY,y:e.clientY,mode:viaGrip?'drag':'pending',sc,st:sc.scrollTop,openAt:li.classList.contains('open')?OX:0,t0:Date.now()};
  if(viaGrip){e.preventDefault();beginDrag()}else if(grip)PG.g.timer=setTimeout(()=>{if(PG.g&&PG.g.mode==='pending'&&!li.classList.contains('open')){PG.g.mode='drag';beginDrag();if(navigator.vibrate)navigator.vibrate(10)}},350);
  try{(viaGrip?grip:fg).setPointerCapture(e.pointerId)}catch(_){}};
 if(grip)grip.addEventListener('pointerdown',e=>{e.stopPropagation();start(e,true)});
 fg.addEventListener('pointerdown',e=>start(e,false));
 const move=e=>{const g=PG.g;if(!g||g.li!==li||e.pointerId!==g.id)return;const dx=e.clientX-g.x0,dy=e.clientY-g.y0;g.y=e.clientY;
  if(g.mode==='pending'){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){clearTimeout(g.timer);g.mode='swipe';if(PG.open&&PG.open!==li)closeRow();fg.style.transition='none'}else if(Math.abs(dy)>8){clearTimeout(g.timer);g.mode='scroll'}}
  if(g.mode==='swipe'){const x=Math.max(OX-30,Math.min(0,g.openAt+dx));fg.style.transform='translateX('+x+'px)';g.dx=x}
  if(g.mode==='drag'){e.preventDefault();dragMove()}};
 const end=e=>{const g=PG.g;if(!g||g.li!==li||e.pointerId!==g.id)return;clearTimeout(g.timer);PG.g=null;
  if(g.mode==='swipe'){PG.suppress=true;setTimeout(()=>PG.suppress=false,400);fg.style.transition='transform .2s';const open=(g.dx||0)<OX/2&&e.type!=='pointercancel';
   if(open){fg.style.transform='translateX('+OX+'px)';li.classList.add('open');PG.open=li}else{fg.style.transform='';li.classList.remove('open');if(PG.open===li)PG.open=null}}
  else if(g.mode==='drag'){PG.suppress=true;setTimeout(()=>PG.suppress=false,400);endDrag(g)}};
 [fg,grip].filter(Boolean).forEach(n=>{n.addEventListener('pointermove',move);n.addEventListener('pointerup',end);n.addEventListener('pointercancel',end)})}
function beginDrag(){const g=PG.g;closeRow();const ul=g.li.parentNode;g.rows=[...ul.querySelectorAll('li.prow')];g.from=g.rows.indexOf(g.li);g.to=g.from;
 g.tops=g.rows.map(r=>r.offsetTop);g.h=g.li.offsetHeight;g.li.classList.add('lift');g.rows.forEach(r=>{if(r!==g.li)r.style.transition='transform .15s'});ul.classList.add('dragging');autoScroll()}
function dragMove(){const g=PG.g;const dy=g.y-g.y0+(g.sc.scrollTop-g.st);g.li.style.transform='translateY('+dy+'px)';const c=g.tops[g.from]+dy+g.h/2;let to=0;for(let k=0;k<g.rows.length;k++){if(k!==g.from&&c>g.tops[k]+g.rows[k].offsetHeight/2)to++}
 g.to=to;g.rows.forEach((r,k)=>{if(r===g.li)return;let sh=0;if(g.from<to&&k>g.from&&k<=to)sh=-g.h;if(g.from>to&&k>=to&&k<g.from)sh=g.h;r.style.transform=sh?'translateY('+sh+'px)':''})}
function autoScroll(){const g=PG.g;if(!g||g.mode!=='drag')return;const r=g.sc.getBoundingClientRect(),edge=56;let v=0;if(g.y<r.top+edge)v=-Math.ceil((r.top+edge-g.y)/4);else if(g.y>r.bottom-edge)v=Math.ceil((g.y-(r.bottom-edge))/4);
 if(v){const b=g.sc.scrollTop;g.sc.scrollTop+=v;if(g.sc.scrollTop!==b)dragMove()}requestAnimationFrame(autoScroll)}
function endDrag(g){g.rows.forEach(r=>{r.style.transition='';r.style.transform=''});g.li.classList.remove('lift');g.li.parentNode&&g.li.parentNode.classList.remove('dragging');plMoveTo(g.p,g.from,g.to);renderPls()}
if('serviceWorker' in navigator){const sw=navigator.serviceWorker;const hadCtl=!!sw.controller;
 sw.register('sw.js',{updateViaCache:'none'}).then(reg=>{reg.update().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})})}).catch(()=>{});
 sw.addEventListener('controllerchange',()=>{if(!hadCtl)return;const k='pp-reloaded-v';if(sessionStorage.getItem(k)===String(Date.now()/60000|0))return;sessionStorage.setItem(k,String(Date.now()/60000|0));location.reload()})}
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
load();
