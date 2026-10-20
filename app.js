const $=id=>document.getElementById(id),L=Logic,au=$('audio');
const S={songs:[],pls:[],cwd:[],Q:null,shuffle:false,repeat:'off',A:null,B:null,ab:false,waiting:false,url:null,rec:null,timer:null,openPl:null};
async function load(){S.songs=await DB.allSongs();S.pls=(await DB.get('playlists'))||[];const st=(await DB.get('settings'))||{};S.shuffle=!!st.shuffle;S.repeat=st.repeat||'off';$('autoRep').checked=!!st.autoRep;$('gap').value=st.gap??2;S.Q=(await DB.get('queue'))||null;if(S.Q&&!S.Q.list.every(byId))S.Q=null;if(S.Q){if(S.Q.shuffle!==S.shuffle)L.setShuffle(S.Q,S.shuffle);loadCur(false)}renderAll();if(!(await DB.get('seenWelcome'))){tab('help');DB.set('seenWelcome',true)}}
const saveSet=()=>DB.set('settings',{shuffle:S.shuffle,repeat:S.repeat,autoRep:$('autoRep').checked,gap:+$('gap').value});
const savePls=()=>DB.set('playlists',S.pls);
function tab(t){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('on',s.id===t))}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.t));
async function importFiles(list){let n=0;for(const f of list){if(!/\.(mp3|m4a|aac|wav)$/i.test(f.name)&&!/^audio\//.test(f.type))continue;const path=f.webkitRelativePath||f.name;const id=L.songId(path,f.size);await DB.putSong({id,path,name:f.name.replace(/\.[^.]+$/,''),size:f.size,type:f.type||'audio/mpeg',added:Date.now()},f);n++}S.songs=await DB.allSongs();renderAll();alert('Imported '+n+' song(s).')}
$('inDir').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};$('inFiles').onchange=e=>{importFiles([...e.target.files]);e.target.value=''};
$('clearLib').onclick=async()=>{if(!confirm('Remove all songs from this device?'))return;await DB.clear();S.songs=[];S.pls.forEach(p=>p.ids=[]);savePls();S.cwd=[];renderAll()};
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e}
function btn(txt,fn){const b=el('button',txt);b.onclick=e=>{e.stopPropagation();fn()};return b}
function renderLib(){const root=L.buildTree(S.songs);let node=L.nodeAt(root,S.cwd);if(!node){S.cwd=[];node=root}
 const c=$('crumbs');c.innerHTML='';const h=el('a','Home');h.href='#';h.onclick=e=>{e.preventDefault();S.cwd=[];renderLib()};c.append(h);S.cwd.forEach((d,i)=>{c.append(' / ');const a=el('a',d);a.href='#';a.onclick=e=>{e.preventDefault();S.cwd=S.cwd.slice(0,i+1);renderLib()};c.append(a)});
 const ul=$('tree');ul.innerHTML='';if(!S.songs.length)ul.append(el('li','No songs yet. Tap Import folder or Import files.'));
 Object.keys(node.dirs).sort().forEach(d=>{const li=el('li');li.append(el('span','📁 '+d,'n'));li.onclick=()=>{S.cwd.push(d);renderLib()};ul.append(li)});
 const songs=node.songs.sort((a,b)=>a.path.localeCompare(b.path));
 if(songs.length){const li=el('li');li.append(el('span','Play all in this folder','n'));li.onclick=()=>playList(songs.map(s=>s.id),0,fctx());ul.append(li)}
 songs.forEach((s,i)=>{const li=el('li',null,cur()===s.id?'cur':'');li.append(el('span','♪ '+s.name,'n'));li.onclick=()=>playList(songs.map(x=>x.id),i,fctx());
  li.append(btn('+List',()=>addToPl(s.id)),btn('✕',async()=>{if(!confirm('Remove '+s.name+'?'))return;await DB.delSong(s.id);S.songs=S.songs.filter(x=>x.id!==s.id);S.pls.forEach(p=>p.ids=p.ids.filter(x=>x!==s.id));savePls();renderAll()}));ul.append(li)})}
function addToPl(id){if(!S.pls.length){alert('Create a playlist first in the Playlists tab.');return}const names=S.pls.map((p,i)=>(i+1)+'. '+p.name).join('\n');const k=prompt('Add to which playlist? Enter number:\n'+names,'1');const p=S.pls[(+k)-1];if(p){p.ids.push(id);savePls();renderPls()}}
const fctx=()=>({type:'folder',id:S.cwd.join('/'),name:S.cwd.length?'Folder '+S.cwd.join(' / '):'Library'});
const byId=id=>S.songs.find(s=>s.id===id);
function renderPls(){const ul=$('plList');ul.innerHTML='';S.pls.forEach(p=>{const li=el('li');li.append(el('span',p.name+' ('+p.ids.length+')','n'));li.onclick=()=>{S.openPl=p.id;renderPls()};
 li.append(btn('▶',()=>playList(p.ids,0,{type:'pl',id:p.id,name:p.name})),btn('Rename',()=>{const n=prompt('New name',p.name);if(n){p.name=n;if(S.Q&&S.Q.ctx.id===p.id){S.Q.ctx.name=n;saveQ();renderFrom()}savePls();renderPls()}}),btn('Delete',()=>{if(confirm('Delete playlist '+p.name+'?')){S.pls=S.pls.filter(x=>x!==p);savePls();renderPls()}}));ul.append(li)});
 const d=$('plDetail');d.innerHTML='';const p=S.pls.find(x=>x.id===S.openPl);if(!p)return;d.append(el('h3',p.name));const l=el('ul',null,'list');
 p.ids.forEach((id,i)=>{const s=byId(id);const li=el('li');li.append(el('span',s?s.name:'(missing)','n'));li.onclick=()=>playList(p.ids,i,{type:'pl',id:p.id,name:p.name});
  li.append(btn('↑',()=>{p.ids=L.move(p.ids,i,-1);savePls();renderPls()}),btn('↓',()=>{p.ids=L.move(p.ids,i,1);savePls();renderPls()}),btn('✕',()=>{p.ids.splice(i,1);savePls();renderPls()}));l.append(li)});
 if(!p.ids.length)l.append(el('li','Empty. Use +List in the Library to add songs.'));d.append(l)}
$('newPl').onclick=()=>{const n=prompt('Playlist name','Playlist '+(S.pls.length+1));if(n){S.pls.push({id:'p'+Date.now(),name:n,ids:[]});savePls();renderPls()}};
function renderAll(){renderLib();renderPls();renderCtl()}
const cur=()=>S.Q&&S.Q.list[S.Q.qi];
const saveQ=()=>DB.set('queue',S.Q);
function playList(ids,i,ctx){const q=L.makeQueue(ctx||{type:'all',name:'All songs'},ids,i,S.shuffle,byId);if(!q)return;S.Q=q;saveQ();loadCur(true)}
function renderFrom(){$('from').textContent=S.Q?'Playing from: '+S.Q.ctx.name:''}
async function loadCur(play){const s=byId(cur());if(!s)return;exitAB();clearAB();const b=await DB.blob(s.id);if(S.url)URL.revokeObjectURL(S.url);S.url=URL.createObjectURL(b);au.src=S.url;$('now').textContent=s.name;renderFrom();
 if('mediaSession' in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:s.name,album:s.path.split('/').slice(0,-1).join(' / '),artwork:[{src:'icons/icon-512.png',sizes:'512x512',type:'image/png'}]})}
 if(play)au.play().catch(()=>{});renderLib()}
