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
  const b=a+spec.semi,ca=(curve&&curve[a])||0,cb=(curve&&curve[b])||0;
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
  PRESCAN.forEach(m=>steps.push(step({phase:'prescan',midi:m,title:'Pre-scan '+label(m),prompt:'Play '+plainName(m)+' and hold it. A steady reading is saved however sharp or flat it is. If it cannot be read, the scan moves on.'})));
  if(raise)for(let m=LO;m<=HI;m++)steps.push(step({phase:'raise',midi:m,title:'Pitch raise '+label(m),prompt:promptFor('raise',m)}));
  const skeleton=[69,57,53,61,65];
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
  let mute='This note has one string.';
  if(n>1&&i===1)mute='Mute the other strings so only this one sounds.';
  else if(n>1&&i===n)mute='Mute every string except this last one, and match it to the others.';
  else if(n>1)mute='Mute the strings you are not tuning, and match this one to the string already set.';
  if(!name)return {plain:mute,detail:'',hearing:'pitch'};
  return {plain:'Play '+name+' alone. '+mute+' Listening for this string\'s pitch.',detail:'',hearing:'pitch'}}
 function stringPrompt(i,n){
  if(n<=1)return 'Tune this string.';
  if(i===1)return 'Tune this string first.';
  if(n===2)return 'Tune the other string to match.';
  if(i===n)return 'Tune the last string to match.';
  return 'Tune the next string to match.'}
 function expandTuning(steps,split2,split3){
  const out=[];
  (steps||[]).forEach(s=>{
   if(s.phase==='prescan'){out.push(Object.assign({},s,{stringIndex:1,stringCount:1,lastString:false,waitDone:false}));return}
   if(s.phase==='check'||!s.midi){out.push(Object.assign({},s,{stringIndex:1,stringCount:1,lastString:true,waitDone:true}));return}
   const n=stringCount(s.midi,split2,split3);
   for(let i=1;i<=n;i++)out.push(Object.assign({},s,{stringIndex:i,stringCount:n,lastString:i===n,waitDone:i===n,title:s.title+' string '+i+' of '+n,prompt:stringPrompt(i,n)}));
  });
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
 return{LO,HI,NAMES,TYPICAL,SIZES,SPLITS,HOLD_MS,TOL,RAISE_IF_FLAT,OVERPULL,PRESCAN,PRESCAN_WAIT,GOT_MS,DIFFERENT,METER,INTERVALS,label,plainName,isWhite,smoothTypical,bOf,sizeCurve,typicalCurve,curveFor,etFreq,targetFreq,partialFreq,expectedBeat,measureBeats,analyzeIntervalAudio,listenCue,needsPitchRaise,overpullTarget,nearestMeasured,interpretFreq,allowPrescan,isRing,confidenceFor,meterView,stringCount,stringPrompt,expandTuning,upsertProfile,renameProfile,deleteProfile,buildSequence,emptyState,applySample,jump}})();
if(typeof module!=='undefined')module.exports=PianoTune;

