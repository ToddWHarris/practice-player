// v34 guided tune: stretch order, sequence, overpull, step rules, back/jump, beat rates.
const a=require('assert');const P=require('../pianotune.js');
const ids=['concert','baby','studio','spinet'];
ids.forEach(id=>{
  const map=P.curveFor(id);
  a.equal(map.origin[69],'derived');
  a.ok(Math.abs(map.cents[69])<1e-9,id+' A4');
  for(let m=P.LO;m<=P.HI;m++)a.ok(isFinite(map.cents[m]),id+' '+m);
  // treble rises, bass falls
  a.ok(map.cents[21]<map.cents[57]&&map.cents[57]<0,id+' bass flat');
  a.ok(map.cents[108]>map.cents[81]&&map.cents[81]>0,id+' treble sharp');
});
// smaller pianos stretch more at both ends
const c=id=>P.curveFor(id).cents;
a.ok(c('concert')[21]>c('baby')[21]&&c('baby')[21]>c('studio')[21]&&c('studio')[21]>c('spinet')[21],'bass stretch grows as the piano gets smaller');
a.ok(c('concert')[108]<c('baby')[108]&&c('baby')[108]<c('studio')[108]&&c('studio')[108]<c('spinet')[108],'treble stretch grows as the piano gets smaller');
// Typical anchors are the sourced Fernhart table; notes between them are derived
const t=P.curveFor('typical');
P.TYPICAL.forEach(([m,v])=>{a.ok(Math.abs(t.cents[m]-v)<1e-9);a.equal(t.origin[m],'sourced')});
a.equal(t.origin[22],'derived');
a.ok(t.cents[22]>t.cents[21]&&t.cents[22]<t.cents[24],'smooth fill between A0 and C1');
// overpull: 20 cents flat aims 5 cents sharp of the final target. Sharp notes are not pulled further.
a.ok(Math.abs(P.overpullTarget(3,-20)-(3+5))<1e-9);
a.ok(Math.abs(P.overpullTarget(3,4)-3)<1e-9);
a.equal(P.OVERPULL,0.25);
a.equal(P.needsPitchRaise({21:-3,69:-2}),false);
a.equal(P.needsPitchRaise({21:-12,69:-10,108:-9}),true);
// sequence
function phases(raise){return P.buildSequence({raise})}
const calm=phases(false),raised=phases(true);
a.deepEqual(calm.filter(s=>s.phase==='prescan').map(s=>s.midi),P.PRESCAN);
a.equal(calm.some(s=>s.phase==='raise'),false);
a.equal(raised.filter(s=>s.phase==='raise').length,88);
const tune=calm.filter(s=>s.phase==='a4'||s.phase==='temper'||s.phase==='check');
a.equal(tune[0].midi,69);a.ok(tune[0].prompt.indexOf('440')<0||tune[0].prompt.indexOf('Mute')>=0);
a.ok(tune[0].prompt.indexOf('Mute')>=0&&tune[0].prompt.indexOf('unison')>=0);
const sk=tune.filter(s=>s.phase!=='check').map(s=>s.midi);
a.deepEqual(sk.slice(0,5),[69,57,53,61,65]);
const thirds=calm.find(s=>s.title==='Progressive thirds');
a.deepEqual(thirds.midis,[53,57,61,65]);
a.ok(thirds.intervals.length===3);
const check2=calm.find(s=>s.title.indexOf('fourth')>=0);
a.ok(check2.intervals.some(i=>i.kind==='P4')&&check2.intervals.some(i=>i.kind==='P5')&&check2.intervals.some(i=>i.kind==='M6'));
const after=calm.slice(calm.indexOf(check2)+1);
a.equal(after[0].phase,'up');a.equal(after[0].midi,66);
a.equal(after.filter(s=>s.phase==='up').slice(-1)[0].midi,108);
const bass=after.filter(s=>s.phase==='down');
a.equal(bass[0].midi,52);a.equal(bass.slice(-1)[0].midi,21);
a.equal(calm.filter(s=>s.phase==='fine').length,88);
a.ok(calm[calm.length-1].phase==='fine'&&calm[calm.length-1].midi===108);
// beat rate is finite and thirds speed up on the concert curve
const curve=c('concert'),b=m=>P.bOf(P.SIZES.concert,m);
const b1=P.expectedBeat(curve,b,440,53,'M3');
const b2=P.expectedBeat(curve,b,440,57,'M3');
const b3=P.expectedBeat(curve,b,440,61,'M3');
a.ok(b1.beat>0&&b2.beat>b1.beat&&b3.beat>b2.beat,'progressive thirds speed up');
// measured beats from a 7 Hz envelope
const dt=0.02,frames=[];for(let i=0;i<60;i++)frames.push(1+0.6*Math.sin(2*Math.PI*7*i*dt));
const got=P.measureBeats(frames,dt);a.ok(Math.abs(got-7)<0.6,got);
// step completion
let st=P.emptyState();const one={phase:'temper',midi:60,midis:[60]};
let r=P.applySample(st,one,{midi:60,cents:5},1000);
a.equal(r.advance,false);a.equal(r.lean,1);a.equal(r.color,'red');
r=P.applySample(r.state,one,{midi:60,cents:-4},2000);
a.equal(r.lean,-1);a.equal(r.color,'red');
r=P.applySample(st,one,{midi:60,cents:1},0);
a.equal(r.advance,false);
r=P.applySample(r.state,one,{midi:60,cents:1.5},P.HOLD_MS);
a.equal(r.advance,true);a.equal(r.chime,true);a.equal(r.state.green[60],true);
// chord: every key must go green
const chord={phase:'check',midis:[53,57,61,65]};
st=P.emptyState();
function hold(state,midi){let s=state,out;out=P.applySample(s,chord,{midi,cents:0},0);out=P.applySample(out.state,chord,{midi,cents:0},P.HOLD_MS);return out}
r=hold(st,53);a.equal(r.advance,false);a.equal(r.state.green[53],true);
r=hold(r.state,57);a.equal(r.advance,false);
r=hold(r.state,61);a.equal(r.advance,false);
r=hold(r.state,65);a.equal(r.advance,true);a.equal(r.chime,true);
// back and jump
const seq=calm;let js=P.emptyState();js.step=5;
js=P.jump(js,4,seq.length);a.equal(js.step,4);a.deepEqual(js.green,{});
js=P.jump(js,0,seq.length);a.equal(js.step,0);
js=P.jump(js,-3,seq.length);a.equal(js.step,0);
js=P.jump(js,999,seq.length);a.equal(js.step,seq.length-1);
// storage name stays additive
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
a.ok(app.includes("'pp-pianotune'"));
a.ok(app.includes("indexedDB.open('practice-player',1)")===false);
a.ok(fs.readFileSync('db.js','utf8').includes("indexedDB.open('practice-player',1)"));
// Full pre-scan is every note from A0 to C8, in order. It does not start by judging tune.
a.equal(P.PRESCAN.length,88);
a.equal(P.PRESCAN[0],21);
a.equal(P.PRESCAN[87],108);
a.equal(new Set(P.PRESCAN).size,88);
function steady(step,base){let r={state:P.emptyState(),advance:false};for(let i=0;i<8;i++){r=P.applySample(r.state,step,{midi:step.midi,cents:base+(i%2?4:-4)},i*80);if(r.advance)return r}return r}
const a0={phase:'prescan',midi:21,midis:[21]};
const a4p={phase:'prescan',midi:69,midis:[69]};
r=steady(a0,80);a.equal(r.advance,true);a.ok(Math.abs(r.state.prescan[21].cents-80)<6);a.equal(r.state.prescan[21].confidence,'low');
r=steady(a4p,-120);a.equal(r.advance,true);a.ok(Math.abs(r.state.prescan[69].cents+120)<6);a.equal(r.state.prescan[69].confidence,'high');
r=steady(a4p,700);a.equal(r.advance,false,'a different note must not be stored');
r=steady(a4p,10);if(r.advance){/* span of 7*80 is enough */}
{let q={state:P.emptyState(),advance:false};for(let i=0;i<6;i++)q=P.applySample(q.state,a4p,{midi:69,cents:10},i*20);a.equal(q.advance,false,'a short blip is not a steady reading')}
const tgt=P.targetFreq(21,P.curveFor('studio').cents[21],440);
const folded=P.interpretFreq(tgt*2,21,tgt);a.ok(folded.folded&&Math.abs(folded.cents)<5,'A0 overtone folds to the fundamental');
const kept=P.interpretFreq(440,69,440);a.ok(!kept.folded&&Math.abs(kept.cents)<1);
a.equal(P.allowPrescan({now:1000,gotUntil:0,settleUntil:0,prevFreq:27.5,freq:27.6,attack:false}),false);
a.equal(P.allowPrescan({now:1000,gotUntil:0,settleUntil:0,prevFreq:27.5,freq:27.6,attack:true}),true);
a.equal(P.allowPrescan({now:200,gotUntil:700,prevFreq:0,freq:30,attack:true}),false);
const hi=P.meterView(80),lo=P.meterView(-120);a.ok(hi.text.indexOf('+80.0')===0&&!hi.past&&hi.pct>50&&hi.pct<100);a.ok(lo.text.indexOf('-120.0')===0&&!lo.past&&lo.pct>0&&lo.pct<50);a.ok(P.meterView(250).past);
a.equal(P.needsPitchRaise({69:{cents:-2,confidence:'high'},21:{cents:null,confidence:'unread'}}),false);
a.equal(P.needsPitchRaise({69:{cents:-20,confidence:'high'}}),true);
console.log('pianotune ok');
