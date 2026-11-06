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
  const b=a+spec.semi,ca=curve[a]||0,cb=curve[b]||0;
  const fa=targetFreq(a,ca,a4),fb=targetFreq(b,cb,a4);
  const Ba=bFn?bFn(a):0,Bb=bFn?bFn(b):0;
  const beat=Math.abs(partialFreq(fa,spec.p,Ba)-partialFreq(fb,spec.q,Bb));
  return{a,b,kind,name:spec.name,beat,label:label(a)+'-'+label(b)}}
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
  steps.push(step({phase:'check',title:'Progressive thirds',prompt:'Play F3-A3, then A3-C#4, then C#4-F4. The beats should get faster. Each highlighted key turns green when it is in tune.',midis:[53,57,61,65],intervals:[{a:53,kind:'M3'},{a:57,kind:'M3'},{a:61,kind:'M3'}]}));
  [62,55,60,64,59,54,56,58,63].forEach(m=>steps.push(step({phase:'temper',midi:m,title:'Tune '+label(m),prompt:promptFor('temper',m)})));
  steps.push(step({phase:'check',title:'Check fourth, fifth and sixth',prompt:'Play each pair. Compare the beat you hear with the expected rate.',midis:[57,62,64,53],intervals:[{a:57,kind:'P4'},{a:57,kind:'P5'},{a:53,kind:'M6'}]}));
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
 function jump(state,index,count){
  const i=Math.max(0,Math.min(count-1,index|0));
  return Object.assign({},state,{step:i,holdStart:null,holdMidi:null,green:{},hist:[],lean:0,outSince:null})}
 return{LO,HI,NAMES,TYPICAL,SIZES,HOLD_MS,TOL,RAISE_IF_FLAT,OVERPULL,PRESCAN,PRESCAN_WAIT,GOT_MS,DIFFERENT,METER,INTERVALS,label,plainName,isWhite,smoothTypical,bOf,sizeCurve,typicalCurve,curveFor,etFreq,targetFreq,partialFreq,expectedBeat,measureBeats,needsPitchRaise,overpullTarget,nearestMeasured,interpretFreq,allowPrescan,isRing,confidenceFor,meterView,buildSequence,emptyState,applySample,jump}})();
if(typeof module!=='undefined')module.exports=PianoTune;

if(typeof document!=='undefined'){
const PT=PianoTune,coreJump=PianoTune.jump,GK='pp-pianotune';
const G={on:false,listening:false,sounding:false,stream:null,ctx:null,play:null,an:null,raf:0,buf:null,sess:null,seq:[],curve:null,built:false,env:[],showGot:false,showNext:false,showUnread:false,blinking:false,gotMidi:null,prevFreq:0,attack:false,sawQuiet:false,peak:0,gotUntil:0,settleUntil:0,armAt:0};
const $g=id=>document.getElementById(id);
function loadSess(){try{const o=JSON.parse(localStorage.getItem(GK)||'null');if(o&&o.v===2)return o}catch(e){}return{v:2,type:'concert',a4:440,step:0,prescan:{},updated:0}}
function saveSess(){try{G.sess.updated=Date.now();localStorage.setItem(GK,JSON.stringify({v:2,type:G.sess.type,a4:G.sess.a4,step:G.sess.step,prescan:G.sess.prescan,updated:G.sess.updated}))}catch(e){}}
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
  G.seq=PT.buildSequence({raise});
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
  return step.intervals.map(iv=>{const e=PT.expectedBeat(G.curve.cents,bFn(),G.sess.a4,iv.a,iv.kind);return e&&isFinite(e.beat)?e.label+' '+e.name+' about '+e.beat.toFixed(1)+' beats/s':''}).filter(Boolean).join('. ');
}
function renderKeys(){
  const box=$g('gtKeys');if(!box||box.childElementCount)return;
  const whites=[];for(let m=PT.LO;m<=PT.HI;m++)if(PT.isWhite(m))whites.push(m);
  whites.forEach(m=>{const k=document.createElement('button');k.type='button';k.className='wk';k.dataset.m=m;k.setAttribute('aria-label',PT.label(m));k.onclick=()=>jumpToMidi(m);box.append(k)});
  whites.forEach((m,i)=>{const n=m+1;if(n>PT.HI||PT.isWhite(n))return;const k=document.createElement('button');k.type='button';k.className='bk';k.dataset.m=n;k.style.left=((i+0.62)/whites.length*100)+'%';k.setAttribute('aria-label',PT.label(n));k.onclick=()=>jumpToMidi(n);box.append(k)});
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
  $g('gtPrompt').textContent=G.showGot?'Saved.':(step.prompt||'');
  $g('gtCount').textContent=(shown+1)+' / '+G.seq.length;
  const beats=beatsText(step);
  const measured=G.measured;
  $g('gtBeats').textContent=(beats?('Expected: '+beats+'. '):'')+(step.phase==='check'?(typeof measured==='number'?'Measured about '+measured.toFixed(1)+' beats/s.':'Measured: play both notes together.'):'');
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
  paintKeys(G.colors,G.hold?G.hold.lean:0);
  $g('gtType').value=G.sess.type&&$g('gtType').querySelector('option[value="'+G.sess.type+'"]')?G.sess.type:'concert';
  $g('gtA4').value=G.sess.a4}
