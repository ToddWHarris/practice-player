// V43 treble strikes: a soft, fast-decaying strike in the top octaves is judged on its
// strike, not on an average diluted by quiet tail. Before V43 every case below that is
// marked "was silence" came back rejected with reason 'silence' even though the tone was
// there; the pitch stages never saw it. A genuinely silent take still rejects 'silence',
// and a strike that was already fading when the take started is its own reason, 'early'.
const a=require('assert');const P=require('../pianotune.js');
const SR=48000;
function strike(f1,B,tau,peak,totalSec,leadSec){
 const tone=P.synthUnison(SR,totalSec-leadSec,[{f1,B,partials:[1,2,3,4,5,6],amp:1}],{tau,raw:true});
 let pk=0;for(let i=0;i<tone.length;i++)pk=Math.max(pk,Math.abs(tone[i]));
 const g=peak/(pk||1),x=new Float32Array(Math.floor(SR*totalSec)),lead=Math.floor(SR*leadSec);
 for(let i=0;i<tone.length;i++)x[lead+i]=tone[i]*g;
 return x}
function midDecay(f1,B,tau,peak,startIn,totalSec){
 const tone=P.synthUnison(SR,totalSec+startIn,[{f1,B,partials:[1,2,3,4,5,6],amp:1}],{tau,raw:true});
 let pk=0;for(let i=0;i<tone.length;i++)pk=Math.max(pk,Math.abs(tone[i]));
 const g=peak/(pk||1),x=new Float32Array(Math.floor(SR*totalSec)),off=Math.floor(SR*startIn);
 for(let i=0;i<x.length;i++)x[i]=tone[off+i]*g;
 return x}
function hear(x,midi){return P.analyzeCalibrationNote(x,SR,{midi,a4:440})}
// The reported shape: strike lands in a full 2.4 s take (no capture attack), fast decay.
const cases=[
 {midi:93,B:0.0011,tau:0.08,peak:0.04},
 {midi:93,B:0.0011,tau:0.10,peak:0.03},
 {midi:93,B:0.0011,tau:0.08,peak:0.03},
 {midi:96,B:0.0014,tau:0.09,peak:0.035},
 {midi:105,B:0.0037,tau:0.08,peak:0.04},
 {midi:108,B:0.0049,tau:0.08,peak:0.04},
 {midi:108,B:0.0049,tau:0.10,peak:0.03}
];
cases.forEach(c=>{
 const r=hear(strike(P.etFreq(c.midi,440),c.B,c.tau,c.peak,2.4,0.3),c.midi);
 a.equal(r.status,'measured',P.label(c.midi)+' tau '+c.tau+' peak '+c.peak+' -> '+r.reason);
 a.ok(Math.abs(r.B/c.B-1)<0.4,P.label(c.midi)+' B '+r.B+' vs '+c.B);
 a.ok(r.diag&&r.diag.strikeRms>0.004,'strike window carries the judgement for '+P.label(c.midi));
 a.ok(r.diag.segRms<r.diag.strikeRms,'segment average is the diluted one for '+P.label(c.midi));
 a.ok(r.diag.frames.length>100,'frame series is recorded for '+P.label(c.midi));
 a.equal(r.diag.startedHot,false)});
// Strikes that began before the take was really listening, caught mid-decay, now measure
// instead of rejecting 'silence' (the tone is still coherent, just quieter).
const mid1=hear(midDecay(P.etFreq(93,440),0.0011,0.25,0.12,0.4,2.4),93);
a.equal(mid1.status,'measured',mid1.reason);
const mid2=hear(midDecay(P.etFreq(93,440),0.0011,0.12,0.12,0.2,2.4),93);
a.equal(mid2.status,'measured',mid2.reason);
const mid3=hear(midDecay(P.etFreq(108,440),0.0049,0.12,0.12,0.2,2.4),108);
a.equal(mid3.status,'measured',mid3.reason);
// A strike so far into its fade that only the tail is left: not silence, its own reason.
const early=hear(midDecay(P.etFreq(93,440),0.0011,0.10,0.09,0.23,2.4),93);
a.equal(early.status,'rejected');
a.equal(early.reason,'early',early.reason);
a.equal(early.diag.startedHot,true);
// True silence still rejects as silence, in the treble as everywhere else.
a.equal(hear(new Float32Array(SR),93).reason,'silence');
a.equal(hear(new Float32Array(SR),108).reason,'silence');
const noise=new Float32Array(SR*1.6);let ns=9;for(let i=0;i<noise.length;i++){ns=(ns*16807)%2147483647;noise[i]=((ns/2147483647)*2-1)*0.002}
a.equal(hear(noise,93).reason,'silence');
// A strike far too faint even on its own window is still silence, not a measurement.
const faint=hear(strike(P.etFreq(93,440),0.0011,0.10,0.01,2.4,0.3),93);
a.equal(faint.reason,'silence',faint.reason);
// Lower notes keep working on the same rules (no treble special case).
const low=hear(strike(P.etFreq(45,440),0.00055,0.5,0.03,2.4,0.3),45);
a.equal(low.status,'measured',low.reason);
a.ok(Math.abs(low.B/0.00055-1)<0.4,low.B);
const midNote=hear(strike(P.etFreq(69,440),0.0004,0.8,0.03,2.4,0.3),69);
a.equal(midNote.status,'measured',midNote.reason);
// Segment info is exposed for the session log, and the array form still works.
const info=P.selectCalibrationSegmentInfo(strike(P.etFreq(93,440),0.0011,0.08,0.04,2.4,0.3),SR);
a.ok(info.segment.length>0&&isFinite(info.floor)&&isFinite(info.gate)&&info.anchor>0);
a.ok(Array.isArray(P.selectCalibrationSegment(strike(P.etFreq(93,440),0.0011,0.08,0.04,2.4,0.3),SR))||P.selectCalibrationSegment(strike(P.etFreq(93,440),0.0011,0.08,0.04,2.4,0.3),SR).length>0);
console.log('treble ok');