if(typeof document!=='undefined'){
const PT=PianoTune,coreJump=PianoTune.jump,GK='pp-pianotune';
const G={on:false,listening:false,sounding:false,stream:null,ctx:null,play:null,an:null,raf:0,buf:null,sess:null,seq:[],curve:null,built:false,env:[],showGot:false,showNext:false,showUnread:false,blinking:false,gotMidi:null,prevFreq:0,attack:false,sawQuiet:false,peak:0,gotUntil:0,settleUntil:0,armAt:0};
const $g=id=>document.getElementById(id);
const PKEY='pp-piano-profiles';
function blankSess(){return{v:3,type:null,a4:440,step:0,prescan:{},split2:null,split3:null,tuningOk:false,profileId:null,ready:false,updated:0}}
function loadSess(){try{const o=JSON.parse(localStorage.getItem(GK)||'null');if(o&&o.v===3)return o;if(o&&o.v===2&&o.type&&PT.SPLITS[o.type])return Object.assign(blankSess(),o,{v:3,ready:true,split2:PT.SPLITS[o.type].split2,split3:PT.SPLITS[o.type].split3})}catch(e){}return blankSess()}
function saveSess(){try{G.sess.updated=Date.now();localStorage.setItem(GK,JSON.stringify({v:3,type:G.sess.type,a4:G.sess.a4,step:G.sess.step,prescan:G.sess.prescan,split2:G.sess.split2,split3:G.sess.split3,tuningOk:!!G.sess.tuningOk,profileId:G.sess.profileId,ready:!!G.sess.ready,updated:G.sess.updated}))}catch(e){}}
function loadPianos(){try{const a=JSON.parse(localStorage.getItem(PKEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function savePianos(a){try{localStorage.setItem(PKEY,JSON.stringify(a))}catch(e){}}
function profiles(){try{const a=JSON.parse(localStorage.getItem('pp-tuner-profiles')||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function findProfile(id){return profiles().find(p=>p.id===id)||null}
function activeCurve(){
  const t=G.sess.type||'concert';
  if(String(t).indexOf('profile:')===0)return PT.curveFor(t,findProfile(t.slice(8)));
  return PT.curveFor(t)}
function bFn(){const id=G.sess.type;return PT.SIZES[id]?midi=>PT.bOf(PT.SIZES[id],midi):null}
function rebuild(keepStep){
  const raise=PT.needsPitchRaise(G.sess.prescan||{});
  G.curve=activeCurve();
  G.seq=PT.expandTuning(PT.buildSequence({raise}),G.sess.split2,G.sess.split3);
  if(!keepStep)G.sess.step=0;
  if(G.sess.step>=G.seq.length)G.sess.step=G.seq.length-1;
  if(G.sess.step<0)G.sess.step=0;
  G.hold=PT.emptyState();G.hold.step=G.sess.step;G.hold.prescan=Object.assign({},G.sess.prescan||{});
  G.env=[];saveSess()}
function stepNow(){return G.seq[G.sess.step]||G.seq[0]}
function targetCents(step,midi){
  const base=(G.curve&&G.curve.cents[midi])||0;
  if(step&&step.phase==='raise')return PT.overpullTarget(base,PT.nearestMeasured(G.sess.prescan,midi));
  return base}
function beatsText(step){
  if(!step||!step.intervals)return'';
  const lines=step.intervals.map(iv=>{const e=PT.expectedBeat(G.curve.cents,bFn(),G.sess.a4,iv.a,iv.kind);if(!e||!isFinite(e.beat))return'';return e.label+' size model '+e.beat.toFixed(1)+' beats/s, harmonic model '+e.harmonic.toFixed(1)+' beats/s (partials '+e.p+'/'+e.q+')'}).filter(Boolean);
  return lines.length?lines.join('. ')+'. Models only. Not measured on this piano.':'';
}
function intervalQuery(step){
  const pairs=(step.intervals||[]).map(iv=>PT.expectedBeat(G.curve.cents,bFn(),G.sess.a4,iv.a,iv.kind)).filter(Boolean);
  const notes=[],seen={};
  (step.midis||[]).forEach(m=>{if(seen[m])return;seen[m]=1;notes.push(PT.targetFreq(m,(G.curve&&G.curve.cents&&G.curve.cents[m])||0,G.sess.a4))});
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
function readInterval(step,now){
  if(!G.wave||!G.waveSr){G.beatRead={status:'uncertain',confidence:'uncertain',reason:'short'};return}
  const need=Math.floor(G.waveSr*1);
  if(G.waveN<need){G.beatRead={status:'uncertain',confidence:'uncertain',reason:'short'};return}
  const t0=now||0;
  G.beatRead=PT.analyzeIntervalAudio(waveSlice(need),G.waveSr,intervalQuery(step));
  if(G.beatRead)G.beatRead.lagMs=t0?Math.max(0,(performance.now()-t0)):null;
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
  const cue=PT.listenCue(step,step.phase==='check'?G.beatRead:null);
  let plain=G.showGot?'Saved this note.':(G.showUnread?'No clear reading. Use Retry unread to hear this note again.':(cue.plain||step.prompt||''));
  if(!G.showGot&&!G.showUnread){
   if(!G.listening)plain+=' Microphone is off.';
   else if(cue.state)plain+=' '+cue.state;
   else plain+=' Listening now.'}
  $g('gtPrompt').textContent=plain;
  if($g('gtDetail')){$g('gtDetail').textContent=cue.detail||'';$g('gtDetail').hidden=!cue.detail}
  $g('gtCount').textContent=(shown+1)+' / '+G.seq.length;
  const beats=beatsText(step);
  const beatLine=step.phase==='check'?(beats?beats+' ':'')+measuredText():beats;
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
  $g('gtNeedle').style.left=view.pct+'%';
  $g('gtNeedleWrap').classList.toggle('ok',typeof cents==='number'&&isFinite(cents)&&Math.abs(cents)<=PT.TOL);
  $g('gtNeedleWrap').classList.toggle('past',!!view.past);
  if($g('gtRetry'))$g('gtRetry').hidden=unreadIndex()<0;
  if($g('gtDone'))$g('gtDone').hidden=!G.showDone;
  if($g('gtTuneCard'))$g('gtTuneCard').hidden=!G.showTuningCard;
  $g('gtune').classList.toggle('hasDone',!!G.showDone);
  paintKeys(G.colors,G.hold?G.hold.lean:0);
  $g('gtType').value=G.sess.type&&$g('gtType').querySelector('option[value="'+G.sess.type+'"]')?G.sess.type:'concert';
  $g('gtA4').value=G.sess.a4}
function fillTypes(){
  const s=$g('gtType');const curV=G.sess.type;s.innerHTML='';
  [['concert','Concert grand (9 ft)'],['baby','Baby grand'],['studio','Studio upright'],['spinet','Spinet'],['typical','Typical']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.append(o)});
  profiles().forEach(p=>{const o=document.createElement('option');o.value='profile:'+p.id;o.textContent='Saved: '+p.name;s.append(o)});
  if(curV&&s.querySelector('option[value="'+curV+'"]'))s.value=curV}
function renderList(){
  const ul=$g('gtList');ul.innerHTML='';
  G.seq.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(i+1)+'. '+s.title;if(i===G.sess.step)b.className='on';b.onclick=()=>{jumpTo(i);$g('gtList').hidden=true};ul.append(b)});
}
function jumpTo(i){G.previewHold=false;G.showGot=false;G.showUnread=false;G.showNext=false;G.showDone=false;G.showTuningCard=false;G.gotUntil=0;G.settleUntil=0;G.prevFreq=0;G.hold=coreJump(G.hold||PT.emptyState(),i,G.seq.length);G.sess.step=G.hold.step;G.colors={};G.lastCents=null;G.measured=null;G.env=[];clearWave();saveSess();render();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep()}
function onKey(m){if(G.pickSplit){if(G.pickSplit===3)G.sess.split3=m;else G.sess.split2=m;if(G.sess.split2!=null&&G.sess.split3!=null&&G.sess.split2>=G.sess.split3)G.sess.split2=G.sess.split3-1;renderSplits();return}jumpToMidi(m)}
function jumpToMidi(m){const i=G.seq.findIndex((s,idx)=>idx>=G.sess.step&&s.midis&&s.midis.indexOf(m)>=0);if(i>=0)jumpTo(i)}
function renderSplits(){renderKeys();if($g('gtSplit3Lab'))$g('gtSplit3Lab').textContent='Lowest 3-string key: '+(G.sess.split3!=null?PT.label(G.sess.split3):'');if($g('gtSplit2Lab'))$g('gtSplit2Lab').textContent='Lowest 2-string key: '+(G.sess.split2!=null?PT.label(G.sess.split2):'');document.querySelectorAll('#gtSplits .pick').forEach(b=>b.classList.toggle('on',+b.dataset.which===G.pickSplit));document.querySelectorAll('#gtKeys button').forEach(el=>{const m=+el.dataset.m;el.classList.remove('next','ok','bad','sharp','flat','dim','near','blink');el.classList.add(m===G.sess.split2||m===G.sess.split3?'next':'dim')})}
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
    if(step&&step.phase==='check'&&!G.previewHold){
     appendWave(G.buf,G.ctx.sampleRate);
     if(!G.beatAt||now-G.beatAt>450){G.beatAt=now;readInterval(step,now);render()}
    }else if(!(step&&step.phase==='check')){
     const f=TunerCore.yin(G.buf,G.ctx.sampleRate,0.12);
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
    const hz=PT.targetFreq(m,targetCents(step,m),G.sess.a4);
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
   if(step.phase==='prescan'){advanceStep('prescan',picked.freq,false);return}
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
  else{G.showGot=false;G.showNext=false;render();if(was==='prescan')playStep();else setTimeout(playStep,280)}}
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
  const freqs=(step.phase==='check'?step.midis:[midi]).map(m=>PT.targetFreq(m,targetCents(step,m),G.sess.a4));
  sound(freqs)}
function sound(freqs){
  G.sounding=true;G.lastCents=null;
  try{
    const ctx=tuneAudio();if(ctx.state!=='running'&&ctx.resume)ctx.resume();
    const now=ctx.currentTime;const master=ctx.createGain();master.gain.value=0.2;master.connect(ctx.destination);
    freqs.forEach(f=>{
      const B=(bFn()?bFn()(69):0.0004);
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
function showOnly(id){['gtPick','gtStyle','gtSplits','gtTuneCard'].forEach(k=>{const n=$g(k);if(n)n.hidden=k!==id});if(id)$g('gtune').classList.add('setup')}
function hideSetup(){showOnly(null);$g('gtune').classList.remove('setup')}
function renderPianos(){const box=$g('gtSaved');if(!box)return;box.innerHTML='';loadPianos().forEach(p=>{const row=document.createElement('div');row.className='gtPiano';const nm=document.createElement('span');nm.className='gtPianoName';nm.textContent=p.name;const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Load';b.onclick=()=>loadPiano(p.id);const rn=document.createElement('button');rn.type='button';rn.className='btn';rn.textContent='Rename';rn.onclick=()=>{const n=(prompt('New name',p.name)||'').trim();if(!n)return;savePianos(PT.renameProfile(loadPianos(),p.id,n));renderPianos()};const del=document.createElement('button');del.type='button';del.className='btn';del.textContent='Delete';del.onclick=()=>{if(!confirm('Delete '+p.name+'?'))return;savePianos(PT.deleteProfile(loadPianos(),p.id));renderPianos()};row.append(nm,b,rn,del);box.append(row)})}
function loadPiano(id){const p=loadPianos().find(x=>x.id===id);if(!p)return;G.sess=Object.assign(blankSess(),{ready:true,type:p.style,a4:p.a4||440,split2:p.split2,split3:p.split3,prescan:p.prescan||{},step:p.step|0,tuningOk:!!p.tuningOk,profileId:p.id});G.tuningOk=!!p.tuningOk;hideSetup();startWork()}
function savePiano(){const name=($g('gtPianoName').value||'').trim();if(!name){$g('gtPianoName').focus();return}const id=G.sess.profileId||('k'+Date.now());const rec={id,name,style:G.sess.type,a4:G.sess.a4,split2:G.sess.split2,split3:G.sess.split3,prescan:G.sess.prescan,step:G.sess.step,tuningOk:!!G.tuningOk,updated:Date.now()};savePianos(PT.upsertProfile(loadPianos(),rec));G.sess.profileId=id;saveSess()}
function startWork(){G.tuningOk=!!G.sess.tuningOk;rebuild(true);renderKeys();render();renderList();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep();listen()}
function openTune(){
  try{if(window.Tuner)Tuner.leave()}catch(e){}
  try{if(window.Meter)Meter.stop()}catch(e){}
  try{if(window.Metro&&Metro.M&&Metro.M.on)Metro.stop()}catch(e){}
  try{if(typeof au!=='undefined'&&au&&!au.paused)au.pause()}catch(e){}
  G.sess=loadSess();G.tuningOk=!!G.sess.tuningOk;G.on=true;$g('gtune').hidden=false;document.body.classList.add('gtOpen');
  fillTypes();
  renderPianos();showOnly('gtPick')}
function acceptTuning(){if(!G.showTuningCard)return;G.showTuningCard=false;G.tuningOk=true;G.sess.tuningOk=true;advanceStep('prescan',G.pendingFreq||0,false)}
function tapDone(){if(!G.showDone)return;G.showDone=false;G.sess.step=Math.min(G.seq.length-1,G.sess.step+1);G.hold=coreJump(G.hold||PT.emptyState(),G.sess.step,G.seq.length);G.hold.prescan=Object.assign({},G.sess.prescan);G.lastCents=null;G.colors={};saveSess();render();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep()}
function helpChrome(on){
  document.body.classList.toggle('tuneHelp',!!on);
  const back=document.getElementById('gtHelpBack');if(back)back.hidden=!on;
  const tb=document.getElementById('gtToolsBack');if(tb)tb.textContent=on?'Back to piano':'Back to topics'}
function openToolsHelp(){
  if(!G.on)return;
  G.holdHelp=true;G.wasListening=!!G.listening;stopListen();saveSess();
  $g('gtune').hidden=true;document.body.classList.remove('gtOpen');helpChrome(true);
  if(window.tab)tab('help');
  const h=document.getElementById('h-piano-tools');if(h)h.scrollIntoView({block:'start'})}
function returnFromHelp(){
  if(!G.holdHelp)return;
  G.holdHelp=false;helpChrome(false);
  const on=document.querySelector('nav button.on');
  if(!on||on.dataset.t!=='tun'){if(window.tab)tab('tun')}
  try{if(window.Tuner)Tuner.leave()}catch(e){}
  $g('gtune').hidden=false;document.body.classList.add('gtOpen');
  if(G.wasListening)listen()}
function closeTune(){G.holdHelp=false;G.wasListening=false;helpChrome(false);G.on=false;stopListen();G.sounding=false;$g('gtune').hidden=true;document.body.classList.remove('gtOpen');saveSess()}
function init(){
  const b=$g('gtOpen');if(!b||G.ready)return;G.ready=true;
  b.onclick=openTune;
  $g('gtClose').onclick=closeTune;
  if($g('gtHelp'))$g('gtHelp').onclick=openToolsHelp;
  if($g('gtHelpBack'))$g('gtHelpBack').onclick=returnFromHelp;
  $g('gtBack').onclick=()=>jumpTo((G.sess.step||0)-1);
  $g('gtSteps').onclick=()=>{renderList();$g('gtList').hidden=!$g('gtList').hidden};
  $g('gtType').onchange=e=>{G.sess.type=e.target.value;rebuild(true);render();playStep()};
  $g('gtA4').onchange=e=>{let v=+e.target.value;if(!isFinite(v))v=440;v=Math.max(430,Math.min(450,Math.round(v*10)/10));G.sess.a4=v;saveSess();render();if(stepNow()&&stepNow().phase!=='prescan')playStep()};
  if($g('gtRetry'))$g('gtRetry').onclick=retryUnread;
  if($g('gtNew'))$g('gtNew').onclick=()=>{G.pickStyle=null;$g('gtStyleNext').disabled=true;document.querySelectorAll('#gtStyle button[data-style]').forEach(b=>b.classList.remove('on'));showOnly('gtStyle')};
  document.querySelectorAll('#gtStyle button[data-style]').forEach(b=>b.onclick=()=>{G.pickStyle=b.dataset.style;document.querySelectorAll('#gtStyle button[data-style]').forEach(x=>x.classList.toggle('on',x===b));$g('gtStyleNext').disabled=false});
  if($g('gtStyleNext'))$g('gtStyleNext').onclick=()=>{if(!G.pickStyle)return;const sp=PT.SPLITS[G.pickStyle];G.sess.type=G.pickStyle;G.sess.split2=sp.split2;G.sess.split3=sp.split3;G.pickSplit=3;renderSplits();fillTypes();showOnly('gtSplits')};
  document.querySelectorAll('#gtSplits .pick').forEach(b=>b.onclick=()=>{G.pickSplit=+b.dataset.which;renderSplits()});
  if($g('gtSplitsStart'))$g('gtSplitsStart').onclick=()=>{if(!(G.sess.split2<G.sess.split3))return;G.sess.ready=true;G.sess.step=0;G.sess.prescan={};G.tuningOk=false;G.sess.tuningOk=false;G.pickSplit=0;hideSetup();startWork()};
  if($g('gtTuneOk'))$g('gtTuneOk').onclick=acceptTuning;
  if($g('gtDone'))$g('gtDone').onclick=tapDone;
  if($g('gtSave'))$g('gtSave').onclick=savePiano;
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.on)stopListen()});
}
function previewInterval(samples,sampleRate){
 const step=stepNow();if(!step||step.phase!=='check')return null;
 G.previewHold=true;
 G.beatRead=PT.analyzeIntervalAudio(samples,sampleRate,intervalQuery(step));
 G.showDone=true;render();return G.beatRead}
Object.assign(PianoTune,{init,open:openTune,close:closeTune,playAgain:playStep,jump:jumpTo,holdingHelp:()=>!!G.holdHelp,returnFromHelp,previewInterval,feedHz:function(freq,now){if(G.sounding)return{ignored:true};onFreq(freq,now==null?performance.now():now);return{ignored:false,step:G.sess.step,sounding:G.sounding}},_sounding:()=>G.sounding,_setSounding:v=>{G.sounding=!!v},_attack:()=>{G.attack=true},_session:()=>G.sess});
window.PianoTune=PianoTune;
document.addEventListener('DOMContentLoaded',init);
if(document.readyState!=='loading')init();
}