function step(dir,auto){const n=L.stepQueue(S.Q,dir,S.repeat,auto);if(n<0){au.pause();return}saveQ();loadCur(true)}
au.onended=()=>{if(S.repeat==='one'){au.currentTime=0;au.play();return}step(1,true)};
$('play').onclick=()=>{if(!au.src){if(S.songs.length)playList(S.songs.map(s=>s.id),0);return}au.paused?au.play():au.pause()};
$('prev').onclick=()=>{if(au.currentTime>3)au.currentTime=0;else step(-1)};$('next').onclick=()=>step(1);
$('shuf').onclick=()=>{S.shuffle=!S.shuffle;if(S.Q){L.setShuffle(S.Q,S.shuffle);saveQ()}saveSet();renderCtl()};
$('rep').onclick=()=>{S.repeat={off:'all',all:'one',one:'off'}[S.repeat];saveSet();renderCtl()};
function renderCtl(){$('shuf').textContent='Shuffle: '+(S.shuffle?'on':'off');$('rep').textContent='Repeat: '+{off:'off',all:'playlist',one:'one song'}[S.repeat];$('play').textContent=au.paused?'▶':'⏸';renderMarks()}
au.onplay=au.onpause=()=>{renderCtl();if('mediaSession' in navigator)navigator.mediaSession.playbackState=au.paused?'paused':'playing'};
let seeking=false;$('seek').oninput=()=>{seeking=true;$('tCur').textContent=L.fmt($('seek').value/1000*(au.duration||0))};$('seek').onchange=()=>{if(au.duration)au.currentTime=$('seek').value/1000*au.duration;seeking=false};
au.ontimeupdate=()=>{if(!seeking&&au.duration)$('seek').value=au.currentTime/au.duration*1000;$('tCur').textContent=L.fmt(au.currentTime);$('tDur').textContent=L.fmt(au.duration||0);checkB()};
au.onloadedmetadata=()=>{renderMarks();$('tDur').textContent=L.fmt(au.duration)};
// A-B loop
function renderMarks(){const d=au.duration||0;const pos=(t,e)=>{e.style.display=t!=null&&d?'block':'none';if(d&&t!=null)e.style.left=(t/d*100)+'%'};pos(S.A,$('mA'));pos(S.B,$('mB'));const band=$('abBand');if(d&&S.A!=null&&S.B!=null){band.style.display='block';band.style.left=S.A/d*100+'%';band.style.width=(S.B-S.A)/d*100+'%'}else band.style.display='none';
 $('abState').textContent=(S.A!=null?'A '+S.A.toFixed(1):'')+(S.B!=null?'  B '+S.B.toFixed(1):'')+(S.ab?'  (on)':'');$('abOn').textContent=S.ab?'Stop loop':'Start loop'}
