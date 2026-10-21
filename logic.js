// Pure logic, testable without DOM
const Logic={
 buildTree(songs){const root={name:'',dirs:{},songs:[]};for(const s of songs){const parts=s.path.split('/');parts.pop();let n=root;for(const p of parts){n=n.dirs[p]||(n.dirs[p]={name:p,dirs:{},songs:[]})}n.songs.push(s)}return root},
 nodeAt(root,dirs){let n=root;for(const d of dirs){n=n&&n.dirs[d]}return n},
 shuffled(arr,rnd=Math.random){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a},
 nextIndex(i,len,repeat,dir=1){if(!len)return -1;if(repeat==='one')return i;const n=i+dir;if(n>=len)return repeat==='all'?0:-1;if(n<0)return repeat==='all'?len-1:0;return n},
 move(arr,i,d){const j=i+d;if(j<0||j>=arr.length)return arr;const a=arr.slice();[a[i],a[j]]=[a[j],a[i]];return a},
 clampAB(a,b,dur){a=Math.max(0,Math.min(a,dur||a));if(b!=null){b=Math.max(0,Math.min(b,dur||b));if(b<=a+0.1)b=Math.min((dur||a+1),a+0.5)}return[a,b]},
 cue(text){const t=(text||'').toLowerCase().replace(/[^a-z' ]+/g,' ');if(/\bstop\b/.test(t))return'stop';if(/\b(go|again|repeat|yes)\b/.test(t))return'again';return null},
 fmt(s){s=Math.max(0,s|0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},
 // Play queue: bound to the context playback was started from (playlist or folder)
 // Play queue bound to its start context. items: [{id,k}] (k = playlist index, or null); play: item indices in play order; list: ids in play order
 _sync(q){q.list=q.play.map(i=>q.items[i].id);return q},
 makeQueue(ctx,ids,start,shuffle,valid=()=>true,rnd=Math.random){const items=ids.map((id,k)=>({id,k})).filter(p=>valid(p.id));if(!items.length)return null;let si=items.findIndex(p=>p.k===start);if(si<0)si=0;
  const q={ctx,items,play:items.map((_,i)=>i),qi:si,shuffle:false};Logic._sync(q);if(shuffle)Logic.setShuffle(q,true,rnd);return q},
 upgradeQueue(q){if(!q||q.items)return q;q.items=(q.order||q.list).map(id=>({id,k:null}));q.play=q.list.map(id=>(q.order||q.list).indexOf(id));if(q.play.some(i=>i<0))q.play=q.items.map((_,i)=>i);delete q.order;delete q.pos;return Logic._sync(q)},
 setShuffle(q,on,rnd=Math.random){if(!q)return q;const cur=q.play[q.qi];const pend=q.items.map((_,i)=>i).filter(i=>!q.items[i].gone||i===cur);
  if(on){q.play=[cur,...Logic.shuffled(pend.filter(i=>i!==cur),rnd)];q.qi=0}else{q.play=Logic._orderIdx(q,pend);q.qi=q.play.indexOf(cur)}q.shuffle=on;return Logic._sync(q)},
 _orderIdx(q,idx){return idx.slice().sort((a,b)=>{const ka=q.items[a].k,kb=q.items[b].k;return (ka==null||kb==null)?a-b:ka-kb})},
 _prune(q){const cur=q.play[q.qi];q.play=q.play.filter(i=>!q.items[i].gone||i===cur);q.qi=q.play.indexOf(cur)},
 stepQueue(q,dir,repeat,auto){if(!q)return -1;const rep=auto?repeat:(repeat==='one'?'all':repeat);const n=Logic.nextIndex(q.qi,q.play.length,rep,dir);if(n<0)return n;
  const was=q.play[q.qi],target=q.play[n];if(q.items[was].gone&&target!==was)q.play=q.play.filter(i=>i!==was);q.qi=q.play.indexOf(target);
  Logic._sync(q);return q.qi},
 // Playlist edited while it is the active queue: keep the playing song current
 plMove(q,from,to){if(!q)return q;for(const it of q.items){if(it.k==null)continue;const k=it.k;if(k===from)it.k=to;else if(from<to&&k>from&&k<=to)it.k=k-1;else if(from>to&&k>=to&&k<from)it.k=k+1;else if(!Number.isInteger(k)){const f=Math.ceil(k);if(f===from)it.k=to-0.5;else if(from<to&&f>from&&f<=to)it.k=k-1;else if(from>to&&f>=to&&f<from)it.k=k+1}}
  if(!q.shuffle){const cur=q.play[q.qi];q.play=Logic._orderIdx(q,q.play);q.qi=q.play.indexOf(cur)}return Logic._sync(q)},
 plRemove(q,r){if(!q)return q;const cur=q.play[q.qi];const ix=q.items.findIndex(it=>it.k===r);for(const it of q.items)if(it.k!=null&&it.k>r)it.k-=1;
  if(ix>=0){if(ix===cur){q.items[ix].gone=true;q.items[ix].k=r-0.5}else{q.play=q.play.filter(i=>i!==ix);q.qi=q.play.indexOf(cur)}}return Logic._sync(q)},
 // Accent color helpers
 PRESETS:[['Green','#22c55e'],['Blue','#3b82f6'],['Teal','#14b8a6'],['Pink','#ec4899'],['Purple','#a855f7'],['Red','#ef4444'],['Orange','#f97316'],['Gold','#eab308']],
 normHex(h){h=String(h||'').trim().toLowerCase();if(/^#[0-9a-f]{3}$/.test(h))h='#'+[...h.slice(1)].map(c=>c+c).join('');return /^#[0-9a-f]{6}$/.test(h)?h:null},
 lum(h){const c=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]},
 textOn(h){const L=Logic.lum(h);return (L+0.05)/0.05>=1.05/(L+0.05)?'#000000':'#ffffff'},
 // Loop editor helpers
 editorWindow(a,b,dur,pre,post){dur=dur||b||0;return[Math.max(0,a-pre),Math.min(dur,b+post)]},
 dragHandle(which,t,a,b,dur){t=Math.round(t);dur=dur||Math.max(b,t);if(which==='A'){const hi=Math.floor(b-1);a=Math.max(0,Math.min(t,hi));if(a>b-1)a=Math.max(0,b-1);return[a,b]}const lo=Math.ceil(a+1);b=Math.min(Math.max(t,lo),dur);if(b<a+1)b=Math.min(dur,a+1);return[a,b]},
 songId(path,size){return path+'|'+size}
};
if(typeof module!=='undefined')module.exports=Logic;
// ID3v2 / ID3v1 parser and MPEG bitrate, vanilla JS. Input: Uint8Array of the file head (and optional tail for v1)
const ID3={
 dec(b,enc){if(!b.length)return'';try{if(enc===0)return Array.from(b,c=>String.fromCharCode(c)).join('').replace(/\0+$/,'').trim();
  if(enc===3)return new TextDecoder('utf-8').decode(b).replace(/\0+$/,'').trim();
  if(enc===2)return new TextDecoder('utf-16be').decode(b).replace(/\0+$/,'').trim();
  if(b[0]===0xfe&&b[1]===0xff)return new TextDecoder('utf-16be').decode(b.subarray(2)).replace(/\0+$/,'').trim();
  return new TextDecoder('utf-16le').decode(b[0]===0xff&&b[1]===0xfe?b.subarray(2):b).replace(/\0+$/,'').trim()}catch(e){return''}},
 syncsafe(b,o){return (b[o]&127)<<21|(b[o+1]&127)<<14|(b[o+2]&127)<<7|(b[o+3]&127)},
 term(b,o,enc){const w=(enc===1||enc===2)?2:1;let i=o;while(i+w<=b.length){if(b[i]===0&&(w===1||b[i+1]===0))return i;i+=w}return b.length},
 unsync(b){const o=[];for(let i=0;i<b.length;i++){o.push(b[i]);if(b[i]===0xff&&b[i+1]===0)i++}return Uint8Array.from(o)},
 tagSize(h){return h.length>=10&&h[0]===73&&h[1]===68&&h[2]===51?10+ID3.syncsafe(h,6)+((h[5]&16)?10:0):0},
 v2(b){const r={};if(ID3.tagSize(b)===0)return r;const ver=b[3],flags=b[5];let end=Math.min(b.length,10+ID3.syncsafe(b,6));let o=10;
  if(ver<3&&(flags&128))b=ID3.unsync(b.subarray(0,end)),end=b.length;
  if(flags&64){o+=ver===4?ID3.syncsafe(b,10):((b[10]<<24|b[11]<<16|b[12]<<8|b[13])+4)}
  const idl=ver===2?3:4,hl=ver===2?6:10;
  const map={TIT2:'title',TT2:'title',TPE1:'artist',TP1:'artist',TALB:'album',TAL:'album',TYER:'year',TYE:'year',TDRC:'year',TRCK:'track',TRK:'track',TPE2:'albumArtist',TP2:'albumArtist'};
  while(o+hl<=end){const id=String.fromCharCode(...b.subarray(o,o+idl));if(!/^[A-Z0-9]+$/.test(id))break;
   let sz=ver===2?(b[o+3]<<16|b[o+4]<<8|b[o+5]):ver===4?ID3.syncsafe(b,o+4):((b[o+4]<<24)|(b[o+5]<<16)|(b[o+6]<<8)|b[o+7])>>>0;
   let fl=ver>2?b[o+9]:0;let d=b.subarray(o+hl,Math.min(end,o+hl+sz));o+=hl+sz;if(!sz)continue;
   if(ver===4&&(fl&2))d=ID3.unsync(d);if(ver===4&&(fl&1))d=d.subarray(4);
   if(map[id]&&!r[map[id]])r[map[id]]=ID3.dec(d.subarray(1),d[0]);
   else if((id==='APIC'||id==='PIC')&&!r.pic){const enc=d[0];let p=1,mime;if(id==='PIC'){const f=String.fromCharCode(d[1],d[2],d[3]).toLowerCase();mime=f==='png'?'image/png':'image/jpeg';p=4}else{const z=d.indexOf(0,1);mime=ID3.dec(d.subarray(1,z),0)||'image/jpeg';p=z+1}
    p++;const dz=ID3.term(d,p,enc);p=dz+((enc===1||enc===2)?2:1);if(!/\//.test(mime))mime='image/'+(mime.toLowerCase()==='png'?'png':'jpeg');if(p<d.length)r.pic={mime,data:d.slice(p)}}}
  if(r.year)r.year=r.year.slice(0,4);return r},
 v1(t){if(!t||t.length<128)return{};t=t.subarray(t.length-128);if(!(t[0]===84&&t[1]===65&&t[2]===71))return{};const s=(a,b)=>ID3.dec(t.subarray(a,b),0).replace(/\0.*$/,'').trim();
  const r={title:s(3,33),artist:s(33,63),album:s(63,93),year:s(93,97)};if(t[125]===0&&t[126])r.track=String(t[126]);for(const k in r)if(!r[k])delete r[k];return r},
 bitrate(b,off){const T1=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],T2=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
  for(let i=off||0;i<Math.min(b.length-4,(off||0)+65536);i++){if(b[i]===0xff&&(b[i+1]&0xe0)===0xe0){const ver=(b[i+1]>>3)&3,lay=(b[i+1]>>1)&3,bi=b[i+2]>>4;if(lay!==1||ver===1||bi===0||bi===15)continue;
   const kb=(ver===3?T1:T2)[bi];const x=b.subarray(i+4,i+40);const s=String.fromCharCode(...x);if(/Xing|Info/.test(s)){const k=s.indexOf('Xing')>=0?s.indexOf('Xing'):s.indexOf('Info');return{kbps:kb,vbr:s.substr(k,4)==='Xing'}}return{kbps:kb}}}return null},
 parse(head,tail){const v2=ID3.v2(head),v1=ID3.v1(tail);const r=Object.assign({},v1,v2);const br=ID3.bitrate(head,ID3.tagSize(head));if(br)r.kbps=br.kbps,r.vbr=!!br.vbr;return r}
};
if(typeof module!=='undefined')module.exports.ID3=ID3;
