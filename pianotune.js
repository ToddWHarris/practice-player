// v34 Guided piano tune.
// Stretch for Typical is the existing Fernhart-attributed anchor table (sourced) with smoothstep fills (derived).
// Concert grand, baby grand, studio upright and spinet curves are derived, not copied from a tuner product.
// Model: Fletcher 1964 partials, a 4:2 octave match (aural double-octave test), B larger on shorter pianos (Young 1952).
const PianoTune=(function(){
 const LO=21,HI=108;
 const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
 const TYPICAL=[[21,-12.0],[24,-8.9],[36,-3.7],[48,-2.2],[57,-1.7],[60,-1.3],[69,0.0],[72,0.9],[84,6.5],[96,12.9],[108,29.7]];
 // bA4 and bass are inharmonicity coefficients at A4 and in the low bass. exp is how fast B rises with frequency.
 // All three are derived choices inside the published range of B (about 1e-4 to 1e-3), not a measurement of one piano.
 const SIZES={
  concert:{id:'concert',label:'Concert grand (9 ft)',bA4:0.00026,exp:0.95,bass:0.00032},
  baby:{id:'baby',label:'Baby grand',bA4:0.00038,exp:0.95,bass:0.00048},
  studio:{id:'studio',label:'Studio upright',bA4:0.00050,exp:0.95,bass:0.00066},
  spinet:{id:'spinet',label:'Spinet',bA4:0.00072,exp:0.95,bass:0.00100}
 };
 const HOLD_MS=450,TOL=2,RAISE_IF_FLAT=8,OVERPULL=0.25;
 const PRESCAN_WINDOW=700,PRESCAN_SPAN=400,PRESCAN_SPREAD=15,OUTLIER=50,DIFFERENT=600,METER=200,PRESCAN_WAIT=8000,GOT_MS=700;
 const PRESCAN=[];for(let m=21;m<=108;m++)PRESCAN.push(m);
 const FLAT={1:'D flat',3:'E flat',6:'G flat',8:'A flat',10:'B flat'};
 function label(m){m=m|0;return NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1)}
 function isWhite(m){const n=((m%12)+12)%12;return n===0||n===2||n===4||n===5||n===7||n===9||n===11}
 function smoothTypical(midi){
  const m=+midi;if(m<=TYPICAL[0][0])return TYPICAL[0][1];if(m>=TYPICAL[TYPICAL.length-1][0])return TYPICAL[TYPICAL.length-1][1];
  for(let i=0;i<TYPICAL.length-1;i++){const a=TYPICAL[i],b=TYPICAL[i+1];if(m>=a[0]&&m<=b[0]){const t=(m-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s}}
  return 0}
 function bOf(size,midi){
  const f=440*Math.pow(2,(midi-69)/12);
  const shaped=size.bA4*Math.pow(f/440,size.exp);
  const t=Math.max(0,Math.min(1,(midi-28)/36));
  return (1-t)*Math.max(shaped,size.bass)+t*shaped}
 function octave42(Bm,Bu){
  const s4=Math.sqrt((1+16*Bm)/(1+Bm)),s2=Math.sqrt((1+4*Bu)/(1+Bu));
  return 1200*Math.log2(s4/s2)}
 function sizeCurve(size){
  const c={69:0},origin={69:'derived'};
  for(let m=69;m<HI;m++){c[m+1]=c[m]+octave42(bOf(size,m),bOf(size,Math.min(HI,m+12)))/12;origin[m+1]='derived'}
  for(let m=69;m>LO;m--){c[m-1]=c[m]-octave42(bOf(size,Math.max(LO,m-12)),bOf(size,m))/12;origin[m-1]='derived'}
  return{cents:c,origin,b:midi=>bOf(size,midi)}}
 const SIZE_CURVE={};
 Object.keys(SIZES).forEach(id=>{SIZE_CURVE[id]=sizeCurve(SIZES[id])});
 function typicalCurve(){
  const cents={},origin={};
  const anchors={};TYPICAL.forEach(p=>{anchors[p[0]]=p[1]});
  for(let m=LO;m<=HI;m++){
   if(anchors[m]!=null){cents[m]=anchors[m];origin[m]='sourced'}
   else{cents[m]=smoothTypical(m);origin[m]='derived'}
  }
  return{cents,origin,b:null}}
 function curveFor(typeId,profile){
  if(typeId==='typical')return typicalCurve();
  if(SIZES[typeId])return SIZE_CURVE[typeId];
  if(MODELS[typeId])return null;
  if(String(typeId).indexOf('profile:')===0&&profile&&profile.curve){
   const cents={},origin={};
   for(let m=LO;m<=HI;m++){
    const v=profile.curve[m];
    cents[m]=isFinite(v)?+v:0;
    origin[m]=(profile.samples&&profile.samples[m]!=null)?'sourced':'derived'}
   return{cents,origin,b:null}}
  return typicalCurve()}
 function etFreq(midi,a4){return a4*Math.pow(2,(midi-69)/12)}
 function targetFreq(midi,cents,a4){return etFreq(midi,a4)*Math.pow(2,(cents||0)/1200)}
 function partialFreq(f1,n,B){B=B||0;return n*f1*Math.sqrt((1+B*n*n)/(1+B))}
 const INTERVALS={M3:{semi:4,p:5,q:4,name:'major third'},P4:{semi:5,p:4,q:3,name:'fourth'},P5:{semi:7,p:3,q:2,name:'fifth'},M6:{semi:9,p:5,q:3,name:'major sixth'},P8:{semi:12,p:4,q:2,name:'octave'}};
 function expectedBeat(curve,bFn,a4,a,kind){
  const spec=INTERVALS[kind];if(!spec)return null;
  const b=a+spec.semi;
  const rawA=curve?curve[a]:0,rawB=curve?curve[b]:0;
  const ca=rawA===undefined?0:(rawA==null||!isFinite(+rawA)?null:+rawA);
  const cb=rawB===undefined?0:(rawB==null||!isFinite(+rawB)?null:+rawB);
  if(ca==null||cb==null)return null;
  const fa=targetFreq(a,ca,a4),fb=targetFreq(b,cb,a4);
  const Ba=bFn?bFn(a):0,Bb=bFn?bFn(b):0;
  const low=partialFreq(fa,spec.p,Ba),high=partialFreq(fb,spec.q,Bb);
  const lowH=partialFreq(fa,spec.p,0),highH=partialFreq(fb,spec.q,0);
  return{a,b,kind,name:spec.name,p:spec.p,q:spec.q,fa,fb,low,high,beat:Math.abs(low-high),harmonic:Math.abs(lowH-highH),label:label(a)+'-'+label(b),model:'size'}}
 function fftMag(frame){
  const n0=frame.length|0;if(n0<32)return null;
  let n=1;while(n<n0)n<<=1;if(n<1024)n=1024;
  const re=new Float64Array(n),im=new Float64Array(n);
  for(let i=0;i<n0;i++){const w=0.5*(1-Math.cos((2*Math.PI*i)/Math.max(1,n0-1)));re[i]=frame[i]*w}
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);
   for(let i=0;i<n;i+=len){let wrk=1,wik=0;const half=len>>1;
    for(let k=0;k<half;k++){const ur=re[i+k],ui=im[i+k],vr=re[i+k+half]*wrk-im[i+k+half]*wik,vi=re[i+k+half]*wik+im[i+k+half]*wrk;
     re[i+k]=ur+vr;im[i+k]=ui+vi;re[i+k+half]=ur-vr;im[i+k+half]=ui-vi;
     const nr=wrk*wr-wik*wi;wik=wrk*wi+wik*wr;wrk=nr}}}
  const mag=new Float64Array(n>>1);
  for(let i=0;i<mag.length;i++)mag[i]=Math.hypot(re[i],im[i]);
  return{mag,n,n0}}
 function localPeaks(spec,sr,f0,halfHz){
  if(!spec||!(f0>0))return [];
  const mag=spec.mag,binHz=sr/spec.n;
  const i0=Math.max(1,Math.round((f0-halfHz)/binHz)),i1=Math.min(mag.length-2,Math.round((f0+halfHz)/binHz));
  const out=[];
  for(let i=i0;i<=i1;i++){
   if(!(mag[i]>=mag[i-1]&&mag[i]>=mag[i+1])||!(mag[i]>0))continue;
   const a=mag[i-1],b=mag[i],c=mag[i+1],den=a-2*b+c;
   let d=0;if(Math.abs(den)>1e-12)d=Math.max(-0.5,Math.min(0.5,(a-c)/(2*den)));
   const vals=[];
   for(let k=Math.max(1,i-36);k<=Math.min(mag.length-1,i+36);k++)if(Math.abs(k-i)>3)vals.push(mag[k]);
   vals.sort((x,y)=>x-y);
   const med=vals.length?vals[vals.length>>1]:0;
   out.push({freq:(i+d)*binHz,mag:b,snr:med>1e-12?b/med:999})}
  out.sort((x,y)=>y.mag-x.mag);
  return out}
 function peakNear(spec,sr,f0,halfHz){
  if(!spec||!(f0>0))return null;
  const mag=spec.mag,binHz=sr/spec.n;
  let i0=Math.max(1,Math.round((f0-halfHz)/binHz)),i1=Math.min(mag.length-2,Math.round((f0+halfHz)/binHz));
  if(i1<=i0+1)return null;
  let best=i0,bestM=-1;
  for(let i=i0;i<=i1;i++)if(mag[i]>bestM){bestM=mag[i];best=i}
  if(!(mag[best]>=mag[best-1]&&mag[best]>=mag[best+1]))return null;
  const a=mag[best-1],b=mag[best],c=mag[best+1],den=a-2*b+c;
  let d=0;if(Math.abs(den)>1e-12)d=Math.max(-0.5,Math.min(0.5,(a-c)/(2*den)));
  const vals=[];
  for(let i=Math.max(1,best-36);i<=Math.min(mag.length-1,best+36);i++)if(Math.abs(i-best)>3)vals.push(mag[i]);
  vals.sort((x,y)=>x-y);
  const med=vals.length?vals[vals.length>>1]:0;
  return{freq:(best+d)*binHz,mag:bestM,snr:med>1e-12?bestM/med:999}}
 function strongFundamentals(spec,sr,funds){
  let best=0;const hits=[];
  (funds||[]).forEach(f=>{const pk=peakNear(spec,sr,f,Math.max(8,f*0.02));if(pk&&pk.snr>=5){hits.push(pk);if(pk.mag>best)best=pk.mag}});
  if(!(best>0))return 0;
  return hits.filter(pk=>pk.mag>=best*0.45).length}
 function analyzeIntervalAudio(samples,sampleRate,query){
  query=query||{};const sr=+sampleRate,n0=samples?samples.length|0:0;
  const blank=(reason)=>({status:'uncertain',confidence:'uncertain',reason,beat:null,label:'',pair:null,resolutionHz:n0>0&&sr>0?sr/n0:null,windowSec:sr>0?n0/sr:0});
  if(!query.pairs||!query.pairs.length)return blank('unsupported');
  const pairs=query.pairs.filter(p=>p&&p.p>p.q);
  if(!pairs.length)return blank('unsupported');
  if(!(sr>=8000)||n0<32)return blank('short');
  let e=0;for(let i=0;i<n0;i++)e+=samples[i]*samples[i];
  const rms=Math.sqrt(e/Math.max(1,n0));
  if(!(rms>0.004))return blank('silence');
  const windowSec=n0/sr,resolutionHz=sr/n0;
  if(windowSec<0.45)return Object.assign(blank('short'),{resolutionHz,windowSec,rms});
  const spec=fftMag(samples);if(!spec)return blank('short');
  const funds=query.notes||[];
  if(strongFundamentals(spec,sr,funds)>=3)return Object.assign(blank('three-notes'),{resolutionHz,windowSec,rms});
  const found=[];let unresolved=null,sawOne=false;
  for(let pi=0;pi<pairs.length;pi++){
   const pair=pairs[pi];if(!(pair.fa>0)||!(pair.fb>0))continue;
   const expectLo=pair.low||partialFreq(pair.fa,pair.p,0),expectHi=pair.high||partialFreq(pair.fb,pair.q,0);
   const center=(expectLo+expectHi)/2;
   const half=Math.min(Math.max(20,center*0.04),Math.max(pair.fa,pair.fb)*0.45);
   const peaks=localPeaks(spec,sr,center,half).filter(pk=>pk.snr>=3.2);
   if(peaks.length>=1)sawOne=true;
   if(peaks.length<2||peaks[1].mag<peaks[0].mag*0.15)continue;
   const lo=peaks[0],hi=peaks[1];
   const beat=Math.abs(lo.freq-hi.freq);
   const sepBins=beat/resolutionHz;
   const snr=Math.min(lo.snr,hi.snr);
   if(sepBins<2.2){unresolved=Object.assign(blank('resolution'),{resolutionHz,windowSec,rms,lowHz:lo.freq,highHz:hi.freq});continue}
   if(!(snr>=6&&sepBins>=3)){unresolved=Object.assign(blank('noise'),{resolutionHz,windowSec,rms});continue}
   found.push({status:'ok',confidence:'high',reason:'ok',beat,label:pair.label||'',pair:pair.kind||null,p:pair.p,q:pair.q,lowHz:lo.freq,highHz:hi.freq,resolutionHz,windowSec,rms,snr})}
  if(!found.length){
   if(unresolved)return unresolved;
   const reason=sawOne?'missing-partial':(rms>0.02?'noise':'missing-partial');
   return Object.assign(blank(reason),{resolutionHz,windowSec,rms})}
  if(found.length>1)return Object.assign(blank('ambiguous'),{resolutionHz,windowSec,rms});
  return found[0]}
 function synthUnison(sr,sec,voices,opt){
  opt=opt||{};const n=Math.floor(sr*sec),x=new Float32Array(n),tau=opt.tau==null?1.4:opt.tau;
  let seed=opt.seed||5;
  for(let i=0;i<n;i++){const t=i/sr,env=Math.exp(-t/Math.max(0.05,tau));let s=0;
   (voices||[]).forEach(v=>{const B=v.B||0,amp=v.amp==null?1:v.amp,ns=v.partials||[1,2,3,4,5,6];
    ns.forEach(k=>{s+=(amp/k)*Math.sin(2*Math.PI*partialFreq(v.f1,k,B)*t)})});
   if(opt.noise){seed=(seed*16807)%2147483647;s+=((seed/2147483647)*2-1)*opt.noise}
   x[i]=s*env}
  if(!opt.raw){let m=0;for(let i=0;i<n;i++)m=Math.max(m,Math.abs(x[i]));if(m>0)for(let i=0;i<n;i++)x[i]*=0.3/m}
  return x}
 function analyzeUnison(samples,sampleRate,opts){
  opts=opts||{};const sr=+sampleRate,n0=samples?samples.length|0:0,f1=+opts.f1,strings=opts.strings===3?3:2;
  const searchB=+opts.searchB||0;
  const blank=(reason)=>({status:'uncertain',confidence:'uncertain',reason,strings,partials:[],fundamentalBeat:null,pattern:null,summary:'',pass:false,resolutionHz:n0>0&&sr>0?sr/Math.max(1,n0):null,windowSec:sr>0?n0/sr:0});
  if(!(f1>20))return blank('unsupported');
  if(!(sr>=8000)||n0<32)return blank('short');
  let e=0;for(let i=0;i<n0;i++)e+=samples[i]*samples[i];
  const rms=Math.sqrt(e/Math.max(1,n0));
  if(!(rms>0.004))return blank('silence');
  const windowSec=n0/sr,resolutionHz=sr/Math.max(1,n0);
  if(windowSec<0.45)return Object.assign(blank('short'),{resolutionHz,windowSec,rms});
  const spec=fftMag(samples);if(!spec)return blank('short');
  const partials=[];
  for(let n=1;n<=6;n++){
   const center=partialFreq(f1,n,searchB);
   const half=Math.min(Math.max(8,10*n),f1*0.35);
   let peaks=localPeaks(spec,sr,center,half).filter(pk=>pk.snr>=4);
   const kept=[];
   peaks.forEach(pk=>{
    if(kept.some(k=>Math.abs(k.freq-pk.freq)<resolutionHz*2.2))return;
    if(kept.length&&pk.mag<kept[0].mag*0.18)return;
    kept.push(pk)});
   const strongAll=kept.filter(pk=>pk.snr>=6);
   const strong=(strongAll.length>strings?strongAll:strongAll.slice()).sort((a,b)=>a.freq-b.freq);
   const pairs=[];
   for(let i=0;i<strong.length;i++)for(let j=i+1;j<strong.length;j++){
    const beat=Math.abs(strong[i].freq-strong[j].freq);
    pairs.push({a:i,b:j,beatHz:beat,resolved:beat/resolutionHz>=3})}
   const resolved=pairs.filter(p=>p.resolved);
   let state='unresolved';
   if(strong.length>strings)state='ambiguous';
   else if(resolved.length)state='measured';
   else if(strong.length>=2)state='too-close';
   else if(strong.length===1)state='one-peak';
   partials.push({n,center,peaks:strong.map(pk=>({hz:pk.hz||pk.freq,snr:pk.snr})),pairs,state})}
  const usable=partials.filter(p=>p.state==='measured');
  const p1=partials.find(p=>p.n===1);
  const b1=p1&&p1.pairs.filter(p=>p.resolved).map(p=>p.beatHz).sort((a,b)=>a-b);
  const fundamentalBeat=b1&&b1.length?b1[b1.length>>1]:null;
  let pattern=null;
  if(fundamentalBeat&&fundamentalBeat>resolutionHz*3){
   let seen=0,agree=0;
   usable.filter(p=>p.n>1).forEach(p=>{
    const beats=p.pairs.filter(x=>x.resolved).map(x=>x.beatHz).sort((a,b)=>a-b);
    if(!beats.length)return;seen++;
    const mid=beats[beats.length>>1];
    if(Math.abs(mid/p.n-fundamentalBeat)/fundamentalBeat<0.4)agree++});
   if(seen&&agree>=Math.ceil(seen*0.5))pattern='offset'}
  const higher=partials.filter(p=>p.n>=3&&p.state==='measured'&&p.pairs.some(x=>x.resolved&&x.beatHz>2));
  if(!pattern&&(!fundamentalBeat||fundamentalBeat<resolutionHz*3)&&higher.length>=2)pattern='higher-partials';
  if(partials.some(p=>p.state==='ambiguous')&&usable.length<2)return Object.assign(blank('ambiguous'),{resolutionHz,windowSec,rms,partials,summary:'More tones stood out than the strings of this note. Mute anything you are not matching.'});
  if(!usable.length){
   const reason=partials.some(p=>p.state==='too-close')?'resolution':(partials.some(p=>p.state==='one-peak')?'one-string':(rms>0.02?'noise':'weak-partial'));
   const summary=reason==='resolution'?'The strings are too close, or the window is too short, to separate a beat.':reason==='one-string'?'Only one tone stood out. The other string may be muted, or the beats are too slow to split.':'The overtones were not clear enough.';
   return Object.assign(blank(reason),{resolutionHz,windowSec,rms,partials,summary})}
  let summary;
  const rate=fundamentalBeat!=null?fundamentalBeat.toFixed(1):null;
  if(pattern==='offset'&&rate)summary='Partial 1 beats about '+rate+' times a second. Higher overtones beat about that many times their number, which fits one string shifted in pitch. Stretch did not ask for that gap.';
  else if(pattern==='higher-partials')summary='The lower overtones were not split, and higher overtones are beating. That can be different stiffness, or beats too slow to see down low. It is not a pass and not a fail.';
  else if(rate)summary='Partial 1 beats about '+rate+' times a second. The higher overtones do not clearly confirm a single pitch shift.';
  else summary='Some overtones show beats. The partials do not agree on one cause.';
  const confidence=(pattern==='offset'||pattern==='higher-partials')&&usable.length>=2?'high':'low';
  return {status:'ok',confidence,reason:'ok',strings,partials,fundamentalBeat,pattern,summary,pass:false,resolutionHz,windowSec,rms}}
 function measureBeats(frames,dt){
  if(!frames||frames.length<12||!(dt>0))return null;
  const n=frames.length;let mean=0;for(let i=0;i<n;i++)mean+=frames[i];mean/=n;
  const a=new Array(n);let energy=0;
  for(let i=0;i<n;i++){a[i]=frames[i]-mean;energy+=a[i]*a[i]}
  if(energy<1e-6)return null;
  const minL=Math.max(1,Math.round(0.04/dt)),maxL=Math.min(n-2,Math.round(1.2/dt));
  let best=0,bestL=0;
  for(let lag=minL;lag<=maxL;lag++){let s=0,c=0;for(let i=0;i+lag<n;i++){s+=a[i]*a[i+lag];c++}const r=c?s/c:0;if(r>best){best=r;bestL=lag}}
  if(!(bestL>0)||best<0.15*(energy/n))return null;
  return 1/(bestL*dt)}
 function plainName(midi){midi=midi|0;const n=((midi%12)+12)%12,oct=Math.floor(midi/12)-1;return (FLAT[n]||NAMES[n])+' '+oct}
 function asReading(v){
  if(v==null)return null;
  if(typeof v==='number')return isFinite(v)?{cents:v,confidence:'high'}:null;
  if(!v||v.confidence==='unread'||!isFinite(v.cents))return null;
  return v}
 function weightOf(r){return r&&r.confidence==='low'?0.25:1}
 function weightedAvg(prescan){
  let s=0,w=0;
  for(const k in prescan||{}){const r=asReading(prescan[k]);if(!r)continue;const wt=weightOf(r);s+=r.cents*wt;w+=wt}
  return w?s/w:null}
 function needsPitchRaise(prescan){const avg=weightedAvg(prescan);return avg!=null&&avg<=-RAISE_IF_FLAT}
 function averageFlat(prescan){const avg=weightedAvg(prescan);return avg==null?0:avg}
 function nearestMeasured(prescan,midi){
  let best=null,score=1e9;
  for(const k in prescan||{}){const r=asReading(prescan[k]);if(!r)continue;const d=Math.abs((+k)-midi)+(r.confidence==='low'?12:0);if(d<score){score=d;best=r.cents}}
  return best==null?averageFlat(prescan):best}
 function centsBetween(f,target){return 1200*Math.log2(f/target)}
 function interpretFreq(freq,midi,targetHz){
  if(!(freq>0)||!(targetHz>0))return null;
  let best=freq,bestAbs=Math.abs(centsBetween(freq,targetHz));
  const folds=midi<=45?[2,3,4]:[2];
  for(const n of folds){const f=freq/n;if(f<20)continue;const err=Math.abs(centsBetween(f,targetHz));if(err+30<bestAbs){best=f;bestAbs=err}}
  const cents=centsBetween(best,targetHz);
  return{freq:best,cents,folded:best!==freq,other:Math.abs(cents)>DIFFERENT}}
 function isRing(freq,prevFreq){if(!(freq>0)||!(prevFreq>0))return false;return Math.abs(centsBetween(freq,prevFreq))<45}
 function allowPrescan(o){
  o=o||{};
  if(o.gotUntil&&o.now<o.gotUntil)return false;
  if(isRing(o.freq,o.prevFreq)&&!o.attack)return false;
  if(o.settleUntil&&o.prevFreq&&o.now<o.settleUntil&&!o.attack)return false;
  return true}
 function confidenceFor(midi,spread){return(midi<=33||midi>=96||spread>8)?'low':'high'}
 function meterView(cents){
  if(typeof cents!=='number'||!isFinite(cents))return{text:'--',pct:50,past:false};
  const past=Math.abs(cents)>METER,shown=Math.max(-METER,Math.min(METER,cents));
  const text=(cents>=0?'+':'')+cents.toFixed(1)+' cents'+(past?(cents>0?' (past +200)':' (past -200)'):'');
  return{text,pct:(shown+METER)/(2*METER)*100,past}}
 function overpullTarget(finalCents,measured){
  const flat=Math.max(0,-(+measured||0));
  return (+finalCents||0)+OVERPULL*flat}
 function promptFor(phase,midi){
  const n=label(midi);
  if(phase==='a4')return 'Mute the outer strings of '+n+'. Tune the center string to '+n+' at the goal pitch, then match the unisons.';
  if(phase==='temper')return 'Mute the outer strings of '+n+'. Tune the center string, then tune the unisons to it.';
  if(phase==='up'||phase==='down')return 'Tune '+n+' from the octave already set. Mute, set the center string, then match the unisons.';
  if(phase==='raise')return 'Pitch raise. Tune every string of '+n+' to the overpull pitch, a little sharp of the final pitch, then move on.';
  if(phase==='fine')return 'Fine pass. Touch up '+n+' to the final pitch, including the unisons.';
  return 'Play '+n+' and hold it.'}
 function step(partial){partial.midis=partial.midis||[partial.midi];return partial}
 function buildSequence(opts){
  opts=opts||{};const raise=!!opts.raise;const steps=[];
  const order=opts.temperament==='f3f4'?'f3f4':'a2a4';
  PRESCAN.forEach(m=>steps.push(step({phase:'prescan',midi:m,title:'Pre-scan '+label(m),prompt:'Play '+plainName(m)+' and hold it. A steady reading is saved however sharp or flat it is. If it cannot be read, the scan moves on.'})));
  if(raise)for(let m=LO;m<=HI;m++)steps.push(step({phase:'raise',midi:m,title:'Pitch raise '+label(m),prompt:promptFor('raise',m)}));
  const skeleton=order==='f3f4'?[69,57,53,61,65]:[69,57,45,49,53,61,65];
  skeleton.forEach(m=>steps.push(step({phase:m===69?'a4':'temper',midi:m,title:(m===69?'Set ':'Tune ')+label(m),prompt:promptFor(m===69?'a4':'temper',m)})));
  steps.push(step({phase:'check',title:'Progressive thirds',prompt:'Play two notes of one pair and hold them. F3 with A3, then A3 with C sharp 4, then C sharp 4 with F4. The app reads partials for that pair. It does not pass the step. Tap Done after you have read the numbers.',midis:[53,57,61,65],intervals:[{a:53,kind:'M3'},{a:57,kind:'M3'},{a:61,kind:'M3'}]}));
  [62,55,60,64,59,54,56,58,63].forEach(m=>steps.push(step({phase:'temper',midi:m,title:'Tune '+label(m),prompt:promptFor('temper',m)})));
  steps.push(step({phase:'check',title:'Check fourth, fifth and sixth',prompt:'Play two notes of one pair and hold them. This step cannot read three notes at once. The numbers are models plus a partial reading. They are not a pass. Tap Done after you have read them.',midis:[57,62,64,53],intervals:[{a:57,kind:'P4'},{a:57,kind:'P5'},{a:53,kind:'M6'}]}));
  for(let m=66;m<=HI;m++)steps.push(step({phase:'up',midi:m,title:'Treble '+label(m),prompt:promptFor('up',m)}));
  for(let m=52;m>=LO;m--)steps.push(step({phase:'down',midi:m,title:'Bass '+label(m),prompt:promptFor('down',m)}));
  for(let m=LO;m<=HI;m++)steps.push(step({phase:'fine',midi:m,title:'Fine '+label(m),prompt:promptFor('fine',m)}));
  steps.forEach((s,i)=>{s.index=i});
  return steps}
 function emptyState(){return{step:0,holdStart:null,holdMidi:null,green:{},hist:[],prescan:{},lean:0,outSince:null}}
 function applySample(state,step,sample,now){
  const s=Object.assign({},state,{green:Object.assign({},state.green),hist:(state.hist||[]).slice(),prescan:Object.assign({},state.prescan)});
  let chime=false,advance=false,lean=0,color='next';
  if(!step||!sample||!isFinite(sample.cents)||!isFinite(sample.midi)){s.holdStart=null;s.lean=0;return{state:s,chime,advance,lean:0,color:'idle'}}
  const midi=sample.midi|0,cents=+sample.cents;
  if(step.phase==='prescan'){
   if(Math.abs(cents)>DIFFERENT){s.lean=0;return{state:s,chime:false,advance:false,lean:0,color:'idle',midi}}
   const t=isFinite(now)?now:0;
   s.hist.push({c:cents,t});
   s.hist=s.hist.filter(h=>t-(h.t||0)<=PRESCAN_WINDOW);
   if(s.hist.length>=5){
    const sorted=s.hist.map(h=>h.c).sort((a,b)=>a-b);
    const med=sorted[sorted.length>>1];
    const inliers=s.hist.filter(h=>Math.abs(h.c-med)<=OUTLIER);
    if(inliers.length>=5){
     const ic=inliers.map(h=>h.c).sort((a,b)=>a-b);
     const im=ic[ic.length>>1];
     const loI=Math.floor((ic.length-1)*0.15),hiI=Math.min(ic.length-1,Math.max(0,Math.ceil(ic.length*0.85)-1));
     const spread=ic[hiI]-ic[loI];
     const span=inliers[inliers.length-1].t-inliers[0].t;
     if(span>=PRESCAN_SPAN&&spread<=PRESCAN_SPREAD){
      s.prescan[midi]={cents:im,confidence:confidenceFor(midi,spread)};
      s.green[midi]=true;advance=true;color='green';s.hist=[]}
     else color='next'}
    else color='next'}
   else color='next';
   s.lean=0;return{state:s,chime:false,advance,lean:0,color,midi}}
  const wanted=step.midis||[step.midi];
  if(wanted.indexOf(midi)<0){s.holdStart=null;s.lean=0;return{state:s,chime,advance,lean:0,color:'idle'}}
  if(midi>=84){
   s.strikes=s.strikes||{};
   const arr=(s.strikes[midi]||[]).concat([cents]).slice(-3);
   s.strikes[midi]=arr;
   const sorted=arr.slice().sort((p,q)=>p-q);
   const med=sorted[sorted.length>>1];
   const spread=sorted[sorted.length-1]-sorted[0];
   if(arr.length>=3&&Math.abs(med)<=TOL&&spread<=3){s.green[midi]=true;color='green';lean=0}
   else {color=Math.abs(cents)<=TOL?'green':'red';lean=cents>0?1:-1}
   s.lean=lean;
   if(wanted.every(m=>s.green[m])){chime=true;advance=true}
   return {state:s,chime,advance,lean,color,midi,strikes:arr.slice()}}
  if(Math.abs(cents)<=TOL){
   if(s.holdMidi!==midi||s.holdStart==null){s.holdMidi=midi;s.holdStart=now}
   s.outSince=null;color='green';lean=0;
   const started=s.holdStart==null?now:s.holdStart;
   if(now-started>=HOLD_MS){s.green[midi]=true;s.holdStart=null}
  }else{
   if(s.outSince==null)s.outSince=now;
   if(now-s.outSince>180){s.holdStart=null;s.holdMidi=null}
   color='red';lean=cents>0?1:-1}
  s.lean=lean;
  if(wanted.every(m=>s.green[m])){chime=true;advance=true}
  return{state:s,chime,advance,lean,color,midi}}
 const SPLITS={concert:{split2:24,split3:53},baby:{split2:26,split3:55},studio:{split2:28,split3:57},spinet:{split2:29,split3:60}};
 const MODELS={'kawai-k200':{id:'kawai-k200',maker:'Kawai',model:'K-200',heightCm:114,widthCm:149,depthCm:57,weightKg:208,speakingNo1Mm:1157,duplex:false,agraffes:false,sources:['https://kawaius.com/products/kawai-k-200-upright-piano','https://www.kawai.co.uk/products/uprightpianos/kseries/k200/'],layoutStart:'studio',layoutNote:'generic-studio-start'}};
 function stringCount(midi,split2,split3){midi=midi|0;if(!(split2<split3))return 1;if(midi<split2)return 1;if(midi<split3)return 2;return 3}
 function pairInfo(iv){
  const spec=INTERVALS[iv&&iv.kind];if(!spec||!(iv.a>=0))return null;
  const b=iv.a+spec.semi;
  return{label:label(iv.a)+'-'+label(b),low:label(iv.a),high:label(b),p:spec.p,q:spec.q,kind:iv.kind}}
 function pairChoices(pairs){
  if(!pairs||!pairs.length)return 'the two notes of this step';
  return pairs.map(p=>p.low+' and '+p.high).join(', or ')}
 function retryListen(reason,pairs){
  const who=pairChoices(pairs);
  if(reason==='three-notes')return 'Too many notes are sounding. Play only '+who+' together.';
  if(reason==='silence')return 'Play '+who+' again and hold them. The sound was too quiet.';
  if(reason==='short')return 'Keep holding '+who+'. The take was too short.';
  if(reason==='missing-partial')return 'Play '+who+' again, a little louder. One overtone was missing.';
  if(reason==='noise')return 'Play '+who+' again. The overtones were muddy.';
  if(reason==='resolution')return 'Hold '+who+' longer. The beats were too slow to separate.';
  if(reason==='ambiguous')return 'Play only one pair: '+who+'.';
  return 'Play '+who+' again and hold them.'}
 function overtoneDetail(pairs){
  if(!pairs||!pairs.length)return '';
  return 'An overtone is a higher tone inside the note. '+pairs.map(p=>p.label+' uses overtone '+p.p+' of '+p.low+' and overtone '+p.q+' of '+p.high+'.').join(' ')}
 function listenCue(step,read){
  if(!step)return {plain:'',detail:'',hearing:''};
  if(step.phase==='prescan')return {plain:'Play '+plainName(step.midi)+' alone and hold it. Listening for this note\'s pitch.',detail:'',hearing:'pitch'};
  if(step.phase==='check'){
   const pairs=(step.intervals||[]).map(pairInfo).filter(Boolean);
   const heard=read&&read.status==='ok'&&read.label?pairs.find(p=>p.label===read.label):null;
   if(heard)return {plain:'Play '+heard.low+' and '+heard.high+' together. Comparing overtones to measure their beats.',detail:overtoneDetail([heard]),hearing:'beats',state:'Heard '+heard.label+'.'};
   if(read&&read.status!=='ok')return {plain:retryListen(read.reason,pairs),detail:overtoneDetail(pairs),hearing:'beats',state:'Not sure yet.'};
   return {plain:'Play two notes together and hold them: '+pairChoices(pairs)+'. Comparing overtones to measure their beats.',detail:overtoneDetail(pairs),hearing:'beats',state:'Listening now.'}}
  const name=step.midi?label(step.midi):'';
  const n=step.stringCount||1,i=step.stringIndex||1;
  if(n>1&&i>1&&name){
   const which=i===n?'this last string':'this string';
   const plain='Let '+name+' '+which+' sound together with the string already set. Mute every string you are not matching. Listening for beats.';
   const detail='Stretch sets this note against other notes. It does not ask these strings to sit apart. A beat through the lower overtones can mean one string is shifted in pitch. Beats that show mainly higher up can come from different stiffness. The numbers are confirmation for your ear. They are not a pass and not a fail.';
   const state=read&&read.summary?read.summary:(read&&read.status==='uncertain'?'Not sure yet.':'Listening now.');
   return {plain,detail,hearing:'unison',state}}
  let mute='This note has one string.';
  if(n>1&&i===1)mute='Mute the other strings so only this one sounds.';
  if(!name)return {plain:mute,detail:'',hearing:'pitch'};
  return {plain:'Play '+name+' alone. '+mute+' Listening for this string\'s pitch.',detail:'',hearing:'pitch'}}
 function stringPrompt(i,n){
  if(n<=1)return 'Tune this string.';
  if(i===1)return 'Tune this string first.';
  if(n===2)return 'Tune the other string to match.';
  if(i===n)return 'Tune the last string to match.';
  return 'Tune the next string to match.'}
 function expandTuning(steps,split2,split3,opts){
  opts=opts||{};const defer=opts.unison==='sanderson';const later=[];const out=[];
  (steps||[]).forEach(s=>{
   if(s.phase==='prescan'){out.push(Object.assign({},s,{stringIndex:1,stringCount:1,lastString:false,waitDone:false}));return}
   if(s.phase==='check'||!s.midi){out.push(Object.assign({},s,{stringIndex:1,stringCount:1,lastString:true,waitDone:true}));return}
   const n=stringCount(s.midi,split2,split3);
   const hold=defer&&(s.phase==='temper'||s.phase==='down');
   const limit=hold?1:n;
   for(let i=1;i<=limit;i++)out.push(Object.assign({},s,{stringIndex:i,stringCount:n,lastString:!hold&&i===n,waitDone:!hold&&i===n,title:s.title+' string '+i+' of '+n,prompt:hold&&i===1?'Leave the strip in. Set this one string. Its unison comes at the end.':stringPrompt(i,n)}));
   if(hold&&n>1)for(let i=2;i<=n;i++)later.push(Object.assign({},s,{phase:'unison',stringIndex:i,stringCount:n,lastString:i===n,waitDone:i===n,title:s.title+' string '+i+' of '+n,prompt:stringPrompt(i,n)}));
  });
  later.forEach(s=>out.push(s));
  out.forEach((s,i)=>{s.index=i});
  return out}
 function upsertProfile(list,rec){
  const a=(list||[]).slice();const i=a.findIndex(p=>p.id===rec.id);
  if(i>=0)a[i]=rec;else a.push(rec);
  a.sort((x,y)=>String(x.name).localeCompare(String(y.name)));
  return a}
 function renameProfile(list,id,name){return (list||[]).map(p=>p.id===id?Object.assign({},p,{name:name}):p)}
 function deleteProfile(list,id){return (list||[]).filter(p=>p.id!==id)}
 function jump(state,index,count){
  const i=Math.max(0,Math.min(count-1,index|0));
  return Object.assign({},state,{step:i,holdStart:null,holdMidi:null,green:{},hist:[],lean:0,outSince:null})}
 const CAL_VERSION=2,CAL_ALGORITHM='cal-4:2-v2';
 const CAL_NOTES=[21,33,45,52,53,57,69,74,81,84,93,96,105,108];
 function stiffnessTrend(meas,side){
  const rows=(meas||[]).filter(s=>s&&s.B>0&&(side==='up'?s.midi>=57:s.midi<=69));
  const fail=(reason,extra)=>({ok:false,reason,side,n:rows.length,k:null,rms:null,a:null,...(extra||{})});
  if(rows.length<3)return fail('few-notes');
  let n=0,sx=0,sy=0,sxx=0,sxy=0;
  rows.forEach(s=>{const x=s.midi-69,y=Math.log(s.B);n++;sx+=x;sy+=y;sxx+=x*x;sxy+=x*y});
  const den=n*sxx-sx*sx;
  if(!(Math.abs(den)>1e-9))return fail('fit');
  const k=(n*sxy-sx*sy)/den,a=(sy-k*sx)/n;
  let err=0;rows.forEach(s=>{const d=Math.log(s.B)-(a+k*(s.midi-69));err+=d*d});
  const rms=Math.sqrt(err/n);
  if(!(k>-0.01&&k<0.12&&rms<0.22))return fail('unstable',{k,rms});
  return {ok:true,reason:'ok',side,n,a,k,rms}}
 function fitPartialB(partials){
  const pts=(partials||[]).filter(p=>p&&p.n>=1&&p.hz>0);
  if(pts.length<3)return {status:'withheld',reason:'few-partials',B:null,f0:null,f1:null,residualCents:null};
  let sw=0,sx=0,sy=0,sxx=0,sxy=0;
  pts.forEach(p=>{const x=p.n*p.n,y=(p.hz/p.n)*(p.hz/p.n),w=Math.max(0.25,Math.min(p.snr||1,20));
   sw+=w;sx+=w*x;sy+=w*y;sxx+=w*x*x;sxy+=w*x*y});
  const den=sw*sxx-sx*sx;
  if(!(Math.abs(den)>1e-18))return {status:'withheld',reason:'fit',B:null,f0:null,f1:null,residualCents:null};
  const A=(sy*sxx-sx*sxy)/den,C=(sw*sxy-sx*sy)/den;
  if(!(A>0))return {status:'withheld',reason:'fit',B:null,f0:null,f1:null,residualCents:null};
  const f0=Math.sqrt(A),B=C/A;
  if(!(B>-0.00005&&B<0.05))return {status:'withheld',reason:'fit',B:null,f0:null,f1:null,residualCents:null};
  const Bb=Math.max(0,B);
  const res=pts.map(p=>Math.abs(1200*Math.log2(p.hz/(p.n*f0*Math.sqrt(1+Bb*p.n*p.n))))).sort((a,c)=>a-c);
  const med=res[res.length>>1];
  if(med>8)return {status:'withheld',reason:'fit',B:Bb,f0,f1:f0*Math.sqrt(1+Bb),residualCents:med};
  return {status:'measured',reason:'ok',B:Bb,f0,f1:f0*Math.sqrt(1+Bb),residualCents:med}}
 function centsBetween(freq,ref){return 1200*Math.log2(freq/ref)}
 function partialSeries(peaks,f1,B0){
  const used={};const found=[];
  for(let n=2;n<=8;n++){
   const pred=partialFreq(f1,n,B0);let best=-1,bestDc=36;
   for(let i=0;i<peaks.length;i++){if(used[i])continue;const dc=Math.abs(centsBetween(peaks[i].freq,pred));if(dc<bestDc){bestDc=dc;best=i}}
   if(best>=0){used[best]=1;found.push({n:n,hz:peaks[best].freq,snr:peaks[best].snr,mag:peaks[best].mag})}}
  return found}
 function seriesScore(found,fit){return found.length*20-fit.residualCents*2}
 function acceptedSeries(found,fit,et){
  if(!found||found.length<3||!found.some(p=>p.n%2===1))return null;
  if(!fit||fit.status!=='measured'||!(fit.f1>0))return null;
  const heard=centsBetween(fit.f1,et);
  if(!(Math.abs(heard)<=90))return null;
  return heard}
 function inferMissingFundamental(spec,sr,et){
  const Bs=[0,0.0002,0.0005,0.0012,0.003,0.008];
  const lo=partialFreq(et*Math.pow(2,-90/1200),2,0)*0.97;
  const hi=partialFreq(et*Math.pow(2,90/1200),8,0.012);
  const peaks=localPeaks(spec,sr,(lo+hi)/2,(hi-lo)/2+8).filter(p=>p.snr>=6&&p.freq>=lo*0.98&&p.freq<=hi*1.02);
  const passing=[];
  for(let c=-90;c<=90;c+=3){
   const f1=et*Math.pow(2,c/1200);
   for(let bi=0;bi<Bs.length;bi++){
    const found=partialSeries(peaks,f1,Bs[bi]);
    const fit=fitPartialB(found);
    const heard=acceptedSeries(found,fit,et);
    if(heard==null)continue;
    passing.push({found:found,fit:fit,heard:heard,score:seriesScore(found,fit)})}}
  passing.sort((a,b)=>b.score-a.score);
  if(passing.length){
   const best=passing[0];
   if(passing.some(p=>p!==best&&Math.abs(p.heard-best.heard)>30&&p.score>best.score-8))return {status:'rejected',reason:'unclear'};
   const split=best.found.some(pk=>{
    const nearPk=localPeaks(spec,sr,pk.hz,Math.max(pk.hz*0.04,6)).filter(p=>p.snr>=6&&Math.abs(centsBetween(p.freq,pk.hz))>8&&Math.abs(centsBetween(p.freq,pk.hz))<40);
    return nearPk.length&&nearPk[0].mag>pk.mag*0.45});
   if(split)return {status:'rejected',reason:'multiple-strings',heardCents:best.heard,partials:best.found};
   return {status:'measured',heardCents:best.heard,partials:best.found,fit:best.fit}}
  const wideLo=Math.max(20,et*Math.pow(2,-1400/1200));
  const wideHi=partialFreq(et*Math.pow(2,1400/1200),8,0.012);
  const wide=localPeaks(spec,sr,(wideLo+wideHi)/2,(wideHi-wideLo)/2+8).filter(p=>p.snr>=6&&p.freq>=wideLo&&p.freq<=wideHi);
  let evenHits=0,oddHit=false;
  [2,4,6,8].forEach(n=>{if(wide.some(p=>Math.abs(centsBetween(p.freq,n*et))<45))evenHits++});
  [3,5,7].forEach(n=>{if(wide.some(p=>Math.abs(centsBetween(p.freq,partialFreq(et,n,0.001)))<55))oddHit=true});
  if(evenHits>=3&&!oddHit)return {status:'rejected',reason:'wrong-note'};
  let far=null;
  for(let c=-1400;c<=1400;c+=12){
   if(Math.abs(c)<=90)continue;
   const f1=et*Math.pow(2,c/1200);
   for(let bi=0;bi<Bs.length;bi++){
    const found=partialSeries(wide,f1,Bs[bi]);
    if(found.length<3||!found.some(p=>p.n%2===1))continue;
    const fit=fitPartialB(found);
    if(!fit||fit.status!=='measured'||!(fit.f1>0))continue;
    const heard=centsBetween(fit.f1,et);
    if(Math.abs(heard)<=90)continue;
    const score=seriesScore(found,fit);
    if(!far||score>far.score)far={heard:heard,score:score}}}
  if(far)return {status:'rejected',reason:'wrong-note',heardCents:far.heard};
  return {status:'rejected',reason:'unclear'}}
 function calibrationCue(midi,split2,split3){
  const name=label(midi),n=stringCount(midi,split2,split3);
  const how=n<=1?'This note has one string.':'This note has '+n+' strings. Mute '+(n-1)+'. Play one string only.';
  return 'Play '+name+'. '+how+' Listening for its overtones, not for whether it is in tune.'}
 function frameRmsSeries(samples,sampleRate){
  const sr=+sampleRate,x=samples,n=x?x.length|0:0;
  const win=Math.max(8,Math.round(sr*0.02)),hop=Math.max(4,Math.round(sr*0.01));
  const frames=[];
  for(let i=0;i+win<=n;i+=hop){let e=0;for(let j=0;j<win;j++)e+=x[i+j]*x[i+j];frames.push({i:i,r:Math.sqrt(e/win)})}
  return{frames,win,hop}}
 function maxWindowRms(samples,sampleRate,sec){
  const sr=+sampleRate,x=samples,n=x?x.length|0:0;
  const W=Math.max(16,Math.round(sr*(sec||0.08))),hop=Math.max(4,Math.round(sr*0.01));
  if(!(n>=W))return 0;
  const sq=new Float64Array(n+1);
  for(let i=0;i<n;i++)sq[i+1]=sq[i]+x[i]*x[i];
  let best=0;
  for(let i=0;i+W<=n;i+=hop){const v=Math.sqrt((sq[i+W]-sq[i])/W);if(v>best)best=v}
  return best}
 function selectCalibrationSegmentInfo(samples,sampleRate){
  const sr=+sampleRate,x=samples,n=x?x.length|0:0;
  const out={segment:x,start:0,floor:0,gate:0,anchor:-1,attackFound:false,peakFrameRms:0,frames:[]};
  if(!(sr>=8000)||n<Math.round(sr*0.45))return out;
  const fr=frameRmsSeries(x,sr),frames=fr.frames;
  out.frames=frames;
  if(frames.length<4)return out;
  const quiet=frames.map(f=>f.r).sort((a,b)=>a-b);
  const floor=quiet[Math.max(0,Math.floor(quiet.length*0.2))]||0;
  const gate=Math.max(0.008,floor*5);
  out.floor=floor;out.gate=gate;
  let attack=-1;
  for(let k=1;k<frames.length;k++){if(frames[k].r>=gate&&frames[k].r>frames[k-1].r*1.35){attack=frames[k].i;break}}
  out.attackFound=attack>=0;
  let anchor=attack,pkF=null;
  frames.forEach(f=>{if(!pkF||f.r>pkF.r)pkF=f});
  out.peakFrameRms=pkF?pkF.r:0;
  if(anchor<0)anchor=pkF?pkF.i:0;
  out.anchor=anchor;
  if(anchor<Math.round(sr*0.08)&&n<=Math.round(sr*1.35))return out;
  const keep=Math.min(n,Math.round(sr*0.9)),pre=Math.round(sr*0.05);
  let start=Math.max(0,anchor-pre),end=Math.min(n,start+keep);
  if(end-start<Math.round(sr*0.5)){end=Math.min(n,start+Math.round(sr*0.5));if(end-start<Math.round(sr*0.5))start=Math.max(0,end-Math.round(sr*0.5))}
  // v43 decay match: once the strike has fallen to a fifth of its peak frame and stayed
  // there, the rest of the window is tail. End there instead of averaging the tail in,
  // but never below the half-second floor the pitch stages rely on.
  if(pkF){
   const low=Math.max(floor*2,pkF.r*0.2);
   for(let k=0;k<frames.length;k++){
    const f=frames[k];if(f.i<=pkF.i)continue;
    if(f.r<low&&(k+1>=frames.length||frames[k+1].r<low)&&(k+2>=frames.length||frames[k+2].r<low)){
     const cand=f.i+fr.win;
     if(cand-start>=Math.round(sr*0.5)&&cand<end)end=cand;
     break}}}
  if(start<=0&&end>=n)return out;
  out.start=start;out.segment=x.slice(start,end);return out}
 function selectCalibrationSegment(samples,sampleRate){return selectCalibrationSegmentInfo(samples,sampleRate).segment}
 // v43 capture onset: the strike is judged on ~10 ms sub-chunks, not whole 85 ms processor
 // buffers, so a soft fast treble strike trips the attack gate instead of running the full
 // 2.4 s worst-case take. Also reports whether the take was already hot at sample 0, which
 // is the signature of a strike played before listening really started.
 function makeCaptureOnset(sampleRate){
  const sr=+sampleRate||48000,sub=Math.max(64,Math.round(sr*0.01)),CHUNK=4096;
  let carry=new Float32Array(0),consumed=0,buffers=0;
  let attackAt=-1,floor=0.001,prevSub=0,prevHot=false,firstSub=true,startedHot=false;
  let maxChunkRms=0,maxSubRms=0,csq=0,ccount=0;
  function feedSub(rms,startIdx){
   if(rms>maxSubRms)maxSubRms=rms;
   const hot=rms>=Math.max(0.007,floor*4);
   if(firstSub){firstSub=false;if(hot)startedHot=true}
   if(attackAt<0&&startIdx>sr*0.04&&hot&&(rms>prevSub*1.4||prevHot))attackAt=startIdx;
   if(!hot)floor=floor*0.95+rms*0.05;
   prevSub=rms;prevHot=hot}
  function push(buf){
   if(!buf||!buf.length)return api;
   buffers++;
   for(let i=0;i<buf.length;i++){csq+=buf[i]*buf[i];ccount++;if(ccount>=CHUNK){const r=Math.sqrt(csq/ccount);if(r>maxChunkRms)maxChunkRms=r;csq=0;ccount=0}}
   const merged=new Float32Array(carry.length+buf.length);
   merged.set(carry);merged.set(buf,carry.length);carry=merged;
   let off=0;
   while(carry.length-off>=sub){
    let e=0;for(let j=0;j<sub;j++){const v=carry[off+j];e+=v*v}
    feedSub(Math.sqrt(e/sub),consumed+off);
    off+=sub}
   consumed+=off;
   carry=carry.slice(off);
   return api}
  const api={push,
   get attackAt(){return attackAt},
   get attackDetected(){return attackAt>=0},
   get startedHot(){return startedHot},
   get maxChunkRms(){return maxChunkRms},
   get maxSubRms(){return maxSubRms},
   get floor(){return floor},
   get buffers(){return buffers},
   get totalSamples(){return consumed+carry.length}};
  return api}
 function analyzeCalibrationNote(samples,sampleRate,opts){
  opts=opts||{};const sr=+sampleRate;let n0=samples?samples.length|0:0,midi=opts.midi|0,a4=opts.a4||440;
  const blank=(status,reason)=>({status,reason,midi,B:null,residualCents:null,partials:[],heardCents:null,confidence:'withheld'});
  if(!(sr>=8000)||n0<32)return blank('rejected','short');
  const takeSec=n0/sr;
  let wholeE=0;for(let i=0;i<n0;i++)wholeE+=samples[i]*samples[i];
  const wholeRms=Math.sqrt(wholeE/Math.max(1,n0));
  let info=null;
  if(n0/sr>=0.45){info=selectCalibrationSegmentInfo(samples,sr);const seg=info.segment;if(seg&&seg.length&&seg!==samples){samples=seg;n0=seg.length}}
  let e=0;for(let i=0;i<n0;i++)e+=samples[i]*samples[i];
  const segRms=Math.sqrt(e/Math.max(1,n0));
  // v43: judge the strike on its own window as well as on the segment average. A soft,
  // fast-decaying treble strike puts its energy in the first fraction of a second; the
  // segment average dilutes that with quiet tail and called real strikes silence.
  const strikeRms=maxWindowRms(samples,sr,0.08);
  const segFrames=frameRmsSeries(samples,sr).frames;
  let pkF=0,pkI=-1;segFrames.forEach((f,i)=>{if(f.r>pkF){pkF=f.r;pkI=i}});
  const startedHot=pkI>=0&&pkI<=2&&segFrames.length>0&&segFrames[0].r>=pkF*0.55;
  const diag={sr,takeSec:+takeSec.toFixed(3),wholeRms:+wholeRms.toFixed(5),
   segStartSec:info?+(info.start/sr).toFixed(3):0,segSec:+(n0/sr).toFixed(3),segRms:+segRms.toFixed(5),
   strikeRms:+strikeRms.toFixed(5),peakFrameRms:+pkF.toFixed(5),
   floor:info?+info.floor.toFixed(5):null,gate:info?+info.gate.toFixed(5):null,
   anchorSec:info&&info.anchor>=0?+(info.anchor/sr).toFixed(3):null,
   segAttack:info?!!info.attackFound:null,startedHot:!!startedHot,
   frames:(info&&info.frames.length?info.frames:segFrames).map(f=>+f.r.toFixed(4))};
  if(!(segRms>0.004||strikeRms>0.004)){
   // A take that is already loud at sample 0 and only fades was played before listening
   // really started (for example during "Opening the microphone..."), not silence.
   const early=startedHot&&pkF>0.0025&&pkF>(info?info.floor*3:0);
   return Object.assign(blank('rejected',early?'early':'silence'),{diag})}
  if(n0/sr<0.45)return Object.assign(blank('rejected','short'),{diag});
  const spec=fftMag(samples);if(!spec)return Object.assign(blank('rejected','short'),{diag});
  const et=etFreq(midi,a4);
  const near=localPeaks(spec,sr,et,et*0.08).filter(p=>p.snr>=6);
  const direct=near.length&&Math.abs(centsBetween(near[0].freq,et))<=90?near[0]:null;
  if(!direct){
   const inf=inferMissingFundamental(spec,sr,et);
   if(inf.status!=='measured')return Object.assign(blank('rejected',inf.reason),{heardCents:inf.heardCents==null?null:inf.heardCents,partials:inf.partials||[],diag});
   const fit=inf.fit,partials=inf.partials.slice().sort((a,b)=>a.n-b.n);
   return {status:'measured',reason:'ok',midi,B:fit.B,residualCents:fit.residualCents,partials,heardCents:inf.heardCents,confidence:partials.length>=4&&fit.residualCents<3?'high':'low',fundamental:'inferred',diag}}
  const p1=direct;
  const heardCents=centsBetween(p1.freq,et);
  const split=localPeaks(spec,sr,p1.freq,p1.freq*0.04).filter(p=>p.snr>=6&&Math.abs(1200*Math.log2(p.freq/p1.freq))>8&&Math.abs(1200*Math.log2(p.freq/p1.freq))<40);
  if(split.length&&split[0].mag>p1.mag*0.45)return Object.assign(blank('rejected','multiple-strings'),{heardCents,diag});
  // v43: the partial search is seeded at several stiffness values, not just one. On the
  // top notes the true B is far from the default seed, so the upper partials sit more
  // than the 45-cent search tolerance away from their predicted places and a healthy
  // strike was refused as a bad fit. The first seed is the old behaviour and stays the
  // fallback; another seed only wins when it actually measures, with more partials or
  // a tighter fit.
  const seedBs=[opts.searchB||0.0003,0.0012,0.003,0.008];
  let partials=null,fit=null,bestScore=-1;
  for(let si=0;si<seedBs.length;si++){
   const found={1:{n:1,hz:p1.freq,snr:p1.snr}};
   let B=seedBs[si],f1h=p1.freq;
   for(let pass=0;pass<2;pass++){
    for(let n=2;n<=8;n++){
     const pred=partialFreq(f1h,n,B);
     const pk=localPeaks(spec,sr,pred,Math.max(8,pred*0.03)).filter(p=>p.snr>=5)[0];
     if(!pk)continue;
     if(Math.abs(1200*Math.log2(pk.freq/pred))>45)continue;
     found[n]={n,hz:pk.freq,snr:pk.snr}}
    const ft=fitPartialB(Object.keys(found).map(k=>found[k]));
    if(ft.status==='measured'&&ft.f1){f1h=ft.f1;B=ft.B}}
   const parts=Object.keys(found).map(k=>found[k]).sort((a,b)=>a.n-b.n);
   const ft=fitPartialB(parts);
   if(si===0){partials=parts;fit=ft}
   if(ft.status==='measured'){
    const score=parts.length*100-(ft.residualCents||0);
    if(score>bestScore){bestScore=score;partials=parts;fit=ft}}}
  if(fit.status!=='measured')return Object.assign(blank('rejected',fit.reason||'fit'),{heardCents,partials,residualCents:fit.residualCents,diag});
  return {status:'measured',reason:'ok',midi,B:fit.B,residualCents:fit.residualCents,partials,heardCents,confidence:partials.length>=4&&fit.residualCents<3?'high':'low',diag}}
 function deriveCalibration(notes,refA4,styleId){
  const meas=(notes||[]).filter(n=>n&&n.status==='measured'&&n.B>0).slice().sort((a,b)=>a.midi-b.midi);
  const base={version:CAL_VERSION,algorithm:CAL_ALGORITHM,refA4:refA4||440,styleId:styleId||null,accepted:false,fallback:null,status:'insufficient',notes:meas,targets:{},extrapolation:null};
  if(meas.length<4)return base;
  const lo=meas[0].midi,hi=meas[meas.length-1].midi;
  if(!(lo<=69&&hi>=69&&meas.some(n=>n.midi<=45)&&meas.some(n=>n.midi>=81)))return base;
  const up=hi>=81?stiffnessTrend(meas,'up'):{ok:false,reason:'no-treble-anchor',side:'up'};
  const down=lo<=45?stiffnessTrend(meas,'down'):{ok:false,reason:'no-bass-anchor',side:'down'};
  function fromTrend(midi,trend,span){
   if(!trend||!trend.ok)return null;
   if(Math.abs(midi-span)> (trend.side==='up'?18:12))return null;
   const B=Math.exp(trend.a+trend.k*(midi-69));
   if(!(B>1e-5&&B<0.02))return null;
   return B}
  function bAt(midi){
   const hit=meas.find(s=>s.midi===midi);
   if(hit)return {B:hit.B,bSource:'measured'};
   let a=null,b=null;
   meas.forEach(s=>{if(s.midi<midi)a=s;if(s.midi>midi&&!b)b=s});
   if(a&&b){const t=(midi-a.midi)/(b.midi-a.midi);return {B:Math.exp(Math.log(a.B)*(1-t)+Math.log(b.B)*t),bSource:'inferred'}}
   const ext=midi>hi?fromTrend(midi,up,hi):midi<lo?fromTrend(midi,down,lo):null;
   if(ext)return {B:ext,bSource:'extrapolated'};
   return {B:null,bSource:'unavailable'}}
  const cents={69:0};
  for(let m=69;m<HI;m++){const bl=bAt(m),bu=bAt(m+1);if(!bl.B||!bu.B)break;cents[m+1]=cents[m]+octave42(bl.B,bu.B)/12}
  for(let m=69;m>LO;m--){const bl=bAt(m-1),bu=bAt(m);if(!bl.B||!bu.B||cents[m]==null)break;cents[m-1]=cents[m]-octave42(bl.B,bu.B)/12}
  const model=SIZES[styleId]?SIZE_CURVE[styleId]:null;
  const targets={};
  for(let m=LO;m<=HI;m++){
   const b=bAt(m);
   if(m===69)targets[m]={cents:0,source:'anchor',B:b.B,bSource:b.bSource};
   else if(cents[m]!=null&&b.B)targets[m]={cents:cents[m],source:b.bSource,B:b.B,bSource:b.bSource};
   else if(model)targets[m]={cents:null,source:'unavailable',B:null,bSource:'unavailable',modelCents:model.cents[m]};
   else targets[m]={cents:null,source:'unavailable',B:null,bSource:'unavailable'}}
  return {version:CAL_VERSION,algorithm:CAL_ALGORITHM,refA4:refA4||440,styleId:styleId||null,accepted:true,fallback:null,status:'accepted',extrapolation:{up,down},notes:meas.map(n=>({midi:n.midi,B:n.B,residualCents:n.residualCents,confidence:n.confidence,partials:n.partials,heardCents:n.heardCents})),targets}}
 function curveFromCalibration(cal,styleId){
  const model=SIZES[styleId]?SIZE_CURVE[styleId]:typicalCurve();
  const cents={},origin={},bmap={};
  for(let m=LO;m<=HI;m++){
   const t=cal&&cal.targets&&(cal.targets[m]||cal.targets[String(m)]);
   if(t&&t.cents!=null&&isFinite(+t.cents)){cents[m]=+t.cents;origin[m]=t.source;bmap[m]=t.B>0?t.B:null}
   else if(cal&&cal.fallback==='model'){cents[m]=model.cents[m];origin[m]='model-fallback';bmap[m]=model.b?model.b(m):null}
   else {cents[m]=null;origin[m]='unavailable';bmap[m]=null}}
  return {cents,origin,b:midi=>bmap[midi]||0,calibration:true,algorithm:cal&&cal.algorithm}}
 return{LO,HI,NAMES,TYPICAL,SIZES,SPLITS,MODELS,HOLD_MS,TOL,RAISE_IF_FLAT,OVERPULL,PRESCAN,PRESCAN_WAIT,GOT_MS,DIFFERENT,METER,INTERVALS,CAL_VERSION,CAL_ALGORITHM,CAL_NOTES,label,plainName,isWhite,smoothTypical,bOf,sizeCurve,typicalCurve,curveFor,curveFromCalibration,deriveCalibration,fitPartialB,analyzeCalibrationNote,selectCalibrationSegment,selectCalibrationSegmentInfo,frameRmsSeries,maxWindowRms,makeCaptureOnset,calibrationCue,etFreq,targetFreq,partialFreq,expectedBeat,measureBeats,analyzeIntervalAudio,analyzeUnison,synthUnison,listenCue,needsPitchRaise,overpullTarget,nearestMeasured,interpretFreq,allowPrescan,isRing,confidenceFor,meterView,stringCount,stringPrompt,expandTuning,upsertProfile,renameProfile,deleteProfile,buildSequence,emptyState,applySample,jump}})();
