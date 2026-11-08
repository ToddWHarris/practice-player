// V43 capture onset: the strike is looked for on ~10 ms sub-chunks. On the old rule
// (one RMS per 85 ms processor buffer, hot at 0.012 with a 1.5x rise) the soft fast
// treble strikes below never registered an attack, so the take ran the full 2.4 s and
// the strike was diluted away. The old rule is re-implemented here to prove the miss.
const a=require('assert');const P=require('../pianotune.js');
const SR=48000;
function strike(f1,B,tau,peak,totalSec,leadSec){
 const tone=P.synthUnison(SR,totalSec-leadSec,[{f1,B,partials:[1,2,3,4,5,6],amp:1}],{tau,raw:true});
 let pk=0;for(let i=0;i<tone.length;i++)pk=Math.max(pk,Math.abs(tone[i]));
 const g=peak/(pk||1),x=new Float32Array(Math.floor(SR*totalSec)),lead=Math.floor(SR*leadSec);
 for(let i=0;i<tone.length;i++)x[lead+i]=tone[i]*g;
 return x}
function feed(det,x){
 for(let i=0;i<x.length;i+=4096)det.push(x.slice(i,Math.min(x.length,i+4096)));
 return det}
function oldRuleAttack(x){
 let total=0,attackAt=-1,floor=0.001,prev=0;
 for(let i=0;i<x.length;i+=4096){
  const c=x.slice(i,Math.min(x.length,i+4096));if(c.length<4096&&total>0)break;
  let e=0;for(let j=0;j<c.length;j++)e+=c[j]*c[j];
  const r=Math.sqrt(e/Math.max(1,c.length));
  const hot=r>=Math.max(0.012,floor*5);
  if(attackAt<0&&total>SR*0.04&&hot&&(r>prev*1.5||prev>=0.012))attackAt=total;
  if(!hot)floor=floor*0.9+r*0.1;
  prev=r;total+=c.length}
 return attackAt}
// Soft fast A6 in a 2.4 s take: the old rule misses it, the sub-chunk rule catches it.
const soft=strike(P.etFreq(93,440),0.0011,0.10,0.03,2.4,0.3);
a.equal(oldRuleAttack(soft),-1,'old whole-buffer rule misses the soft A6 strike');
const d1=feed(P.makeCaptureOnset(SR),soft);
a.equal(d1.attackDetected,true,'sub-chunk rule catches the soft A6 strike');
a.ok(d1.attackAt/SR>0.25&&d1.attackAt/SR<0.5,'attack lands on the strike: '+(d1.attackAt/SR));
a.equal(d1.startedHot,false);
a.ok(d1.maxSubRms>d1.maxChunkRms,'sub-chunks see the strike the buffers average down');
const soft2=strike(P.etFreq(93,440),0.0011,0.08,0.04,2.4,0.3);
a.equal(feed(P.makeCaptureOnset(SR),soft2).attackDetected,true);
const top=strike(P.etFreq(108,440),0.0049,0.08,0.04,2.4,0.3);
a.equal(feed(P.makeCaptureOnset(SR),top).attackDetected,true,'C8 soft strike is caught too');
// Pure quiet: no attack, not hot at the start.
const dq=feed(P.makeCaptureOnset(SR),new Float32Array(SR*2.4));
a.equal(dq.attackDetected,false);
a.equal(dq.startedHot,false);
a.equal(dq.maxChunkRms,0);
// A take that opens mid-strike (played before Listening) is hot from sample 0.
const midTone=P.synthUnison(SR,1.2,[{f1:P.etFreq(93,440),B:0.0011,partials:[1,2,3,4,5,6],amp:1}],{tau:0.12,raw:true});
let mpk=0;for(let i=0;i<midTone.length;i++)mpk=Math.max(mpk,Math.abs(midTone[i]));
const mid=new Float32Array(midTone.length);for(let i=0;i<mid.length;i++)mid[i]=midTone[i]*(0.12/(mpk||1));
const dm=feed(P.makeCaptureOnset(SR),mid);
a.equal(dm.startedHot,true,'mid-decay take is flagged hot at the start');
// An ordinary clear strike still lands where it should.
const norm=strike(440,0.0004,1.4,0.12,2.0,0.5);
const dn=feed(P.makeCaptureOnset(SR),norm);
a.equal(dn.attackDetected,true);
a.ok(Math.abs(dn.attackAt/SR-0.5)<0.1,'attack near the strike: '+(dn.attackAt/SR));
console.log('capture ok');
