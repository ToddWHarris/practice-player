// Pure logic, testable without DOM
const Logic={
 buildTree(songs){const root={name:'',dirs:{},songs:[]};for(const s of songs){const parts=s.path.split('/');parts.pop();let n=root;for(const p of parts){n=n.dirs[p]||(n.dirs[p]={name:p,dirs:{},songs:[]})}n.songs.push(s)}return root},
 nodeAt(root,dirs){let n=root;for(const d of dirs){n=n&&n.dirs[d]}return n},
 shuffled(arr,rnd=Math.random){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a},
 nextIndex(i,len,repeat,dir=1){if(!len)return -1;if(repeat==='one')return i;const n=i+dir;if(n>=len)return repeat==='all'?0:-1;if(n<0)return repeat==='all'?len-1:0;return n},
 move(arr,i,d){const j=i+d;if(j<0||j>=arr.length)return arr;const a=arr.slice();[a[i],a[j]]=[a[j],a[i]];return a},
 clampAB(a,b,dur){a=Math.max(0,Math.min(a,dur||a));if(b!=null){b=Math.max(0,Math.min(b,dur||b));if(b<=a+0.1)b=Math.min((dur||a+1),a+0.5)}return[a,b]},
 cue(text){const t=(text||'').toLowerCase();if(/\bstop\b/.test(t))return'stop';if(/\b(go|again|repeat|yes)\b/.test(t))return'again';return null},
 fmt(s){s=Math.max(0,s|0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},
 // Play queue: bound to the context playback was started from (playlist or folder)
 makeQueue(ctx,ids,start,shuffle,valid=()=>true,rnd=Math.random){const pairs=ids.map((id,k)=>({id,k})).filter(p=>valid(p.id));if(!pairs.length)return null;let si=pairs.findIndex(p=>p.k===start);if(si<0)si=0;const order=pairs.map(p=>p.id);const q={ctx,order,list:order.slice(),qi:si,shuffle:false};if(shuffle)Logic.setShuffle(q,true,rnd);return q},
 setShuffle(q,on,rnd=Math.random){if(!q)return q;if(on){const cur=q.qi;const rest=q.list.map((_,k)=>k).filter(k=>k!==cur);const idx=[cur,...Logic.shuffled(rest,rnd)];q.list=idx.map(k=>q.list[k]);q.pos=idx.map(k=>(q.pos||q.list.map((_,i)=>i))[k]);q.qi=0}else if(q.shuffle){const p=q.pos[q.qi];q.list=q.order.slice();q.qi=p;delete q.pos}q.shuffle=on;if(!on)delete q.pos;return q},
 stepQueue(q,dir,repeat,auto){if(!q)return -1;const rep=auto?repeat:(repeat==='one'?'all':repeat);const n=Logic.nextIndex(q.qi,q.list.length,rep,dir);if(n>=0)q.qi=n;return n},
 songId(path,size){return path+'|'+size}
};
if(typeof module!=='undefined')module.exports=Logic;