function setAB(a,b){[S.A,S.B]=L.clampAB(a,b,au.duration);renderMarks()}
$('setA').onclick=()=>setAB(au.currentTime,S.B!=null&&S.B>au.currentTime?S.B:null);$('setB').onclick=()=>{if(S.A==null)S.A=0;setAB(S.A,au.currentTime)};
$('aM').onclick=()=>S.A!=null&&setAB(S.A-0.5,S.B);$('aP').onclick=()=>S.A!=null&&setAB(S.A+0.5,S.B);$('bM').onclick=()=>S.B!=null&&setAB(S.A,S.B-0.5);$('bP').onclick=()=>S.B!=null&&setAB(S.A,S.B+0.5);
function clearAB(){S.A=S.B=null;renderMarks()}
$('abClear').onclick=()=>{exitAB();clearAB()};
$('abOn').onclick=()=>{if(S.ab){exitAB();return}if(S.A==null||S.B==null){alert('Set A and B first.');return}S.ab=true;au.currentTime=S.A;au.play();renderMarks()};
$('autoRep').onchange=$('gap').onchange=saveSet;
let raf=null;function checkB(){if(S.ab&&!S.waiting&&S.B!=null&&au.currentTime>=S.B){au.pause();au.currentTime=S.B;waitCue()}}
(function tick(){checkB();raf=requestAnimationFrame(tick)})();
function waitCue(){S.waiting=true;$('abBox').open=true;$('listen').hidden=false;
 if($('autoRep').checked){const g=Math.max(0,+$('gap').value||0);$('listenTxt').textContent='Repeating in '+g+'s...';S.timer=setTimeout(again,g*1000);return}
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('listenTxt').textContent='Tap Again (voice not available)';return}
 $('listenTxt').textContent='Listening... say "again" or "stop"';startRec(SR)}