if(typeof module!=='undefined')module.exports=PianoTune;

if(typeof document!=='undefined'){
const PT=PianoTune,coreJump=PianoTune.jump,GK='pp-pianotune';
const G={on:false,listening:false,sounding:false,stream:null,ctx:null,play:null,an:null,raf:0,buf:null,sess:null,seq:[],curve:null,built:false,env:[],showGot:false,showNext:false,showUnread:false,blinking:false,gotMidi:null,prevFreq:0,attack:false,sawQuiet:false,peak:0,gotUntil:0,settleUntil:0,armAt:0};
const $g=id=>document.getElementById(id);
function slog(type,data){try{if(typeof SessionLog!=='undefined')SessionLog.record(type,data||{})}catch(e){}}
function slogStep(){const s=stepNow();if(!s)return;const key=G.sess.step+':'+(s.phase||'');if(key===G.logStepKey)return;G.logStepKey=key;slog('step',{index:G.sess.step,phase:s.phase||null,midi:s.midi||null,title:s.title||null,stringIndex:s.stringIndex||null,stringCount:s.stringCount||null})}
const PKEY='pp-piano-profiles';
function blankSess(){return{v:3,type:null,a4:440,step:0,prescan:{},split2:null,split3:null,tuningOk:false,profileId:null,ready:false,updated:0,calibration:null,targetChoice:null,pianoModel:null,serial:''}}
function loadSess(){try{const o=JSON.parse(localStorage.getItem(GK)||'null');if(o&&o.v===3)return Object.assign(blankSess(),o);if(o&&o.v===2&&o.type&&PT.SPLITS[o.type])return Object.assign(blankSess(),o,{v:3,ready:true,split2:PT.SPLITS[o.type].split2,split3:PT.SPLITS[o.type].split3})}catch(e){}return blankSess()}
function saveSess(){try{G.sess.updated=Date.now();localStorage.setItem(GK,JSON.stringify({v:3,type:G.sess.type,a4:G.sess.a4,step:G.sess.step,prescan:G.sess.prescan,split2:G.sess.split2,split3:G.sess.split3,tuningOk:!!G.sess.tuningOk,profileId:G.sess.profileId,ready:!!G.sess.ready,updated:G.sess.updated,calibration:G.sess.calibration||null,targetChoice:G.sess.targetChoice||null,pianoModel:G.sess.pianoModel||null,serial:G.sess.serial||''}))}catch(e){}}
function loadPianos(){try{const a=JSON.parse(localStorage.getItem(PKEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function savePianos(a){try{localStorage.setItem(PKEY,JSON.stringify(a))}catch(e){}}
function profiles(){try{const a=JSON.parse(localStorage.getItem('pp-tuner-profiles')||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function findProfile(id){return profiles().find(p=>p.id===id)||null}
function activeCurve(){
  const cal=G.sess&&G.sess.calibration;
  if(cal&&cal.accepted)return PT.curveFromCalibration(cal,G.sess.type);
  const t=G.sess.type||'concert';
  if(String(t).indexOf('profile:')===0)return PT.curveFor(t,findProfile(t.slice(8)));
  if(PT.MODELS[t])return PT.curveFor(PT.MODELS[t].layoutStart);
  return PT.curveFor(t)}
function bFn(){
  const cal=G.sess&&G.sess.calibration;
  if(cal&&cal.accepted)return midi=>{const t=cal.targets&&(cal.targets[midi]||cal.targets[String(midi)]);return t&&t.B>0?t.B:0};
  const id=G.sess.type;return PT.SIZES[id]?midi=>PT.bOf(PT.SIZES[id],midi):null}
function rebuild(keepStep){
  const raise=PT.needsPitchRaise(G.sess.prescan||{});
  G.curve=activeCurve();
  const prefs=tunePrefs();G.seq=PT.expandTuning(PT.buildSequence({raise,temperament:prefs.temperament}),G.sess.split2,G.sess.split3,{unison:prefs.unison});
  if(!keepStep)G.sess.step=0;
  if(G.sess.step>=G.seq.length)G.sess.step=G.seq.length-1;
  if(G.sess.step<0)G.sess.step=0;
  G.hold=PT.emptyState();G.hold.step=G.sess.step;G.hold.prescan=Object.assign({},G.sess.prescan||{});
  G.env=[];saveSess()}
function stepNow(){return G.seq[G.sess.step]||G.seq[0]}
function targetCents(step,midi){
  const base=G.curve&&G.curve.cents?G.curve.cents[midi]:0;
  if(base==null||!isFinite(+base))return null;
  if(step&&step.phase==='raise')return PT.overpullTarget(+base,PT.nearestMeasured(G.sess.prescan,midi));
  return +base}
function beatsText(step){
  if(!step||!step.intervals)return'';
  const measured=!!(G.sess&&G.sess.calibration&&G.sess.calibration.accepted);
  const name=measured?'accepted profile':'size model';
  const tail=measured?'Expected from the accepted stiffness profile. Not a pass.':'Models only. Not measured on this piano.';
  const lines=step.intervals.map(iv=>{const e=PT.expectedBeat(G.curve.cents,bFn(),G.sess.a4,iv.a,iv.kind);if(!e||!isFinite(e.beat))return'';return e.label+' '+name+' '+e.beat.toFixed(1)+' beats/s, harmonic model '+e.harmonic.toFixed(1)+' beats/s (partials '+e.p+'/'+e.q+')'}).filter(Boolean);
  return lines.length?lines.join('. ')+'. '+tail:'';
}
function intervalQuery(step){
  const pairs=(step.intervals||[]).map(iv=>PT.expectedBeat(G.curve.cents,bFn(),G.sess.a4,iv.a,iv.kind)).filter(Boolean);
  const notes=[],seen={};
  (step.midis||[]).forEach(m=>{if(seen[m])return;seen[m]=1;const c=G.curve&&G.curve.cents?G.curve.cents[m]:0;if(c==null||!isFinite(+c))return;notes.push(PT.targetFreq(m,+c,G.sess.a4))});
  return{pairs,notes};
}
function reasonText(code){
  if(code==='silence')return 'The sound was too quiet.';
  if(code==='short')return 'Hold the two notes a little longer.';
  if(code==='resolution')return 'The beats are too slow to separate in this take.';
  if(code==='missing-partial')return 'One of the two partials was missing.';
  if(code==='noise')return 'The partials were lost in noise.';
  if(code==='three-notes')return 'Three or more notes are sounding. Play only two.';
  if(code==='ambiguous')return 'More than one pair was heard. Play one pair.';
  if(code==='unsupported')return 'This check does not read unison beats.';
  return 'The partials were not clear.';
}
function measuredText(){
  const r=G.beatRead;
  if(!r)return 'Measured: waiting for two notes held together. Not a pass.';
  if(r.status!=='ok'||!(r.beat>=0)||r.confidence==='uncertain')return 'Measured: uncertain. '+(reasonText(r.reason)||'')+' Not a pass.';
  return 'Measured '+(r.label?r.label+' ':'')+r.beat.toFixed(1)+' beats/s. Confidence '+r.confidence+'. Not a pass.';
}
function clearWave(){G.wave=null;G.waveN=0;G.waveSr=0;G.beatAt=0;G.beatRead=null}
function appendWave(buf,sr){
  if(!G.wave||G.waveSr!==sr){G.wave=new Float32Array(Math.floor(sr*1.25));G.waveN=0;G.waveSr=sr}
  const cap=G.wave.length;
  for(let i=0;i<buf.length;i++){G.wave[G.waveN%cap]=buf[i];G.waveN++}
}
function waveSlice(n){
  const out=new Float32Array(n),cap=G.wave.length,start=G.waveN-n;
  for(let i=0;i<n;i++)out[i]=G.wave[(start+i)%cap];
  return out}
function logBeatRead(step,pairs){
  const r=G.beatRead;if(!r)return;
  const key=G.sess.step+':'+r.status+':'+(r.reason||'')+':'+(r.beat!=null?r.beat.toFixed(1):'');
  if(key===G.logBeatKey)return;G.logBeatKey=key;
  slog('interval-check',{step:G.sess.step,midi:step.midi||null,pairs:pairs?pairs.map(p=>p.label):null,status:r.status,reason:r.reason||'ok',beat:r.beat!=null?+r.beat.toFixed(2):null,confidence:r.confidence||null,rms:r.rms!=null?+r.rms.toFixed(5):null,windowSec:r.windowSec!=null?+r.windowSec.toFixed(2):null,lowHz:r.lowHz!=null?+r.lowHz.toFixed(1):null,highHz:r.highHz!=null?+r.highHz.toFixed(1):null})}
function logUnisonRead(step){
  const u=G.unisonRead;if(!u)return;
  const key=step.midi+':'+u.status+':'+(u.reason||'')+':'+(u.fundamentalBeat!=null?u.fundamentalBeat.toFixed(1):'')+':'+(u.pattern||'');
  if(key===G.logUnisonKey)return;G.logUnisonKey=key;
  slog('unison-check',{midi:step.midi,note:PT.label(step.midi),stringIndex:step.stringIndex||null,stringCount:step.stringCount||null,status:u.status,reason:u.reason||'ok',fundamentalBeat:u.fundamentalBeat!=null?+u.fundamentalBeat.toFixed(2):null,pattern:u.pattern||null,confidence:u.confidence||null,summary:u.summary||null})}
function readInterval(step,now){
  if(!G.wave||!G.waveSr){G.beatRead={status:'uncertain',confidence:'uncertain',reason:'short'};logBeatRead(step,null);return}
  const need=Math.floor(G.waveSr*1);
  if(G.waveN<need){G.beatRead={status:'uncertain',confidence:'uncertain',reason:'short'};logBeatRead(step,null);return}
  const t0=now||0;
  const q=intervalQuery(step);
  G.beatRead=PT.analyzeIntervalAudio(waveSlice(need),G.waveSr,q);
  if(G.beatRead)G.beatRead.lagMs=t0?Math.max(0,(performance.now()-t0)):null;
  logBeatRead(step,q.pairs);
}
function renderKeys(){
  const box=$g('gtKeys');if(!box||box.childElementCount)return;
  const whites=[];for(let m=PT.LO;m<=PT.HI;m++)if(PT.isWhite(m))whites.push(m);
  whites.forEach(m=>{const k=document.createElement('button');k.type='button';k.className='wk';k.dataset.m=m;k.setAttribute('aria-label',PT.label(m));k.onclick=()=>onKey(m);box.append(k)});
  whites.forEach((m,i)=>{const n=m+1;if(n>PT.HI||PT.isWhite(n))return;const k=document.createElement('button');k.type='button';k.className='bk';k.dataset.m=n;k.style.left=((i+0.62)/whites.length*100)+'%';k.setAttribute('aria-label',PT.label(n));k.onclick=()=>onKey(n);box.append(k)});
}
function paintKeys(colors,lean){
  const step=stepNow();const want=(step&&step.midis)||[];
  document.querySelectorAll('#gtKeys button').forEach(el=>{
    const m=+el.dataset.m;el.classList.remove('next','ok','bad','sharp','flat','dim','near','blink');
    if(G.showGot&&G.gotMidi!=null){el.classList.add(m===G.gotMidi?'ok':'dim');return}
    const c=colors&&colors[m];
    if(G.hold&&G.hold.green[m])el.classList.add('ok');
    else if(c==='red')el.classList.add('bad',lean>0?'sharp':'flat');
    else if(c==='green')el.classList.add('near');
    else if(want.indexOf(m)>=0){el.classList.add('next');if(G.blinking)el.classList.add('blink')}
    else el.classList.add('dim')});
}
function render(){
  const step=stepNow();if(!step)return;
  const shown=G.showGot?Math.max(0,G.sess.step-1):G.sess.step;
  $g('gtTitle').textContent=(G.showGot&&G.gotMidi!=null)?('Pre-scan '+PT.label(G.gotMidi)):(step.title||'');
  const unisonStep=step.phase!=='prescan'&&step.phase!=='check'&&(step.stringCount||1)>1&&(step.stringIndex||1)>1;
  const cue=PT.listenCue(step,step.phase==='check'?G.beatRead:(unisonStep?G.unisonRead:null));
  let plain=G.showGot?'Saved this note.':(G.showUnread?'No clear reading. Use Retry unread to hear this note again.':(cue.plain||step.prompt||''));
  if(!G.showGot&&!G.showUnread){
   if(!G.listening)plain+=' Microphone is off.';
   else if(cue.state)plain+=' '+cue.state;
   else plain+=' Listening now.'
   if(plain.indexOf('Rings')<0)plain+=step.phase==='check'||unisonStep?' Rings stay off.':' Rings are what was heard, not the tuning target.'}
  $g('gtPrompt').textContent=plain;
  if($g('pdListen')){$g('pdListen').textContent='';$g('pdListen').hidden=true}
  if($g('gtDetail')){$g('gtDetail').textContent=cue.detail||'';$g('gtDetail').hidden=!cue.detail}
  $g('gtCount').textContent=(shown+1)+' / '+G.seq.length;
  const beats=beatsText(step);
  let beatLine=step.phase==='check'?(beats?beats+' ':'')+measuredText():beats;
  if(unisonStep){
   const u=G.unisonRead;
   beatLine=u&&u.summary?(u.summary+' Not a pass and not a fail.'):(u&&u.status==='uncertain'?'Unison beats: not sure yet. '+(u.summary||'')+' Not a pass and not a fail.':'Unison beats: waiting for the strings together. Not a pass and not a fail.')}
  $g('gtBeats').textContent=beatLine;$g('gtBeats').hidden=!beatLine;
  $g('gtune').classList.toggle('checking',step.phase==='check');
  if(step.phase==='check')G.showDone=true;
  const show=G.showGot&&G.gotMidi!=null?G.gotMidi:(step.midis?step.midis[0]:step.midi);
  $g('gtNote').textContent=PT.label(show)+(G.showGot?' ✓':'');
  $g('gtNote').classList.toggle('got',!!G.showGot);
  const cents=G.lastCents,view=PT.meterView(cents);
  if(G.showGot){$g('gtCents').textContent='Got it';$g('gtCents').classList.add('got')}
  else if(G.showUnread){$g('gtCents').textContent='No clear reading';$g('gtCents').classList.remove('got')}
  else if(G.showNext&&step.phase==='prescan'&&!(typeof cents==='number')){$g('gtCents').textContent='Next: '+PT.plainName(step.midi);$g('gtCents').classList.remove('got')}
  else{$g('gtCents').textContent=view.text;$g('gtCents').classList.remove('got')}
  if($g('gtNeedle'))$g('gtNeedle').style.left=view.pct+'%';
  if($g('gtNeedleWrap')){$g('gtNeedleWrap').style.setProperty('--cents',(typeof cents==='number'&&isFinite(cents)?Math.max(-200,Math.min(200,cents)):0).toFixed(2));
  $g('gtNeedleWrap').classList.toggle('ok',typeof cents==='number'&&isFinite(cents)&&Math.abs(cents)<=PT.TOL);
  $g('gtNeedleWrap').classList.toggle('past',!!view.past)}
  if($g('gtRetry'))$g('gtRetry').hidden=unreadIndex()<0;
  if($g('gtDone'))$g('gtDone').hidden=!G.showDone;
  if($g('gtTuneCard'))$g('gtTuneCard').hidden=!G.showTuningCard;
  $g('gtune').classList.toggle('hasDone',!!G.showDone);
  paintKeys(G.colors,G.hold?G.hold.lean:0);
  if($g('gtTargetSrc')){
   const cal=G.sess&&G.sess.calibration;
   const midi=step.midi;
   if(cal&&cal.accepted){const t=cal.targets&&(cal.targets[midi]||cal.targets[String(midi)]);
    $g('gtTargetSrc').textContent=!t||t.source==='unavailable'?'Target unavailable for this note. The size model is not being substituted.':t.source==='measured'?'Target measured from this piano\'s stiffness. The pitch you played was not copied.':t.source==='inferred'?'Target inferred between measured notes. Not a direct measurement of this note.':t.source==='extrapolated'?'Target extrapolated from the measured stiffness trend. Not a measurement of this note.':t.source==='anchor'?'Target anchored at the A you set, not at the pitch the microphone heard.':t.source==='model-fallback'?'Target from the size model for this note. Not a measurement.':'Target '+t.source+'.'}
   else if(G.sess&&G.sess.targetChoice==='model')$g('gtTargetSrc').textContent=G.sess.pianoModel?'Target from the generic '+G.sess.type+' size model. Not a measurement of this '+G.sess.pianoModel.maker+' '+G.sess.pianoModel.model+'.':'Target from the size model. Not a measurement of this piano.';
   else $g('gtTargetSrc').textContent=''}
  if($g('gtIdentity')){
   const m=G.sess.pianoModel;
   $g('gtIdentity').textContent=m?('Model: '+m.maker+' '+m.model+'. '+(G.sess.serial?'Serial '+G.sess.serial+'.':'Serial not entered.')+' Reference only. Not a measured curve.'):'';
   $g('gtIdentity').hidden=!m}
  if($g('gtModelBadge')){const m=G.sess.pianoModel;$g('gtModelBadge').hidden=!m;$g('gtModelBadge').textContent=m?('Model: '+m.maker+' '+m.model):''}
  if($g('gtSerialLive')){const live=$g('gtSerialLive');live.hidden=!G.sess.pianoModel;if(document.activeElement!==live)live.value=G.sess.serial||''}
  if($g('pdTargetName'))$g('pdTargetName').textContent=PT.label(show);
  if($g('pdTarget'))$g('pdTarget').hidden=!window.matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
  if(step.phase==='check'&&window.PartialDial&&PartialDial.clearRings)PartialDial.clearRings();
  $g('gtType').value=G.sess.type&&$g('gtType').querySelector('option[value="'+G.sess.type+'"]')?G.sess.type:'concert';
  syncA4Field()}
function fillTypes(){
  const s=$g('gtType');const curV=G.sess.type;s.innerHTML='';
  [['concert','Concert grand (9 ft)'],['baby','Baby grand'],['studio','Studio upright'],['spinet','Spinet'],['typical','Typical']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.append(o)});
  profiles().forEach(p=>{const o=document.createElement('option');o.value='profile:'+p.id;o.textContent='Saved: '+p.name;s.append(o)});
  if(curV&&s.querySelector('option[value="'+curV+'"]'))s.value=curV}
function renderList(){
  const ul=$g('gtList');ul.innerHTML='';
  G.seq.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(i+1)+'. '+s.title;if(i===G.sess.step)b.className='on';b.onclick=()=>{jumpTo(i);$g('gtList').hidden=true};ul.append(b)});
}
function jumpTo(i){G.previewHold=false;G.unisonRead=null;if(window.PartialDial&&PartialDial.clearSim)PartialDial.clearSim();G.showGot=false;G.showUnread=false;G.showNext=false;G.showDone=false;G.showTuningCard=false;G.gotUntil=0;G.settleUntil=0;G.prevFreq=0;G.hold=coreJump(G.hold||PT.emptyState(),i,G.seq.length);G.sess.step=G.hold.step;G.colors={};G.lastCents=null;G.measured=null;G.env=[];clearWave();saveSess();render();slogStep();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep()}
function onKey(m){if(G.pickSplit){if(G.pickSplit===3)G.sess.split3=m;else G.sess.split2=m;if(G.sess.split2!=null&&G.sess.split3!=null&&G.sess.split2>=G.sess.split3)G.sess.split2=G.sess.split3-1;renderSplits();return}jumpToMidi(m)}
function jumpToMidi(m){const i=G.seq.findIndex((s,idx)=>idx>=G.sess.step&&s.midis&&s.midis.indexOf(m)>=0);if(i>=0)jumpTo(i)}
function renderSplits(){renderKeys();if($g('gtSplit3Lab'))$g('gtSplit3Lab').textContent='Lowest 3-string key: '+(G.sess.split3!=null?PT.label(G.sess.split3):'');if($g('gtSplit2Lab'))$g('gtSplit2Lab').textContent='Lowest 2-string key: '+(G.sess.split2!=null?PT.label(G.sess.split2):'');
 if($g('gtModelLine')){const m=G.sess.pianoModel;const spec=m&&PT.MODELS[m.id];$g('gtModelLine').hidden=!m;$g('gtModelLine').textContent=spec?(spec.maker+' '+spec.model+' is the piano on record. Height '+spec.heightCm+' cm, width '+spec.widthCm+' cm, depth '+spec.depthCm+' cm, weight '+spec.weightKg+' kg. No. 1 speaking length '+spec.speakingNo1Mm+' mm. Duplex scale: no. Agraffes: no. '+(spec.id==='kawai-k200'?V44Core.k200Splits().note:'The string breaks below are a starting point, not a '+spec.model+' specification.')):''}
 document.querySelectorAll('#gtSplits .pick').forEach(b=>b.classList.toggle('on',+b.dataset.which===G.pickSplit));document.querySelectorAll('#gtKeys button').forEach(el=>{const m=+el.dataset.m;el.classList.remove('next','ok','bad','sharp','flat','dim','near','blink');el.classList.add(m===G.sess.split2||m===G.sess.split3?'next':'dim')})}
function stopListen(){G.listening=false;if(G.raf){cancelAnimationFrame(G.raf);G.raf=0}
  if(G.stream){G.stream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});G.stream=null}}
function loop(){
  if(!G.listening||!G.an)return;
  G.an.getFloatTimeDomainData(G.buf);
  if(!G.sounding){
    let e=0;for(let i=0;i<G.buf.length;i++)e+=G.buf[i]*G.buf[i];
    const rms=Math.sqrt(e/G.buf.length);
    const now=performance.now();
    G.env.push({t:now,v:rms});if(G.env.length>90)G.env.shift();
    trackAttack(rms);
    const step=stepNow();
    if(step&&step.phase==='prescan'&&!G.showGot&&!G.showUnread&&G.armAt&&now-G.armAt>PT.PRESCAN_WAIT&&!G.sess.prescan[step.midi])markUnread();
    const unisonNow=step&&step.phase!=='prescan'&&step.phase!=='check'&&(step.stringCount||1)>1&&(step.stringIndex||1)>1;
    const singleNow=step&&step.phase!=='check'&&step.midi;
    if(unisonNow||singleNow)appendWave(G.buf,G.ctx.sampleRate);
    if(singleNow&&!(window.PartialDial&&PartialDial.simOn&&PartialDial.simOn())&&(!G.partialAt||now-G.partialAt>500)){
     G.partialAt=now;const need=Math.floor((G.waveSr||1)*1);
     if(G.wave&&G.waveN>=need&&window.PartialCore){
      const heard=PartialCore.analyzeSingleNote(waveSlice(need),G.waveSr,{hintHz:PT.etFreq(step.midi,G.sess.a4),midi:step.midi,a4:G.sess.a4});
      if(window.PartialDial&&PartialDial.noteHeard)PartialDial.noteHeard(step.midi,heard)}}
    if(step&&step.phase==='check'&&!G.previewHold){
     appendWave(G.buf,G.ctx.sampleRate);
     if(!G.beatAt||now-G.beatAt>450){G.beatAt=now;readInterval(step,now);render()}
    }else if(unisonNow&&!G.previewHold){
     if(!G.unisonAt||now-G.unisonAt>500){G.unisonAt=now;const need=Math.floor((G.waveSr||1)*1);
      if(G.wave&&G.waveN>=need){const tc=targetCents(step,step.midi);const f1=tc==null?PT.etFreq(step.midi,G.sess.a4):PT.targetFreq(step.midi,tc,G.sess.a4);const Bb=bFn()?bFn()(step.midi):0;
       G.unisonRead=PT.analyzeUnison(waveSlice(need),G.waveSr,{f1,strings:step.stringCount,searchB:Bb});logUnisonRead(step);render()}}
    }else if(!(step&&step.phase==='check')){
     const f=TunerCore.yin(G.buf,G.ctx.sampleRate,0.12,{minRms:0.002,maxHz:9000});
     if(f)onFreq(f,now)}}
  G.raf=requestAnimationFrame(loop)}
function trackAttack(rms){
  G.peak=Math.max(rms,(G.peak||0)*0.97);
  if(G.peak>0.008&&rms<G.peak*0.28)G.sawQuiet=true;
  if(G.sawQuiet&&rms>Math.max(0.012,G.peak*0.5)){G.attack=true;G.sawQuiet=false}}
function onFreq(freq,now){
  const step=stepNow();if(!step||!G.sess||!G.sess.ready||G.showTuningCard||G.sounding||G.showGot||G.showUnread||step.phase==='check')return;
  let midi=step.midi,best=1e9,picked=freq;
  (step.midis||[step.midi]).forEach(m=>{
    const tc=targetCents(step,m);if(tc==null)return;
    const hz=PT.targetFreq(m,tc,G.sess.a4);
    const heard=PT.interpretFreq(freq,m,hz);if(!heard)return;
    const err=Math.abs(heard.cents);if(err<best){best=err;midi=m;picked=heard}});
  if(!picked||typeof picked==='number')return;
  if(step.phase==='prescan'){
    if(picked.other)return;
    if(!PT.allowPrescan({now,gotUntil:G.gotUntil||0,settleUntil:G.settleUntil||0,prevFreq:G.prevFreq||0,freq:picked.freq,attack:!!G.attack}))return}
  const cents=picked.cents;
  G.lastFreq=picked.freq;G.lastCents=cents;
  const res=PT.applySample(G.hold,step,{cents,midi},now);
  G.hold=res.state;G.sess.prescan=Object.assign({},G.hold.prescan);
  G.colors={};if(res.midi)G.colors[res.midi]=res.color==='green'&&G.hold.green[res.midi]?'green':res.color;
  if(res.advance){
   if(step.phase==='prescan'){slog('prescan',{midi:step.midi,note:PT.label(step.midi),cents:+cents.toFixed(1),freq:+picked.freq.toFixed(2)});advanceStep('prescan',picked.freq,false);return}
   if(step.waitDone||step.lastString||step.phase==='check'){G.showDone=true;saveSess();render();return}
   G.sess.step=Math.min(G.seq.length-1,G.sess.step+1);
   G.hold=coreJump(G.hold,G.sess.step,G.seq.length);G.hold.prescan=Object.assign({},G.sess.prescan);
   G.showDone=false;G.lastCents=null;saveSess();render();return}
  G.showDone=false;saveSess();render()}
function advanceStep(was,freq,doChime){
  const next=G.sess.step+1;
  if(was==='prescan'&&G.seq[next]&&G.seq[next].phase!=='prescan'&&!G.tuningOk){G.showTuningCard=true;G.pendingFreq=freq;saveSess();render();return}
  if(doChime)chime();
  G.sess.step=Math.min(G.seq.length-1,G.sess.step+1);
  if(was==='prescan'&&G.seq[G.sess.step]&&G.seq[G.sess.step].phase!=='prescan'){
    rebuild(true);G.sess.step=Math.max(0,G.seq.findIndex(s=>s.phase!=='prescan'))}
  G.hold=coreJump(G.hold,G.sess.step,G.seq.length);G.hold.prescan=Object.assign({},G.sess.prescan);
  G.colors={};G.env=[];G.armAt=0;saveSess();
  if(was==='prescan'&&G.seq[G.sess.step]&&G.seq[G.sess.step].phase==='prescan')beginGot(freq);
  else{G.showGot=false;G.showNext=false;render();if(was==='prescan')playStep();else setTimeout(playStep,280)}
  slogStep()}
function beginGot(freq){
  G.showGot=true;G.showUnread=false;G.showNext=false;G.blinking=false;
  G.gotMidi=G.seq[Math.max(0,G.sess.step-1)]?G.seq[Math.max(0,G.sess.step-1)].midi:null;
  G.prevFreq=freq||0;G.attack=false;G.sawQuiet=false;G.peak=0;
  G.gotUntil=performance.now()+PT.GOT_MS;G.settleUntil=G.gotUntil+350;G.armAt=0;
  render();
  setTimeout(()=>{if(!G.on)return;G.showGot=false;cueNext()},PT.GOT_MS)}
function cueNext(){
  const step=stepNow();G.showNext=!!(step&&step.phase==='prescan');G.blinking=G.showNext;G.lastCents=null;G.armAt=performance.now();
  render();
  if(G.showNext)setTimeout(()=>{G.blinking=false;if(G.on)render()},1500);
  else playStep()}
function markUnread(){
  const step=stepNow();if(!step||step.phase!=='prescan'||G.showGot||G.showUnread)return;
  slog('prescan-unread',{midi:step.midi,note:PT.label(step.midi)});
  G.sess.prescan[step.midi]={cents:null,confidence:'unread'};
  G.hold.prescan=Object.assign({},G.sess.prescan);
  G.showUnread=true;G.showGot=false;G.showNext=false;G.lastCents=null;
  G.sess.step=Math.min(G.seq.length-1,G.sess.step+1);
  if(G.seq[G.sess.step]&&G.seq[G.sess.step].phase!=='prescan'){
    rebuild(false);G.sess.step=Math.max(0,G.seq.findIndex(s=>s.phase!=='prescan'))}
  G.hold=coreJump(G.hold,G.sess.step,G.seq.length);G.hold.prescan=Object.assign({},G.sess.prescan);
  G.armAt=0;saveSess();render();
  setTimeout(()=>{if(!G.on)return;G.showUnread=false;cueNext()},PT.GOT_MS)}
function retryUnread(){
  for(let i=0;i<G.seq.length;i++){const s=G.seq[i];if(s.phase!=='prescan')continue;const r=G.sess.prescan[s.midi];if(r&&r.confidence==='unread'){delete G.sess.prescan[s.midi];jumpTo(i);return}}}
function unreadIndex(){
  for(let i=0;i<G.seq.length;i++){const s=G.seq[i];if(s.phase==='prescan'&&G.sess.prescan[s.midi]&&G.sess.prescan[s.midi].confidence==='unread')return i}
  return -1}
function chime(){try{const ctx=tuneAudio();const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=880;o.type='sine';g.gain.setValueAtTime(0.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.08,ctx.currentTime+0.02);g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.22);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.24)}catch(e){}}
function tuneAudio(){if(G.play)return G.play;const AC=window.AudioContext||window.webkitAudioContext;G.play=new AC();return G.play}
function playStep(){
  const step=stepNow();if(!step||step.phase==='prescan')return;
  const midi=(step.midis&&step.midis[0])||step.midi;
  const tones=(step.phase==='check'?step.midis:[midi]).map(m=>{const tc=targetCents(step,m);if(tc==null)return null;const B=bFn()?bFn()(m):0;return {f:PT.targetFreq(m,tc,G.sess.a4),B:B>0?B:0}}).filter(Boolean);
  if(!tones.length)return;
  sound(tones)}
function sound(tones){
  G.sounding=true;G.lastCents=null;
  try{
    const ctx=tuneAudio();if(ctx.state!=='running'&&ctx.resume)ctx.resume();
    const now=ctx.currentTime;const master=ctx.createGain();master.gain.value=0.2;master.connect(ctx.destination);
    tones.forEach(t=>{
      const f=t.f,B=t.B||0;
      for(let n=1;n<=6;n++){const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.value=PT.partialFreq?PT.partialFreq(f,n,B):f*n;
        const amp=0.5/n;g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(amp,now+0.01);g.gain.exponentialRampToValueAtTime(0.0001,now+1.05);
        o.connect(g);g.connect(master);o.start(now);o.stop(now+1.1)}})
  }catch(e){}
  setTimeout(()=>{G.sounding=false},1200)}
async function listen(){
  if(G.listening)return;
  try{if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia))return;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    const ctx=tuneAudio();if(ctx.state!=='running'&&ctx.resume)await ctx.resume();
    const src=ctx.createMediaStreamSource(stream);const an=ctx.createAnalyser();an.fftSize=8192;an.smoothingTimeConstant=0;src.connect(an);
    G.stream=stream;G.ctx=ctx;G.an=an;G.buf=new Float32Array(an.fftSize);G.listening=true;G.raf=requestAnimationFrame(loop)}catch(e){$g('gtPrompt').textContent=(stepNow()&&stepNow().prompt?stepNow().prompt+' ':'')+(e&&e.name==='NotAllowedError'?'Microphone not allowed.':'No microphone available.')}}
