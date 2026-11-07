// Interval partial beats: spectral difference, not single-note YIN.
const a=require('assert');const P=require('../pianotune.js');
function synth(sr,sec,tones,opt){
 opt=opt||{};const n=Math.floor(sr*sec),x=new Float32Array(n),tau=opt.tau==null?8:opt.tau;
 for(let i=0;i<n;i++){const t=i/sr,env=Math.exp(-t/tau);let s=0;
  tones.forEach(tn=>{s+=(tn.amp==null?0.2:tn.amp)*Math.sin(2*Math.PI*tn.f*t)});
  x[i]=s*env;if(opt.noise)x[i]+=(Math.random()*2-1)*opt.noise}
 let m=0;for(let i=0;i<n;i++)m=Math.max(m,Math.abs(x[i]));
 if(m>0&&!opt.raw)for(let i=0;i<n;i++)x[i]*=0.35/m;
 return x}
function pair(low,high,notes){
 return{pairs:[{fa:180,fb:220,p:5,q:4,low,high,label:'F3-A3',kind:'M3'}],notes:notes||[]}}
const sr=48000;
function run(buf,q){const t=process.hrtime.bigint();const r=P.analyzeIntervalAudio(buf,sr,q);const ms=Number(process.hrtime.bigint()-t)/1e6;r.computeMs=ms;return r}
// Pairing: major third is partial 5 against 4, and stiffness changes the model rate.
const z={};for(let m=21;m<=108;m++)z[m]=0;
const ez=P.expectedBeat(z,()=>0,440,53,'M3');
a.equal(ez.p,5);a.equal(ez.q,4);a.equal(ez.kind,'M3');
const fa=P.etFreq(53,440),fb=P.etFreq(57,440);
a.ok(Math.abs(ez.harmonic-Math.abs(5*fa-4*fb))<1e-6);
a.ok(Math.abs(ez.beat-ez.harmonic)<1e-6);
const sp=P.expectedBeat(P.curveFor('spinet').cents,m=>P.bOf(P.SIZES.spinet,m),440,53,'M3');
a.ok(Math.abs(sp.beat-sp.harmonic)>0.15,'size model is not the harmonic model');
a.equal(P.expectedBeat(z,()=>0,440,57,'P4').p,4);
a.equal(P.expectedBeat(z,()=>0,440,57,'P4').q,3);
a.equal(P.expectedBeat(z,()=>0,440,57,'P5').p,3);
a.equal(P.expectedBeat(z,()=>0,440,57,'P5').q,2);
a.equal(P.expectedBeat(z,()=>0,440,53,'M6').p,5);
a.equal(P.expectedBeat(z,()=>0,440,53,'M6').q,3);
a.equal(P.INTERVALS.unison,undefined);
// Known partial differences.
[3,7,12].forEach(rate=>{
 const r=run(synth(sr,1.2,[{f:880},{f:880+rate}]),pair(880,880));
 a.equal(r.status,'ok',rate+' '+r.reason);
 a.equal(r.confidence,'high');
 a.ok(Math.abs(r.beat-rate)<0.45,rate+' got '+r.beat);
 a.ok(r.computeMs<400,r.computeMs);
});
// Decay and a small inharmonic shift still report the actual difference.
{const r=run(synth(sr,1.2,[{f:900},{f:907}],{tau:0.4}),pair(900,900));
 a.equal(r.status,'ok');a.ok(Math.abs(r.beat-7)<0.7,r.beat)}
{const B=0.0005,f1=198,f2=250;
 const lo=P.partialFreq(f1,5,B),hi=4*f2;
 const r=run(synth(sr,1.2,[{f:lo},{f:hi}]),pair(5*f1,hi));
 a.equal(r.status,'ok',r.reason);
 a.ok(Math.abs(r.beat-Math.abs(lo-hi))<0.6,r.beat+' vs '+Math.abs(lo-hi));
 a.ok(Math.abs(r.beat-Math.abs(5*f1-hi))>1,'measured is not the zero-stiffness rate')}
// Detuning the upper partial moves the measured rate.
{const a7=run(synth(sr,1.2,[{f:1000},{f:1007}]),pair(1000,1000));
 const a9=run(synth(sr,1.2,[{f:1000},{f:1009}]),pair(1000,1000));
 a.ok(Math.abs(a9.beat-a7.beat-2)<0.7,a7.beat+' '+a9.beat)}
// Confounders withhold a result and never look like a pass.
a.equal(run(new Float32Array(sr),pair(880,880)).reason,'silence');
a.equal(run(synth(sr,0.2,[{f:880},{f:887}]),pair(880,880)).reason,'short');
a.equal(run(synth(sr,1.2,[{f:880}]),pair(880,880)).reason,'missing-partial');
a.equal(run(synth(sr,1.2,[{f:880,amp:0.02},{f:887,amp:0.02}],{noise:2,raw:true}),pair(880,880)).status,'uncertain');
a.equal(P.analyzeIntervalAudio(synth(8000,0.5,[{f:200},{f:202}]),8000,pair(200,200)).reason,'resolution');
a.equal(run(synth(sr,1.2,[{f:262},{f:330},{f:392}]),{pairs:pair(880,880).pairs,notes:[262,330,392]}).reason,'three-notes');
a.equal(P.analyzeIntervalAudio(synth(sr,1.2,[{f:440},{f:443}]),sr,{pairs:[{fa:440,fb:440,p:1,q:1,low:440,high:440,label:'A4 unison',kind:'unison'}]}).reason,'unsupported');
{const two={pairs:[
  {fa:180,fb:220,p:5,q:4,low:700,high:700,label:'one',kind:'M3'},
  {fa:200,fb:260,p:5,q:4,low:900,high:900,label:'two',kind:'M3'}],notes:[]};
 const r=run(synth(sr,1.2,[{f:700},{f:707},{f:900},{f:909}]),two);
 a.equal(r.reason,'ambiguous')}
// A clean reading is not a license to pass. The result carries the rate only.
{const r=run(synth(sr,1.2,[{f:880},{f:887}]),pair(880,880));
 a.equal(r.status,'ok');a.ok(!r.pass)}
console.log('interval beats ok');
