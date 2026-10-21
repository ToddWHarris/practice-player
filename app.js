const APP_VERSION=13;
var ED={open:false,ws:0,we:0,drag:null};
const $=id=>document.getElementById(id),L=Logic,au=$('audio');
const S={songs:[],pls:[],cwd:[],Q:null,shuffle:false,repeat:'off',A:null,B:null,ab:false,waiting:false,url:null,rec:null,timer:null,openPl:null};
async function load(){S.songs=await DB.allSongs();S.pls=(await DB.get('playlists'))||[];const st=(await DB.get('settings'))||{};S.shuffle=!!st.shuffle;S.repeat=st.repeat||'off';$('autoRep').checked=!!st.autoRep;$('gap').value=st.gap??2;S.Q=L.upgradeQueue((await DB.get('queue'))||null);if(S.Q&&!S.Q.list.every(byId))S.Q=null;if(S.Q){if(S.Q.shuffle!==S.shuffle)L.setShuffle(S.Q,S.shuffle);loadCur(false)}renderAll();{let c=null;try{c=localStorage.getItem('accent')}catch(e){}applyAccent(c||(await DB.get('accent'))||L.PRESETS[0][1],false)}if(!(await DB.get('seenWelcome'))){tab('help');DB.set('seenWelcome',true)}}
const saveSet=()=>DB.set('settings',{shuffle:S.shuffle,repeat:S.repeat,autoRep:$('autoRep').checked,gap:+$('gap').value});
const savePls=()=>DB.set('playlists',S.pls);
function tab(t){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('on',s.id===t));const set=t==='help';$('player').hidden=set;$('card').hidden=set;if(set){if(typeof exitAB=='function'&&(S.ab||S.waiting))exitAB();if(!au.paused)au.pause()}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
async function importFiles(list){let n=0;for(const f of list){if(!/\.(mp3|m4a|aac|wav)$/i.test(f.name)&&!/^audio\//.test(f.type))continue;const path=f.webkitRelativePath||f.name;const id=L.songId(path,f.size);const data=new Blob([await f.arrayBuffer()],{type:f.type||'audio/mpeg'});delete S.meta[id];await DB.del('meta:'+id);await DB.putSong({id,path,name:f.name.replace(/\.[^.]+$/,''),size:f.size,type:f.type||'audio/mpeg',added:Date.now()},data);n++}S.songs=await DB.allSongs();renderAll();alert('Imported '+n+' song(s).')}
$('inDir').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};$('inFiles').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};
$('clearLib').onclick=async()=>{if(!confirm('Remove all songs from this device?'))return;await DB.clear();await DB.clearMeta();S.meta={};S.songs=[];S.pls.forEach(p=>p.ids=[]);savePls();S.cwd=[];renderAll()};
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e}
function btn(txt,fn){const b=el('button',txt);b.onclick=e=>{e.stopPropagation();fn()};return b}
function renderLib(){const root=L.buildTree(S.songs);let node=L.nodeAt(root,S.cwd);if(!node){S.cwd=[];node=root}
 const c=$('crumbs');c.innerHTML='';const h=el('a','Home');h.href='#';h.onclick=e=>{e.preventDefault();S.cwd=[];renderLib()};c.append(h);S.cwd.forEach((d,i)=>{c.append(' / ');const a=el('a',d);a.href='#';a.onclick=e=>{e.preventDefault();S.cwd=S.cwd.slice(0,i+1);renderLib()};c.append(a)});
 const ul=$('tree');ul.innerHTML='';if(!S.songs.length)ul.append(el('li','No songs yet. Open Settings and tap Import folder or Import files under Your music to add songs from the Files app.'));
 Object.keys(node.dirs).sort().forEach(d=>{const li=el('li');li.append(el('span','📁 '+d,'n'));li.onclick=()=>{S.cwd.push(d);renderLib()};ul.append(li)});
 const songs=node.songs.sort((a,b)=>a.path.localeCompare(b.path));
 if(songs.length){const li=el('li');li.append(el('span','Play all in this folder','n'));li.onclick=()=>playList(songs.map(s=>s.id),0,fctx());ul.append(li)}
 songs.forEach((s,i)=>{const li=el('li',null,cur()===s.id?'cur':'');li.append(el('span','♪ '+s.name,'n'));li.onclick=()=>playList(songs.map(x=>x.id),i,fctx());
  li.append(btn('+List',()=>addToPl(s.id)),btn('✕',async()=>{if(!confirm('Remove '+s.name+'?'))return;await DB.delSong(s.id);await DB.del('meta:'+s.id);delete S.meta[s.id];S.songs=S.songs.filter(x=>x.id!==s.id);S.pls.forEach(p=>p.ids=p.ids.filter(x=>x!==s.id));savePls();renderAll()}));ul.append(li)})}