function showOnly(id){['gtPick','gtStyle','gtSplits','gtTuneCard','gtCal','gtMute','gtCalNext'].forEach(k=>{const n=$g(k);if(n)n.hidden=k!==id});if(id)$g('gtune').classList.add('setup');if(id==='gtSplits'&&$g('gtSplitsStart'))$g('gtSplitsStart').disabled=!G.sess.targetChoice;syncA4Field()}
function activeA4(){let v=G.sess&&+G.sess.a4;if(!isFinite(v))v=440;v=Math.max(430,Math.min(450,Math.round(v*10)/10));if(G.sess)G.sess.a4=v;return v}
function syncA4Field(){const el=$g('gtA4');if(!el||!G.sess||document.activeElement===el)return;el.value=String(activeA4())}
function commitA4(raw){const cur=activeA4();const text=String(raw==null?'':raw).trim();let v=cur;if(text!==''&&isFinite(+text))v=Math.max(430,Math.min(450,Math.round(+text*10)/10));G.sess.a4=v;if(G.sess.calibration)G.sess.calibration.refA4=v;const el=$g('gtA4');if(el)el.value=String(v);saveSess();if(G.seq&&G.seq.length)render();else syncA4Field();if(stepNow()&&stepNow().phase!=='prescan')playStep()}
function calPrompt(){const m=PT.CAL_NOTES[G.calI];if(!$g('gtCalPrompt'))return;if(m==null){$g('gtCalPrompt').textContent='That is the last sample note. Use these measurements only if the screen says the coverage is enough. Nothing here marks a note as tuned.';return}$g('gtCalPrompt').textContent=PT.calibrationCue(m,G.sess.split2,G.sess.split3)}
function setCalResult(text){if($g('gtCalStatus'))$g('gtCalStatus').textContent=text}
function coverageLine(notes){const all=(notes||[]).filter(n=>n&&n.status==='measured');const meas=all.filter(n=>n.B>0).slice().sort((a,b)=>a.midi-b.midi);const cal=PT.deriveCalibration(notes,activeA4(),G.sess.type);const n=all.length;const word=n===1?' note measured. ':' notes measured. ';if(cal.accepted)return 'Coverage is enough to build targets. '+n+word+'A measurement is not a tuned note.';const need=[];if(meas.length<4)need.push('at least 4 kept notes');if(!meas.some(x=>x.midi<=45))need.push('a bass sample at A2 or below');if(!(meas.length&&meas[0].midi<=69&&meas[meas.length-1].midi>=69))need.push('samples on both sides of A4');if(!meas.some(x=>x.midi>=81))need.push('a treble sample at A5 or above');return 'Not enough coverage yet. '+n+word+(need.length?' Still needed: '+need.join(', ')+'.':'')+' A measurement is not a tuned note.'}
function refreshCalUse(){const notes=G.calNotes||[];const cal=PT.deriveCalibration(notes,activeA4(),G.sess.type);const use=$g('gtCalUse');if(use)use.disabled=!!G.calBusy||!cal.accepted;const cov=$g('gtCalCoverage');if(cov)cov.textContent=coverageLine(notes);paintCalKeys()}
function setHear(mode){const b=$g('gtCalHear');if(!b)return;const has=PT.CAL_NOTES[G.calI]!=null;b.classList.remove('primary','rejected');b.setAttribute('aria-busy',mode==='listening'||mode==='opening'?'true':'false');if(mode==='opening'){b.textContent='Opening microphone...';b.disabled=true;b.classList.add('primary')}else if(mode==='listening'){b.textContent='Listening...';b.disabled=true;b.classList.add('primary')}else if(mode==='accepted'){b.textContent='Measurement accepted';b.disabled=!has;b.classList.add('primary')}else if(mode==='rejected'){b.textContent='Not accepted. Try again.';b.disabled=!has;b.classList.add('rejected')}else{b.textContent='Listen to this note';b.disabled=!has;b.classList.add('primary')}}
function syncCalNav(){const retry=$g('gtCalRetry'),skip=$g('gtCalSkip'),has=PT.CAL_NOTES[G.calI]!=null;if(retry)retry.disabled=!has;if(skip)skip.disabled=!has;if(G.calBusy){if(retry)retry.disabled=!has;if(skip)skip.disabled=!has}}
function stopOwnedStream(stream){if(!stream)return;try{stream.getTracks().forEach(t=>t.stop())}catch(e){}if(G.calStream===stream)G.calStream=null}
function dropCalCapture(){G.calGen=(G.calGen||0)+1;G.calBusy=false;const cancel=G.calCancel;G.calCancel=null;if(cancel)cancel();const nodes=G.calNodes;G.calNodes=null;if(nodes){try{nodes.proc.disconnect()}catch(e){}try{nodes.src.disconnect()}catch(e){}try{nodes.mute.disconnect()}catch(e){}}stopOwnedStream(G.calStream);G.calOn=false}
function stopCal(){dropCalCapture()}
function tunePrefs(){let o={};try{o=JSON.parse(localStorage.getItem('pp-v44-resume')||'null')||{}}catch(e){}const p=o.prefs||{};return {temperament:p.temperament==='f3f4'?'f3f4':'a2a4',unison:p.unison==='after-checks'?'after-checks':'sanderson',ring:[1,2,4,8].indexOf(+p.ring)>=0?+p.ring:1}}
function saveTunePrefs(part){let o={};try{o=JSON.parse(localStorage.getItem('pp-v44-resume')||'null')||{}}catch(e){}o.prefs=Object.assign(tunePrefs(),part||{});o.prefs.ring=+o.prefs.ring||1;try{localStorage.setItem('pp-v44-resume',JSON.stringify(o));return true}catch(e){return false}}
function rejectText(label,reason){if(reason==='multiple-strings')return 'Heard more than one string. Mute the others and retry.';if(reason==='wrong-note')return 'That did not sound like '+label+'. Retry.';if(reason==='unclear'||reason==='few-partials')return 'Not enough reliable partials were heard to measure '+label+'. Retry.';if(reason==='fit')return 'The partials did not agree, so '+label+' was not measured. Retry.';if(reason==='short')return 'The take was too short. Play the note after Listening appears, and hold it.';if(reason==='silence')return 'No clear tone was in the take. Play '+label+' after Listening appears, and hold it. You do not need a harder strike if the note was already sounding.';if(reason==='early')return 'The take caught only the fade of '+label+'. It was likely played before Listening appeared. Play '+label+' after Listening appears, and hold it.';return 'Not accepted ('+(reason||'rejected')+'). Retry.'}
function heardWords(cents){if(!isFinite(+cents))return 'an unknown offset';return (cents>=0?'+':'')+(+cents).toFixed(1)+' cents'}
function buildCalKeys(){const box=$g('gtCalKeys');if(!box||box.childElementCount)return;const whites=[];for(let m=PT.LO;m<=PT.HI;m++)if(PT.isWhite(m))whites.push(m);whites.forEach(m=>{const k=document.createElement('button');k.type='button';k.className='wk';k.dataset.m=m;k.tabIndex=-1;box.append(k)});whites.forEach((m,i)=>{const n=m+1;if(n>PT.HI||PT.isWhite(n))return;const k=document.createElement('button');k.type='button';k.className='bk';k.dataset.m=n;k.style.left=((i+0.62)/whites.length*100)+'%';k.tabIndex=-1;box.append(k)})}
function paintCalKeys(){const box=$g('gtCalKeys');if(!box)return;buildCalKeys();const cur=PT.CAL_NOTES[G.calI];const stored={};(G.calNotes||[]).forEach(n=>{if(n&&n.status==='measured'&&n.B>0)stored[n.midi]=1});const scheduled={};PT.CAL_NOTES.forEach(m=>{scheduled[m]=1});const fail=G.calFail||{};box.querySelectorAll('button').forEach(el=>{const m=+el.dataset.m;el.classList.remove('meas','wait','fail','now','failTry','plain');const isCur=m===cur,isStored=!!stored[m],bad=!!fail[m];let state='Not a sample note. Not measured.';if(isStored){el.classList.add('meas');state='Measurement kept. Not a tuned note.'}else if(bad){el.classList.add('fail');state='This try was not kept.'}else if(scheduled[m]){el.classList.add('wait');state='Sample note still waiting.'}else el.classList.add('plain');if(isStored&&bad){el.classList.add('failTry');state='Measurement kept. The latest try was not kept. Not a tuned note.'}if(isCur){el.classList.add('now');state='Play this note. '+state}el.setAttribute('aria-label',PT.label(m)+'. '+state)});if(box)box.setAttribute('aria-label',(cur!=null?'Play '+PT.label(cur)+'. ':'')+'Colors show sample measurements, not tuning. Plain keys are not measured.')}
function logCalAttempt(midi,r,keptPrior){
 if(typeof SessionLog==='undefined')return;
 const d=(r&&r.diag)||{};
 try{SessionLog.record('cal-attempt',Object.assign({
  note:PT.label(midi),midi: midi,status:r?r.status:null,reason:r?(r.reason||'ok'):null,
  heardCents:r&&r.heardCents!=null?+r.heardCents.toFixed(1):null,
  B:r&&r.B?+r.B.toFixed(6):null,residualCents:r&&r.residualCents!=null?+r.residualCents.toFixed(2):null,
  partials:r&&r.partials?r.partials.length:0,confidence:r?r.confidence||null:null,
  keptPrior:!!keptPrior},G.calMeta||{},{
  wholeRms:d.wholeRms!=null?d.wholeRms:null,segRms:d.segRms!=null?d.segRms:null,
  strikeRms:d.strikeRms!=null?d.strikeRms:null,peakFrameRms:d.peakFrameRms!=null?d.peakFrameRms:null,
  segFloor:d.floor!=null?d.floor:null,segGate:d.gate!=null?d.gate:null,
  segAnchorSec:d.anchorSec!=null?d.anchorSec:null,segStartSec:d.segStartSec!=null?d.segStartSec:null,
  segSec:d.segSec!=null?d.segSec:null,segAttack:d.segAttack!=null?d.segAttack:null,
  startedHot:d.startedHot!=null?d.startedHot:null,
  frameRms:SessionLog.trimSeries(d.frames||[])}))}catch(e){}
 G.calMeta=null}
