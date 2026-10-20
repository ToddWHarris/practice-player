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
 songId(path,size){return path+'|'+size}
};
if(typeof module!=='undefined')module.exports=Logic;
