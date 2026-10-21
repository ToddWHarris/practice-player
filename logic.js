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
 makeQueue(ctx,ids,start,shuffle,valid=()=>true,rnd=Math.random){const pairs=ids.map((id,k)=>({id,k})).filter(p=>valid(p.id));if(!pairs.length)return null;let si=pairs.findIndex(p=>p.k===start);if(si<0)si=0;const order=pairs.map(p=>p.id);const q={ctx,order,list:order.slice(),qi:si,shuffle:false};if(shuffle)Logic.setShuffle(q,true,rnd);return q},
 setShuffle(q,on,rnd=Math.random){if(!q)return q;if(on){const cur=q.qi;const rest=q.list.map((_,k)=>k).filter(k=>k!==cur);const idx=[cur,...Logic.shuffled(rest,rnd)];q.list=idx.map(k=>q.list[k]);q.pos=idx.map(k=>(q.pos||q.list.map((_,i)=>i))[k]);q.qi=0}else if(q.shuffle){const p=q.pos[q.qi];q.list=q.order.slice();q.qi=p;delete q.pos}q.shuffle=on;if(!on)delete q.pos;return q},
 stepQueue(q,dir,repeat,auto){if(!q)return -1;const rep=auto?repeat:(repeat==='one'?'all':repeat);const n=Logic.nextIndex(q.qi,q.list.length,rep,dir);if(n>=0)q.qi=n;return n},
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