function applyCalResult(midi,r){const label=PT.label(midi);const prior=(G.calNotes||[]).filter(item=>item&&item.midi===midi&&item.status==='measured'&&item.B>0);if(!G.calFail)G.calFail={};if(r.status==='measured'){G.calNotes=(G.calNotes||[]).filter(item=>item.midi!==midi);G.calNotes.push(r);delete G.calFail[midi];const heard=heardWords(r.heardCents);const still=PT.CAL_NOTES[G.calI]===midi;const next=still?PT.CAL_NOTES[G.calI+1]:null;if(still&&next!=null){G.calI++;calPrompt();setCalResult(label+' accepted. It was '+heard+' from equal temperament when you played it. That offset is not the target. Now play '+PT.label(next)+'.')}else if(still){if($g('gtCalPrompt'))$g('gtCalPrompt').textContent=label+' accepted. That is the last sample note. Use these measurements only if the screen says the coverage is enough. Nothing here marks a note as tuned.';setCalResult(label+' accepted. It was '+heard+' from equal temperament when you played it. That offset is not the target.')}else setCalResult(label+' accepted. It was '+heard+' from equal temperament when you played it. That offset is not the target.');setHear('accepted')}else{G.calFail[midi]=r.reason||'rejected';const why=rejectText(label,r.reason);setCalResult(prior.length?why+' The earlier measurement of '+label+' is still kept.':why);setHear('rejected')}logCalAttempt(midi,r,prior.length>0);refreshCalUse()}
async function captureCal(){const midi=PT.CAL_NOTES[G.calI];if(midi==null||G.calBusy)return;const gen=G.calGen=(G.calGen||0)+1;G.calBusy=true;setHear('opening');syncCalNav();if($g('gtCalUse'))$g('gtCalUse').disabled=true;setCalResult('Opening the microphone for '+PT.label(midi)+'.');paintCalKeys();const tapAt=Date.now();let micAt=0,listAt=0,firstBufAt=0;let stream=null;try{if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia))throw new Error('no-mic');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});if(gen!==G.calGen){stopOwnedStream(stream);return}G.calStream=stream;micAt=Date.now();const ctx=tuneAudio();if(ctx.state!=='running'&&ctx.resume)await ctx.resume();if(gen!==G.calGen){stopOwnedStream(stream);return}setHear('listening');listAt=Date.now();setCalResult('Play '+PT.label(midi)+' now and hold it.');const src=ctx.createMediaStreamSource(stream);const chunks=[];const proc=ctx.createScriptProcessor(4096,1,1);const mute=ctx.createGain();mute.gain.value=0;src.connect(proc);proc.connect(mute);mute.connect(ctx.destination);const nodes={proc,src,mute};G.calNodes=nodes;let total=0;const sr0=ctx.sampleRate||48000;const det=PT.makeCaptureOnset(sr0);proc.onaudioprocess=e=>{if(!firstBufAt)firstBufAt=Date.now();const c=new Float32Array(e.inputBuffer.getChannelData(0));chunks.push(c);det.push(c);total+=c.length};const t0=Date.now();await new Promise(resolve=>{const tick=()=>{const waited=Date.now()-t0;const after=det.attackAt>=0?(total-det.attackAt)/sr0:0;if($g('gtCalStatus')&&det.attackAt<0)$g('gtCalStatus').textContent='Play '+PT.label(midi)+' now. '+Math.max(0,Math.ceil((10000-waited)/1000))+' s left to strike.';if((det.attackAt>=0&&after>=0.75)||waited>=10000){resolve();return}G.calTimer=setTimeout(tick,40)};G.calCancel=()=>{clearTimeout(G.calTimer);resolve()};tick()});if(gen!==G.calGen)return;try{proc.disconnect();src.disconnect();mute.disconnect()}catch(e){}if(G.calNodes===nodes)G.calNodes=null;stopOwnedStream(stream);stream=null;if(gen!==G.calGen)return;let n=0;chunks.forEach(c=>n+=c.length);const x=new Float32Array(n);let o=0;chunks.forEach(c=>{x.set(c,o);o+=c.length});const r=PT.analyzeCalibrationNote(x,ctx.sampleRate,{midi,a4:activeA4()});if(gen!==G.calGen)return;G.calMeta={sr:sr0,takeSec:+(x.length/sr0).toFixed(3),buffers:det.buffers,attackDetected:det.attackDetected,attackAtSec:det.attackAt>=0?+(det.attackAt/sr0).toFixed(3):null,startedHot:det.startedHot,maxChunkRms:+det.maxChunkRms.toFixed(5),maxSubRms:+det.maxSubRms.toFixed(5),onsetFloor:+det.floor.toFixed(5),tapToMicMs:micAt?micAt-tapAt:null,micToListenMs:micAt&&listAt?listAt-micAt:null,listenToFirstBufferMs:firstBufAt&&listAt?firstBufAt-listAt:null};applyCalResult(midi,r)}catch(e){if(gen!==G.calGen)return;stopOwnedStream(stream);const denied=e&&(e.name==='NotAllowedError'||e.name==='SecurityError');slog('cal-attempt',{note:PT.label(midi),midi,status:'error',reason:denied?'mic-denied':'mic-unavailable',tapToMicMs:Date.now()-tapAt});setCalResult(denied?'Microphone not allowed.':'No microphone available.');setHear('rejected');paintCalKeys()}finally{if(gen===G.calGen){G.calBusy=false;G.calCancel=null;refreshCalUse();syncCalNav()}}}
function skipCal(){const m=PT.CAL_NOTES[G.calI];if(m==null)return;const label=PT.label(m);dropCalCapture();slog('cal-skip',{note:label,midi:m});G.calI++;calPrompt();const next=PT.CAL_NOTES[G.calI];setCalResult(next!=null?label+' skipped. Now play '+PT.label(next)+'.':label+' skipped. That is the last sample note.');setHear('idle');refreshCalUse();syncCalNav()}
function retryCal(){const m=PT.CAL_NOTES[G.calI];if(m==null)return;dropCalCapture();captureCal()}
function openCal(){dropCalCapture();slog('cal-open',{});G.calI=0;G.calNotes=[];G.calFail={};G.calMulti={};if(!G.muteAck){showOnly('gtMute');slog('mute-card',{shown:true});return}showOnly('gtCal');calPrompt();setCalResult('Nothing accepted yet. A measurement is not a tuned note.');setHear('idle');refreshCalUse();syncCalNav()}
function beginCal(){G.muteAck=true;slog('mute-card',{acked:true});showOnly('gtCal');calPrompt();setCalResult('Nothing accepted yet. A measurement is not a tuned note.');setHear('idle');refreshCalUse();syncCalNav()}
function missedCal(){return PT.CAL_NOTES.filter(m=>!(G.calNotes||[]).some(n=>n&&n.midi===m&&n.status==='measured'&&n.B>0))}
function offerCalNext(){const cal=PT.deriveCalibration(G.calNotes,activeA4(),G.sess.type);const miss=missedCal().map(m=>PT.label(m));if($g('gtCalNextText'))$g('gtCalNextText').textContent=(cal.accepted?'Coverage is enough. ':'Not enough coverage yet. ')+(miss.length?'Missing: '+miss.join(', ')+'. ':'All sample notes are kept. ')+'A measurement is not a tuned note.';if($g('gtCalScan'))$g('gtCalScan').hidden=!cal.accepted;showOnly('gtCalNext')}
function useCal(){const cal=PT.deriveCalibration(G.calNotes,activeA4(),G.sess.type);if(!cal.accepted){offerCalNext();slog('calibration-refused',{keptNotes:(G.calNotes||[]).length});return}G.sess.calibration=cal;G.sess.targetChoice='measured';saveSess();slog('calibration-used',{keptNotes:cal.notes.length,accepted:true});offerCalNext()}
function scanFromCal(){if($g('gtSplitsStart'))$g('gtSplitsStart').disabled=!G.sess.targetChoice;showOnly('gtSplits');render()}
function fixCal(){const miss=missedCal();G.calI=miss.length?PT.CAL_NOTES.indexOf(miss[0]):0;showOnly('gtCal');calPrompt();setHear('idle');refreshCalUse();syncCalNav()}
function pauseTune(why){if(!G.on||G.paused)return;G.paused=true;G.pauseWhy=why||'button';stopListen();if($g('gtPause'))$g('gtPause').textContent='Resume';slog('session-pause',{why:G.pauseWhy,step:G.sess&&G.sess.step});const p=$g('gtPrompt');if(p&&G.sess&&G.sess.ready)p.textContent='Paused. Tap Resume to keep listening on this note.'}
function resumeTune(){if(!G.paused)return;G.paused=false;G.armAt=performance.now();if($g('gtPause'))$g('gtPause').textContent='Pause';slog('session-resume',{step:G.sess&&G.sess.step});listen();render()}
function saveProgress(from){let name=($g('gtPianoName')&&$g('gtPianoName').value||'').trim();if(!name){name=(window.prompt('Type a name for this piano, then tap Save progress','')||'').trim();if($g('gtPianoName'))$g('gtPianoName').value=name}if(!name){const box=from==='cal'?$g('gtCalStatus'):$g('gtPrompt');if(box)box.textContent='Type a name for this piano, then tap Save progress.';return}const kept=(G.calNotes||[]).filter(n=>n&&n.status==='measured').length;const place=from==='cal'?'Measure, '+((PT.CAL_NOTES[G.calI]!=null)?PT.label(PT.CAL_NOTES[G.calI]):'done')+', '+kept+' of '+PT.CAL_NOTES.length+' notes kept':(G.sess.ready?'Step '+(G.sess.step+1):'String layout');const item={name,at:Date.now(),place,screen:from||'tune',calI:G.calI|0,calNotes:G.calNotes||[],calFail:G.calFail||{},step:G.sess.step|0,type:G.sess.type,a4:G.sess.a4,split2:G.sess.split2,split3:G.sess.split3,ready:!!G.sess.ready,targetChoice:G.sess.targetChoice||null,pianoModel:G.sess.pianoModel||null,serial:G.sess.serial||''};let all={};try{all=JSON.parse(localStorage.getItem('pp-v44-resume')||'null')||{}}catch(e){}all.prefs=tunePrefs();all.items=(all.items||[]).filter(x=>x.name!==name);all.items.push(item);try{localStorage.setItem('pp-v44-resume',JSON.stringify(all));const back=JSON.parse(localStorage.getItem('pp-v44-resume'));const got=back&&(back.items||[]).some(x=>x.name===name&&x.place===place);const msg='Saved: '+name+', at '+place+'. '+new Date(item.at).toLocaleString();const box=from==='cal'?$g('gtCalStatus'):$g('gtPrompt');if(box)box.textContent=got?msg:'Could not save. The saved copy could not be read back.';slog('progress-saved',{name,place,ok:!!got})}catch(e){const box=from==='cal'?$g('gtCalStatus'):$g('gtPrompt');if(box)box.textContent='Could not save. '+(e&&e.name==='QuotaExceededError'?'Storage is full.':'The browser refused the write.');}}
function backCal(){dropCalCapture();setHear('idle');showOnly('gtSplits');syncA4Field()}
function downloadLog(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},60000)}
function exportLog(){
  if(typeof SessionLog==='undefined')return;
  slog('log-export',{entries:SessionLog.count()});
  const name='piano-session-log-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  const blob=new Blob([SessionLog.toJSON()],{type:'application/json'});
  let file=null;try{file=new File([blob],name,{type:'application/json'})}catch(e){}
  if(file&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
   navigator.share({files:[file],title:'Piano session log'}).catch(err=>{if(err&&err.name==='AbortError')return;downloadLog(blob,name)});return}
  downloadLog(blob,name)}
