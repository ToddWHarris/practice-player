// v28: the .pplay zip is a Blob composed of the song Blobs (no copies of the MP3 bytes); the hash and CRC are computed
// one song at a time and the built file is dropped when the sheet closes. Imported songs are stored straight from the file.
// v24 Share a playlist as a .pplay file (a STORE zip: playlist.json + songs/) and import one.
const PLS={file:null,id:null,WARN_MB:20};
function safeName(n){return (String(n||'Playlist').replace(/[\/\\:*?"<>|\u0000-\u001f]/g,'-').replace(/\s+/g,' ').trim().replace(/^\.+/,'')||'Playlist').slice(0,80)}
function plSongs(p){return p.ids.map(byId).filter(Boolean)}
function mbTxt(b){const m=b/1048576;return m<1?'under 1 MB':(m<10?m.toFixed(1):Math.round(m))+' MB'}
async function sha256(blob){const d=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function openPlShare(id){const p=S.pls.find(x=>x.id===id);if(!p)return;const ss=plSongs(p);if(!ss.length){alert('This playlist has no songs to share.');return}
 PLS.id=id;PLS.file=null;const bytes=ss.reduce((a,s)=>a+(s.size||0),0);
 $('plsTitle').textContent='Share '+p.name;$('plsInfo').textContent=ss.length+' song'+(ss.length===1?'':'s')+', '+mbTxt(bytes);$('plsWarn').hidden=bytes<=PLS.WARN_MB*1048576;
 $('plsGo').textContent='Prepare';$('plsGo').disabled=false;$('plsStatus').textContent='';$('plsModal').hidden=false;document.body.classList.add('modalOpen')}
function closePlShare(){$('plsModal').hidden=true;PLS.file=null;document.body.classList.remove('modalOpen')}
async function buildPplay(p){const ss=plSongs(p),ents=[],songs=[];let k=0;
 for(const s of ss){k++;$('plsStatus').textContent='Preparing '+k+' of '+ss.length+'...';const b=await DB.blob(s.id);if(!b)continue;let m=null;try{m=await getMeta(s)}catch(e){}
  const base=(s.path||s.name).split('/').pop(),file='songs/'+String(k).padStart(3,'0')+' '+safeName(base);
  songs.push({file,name:s.name,size:b.size,type:s.type||'audio/mpeg',sha256:await sha256(b),clip:!!s.clip,
   tags:m?{title:m.title||'',artist:m.artist||'',album:m.album||'',year:m.year||'',track:m.track||''}:{},pr:S.pr[s.id]||null});ents.push({name:file,blob:b});m=null}
 const meta={app:'Practice Player',kind:'playlist',format:1,version:APP_VERSION,name:p.name,created:new Date().toISOString(),songs};
 const z=await Zip.build([{name:'playlist.json',blob:new Blob([JSON.stringify(meta)],{type:'application/json'})},...ents]);
 const nm=safeName(p.name)+'.pplay';let f=new File([z],nm,{type:'application/zip'});
 if(navigator.canShare&&!navigator.canShare({files:[f]})){const g=new File([z],nm,{type:'application/octet-stream'});if(navigator.canShare({files:[g]}))f=g}
 return f}
$('plsCancel').onclick=closePlShare;$('plsModal').addEventListener('click',e=>{if(e.target===$('plsModal'))closePlShare()});
$('plsGo').onclick=async()=>{const p=S.pls.find(x=>x.id===PLS.id);if(!p)return closePlShare();
 if(!PLS.file){$('plsGo').disabled=true;try{PLS.file=await buildPplay(p);$('plsStatus').textContent='Ready: '+PLS.file.name+' ('+mbTxt(PLS.file.size)+'). Tap Share.';$('plsGo').textContent='Share'}
  catch(e){$('plsStatus').textContent='Could not prepare the playlist. '+(e&&e.message||'')}finally{$('plsGo').disabled=false}return}
 // second tap: share straight from the gesture
 const f=PLS.file,files=[f];
 if(navigator.share&&navigator.canShare&&navigator.canShare({files})){navigator.share({files,title:p.name}).then(()=>{PLS.file=null;closePlShare();toast('Playlist shared')}).catch(e=>{if(e&&e.name==='AbortError')return;plsDownload(f)});return}
 plsDownload(f)};
function plsDownload(f){const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.className='sendDl';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},60000);closePlShare();toast('Sharing files is not supported here. Downloading '+f.name)}
async function importPplay(file){const list=await Zip.read(file);const pj=list.find(x=>x.name==='playlist.json');if(!pj)throw new Error('This is not a Practice Player playlist file.');
 const meta=JSON.parse(await pj.blob.text());if(meta.kind!=='playlist'||!Array.isArray(meta.songs))throw new Error('This is not a Practice Player playlist file.');
 const ents={};list.forEach(x=>ents[x.name]=x);let base=safeName(meta.name||'Shared playlist').trim(),name=base,n=2;while(S.pls.some(p=>p.name===name))name=base+' ('+(n++)+')';
 const folder='Shared/'+safeName(name);const ids=[];let reused=0,added=0,i=0;const hashCache={};
 for(const sj of meta.songs){i++;const x=ents[sj.file];if(!x)continue;
  // reuse a song that is already in the app: same name and size, or same bytes (hash)
  let ex=S.songs.find(s=>s.name===sj.name&&s.size===sj.size);
  if(!ex&&sj.sha256){for(const s of S.songs.filter(s=>s.size===sj.size)){if(!hashCache[s.id]){const b=await DB.blob(s.id);hashCache[s.id]=b?await sha256(b):''}if(hashCache[s.id]===sj.sha256){ex=s;break}}}
  if(ex){if(ex.removed){delete ex.removed;delete ex.removedAt;delete ex.removedGroup;await DB.putMeta(ex)}ids.push(ex.id);reused++;
   if(sj.pr&&!S.pr[ex.id]){S.pr[ex.id]=sj.pr;await savePR(ex.id)}continue}
  const fn=sj.file.split('/').pop().replace(/^\d{3} /,'');let path=folder+'/'+fn,id=L.songId(path,sj.size);let k=2;while(byId(id)){path=folder+'/'+fn.replace(/(\.[^.]*)?$/,' ('+(k++)+')$1');id=L.songId(path,sj.size)}
  const data=new Blob([x.blob],{type:sj.type||'audio/mpeg'});const rec={id,path,name:sj.name,size:data.size,type:sj.type||'audio/mpeg',added:Date.now(),shared:true};
  await DB.putSong(rec,data);S.songs.push(rec);ids.push(id);added++;if(sj.pr){S.pr[id]=sj.pr;await savePR(id)}}
 const p={id:'p'+Date.now(),name,ids};S.pls.push(p);await DB.set('playlists',S.pls);try{localStorage.setItem('pp-backupDirty','1')}catch(e){}
 S.songs=await DB.allSongs();renderAll();return{name,added,reused,total:ids.length,id:p.id}}
document.querySelectorAll('.plIn').forEach(inp=>inp.onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 try{toast('Importing playlist...');const r=await importPplay(f);S.openPl=r.id;tab('pls');renderPls();
  alert('Imported playlist "'+r.name+'" with '+r.total+' song'+(r.total===1?'':'s')+'.'+(r.added?' '+r.added+' new song'+(r.added===1?' is':'s are')+' in the Library folder Shared.':'')+(r.reused?' '+r.reused+' already in the app '+(r.reused===1?'was':'were')+' reused.':''))}
 catch(err){alert('Could not import the playlist. '+(err&&err.message||''))}});