function startRec(SR){try{const r=new SR();S.rec=r;r.lang=navigator.language||'en-US';r.continuous=false;r.interimResults=true;
 r.onresult=e=>{for(const res of e.results){const c=L.cue(res[0].transcript);if(c){stopRec();c==='stop'?exitAB():again();return}}};
 r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){$('listenTxt').textContent='Mic blocked. Tap Again.';S.rec=null}};
 r.onend=()=>{if(S.waiting&&S.rec===r)setTimeout(()=>S.waiting&&S.rec===r&&startRec(SR),250)};r.start()}catch(e){$('listenTxt').textContent='Tap Again'}}
function stopRec(){const r=S.rec;S.rec=null;if(r)try{r.abort()}catch(e){}}
function again(){clearTimeout(S.timer);stopRec();S.waiting=false;$('listen').hidden=true;if(!S.ab)return;au.currentTime=S.A;au.play()}
function exitAB(){clearTimeout(S.timer);stopRec();S.ab=false;S.waiting=false;$('listen').hidden=true;renderMarks()}
$('again').onclick=again;$('abStop').onclick=exitAB;
if('mediaSession' in navigator){const m=navigator.mediaSession;[['play',()=>au.play()],['pause',()=>au.pause()],['previoustrack',()=>$('prev').onclick()],['nexttrack',()=>step(1)],['seekto',d=>{au.currentTime=d.seekTime}]].forEach(([a,f])=>{try{m.setActionHandler(a,f)}catch(e){}})}
// Help + share
$('helpBody').innerHTML=`<h2>Welcome</h2><p>This is a simple practice player. Your music stays on this device only. Nothing is uploaded.</p>
<h2>Quick setup</h2><ol><li>Open this page in Safari on your iPhone.</li><li>Tap the Share icon, then <b>Add to Home Screen</b>.</li><li>Open the app from your Home Screen.</li><li>Go to Library and tap <b>Import folder</b> or <b>Import files</b>. Pick your MP3s from the Files app.</li><li>Tap a song to play it. Make playlists in the Playlists tab.</li></ol>
<h2>Android setup</h2><ol><li>Open this page in Chrome.</li><li>Tap the three dot menu, then <b>Add to Home screen</b> or <b>Install app</b>.</li><li>Open the app and import songs. If Import folder does not work on your phone, use Import files and select several songs at once.</li></ol><h2>A-B practice loop</h2><ol><li>Play a song. Tap <b>Set A</b> where the part starts and <b>Set B</b> where it ends. Use the +0.5 and -0.5 buttons to fine tune.</li><li>Tap <b>Start loop</b>. At B the music pauses and the app shows Listening.</li><li>Say <b>go</b>, <b>again</b>, <b>repeat</b> or <b>yes</b> to hear it again. Say <b>stop</b> to end the loop. You can always tap the big Again button instead.</li><li>Prefer no voice? Turn on Auto repeat and choose a gap in seconds.</li></ol>
<h2>iPhone and Android limits</h2><ul><li>Songs must be imported into the app. It cannot read your Apple Music library.</li><li>Songs are saved inside this app on this device. If you clear Safari website data, or iOS frees up space, you may need to import them again.</li><li>The microphone only works while the app is open on screen, and only when the page is loaded over HTTPS.</li><li>Voice commands depend on the browser speech support (Safari or Chrome) and may need an internet connection. If it does not work, use the Again button.</li><li>Lock screen controls work for play, pause and skip. The A-B voice cue needs the app open.</li><li>Each person who uses the app imports their own music. Nothing is shared between devices.</li></ul>`;
$('share').onclick=async()=>{const url=location.href.split('#')[0];try{if(navigator.share)await navigator.share({title:'Practice Player',text:'A simple music practice player. Add it to your Home Screen.',url});else{await navigator.clipboard.writeText(url);alert('Link copied: '+url)}}catch(e){}};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
load();