function hideSetup(){showOnly(null);$g('gtune').classList.remove('setup')}
function renderPianos(){const box=$g('gtSaved');if(!box)return;box.innerHTML='';loadPianos().forEach(p=>{const row=document.createElement('div');row.className='gtPiano';const nm=document.createElement('span');nm.className='gtPianoName';nm.textContent=p.name;const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Load';b.onclick=()=>loadPiano(p.id);const rn=document.createElement('button');rn.type='button';rn.className='btn';rn.textContent='Rename';rn.onclick=()=>{const n=(prompt('New name',p.name)||'').trim();if(!n)return;savePianos(PT.renameProfile(loadPianos(),p.id,n));renderPianos()};const del=document.createElement('button');del.type='button';del.className='btn';del.textContent='Delete';del.onclick=()=>{if(!confirm('Delete '+p.name+'?'))return;savePianos(PT.deleteProfile(loadPianos(),p.id));renderPianos()};row.append(nm,b,rn,del);box.append(row)})}
function loadPiano(id){const p=loadPianos().find(x=>x.id===id);if(!p)return;const model=p.pianoModel&&p.pianoModel.id?p.pianoModel:null;G.sess=Object.assign(blankSess(),{ready:true,type:p.style,a4:p.a4||440,split2:p.split2,split3:p.split3,prescan:p.prescan||{},step:p.step|0,tuningOk:!!p.tuningOk,profileId:p.id,calibration:p.calibration||null,targetChoice:p.targetChoice||(p.calibration&&p.calibration.accepted?'measured':'model'),pianoModel:model,serial:p.serial||(model&&model.serial)||''});if(G.sess.pianoModel)G.sess.pianoModel.serial=G.sess.serial;G.tuningOk=!!p.tuningOk;hideSetup();startWork()}
function readSerial(){const live=$g('gtSerialLive'),box=$g('gtSerial');const raw=live&&!live.closest('[hidden]')?live.value:box?box.value:'';return (raw||'').trim()}
function savePiano(){const name=($g('gtPianoName').value||'').trim();if(!name){$g('gtPianoName').focus();return}const serial=readSerial();if(G.sess.pianoModel){G.sess.pianoModel.serial=serial;G.sess.serial=serial}else G.sess.serial='';const id=G.sess.profileId||('k'+Date.now());const rec={id,name,style:G.sess.type,a4:G.sess.a4,split2:G.sess.split2,split3:G.sess.split3,prescan:G.sess.prescan,step:G.sess.step,tuningOk:!!G.tuningOk,updated:Date.now(),calibration:G.sess.calibration||null,targetChoice:G.sess.targetChoice||null,pianoModel:G.sess.pianoModel||null,serial:G.sess.serial||''};savePianos(PT.upsertProfile(loadPianos(),rec));G.sess.profileId=id;saveSess()}
function startWork(){G.tuningOk=!!G.sess.tuningOk;rebuild(true);renderKeys();render();renderList();G.logStepKey=null;slogStep();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep();listen()}
function openTune(){
  try{if(window.Tuner)Tuner.leave()}catch(e){}
  try{if(window.Meter)Meter.stop()}catch(e){}
  try{if(window.Metro&&Metro.M&&Metro.M.on)Metro.stop()}catch(e){}
  try{if(typeof au!=='undefined'&&au&&!au.paused)au.pause()}catch(e){}
  G.sess=loadSess();G.tuningOk=!!G.sess.tuningOk;G.on=true;
  if(typeof SessionLog!=='undefined'){if(!SessionLog.count())SessionLog.start({screen:'piano',appVersion:'V44',type:G.sess.type||null,a4:G.sess.a4});else slog('tune-open',{})}
  $g('gtune').hidden=false;document.body.classList.add('gtOpen');
  fillTypes();
  renderPianos();showOnly('gtPick');syncA4Field();if(G.ringTimer)clearTimeout(G.ringTimer);paintRing()}
function acceptTuning(){if(!G.showTuningCard)return;G.showTuningCard=false;G.tuningOk=true;G.sess.tuningOk=true;advanceStep('prescan',G.pendingFreq||0,false)}
function tapDone(){if(!G.showDone)return;G.showDone=false;G.sess.step=Math.min(G.seq.length-1,G.sess.step+1);G.hold=coreJump(G.hold||PT.emptyState(),G.sess.step,G.seq.length);G.hold.prescan=Object.assign({},G.sess.prescan);G.lastCents=null;G.colors={};saveSess();render();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep()}
function helpChrome(on){
  document.body.classList.toggle('tuneHelp',!!on);
  const back=document.getElementById('gtHelpBack');if(back)back.hidden=!on;
  const dial=document.getElementById('pdHelpBack');if(dial&&!on)dial.hidden=true;
  const tb=document.getElementById('gtToolsBack');if(tb)tb.textContent=on?'Back to piano':'Back to topics'}
function openToolsHelp(anchor){
  if(!G.on)return;
  G.holdHelp=true;G.wasListening=!!G.listening;stopListen();saveSess();
  $g('gtune').hidden=true;document.body.classList.remove('gtOpen');helpChrome(true);
  if(window.tab)tab('help');
  const h=document.getElementById(anchor||'h-piano-tools');if(h)h.scrollIntoView({block:'start'});
  const dial=document.getElementById('pdHelpBack');if(dial)dial.hidden=anchor!=='h-partial-dial'}
function returnFromHelp(){
  if(!G.holdHelp)return;
  G.holdHelp=false;helpChrome(false);
  const on=document.querySelector('nav button.on');
  if(!on||on.dataset.t!=='tun'){if(window.tab)tab('tun')}
  try{if(window.Tuner)Tuner.leave()}catch(e){}
  $g('gtune').hidden=false;document.body.classList.add('gtOpen');syncA4Field();
  if(G.wasListening)listen()}
function closeTune(){slog('session-end',{});G.holdHelp=false;G.wasListening=false;helpChrome(false);G.on=false;dropCalCapture();stopListen();G.sounding=false;$g('gtune').hidden=true;document.body.classList.remove('gtOpen');saveSess()}
function paintRing(){
  const ring=$g('strobeRing');if(!ring||!window.V44Core)return;
  if(!ring.childElementCount){for(let i=0;i<8;i++){const l=document.createElement('i');l.style.transform='rotate('+(i*45)+'deg) translateY(-130%)';ring.append(l)}const hub=document.createElement('i');hub.className='hub';ring.append(hub)}
  const step=G.seq&&G.sess?stepNow():null;
  const midi=step&&step.midi||69;
  const heard=typeof G.lastCents==='number'&&isFinite(G.lastCents)&&!G.paused;
  const n=V44Core.autoPartial(midi);
  const f=PT.etFreq(midi,G.sess&&G.sess.a4||440)*n;
  const offset=heard?f*(Math.pow(2,G.lastCents/1200)-1):0;
  const prefs=tunePrefs();
  const st=V44Core.ringFrame(G.ringPhase||0,offset,prefs.ring,1/30,heard&&G.listening);
  G.ringPhase=st.angle;
  ring.classList.toggle('grey',!!st.grey);
  const lights=ring.querySelectorAll('i');
  for(let j=0;j<4;j++){const on=st.lights&&st.lights[j]>0.45;if(lights[j*2])lights[j*2].classList.toggle('on',!!on);if(lights[j*2+1])lights[j*2+1].classList.toggle('on',!!on)}
  const hub=ring.querySelector('.hub');if(hub)hub.classList.toggle('on',!!st.center);
  const line=$g('gtPartialLine');
  if(line&&step&&step.midi)line.textContent='Listening to partial '+n+' of '+PT.label(step.midi)+'. '+(st.grey?'No clear signal.':(st.frozen?'That partial is on its target.':(st.clockwise?'Sharp.':'Flat.')));
  if(G.on)G.ringTimer=setTimeout(paintRing,33);
}
function init(){
  const b=$g('gtOpen');if(!b||G.ready)return;G.ready=true;
  b.onclick=openTune;
  $g('gtClose').onclick=closeTune;
  if($g('gtHelp'))$g('gtHelp').onclick=()=>openToolsHelp('h-piano-tools');
  if($g('pdHelp'))$g('pdHelp').onclick=()=>openToolsHelp('h-partial-dial');
  if($g('pdHelpBack'))$g('pdHelpBack').onclick=returnFromHelp;
  if($g('gtHelpBack'))$g('gtHelpBack').onclick=returnFromHelp;
  $g('gtBack').onclick=()=>jumpTo((G.sess.step||0)-1);
  $g('gtSteps').onclick=()=>{renderList();$g('gtList').hidden=!$g('gtList').hidden};
  $g('gtType').onchange=e=>{G.sess.type=e.target.value;rebuild(true);render();playStep()};
  $g('gtA4').onchange=e=>commitA4(e.target.value);
  if($g('gtSerialLive'))$g('gtSerialLive').onchange=e=>{const serial=(e.target.value||'').trim();G.sess.serial=G.sess.pianoModel?serial:'';if(G.sess.pianoModel)G.sess.pianoModel.serial=G.sess.serial;saveSess();render()};
  if($g('gtRetry'))$g('gtRetry').onclick=retryUnread;
  if($g('gtNew'))$g('gtNew').onclick=()=>{G.pickStyle=null;$g('gtStyleNext').disabled=true;document.querySelectorAll('#gtStyle button[data-style]').forEach(b=>b.classList.remove('on'));showOnly('gtStyle')};
  document.querySelectorAll('#gtStyle button[data-style]').forEach(b=>b.onclick=()=>{G.pickStyle=b.dataset.style;document.querySelectorAll('#gtStyle button[data-style]').forEach(x=>x.classList.toggle('on',x===b));$g('gtStyleNext').disabled=false;const spec=PT.MODELS[G.pickStyle];if($g('gtK200'))$g('gtK200').hidden=!spec;if($g('gtK200Spec')&&spec)$g('gtK200Spec').textContent=spec.maker+' '+spec.model+': '+spec.heightCm+' cm high, '+spec.widthCm+' cm wide, '+spec.depthCm+' cm deep, '+spec.weightKg+' kg. No. 1 speaking length '+spec.speakingNo1Mm+' mm. No duplex scale. No agraffes. This is a reference, not a tuning curve.';if(!spec&&$g('gtSerial'))$g('gtSerial').value=''});
  if($g('gtStyleNext'))$g('gtStyleNext').onclick=()=>{if(!G.pickStyle)return;const spec=PT.MODELS[G.pickStyle];const style=spec?spec.layoutStart:G.pickStyle;let sp=PT.SPLITS[style];if(spec&&spec.id==='kawai-k200'&&window.V44Core){const saved=(loadPianos()||[]).filter(p=>p.pianoModel&&p.pianoModel.id==='kawai-k200'&&p.split2<p.split3).sort((a,b)=>(b.updated||0)-(a.updated||0));sp=saved.length?{split2:saved[0].split2,split3:saved[0].split3}:{split2:V44Core.k200Splits().split2,split3:V44Core.k200Splits().split3}}if(!sp)return;const serial=($g('gtSerial')&&spec?$g('gtSerial').value:'').trim();G.sess.type=style;G.sess.pianoModel=spec?{id:spec.id,maker:spec.maker,model:spec.model,serial}:null;G.sess.serial=spec?serial:'';G.sess.split2=sp.split2;G.sess.split3=sp.split3;G.pickSplit=2;if($g('gtSerialLive'))$g('gtSerialLive').value=G.sess.serial;slog('layout-chosen',{style,split2:sp.split2,split3:sp.split3,model:spec?spec.id:null});renderSplits();fillTypes();showOnly('gtSplits')};
  document.querySelectorAll('#gtSplits .pick').forEach(b=>b.onclick=()=>{G.pickSplit=+b.dataset.which;renderSplits()});
  if($g('gtSplitsStart'))$g('gtSplitsStart').onclick=()=>{if(!(G.sess.split2<G.sess.split3)||!G.sess.targetChoice)return;G.sess.ready=true;G.sess.step=0;G.sess.prescan={};G.tuningOk=false;G.sess.tuningOk=false;G.pickSplit=0;hideSetup();startWork()};
  if($g('gtCalModel'))$g('gtCalModel').onclick=()=>{G.sess.targetChoice='model';G.sess.calibration={accepted:false,fallback:'model',status:'model',version:PT.CAL_VERSION,algorithm:'size-model',targets:null};saveSess();if($g('gtSplitsStart'))$g('gtSplitsStart').disabled=false;render()};
  if($g('gtCalOpen'))$g('gtCalOpen').onclick=openCal;
  if($g('gtCalBack'))$g('gtCalBack').onclick=backCal;
  if($g('gtCalSkip'))$g('gtCalSkip').onclick=skipCal;
  if($g('gtCalRetry'))$g('gtCalRetry').onclick=retryCal;
  if($g('gtCalHear'))$g('gtCalHear').onclick=()=>{captureCal()};
  if($g('gtCalUse'))$g('gtCalUse').onclick=useCal;
  if($g('gtCalLog'))$g('gtCalLog').onclick=exportLog;
  if($g('gtLog'))$g('gtLog').onclick=exportLog;
  if($g('gtTuneOk'))$g('gtTuneOk').onclick=acceptTuning;
  if($g('gtDone'))$g('gtDone').onclick=tapDone;
  if($g('gtSave'))$g('gtSave').onclick=savePiano;
  if($g('gtMuteOk'))$g('gtMuteOk').onclick=beginCal;
  if($g('gtCalScan'))$g('gtCalScan').onclick=scanFromCal;
  if($g('gtCalFix'))$g('gtCalFix').onclick=fixCal;
  if($g('gtPause'))$g('gtPause').onclick=()=>{if(G.paused)resumeTune();else pauseTune('button')};
  if($g('gtSaveProgress'))$g('gtSaveProgress').onclick=()=>saveProgress('layout');
  if($g('gtSaveProgressCal'))$g('gtSaveProgressCal').onclick=()=>saveProgress('cal');
  if($g('gtSaveProgressTune'))$g('gtSaveProgressTune').onclick=()=>saveProgress('tune');
  ['gtRingSpeed','gtTemper','gtUnison'].forEach(id=>{const el=$g(id);if(!el)return;const prefs=tunePrefs();if(id==='gtRingSpeed')el.value=String(prefs.ring);if(id==='gtTemper')el.value=prefs.temperament;if(id==='gtUnison')el.value=prefs.unison;el.onchange=()=>{saveTunePrefs({ring:+$g('gtRingSpeed').value,temperament:$g('gtTemper').value,unison:$g('gtUnison').value});if(G.sess&&G.sess.ready){rebuild(true);render()}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.on)pauseTune('hidden')});
}
function previewInterval(samples,sampleRate){
 const step=stepNow();if(!step||step.phase!=='check')return null;
 G.previewHold=true;
 G.beatRead=PT.analyzeIntervalAudio(samples,sampleRate,intervalQuery(step));
 G.showDone=true;G.logBeatKey=null;logBeatRead(step,intervalQuery(step).pairs);render();return G.beatRead}
Object.assign(PianoTune,{init,open:openTune,close:closeTune,playAgain:playStep,jump:jumpTo,holdingHelp:()=>!!G.holdHelp,returnFromHelp,openHelpTopic:openToolsHelp,previewInterval,feedHz:function(freq,now){if(G.sounding)return{ignored:true};onFreq(freq,now==null?performance.now():now);return{ignored:false,step:G.sess.step,sounding:G.sounding}},_sounding:()=>G.sounding,_setSounding:v=>{G.sounding=!!v},_attack:()=>{G.attack=true},_session:()=>G.sess});
window.PianoTune=PianoTune;
document.addEventListener('DOMContentLoaded',init);
if(document.readyState!=='loading')init();
}