function fillTypes(){
  const s=$g('gtType');const curV=G.sess.type;s.innerHTML='';
  [['concert','Concert grand (9 ft)'],['baby','Baby grand'],['studio','Studio upright'],['spinet','Spinet'],['typical','Typical']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.append(o)});
  profiles().forEach(p=>{const o=document.createElement('option');o.value='profile:'+p.id;o.textContent='Saved: '+p.name;s.append(o)});
  if(!s.querySelector('option[value="'+curV+'"]'))G.sess.type='concert';
  s.value=G.sess.type}
function renderList(){
  const ul=$g('gtList');ul.innerHTML='';
  G.seq.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(i+1)+'. '+s.title;if(i===G.sess.step)b.className='on';b.onclick=()=>{jumpTo(i);$g('gtList').hidden=true};ul.append(b)});
}
function jumpTo(i){G.showGot=false;G.showUnread=false;G.showNext=false;G.gotUntil=0;G.settleUntil=0;G.prevFreq=0;G.hold=coreJump(G.hold||PT.emptyState(),i,G.seq.length);G.sess.step=G.hold.step;G.colors={};G.lastCents=null;G.measured=null;G.env=[];saveSess();render();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep()}
function jumpToMidi(m){const i=G.seq.findIndex((s,idx)=>idx>=G.sess.step&&s.midis&&s.midis.indexOf(m)>=0);if(i>=0)jumpTo(i)}
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
    if(stepNow()&&stepNow().phase==='check'&&G.env.length>=24){const dt=(G.env[G.env.length-1].t-G.env[0].t)/1000/(G.env.length-1);const mb=PT.measureBeats(G.env.map(x=>x.v),dt);if(mb)G.measured=mb}
    const step=stepNow();
    if(step&&step.phase==='prescan'&&!G.showGot&&!G.showUnread&&G.armAt&&now-G.armAt>PT.PRESCAN_WAIT&&!G.sess.prescan[step.midi])markUnread();
    const f=TunerCore.yin(G.buf,G.ctx.sampleRate,0.12);
    if(f)onFreq(f,now)}
  G.raf=requestAnimationFrame(loop)}
function trackAttack(rms){
  G.peak=Math.max(rms,(G.peak||0)*0.97);
  if(G.peak>0.008&&rms<G.peak*0.28)G.sawQuiet=true;
  if(G.sawQuiet&&rms>Math.max(0.012,G.peak*0.5)){G.attack=true;G.sawQuiet=false}}
function onFreq(freq,now){
  const step=stepNow();if(!step||G.sounding||G.showGot||G.showUnread)return;
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
  if(res.advance){const was=step.phase;advanceStep(was,picked.freq,was!=='prescan');return}
  saveSess();render()}
function advanceStep(was,freq,doChime){
  if(doChime)chime();
  G.sess.step=Math.min(G.seq.length-1,G.sess.step+1);
  if(was==='prescan'&&G.seq[G.sess.step]&&G.seq[G.sess.step].phase!=='prescan'){
    rebuild(false);G.sess.step=Math.max(0,G.seq.findIndex(s=>s.phase!=='prescan'))}
  G.hold=coreJump(G.hold,G.sess.step,G.seq.length);G.hold.prescan=Object.assign({},G.sess.prescan);
  G.colors={};G.env=[];G.armAt=0;saveSess();
  if(was==='prescan')beginGot(freq);else{G.showGot=false;G.showNext=false;render();setTimeout(playStep,280)}}
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
function openTune(){
  try{if(window.Tuner)Tuner.leave()}catch(e){}
  try{if(window.Meter)Meter.stop()}catch(e){}
  try{if(window.Metro&&Metro.M&&Metro.M.on)Metro.stop()}catch(e){}
  try{if(typeof au!=='undefined'&&au&&!au.paused)au.pause()}catch(e){}
  G.sess=loadSess();G.on=true;$g('gtune').hidden=false;document.body.classList.add('gtOpen');
  fillTypes();rebuild(true);renderKeys();render();renderList();if(stepNow()&&stepNow().phase==='prescan')cueNext();else playStep();listen()}
function closeTune(){G.on=false;stopListen();G.sounding=false;$g('gtune').hidden=true;document.body.classList.remove('gtOpen');saveSess()}
function init(){
  const b=$g('gtOpen');if(!b||G.ready)return;G.ready=true;
  b.onclick=openTune;
  $g('gtClose').onclick=closeTune;
  $g('gtBack').onclick=()=>jumpTo((G.sess.step||0)-1);
  $g('gtAgain').onclick=playStep;
  $g('gtSteps').onclick=()=>{renderList();$g('gtList').hidden=!$g('gtList').hidden};
  $g('gtType').onchange=e=>{G.sess.type=e.target.value;rebuild(true);render();playStep()};
  $g('gtA4').onchange=e=>{let v=+e.target.value;if(!isFinite(v))v=440;v=Math.max(430,Math.min(450,Math.round(v*10)/10));G.sess.a4=v;saveSess();render();if(stepNow()&&stepNow().phase!=='prescan')playStep()};
  if($g('gtRetry'))$g('gtRetry').onclick=retryUnread;
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.on)stopListen()});
}
Object.assign(PianoTune,{init,open:openTune,close:closeTune,playAgain:playStep,jump:jumpTo,feedHz:function(freq,now){if(G.sounding)return{ignored:true};onFreq(freq,now==null?performance.now():now);return{ignored:false,step:G.sess.step,sounding:G.sounding}},_sounding:()=>G.sounding,_setSounding:v=>{G.sounding=!!v},_attack:()=>{G.attack=true},_session:()=>G.sess});
window.PianoTune=PianoTune;
document.addEventListener('DOMContentLoaded',init);
if(document.readyState!=='loading')init();
}
