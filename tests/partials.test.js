const a=require('assert');const P=require('../partials.js');
function cent(hz,ref){return 1200*Math.log2(hz/ref)}
// The two formulas name different fundamentals and must agree.
const f1=440,B=0.0004,f0=P.f0FromF1(f1,B);
a.ok(Math.abs(P.f1FromF0(f0,B)-f1)<1e-9);
for(const n of [1,2,3,5,8]){
 a.ok(Math.abs(P.partialFromF0(f0,n,B)-P.partialFromF1(f1,n,B))<1e-6,n);
 a.ok(n===1||P.partialFromF0(f0,n,B)>n*f0);
}
const rows=[];
function once(tag,opts){
 const t0=process.hrtime.bigint();
 const buf=P.synthNote(48000,1.1,opts.f1,opts.B,opts.ns,opts);
 const r=P.analyzeSingleNote(buf,48000,{hintHz:opts.hint||opts.f1,midi:opts.midi==null?69:opts.midi,a4:440});
 r.ms=Number(process.hrtime.bigint()-t0)/1e6;
 rows.push(tag+' f1c='+(r.f1?cent(r.f1,opts.f1).toFixed(3):'na')+' B='+(r.B||0).toExponential(3)+' status='+r.bStatus+' conf='+r.confidence+' rings='+r.partials.map(p=>p.n).join(',')+' ms='+r.ms.toFixed(1)+' reason='+r.reason);
 return r}
const mid=once('A4',{f1:440,B:0.0004,ns:[1,2,3,4,5,6],midi:69});
a.equal(mid.f1Heard,true);
a.ok(mid.partials.some(p=>p.n===1));
a.equal(mid.bStatus,'measured');
a.ok(Math.abs(cent(mid.f1,440))<1,cent(mid.f1,440));
a.ok(Math.abs(mid.B/0.0004-1)<0.15,mid.B);
a.ok(mid.ms<500,mid.ms);
const low=once('A2',{f1:110,B:0.0008,ns:[1,2,3,4,5],midi:45,hint:110});
a.equal(low.bStatus,'measured');
a.ok(Math.abs(cent(low.f1,110))<1.5,cent(low.f1,110));
a.ok(Math.abs(low.B/0.0008-1)<0.2,low.B);
const miss=once('no1',{f1:440,B:0.0004,ns:[2,3,4,5,6],midi:69});
a.equal(miss.f1Heard,false);
a.ok(!miss.partials.some(p=>p.n===1),'ring 1 must not be invented');
a.equal(miss.bStatus,'measured');
const decay=once('decay',{f1:440,B:0.00035,ns:[1,2,3,4,5],tau:0.45,midi:69});
a.equal(decay.bStatus,'measured');
a.ok(Math.abs(cent(decay.f1,440))<1.5);
const sharp=once('sharp',{f1:440*Math.pow(2,12/1200),B:0.0003,ns:[1,2,3,4,5,6],midi:69,hint:440});
const p1=sharp.partials.find(p=>p.n===1);
a.ok(p1&&p1.cents>8&&p1.cents<16,p1&&p1.cents);
const noisy=P.analyzeSingleNote(P.synthNote(48000,1.1,440,0.0004,[1,2,3,4,5],{noise:40,raw:true,seed:9}),48000,{hintHz:440,midi:69,a4:440});
a.equal(noisy.bStatus,'withheld');
const chordBuf=P.synthNote(48000,1.1,440,0.0003,[1,2,3,4],{seed:2});
const other=P.synthNote(48000,1.1,554,0.0003,[1,2,3,4],{seed:4});
for(let i=0;i<chordBuf.length;i++)chordBuf[i]+=other[i];
const chord=P.analyzeSingleNote(chordBuf,48000,{hintHz:440,midi:69,a4:440});
a.equal(chord.reason,'chord');
a.equal(chord.partials.length,0);
const treble=once('treble',{f1:1760,B:0.002,ns:[1,2],midi:93,hint:1760});
a.equal(treble.bStatus,'withheld');
a.ok(treble.partials.length<=2);
a.ok(!treble.partials.some(p=>p.n>2));
const line=P.listenLine('A4',{partials:[{n:2}],f1Heard:false,note:'A4'});
a.ok(line.plain.indexOf('Play A4 alone')>=0&&line.plain.indexOf('overtones')>=0);
a.ok(line.detail.indexOf('ring 1')>=0);
const none=P.listenLine('',null);
a.ok(none.plain.indexOf('Tap a key')>=0);
const stretchNone=P.experimentalStretch([{midi:69,B:0.0004,bStatus:'measured'}],440);
a.equal(stretchNone.status,'unavailable');
const stretch=P.experimentalStretch([
 {midi:45,B:0.0005,bStatus:'measured'},
 {midi:69,B:0.0003,bStatus:'measured'},
 {midi:93,B:0.001,bStatus:'measured'}
],440);
a.equal(stretch.status,'experimental');
const a4=stretch.points.find(p=>p.midi===69);
a.ok(a4&&Math.abs(a4.cents)<1e-6&&a4.source==='measured');
const a6=stretch.points.find(p=>p.midi===93);
a.ok(a6&&a6.cents!=null&&a6.source==='measured');
const a0=stretch.points.find(p=>p.midi===21);
a.equal(a0.source,'unavailable');
console.log(rows.join('\n'));
console.log('partials ok');