function addToPl(id){if(!S.pls.length){alert('Create a playlist first in the Playlists tab.');return}const names=S.pls.map((p,i)=>(i+1)+'. '+p.name).join('\n');const k=prompt('Add to which playlist? Enter number:\n'+names,'1');const p=S.pls[(+k)-1];if(p){p.ids.push(id);savePls();renderPls()}}
const fctx=()=>({type:'folder',id:S.cwd.join('/'),name:S.cwd.length?'Folder '+S.cwd.join(' / '):'Library'});
const byId=id=>S.songs.find(s=>s.id===id);
function renderPls(){const ul=$('plList');ul.innerHTML='';S.pls.forEach(p=>{const li=el('li');li.append(el('span',p.name+' ('+p.ids.length+')','n'));li.onclick=()=>{S.openPl=p.id;renderPls()};
 li.append(btn('▶',()=>playList(p.ids,0,{type:'pl',id:p.id,name:p.name})),btn('Rename',()=>{const n=prompt('New name',p.name);if(n){p.name=n;if(S.Q&&S.Q.ctx.id===p.id){S.Q.ctx.name=n;saveQ();renderFrom()}savePls();renderPls()}}),btn('Delete',()=>{if(confirm('Delete playlist '+p.name+'?')){S.pls=S.pls.filter(x=>x!==p);savePls();renderPls()}}));ul.append(li)});
 const d=$('plDetail');d.innerHTML='';const p=S.pls.find(x=>x.id===S.openPl);if(!p)return;d.append(el('h3',p.name));const l=el('ul',null,'list');
 p.ids.forEach((id,i)=>{const s=byId(id);const li=el('li',null,'prow'+(S.Q&&S.Q.ctx.id===p.id&&cur()===id&&S.Q.items[S.Q.play[S.Q.qi]].k===i?' cur':''));li.dataset.i=i;
  const rm=el('button','Remove','prm');rm.setAttribute('aria-label','Remove from playlist');rm.onclick=e=>{e.stopPropagation();plRemoveAt(p,i)};
  const fg=el('div',null,'pfg');fg.append(el('span',s?s.name:'(missing)','n'));const g=el('span','≡','grip');g.setAttribute('aria-label','Drag to reorder');fg.append(g);
  li.append(rm,fg);fg.addEventListener('click',()=>{if(PG.open){closeRow();PG.suppress=false;return}if(PG.suppress){PG.suppress=false;return}playList(p.ids,i,{type:'pl',id:p.id,name:p.name})});attachRow(li,p);l.append(li)});
 if(!p.ids.length)l.append(el('li','Empty. Use +List in the Library to add songs.'));else d.append(el('p','Drag ≡ to reorder. Swipe a song left to remove it.','hint'));d.append(l)}
$('newPl').onclick=()=>{const n=prompt('Playlist name','Playlist '+(S.pls.length+1));if(n){S.pls.push({id:'p'+Date.now(),name:n,ids:[]});savePls();renderPls()}};
function renderAll(){const lc=document.getElementById('libCount');if(lc)lc.textContent=S.songs.length?S.songs.length+' song'+(S.songs.length===1?'':'s')+' in the app now.':'No songs yet.';typeof renderCard=='function'&&renderCard();renderLib();renderPls();renderCtl()}
const cur=()=>S.Q&&S.Q.list[S.Q.qi];
const saveQ=()=>DB.set('queue',S.Q);
function playList(ids,i,ctx){const q=L.makeQueue(ctx||{type:'all',name:'All songs'},ids,i,S.shuffle,byId);if(!q)return;S.Q=q;saveQ();loadCur(true)}
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
$('play').onclick=()=>{if(!au.src||S.loadFailed){if(S.Q&&byId(cur()))loadCur(true);else if(S.songs.length)playList(S.songs.map(s=>s.id),0);return}au.paused?au.play().catch(playBlocked):au.pause()};
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
$('helpBody').innerHTML=`<h2>Welcome</h2><p>This is a simple practice player. Your music stays on this device only. Nothing is uploaded.</p>
<h2>Quick setup</h2><ol><li>Open this page in Safari on your iPhone.</li><li>Tap the Share icon, then <b>Add to Home Screen</b>.</li><li>Open the app from your Home Screen.</li><li>Go to Settings and, under <b>Your music</b>, tap <b>Import folder</b> or <b>Import files</b>. Pick your MP3s from the Files app.</li><li>Go to Library and tap a song to play it. Make playlists in the Playlists tab.</li></ol><h2>Editing a playlist</h2><ul><li>Drag the ≡ handle on the right of a song to move it up or down. You can also press and hold a song for a moment, then drag it.</li><li>To take a song out of a playlist, swipe it to the left and tap the red <b>Remove</b> button. It is only removed from that playlist, never from your library.</li><li>Changed your mind? Swipe right or tap the song to close it without changes.</li></ul>
<h2>How importing works</h2><ul><li><b>Import folder</b> copies every MP3 in the folder you pick, and in all of its subfolders, into the app's own private storage on this phone. The folder layout is kept. Big folders may take a minute.</li><li>Nothing is uploaded anywhere. Your songs stay on this phone.</li><li>The app's copies are hidden. You will not see them in the Files app.</li><li><b>It is OK to delete the original files</b> from the folder you imported after the import finishes. The app plays its own copies, so your songs keep working. Deleting the originals also frees up space, since until then your songs use about double the space. Just keep a backup somewhere, like on your computer, in case you ever need to import again.</li><li>Deleting the app from the Home Screen, or clearing Safari website data, erases the app's copies. You would then need to import again.</li><li>Importing more later adds to what is already there. Importing the same song again (same name, folder and size) replaces it, so you do not get duplicates.</li><li><b>Remove all</b> clears only the app's copies. Your files in the Files app are not touched.</li></ul><h2>Android setup</h2><ol><li>Open this page in Chrome.</li><li>Tap the three dot menu, then <b>Add to Home screen</b> or <b>Install app</b>.</li><li>Open the app, go to Settings, and import songs under Your music. If Import folder does not work on your phone, use Import files and select several songs at once.</li></ol><h2>A-B practice loop</h2><ol><li>Play a song. Tap <b>Set A</b> where the part starts and <b>Set B</b> where it ends. Use the +0.5 and -0.5 buttons to fine tune.</li><li>Tap <b>Start loop</b>. The first time, iPhone asks to use the microphone. Tap <b>Allow</b>. Voice commands also need Dictation turned on (Settings > General > Keyboard > Enable Dictation).</li><li>At B the music pauses and the app shows Listening.</li><li>Say <b>go</b>, <b>again</b>, <b>repeat</b> or <b>yes</b> to hear it again. Say <b>stop</b> to end the loop. You can always tap the big Again button instead, or tap the Stop loop button.</li><li>Prefer no voice? Turn on Auto repeat and choose a gap in seconds.</li></ol><h2>Loop editor</h2><ul><li>Once A and B are set, tap <b>Loop editor</b> for a big, zoomed in view of your loop.</li><li>Drag the A and B handles with your finger. They move in whole seconds. A always stays at least 1 second before B.</li><li>The view also shows a bit of the song before and after the loop, 10 seconds each by default. You can change this under Loop editor in Settings. Let go of a handle and the view adjusts so you can drag further.</li><li>Turn your phone sideways for a wider timeline.</li><li>Tap <b>Play loop from A</b> to hear it. Voice cues and Auto repeat work here too. Tap <b>Done</b> when finished.</li></ul>
<h2>iPhone and Android limits</h2><ul><li>Songs must be imported into the app. It cannot read your Apple Music library.</li><li>Songs are saved inside this app on this device. If you clear Safari website data, or iOS frees up space, you may need to import them again.</li><li>The microphone only works while the app is open on screen, and only when the page is loaded over HTTPS.</li><li>Voice commands depend on the browser speech support (Safari or Chrome) and may need an internet connection. If it does not work, use the Again button.</li><li>Lock screen controls work for play, pause and skip. The A-B voice cue needs the app open.</li><li>Each person who uses the app imports their own music. Nothing is shared between devices.</li></ul>`;
{const v=el('p','Version '+APP_VERSION,'ver');$('help').append(v);const t=el('p','Practice Player, Version '+APP_VERSION,'ver');t.style.margin='0 0 12px';$('help').prepend(t)}
$('share').onclick=async()=>{const url=location.href.split('#')[0];try{if(navigator.share)await navigator.share({title:'Practice Player',text:'A simple music practice player. Add it to your Home Screen.',url});else{await navigator.clipboard.writeText(url);alert('Link copied: '+url)}}catch(e){}};
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
function attachRow(li,p){const fg=li.querySelector('.pfg'),grip=li.querySelector('.grip');
 const start=(e,viaGrip)=>{if(PG.g)return;if(e.button>0)return;const sc=$('main')||document.querySelector('main');
  PG.g={li,fg,p,id:e.pointerId,x0:e.clientX,y0:e.clientY,y:e.clientY,mode:viaGrip?'drag':'pending',sc,st:sc.scrollTop,openAt:li.classList.contains('open')?OPEN_X:0,t0:Date.now()};
  if(viaGrip){e.preventDefault();beginDrag()}else PG.g.timer=setTimeout(()=>{if(PG.g&&PG.g.mode==='pending'&&!li.classList.contains('open')){PG.g.mode='drag';beginDrag();if(navigator.vibrate)navigator.vibrate(10)}},350);
  try{(viaGrip?grip:fg).setPointerCapture(e.pointerId)}catch(_){}};
 grip.addEventListener('pointerdown',e=>{e.stopPropagation();start(e,true)});
 fg.addEventListener('pointerdown',e=>start(e,false));
 const move=e=>{const g=PG.g;if(!g||g.li!==li||e.pointerId!==g.id)return;const dx=e.clientX-g.x0,dy=e.clientY-g.y0;g.y=e.clientY;
  if(g.mode==='pending'){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){clearTimeout(g.timer);g.mode='swipe';if(PG.open&&PG.open!==li)closeRow();fg.style.transition='none'}else if(Math.abs(dy)>8){clearTimeout(g.timer);g.mode='scroll'}}
  if(g.mode==='swipe'){const x=Math.max(OPEN_X-30,Math.min(0,g.openAt+dx));fg.style.transform='translateX('+x+'px)';g.dx=x}
  if(g.mode==='drag'){e.preventDefault();dragMove()}};
 const end=e=>{const g=PG.g;if(!g||g.li!==li||e.pointerId!==g.id)return;clearTimeout(g.timer);PG.g=null;
  if(g.mode==='swipe'){PG.suppress=true;setTimeout(()=>PG.suppress=false,400);fg.style.transition='transform .2s';const open=(g.dx||0)<OPEN_X/2&&e.type!=='pointercancel';
   if(open){fg.style.transform='translateX('+OPEN_X+'px)';li.classList.add('open');PG.open=li}else{fg.style.transform='';li.classList.remove('open');if(PG.open===li)PG.open=null}}
  else if(g.mode==='drag'){PG.suppress=true;setTimeout(()=>PG.suppress=false,400);endDrag(g)}};
 [fg,grip].forEach(n=>{n.addEventListener('pointermove',move);n.addEventListener('pointerup',end);n.addEventListener('pointercancel',end)})}
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
