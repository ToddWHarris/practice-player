// Experimental single-note partials. Not a certified tuner and not a PTG exam tool.
// Two equivalent formulas, labeled on purpose:
//   f_n = n * f0 * sqrt(1 + B*n*n)          f0 is the ideal unstiffened fundamental, not a heard partial
//   f_n = n * f1 * sqrt((1 + B*n*n)/(1 + B)) f1 is partial 1
// Ring 1 is drawn only when partial 1 is actually found in the sound.
const PartialCore=(function(){
 const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
 function etFreq(midi,a4){return (a4||440)*Math.pow(2,(midi-69)/12)}
 function label(m){m=m|0;return NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1)}
 function centsBetween(hz,ref){return 1200*Math.log2(hz/ref)}
 function partialFromF0(f0,n,B){return n*f0*Math.sqrt(1+(B||0)*n*n)}
 function partialFromF1(f1,n,B){B=B||0;return n*f1*Math.sqrt((1+B*n*n)/(1+B))}
 function f0FromF1(f1,B){return f1/Math.sqrt(1+(B||0))}
 function f1FromF0(f0,B){return f0*Math.sqrt(1+(B||0))}
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
  if(!spec||!(f0>20))return [];
  const mag=spec.mag,binHz=sr/spec.n;
  const i0=Math.max(1,Math.round((f0-halfHz)/binHz)),i1=Math.min(mag.length-2,Math.round((f0+halfHz)/binHz));
  const out=[];
  for(let i=i0;i<=i1;i++){
   if(!(mag[i]>=mag[i-1]&&mag[i]>=mag[i+1])||!(mag[i]>0))continue;
   const a=mag[i-1],b=mag[i],c=mag[i+1],den=a-2*b+c;
   let d=0;if(Math.abs(den)>1e-12)d=Math.max(-0.5,Math.min(0.5,(a-c)/(2*den)));
   const vals=[];
   for(let k=Math.max(1,i-30);k<=Math.min(mag.length-1,i+30);k++)if(Math.abs(k-i)>3)vals.push(mag[k]);
   vals.sort((x,y)=>x-y);
   const med=vals.length?vals[vals.length>>1]:0;
   out.push({freq:(i+d)*binHz,mag:b,snr:med>1e-12?b/med:999})}
  out.sort((x,y)=>y.mag-x.mag);
  return out}
 function fitF0B(points){
  if(!points||points.length<3)return {bStatus:'withheld',reason:'few-partials',f0:null,f1:null,B:null,residualCents:null};
  let sw=0,sx=0,sy=0,sxx=0,sxy=0;
  points.forEach(p=>{const x=p.n*p.n,y=(p.hz/p.n)*(p.hz/p.n),w=Math.max(0.25,Math.min(p.snr||1,30));
   sw+=w;sx+=w*x;sy+=w*y;sxx+=w*x*x;sxy+=w*x*y});
  const den=sw*sxx-sx*sx;
  if(!(Math.abs(den)>1e-18))return {bStatus:'withheld',reason:'fit',f0:null,f1:null,B:null,residualCents:null};
  const A=(sy*sxx-sx*sxy)/den,C=(sw*sxy-sx*sy)/den;
  if(!(A>0))return {bStatus:'withheld',reason:'fit',f0:null,f1:null,B:null,residualCents:null};
  const f0=Math.sqrt(A),B=C/A;
  if(!(B>-0.00002&&B<0.05))return {bStatus:'withheld',reason:'fit',f0,f1:f0*Math.sqrt(1+Math.max(0,B)),B,residualCents:null};
  const res=points.map(p=>Math.abs(centsBetween(p.hz,partialFromF0(f0,p.n,B)))).sort((a,b)=>a-b);
  const med=res[res.length>>1];
  let bStatus='measured',reason='ok';
  if(med>8){bStatus='withheld';reason='fit'}
  return {bStatus,reason,f0,f1:f1FromF0(f0,Math.max(0,B)),B:Math.max(0,B),residualCents:med}}
 function assign(spec,sr,f1,B){
  const used={},out=[];
  for(let n=1;n<=10;n++){
   const pred=partialFromF1(f1,n,B);
   const half=Math.max(10,pred*0.035);
   const peaks=localPeaks(spec,sr,pred,half).filter(p=>p.snr>=6);
   if(!peaks.length)continue;
   if(peaks.length>=2&&peaks[1].mag>peaks[0].mag*0.45&&Math.abs(centsBetween(peaks[1].freq,peaks[0].freq))<25)return {split:true,partials:[]};
   const pk=peaks[0];
   const bin=Math.round(pk.freq/(sr/spec.n));
   if(used[bin]||used[n])continue;
   if(Math.abs(centsBetween(pk.freq,pred))>45)continue;
   used[bin]=1;used[n]=1;
   out.push({n,hz:pk.freq,snr:pk.snr})}
  return {split:false,partials:out}}
 function analyzeSingleNote(samples,sampleRate,opts){
  const t0=Date.now();
  opts=opts||{};const sr=+sampleRate,n0=samples?samples.length|0:0;
  const hint=+opts.hintHz;
  const blank=(status,reason)=>({status,reason,partials:[],f0:null,f1:null,f1Heard:false,B:null,bStatus:'withheld',residualCents:null,confidence:'withheld',midi:opts.midi||null,note:opts.midi?label(opts.midi):'',a4:opts.a4||440,resolutionHz:n0&&sr?sr/n0:null,windowSec:sr?n0/sr:0,computeMs:Date.now()-t0});
  if(!(sr>=8000)||n0<32||!(hint>20))return blank('uncertain','short');
  let e=0;for(let i=0;i<n0;i++)e+=samples[i]*samples[i];
  const rms=Math.sqrt(e/Math.max(1,n0));
  if(!(rms>0.004))return blank('uncertain','silence');
  if(n0/sr<0.45)return blank('uncertain','short');
  const spec=fftMag(samples);if(!spec)return blank('uncertain','short');
  const near=localPeaks(spec,sr,hint,Math.max(12,hint*0.06)).filter(p=>p.snr>=8);
  if(near.length>=2&&near[1].mag>near[0].mag*0.4&&Math.abs(centsBetween(near[1].freq,near[0].freq))>40)return blank('uncertain','chord');
  const base=near[0];
  if(base){
   const others=localPeaks(spec,sr,hint*1.3,hint*0.6).filter(p=>p.snr>=8&&p.mag>base.mag*0.35&&Math.abs(centsBetween(p.freq,hint))>80&&Math.abs(centsBetween(p.freq,hint*2))>80);
   if(others.length)return blank('uncertain','chord')}
  let B=0.0003,f1=hint,got=assign(spec,sr,f1,B);
  if(got.split)return blank('uncertain','unison');
  for(let pass=0;pass<2;pass++){
   const fit=fitF0B(got.partials);
   if(fit.f1&&fit.B!=null&&fit.bStatus!=='withheld'){f1=fit.f1;B=fit.B}
   const again=assign(spec,sr,f1,B||0.0003);
   if(again.split)return blank('uncertain','unison');
   if(again.partials.length)got=again}
  let fit=fitF0B(got.partials);
  if(fit.bStatus==='withheld'&&got.partials.length>=4){
   const res=got.partials.map(p=>({p,e:fit.f0?Math.abs(centsBetween(p.hz,partialFromF0(fit.f0,p.n,fit.B||0))):0}));
   res.sort((a,b)=>b.e-a.e);
   if(res[0]&&res[0].e>20){got.partials=got.partials.filter(p=>p!==res[0].p);fit=fitF0B(got.partials)}}
  const heard=got.partials.some(p=>p.n===1);
  const et=opts.midi?etFreq(opts.midi,opts.a4||440):hint;
  const partials=got.partials.map(p=>({n:p.n,hz:p.hz,snr:p.snr,cents:centsBetween(p.hz,p.n*et)}));
  let confidence='withheld';
  if(fit.bStatus==='measured'&&got.partials.length>=4&&fit.residualCents<2)confidence='high';
  else if(fit.bStatus==='measured')confidence='low';
  const midi=opts.midi!=null?opts.midi:69;
  return {status:partials.length?'ok':'uncertain',reason:partials.length?(fit.reason||'ok'):'few-partials',partials,f0:fit.f0,f1:fit.f1,f1Heard:heard,B:fit.bStatus==='measured'?fit.B:null,bStatus:fit.bStatus,residualCents:fit.residualCents,confidence,midi,note:label(midi),a4:opts.a4||440,resolutionHz:sr/n0,windowSec:n0/sr,computeMs:Date.now()-t0,rms}}
 function synthNote(sr,sec,f1,B,ns,opt){
  opt=opt||{};const n=Math.floor(sr*sec),x=new Float32Array(n),f0=f0FromF1(f1,B),tau=opt.tau==null?1.5:opt.tau;
  let seed=opt.seed||3;
  for(let i=0;i<n;i++){const t=i/sr,env=Math.exp(-t/tau);let s=0;
   ns.forEach(k=>{s+=(1/k)*Math.sin(2*Math.PI*partialFromF0(f0,k,B)*t)});
   if(opt.noise){seed=(seed*16807)%2147483647;s+=((seed/2147483647)*2-1)*opt.noise}
   x[i]=s*env}
  if(!opt.raw){let m=0;for(let i=0;i<n;i++)m=Math.max(m,Math.abs(x[i]));if(m>0)for(let i=0;i<n;i++)x[i]*=0.32/m}
  return x}
 function bAt(meas,midi){
  const hit=meas.find(s=>s.midi===midi);
  if(hit)return {B:hit.B,source:'measured'};
  let lo=null,hi=null;
  meas.forEach(s=>{if(s.midi<midi)lo=s;if(s.midi>midi&&!hi)hi=s});
  if(!lo||!hi||!(lo.B>0)||!(hi.B>0))return {B:null,source:'unavailable'};
  const t=(midi-lo.midi)/(hi.midi-lo.midi);
  return {B:Math.exp(Math.log(lo.B)*(1-t)+Math.log(hi.B)*t),source:'interpolated'}}
 function experimentalStretch(samples,a4){
  a4=a4||440;
  const meas=(samples||[]).filter(s=>s&&s.bStatus==='measured'&&s.B>0).sort((a,b)=>a.midi-b.midi);
  if(meas.length<3)return {status:'unavailable',reason:'Custom stretch is unavailable until at least 3 notes have measured stiffness. It is not a tuning target.',points:[]};
  if(!bAt(meas,69).B)return {status:'unavailable',reason:'Custom stretch is unavailable because A4 stiffness was not measured. It is not a tuning target.',points:[]};
  const f1={69:a4};
  function up(m){const bl=bAt(meas,m-12),bu=bAt(meas,m);if(!bl.B||!bu.B||f1[m-12]==null)return false;
   const f0L=f0FromF1(f1[m-12],bl.B);const f0U=2*f0L*Math.sqrt(1+16*bl.B)/Math.sqrt(1+4*bu.B);f1[m]=f1FromF0(f0U,bu.B);return true}
  function down(m){const bl=bAt(meas,m),bu=bAt(meas,m+12);if(!bl.B||!bu.B||f1[m+12]==null)return false;
   const f0U=f0FromF1(f1[m+12],bu.B);const f0L=(2*f0U*Math.sqrt(1+4*bu.B))/(4*Math.sqrt(1+16*bl.B));f1[m]=f1FromF0(f0L,bl.B);return true}
  for(let m=81;m<=108;m+=12)if(!up(m))break;
  for(let m=57;m>=21;m-=12)if(!down(m))break;
  const points=[];
  for(let m=21;m<=108;m+=12){const b=bAt(meas,m);
   if(f1[m]==null||!b.B)points.push({midi:m,label:label(m),cents:null,source:'unavailable',B:null});
   else points.push({midi:m,label:label(m),cents:centsBetween(f1[m],etFreq(m,a4)),source:b.source,B:b.B})}
  return {status:'experimental',reason:'Experimental 4:2 octave walk from A4. Not a tuning target. Outside the measured notes the result is unavailable.',points}}
 function listenLine(targetLabel,result){
  if(!targetLabel)return {plain:'Tap a key, then play that note alone. Mute the other strings.',detail:'Each ring is one overtone that was actually heard. Zero stays at the top. Sharp is to the right. Flat is to the left. A missing overtone is not drawn.',state:'Choose a note.'};
  if(result&&result.reason==='chord')return {plain:'Play '+targetLabel+' alone. Mute the other strings. Hearing more than one note.',detail:'Each ring is one overtone that was actually heard. This take was not one note, so no rings are shown.',state:'Not sure yet.'};
  if(result&&result.reason==='unison')return {plain:'Play '+targetLabel+' alone. Mute the other strings. Two close tones are beating.',detail:'A single string, or one unison, is needed before rings can be drawn.',state:'Not sure yet.'};
  if(result&&result.reason==='silence')return {plain:'Play '+targetLabel+' alone and hold it. The sound was too quiet.',detail:'Each ring is one overtone that was actually heard.',state:'Not sure yet.'};
  if(result&&result.reason==='short')return {plain:'Keep holding '+targetLabel+' alone. The take was too short.',detail:'Each ring is one overtone that was actually heard.',state:'Not sure yet.'};
  const heard=result&&result.f1Heard;
  const detail='Each ring is one overtone that was actually heard. Zero stays at the top. Sharp is to the right. Flat is to the left.'+(heard?'':' Partial 1 was not heard, so ring 1 is not drawn.');
  if(result&&result.partials&&result.partials.length)return {plain:'Play '+targetLabel+' alone. Mute the other strings. Listening to its overtones.',detail,state:'Heard '+result.note+'.'};
  return {plain:'Play '+targetLabel+' alone. Mute the other strings. Listening to its overtones.',detail,state:'Listening now.'}}
 return {NAMES,etFreq,label,centsBetween,partialFromF0,partialFromF1,f0FromF1,f1FromF0,analyzeSingleNote,synthNote,experimentalStretch,listenLine,bAt}})();
if(typeof module!=='undefined')module.exports=PartialCore;

if(typeof document!=='undefined'){
const PK='pp-partial-profiles';
const S={on:false,hold:false,target:69,a4:440,result:null,profile:{notes:{}},listening:false,stream:null,ctx:null,an:null,raf:0,buf:null,wave:null,waveN:0,waveSr:0,sim:false};
const $p=id=>document.getElementById(id);
function loadProfiles(){try{const a=JSON.parse(localStorage.getItem(PK)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function saveProfiles(a){try{localStorage.setItem(PK,JSON.stringify(a))}catch(e){}}
function clearWave(){S.wave=null;S.waveN=0;S.waveSr=0}
function appendWave(buf,sr){
 if(!S.wave||S.waveSr!==sr){S.wave=new Float32Array(Math.floor(sr*1.25));S.waveN=0;S.waveSr=sr}
 const cap=S.wave.length;
 for(let i=0;i<buf.length;i++){S.wave[S.waveN%cap]=buf[i];S.waveN++}}
function waveSlice(n){const out=new Float32Array(n),cap=S.wave.length,start=S.waveN-n;for(let i=0;i<n;i++)out[i]=S.wave[(start+i)%cap];return out}
function stopMic(){S.listening=false;if(S.raf){cancelAnimationFrame(S.raf);S.raf=0}if(S.stream){S.stream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});S.stream=null}if(S.ctx){try{S.ctx.close()}catch(e){}S.ctx=null}S.an=null}
function ringPoint(cx,cy,r,cents){
 const shown=Math.max(-50,Math.min(50,cents));
 const ang=(-90+(shown/50)*90)*Math.PI/180;
 return {x:cx+r*Math.cos(ang),y:cy+r*Math.sin(ang),pinned:Math.abs(cents)>50}}
function ensureTicks(){
 const g=$p('pdTicks');if(!g||g.childElementCount)return;
 const ns='http://www.w3.org/2000/svg',cx=160,cy=160;
 for(let c=-50;c<=50;c+=10){
  const ang=(-90+(c/50)*90)*Math.PI/180;
  const major=c%20===0;
  const r0=136,r1=major?152:145;
  const ln=document.createElementNS(ns,'line');
  ln.setAttribute('x1',(cx+r0*Math.cos(ang)).toFixed(1));ln.setAttribute('y1',(cy+r0*Math.sin(ang)).toFixed(1));
  ln.setAttribute('x2',(cx+r1*Math.cos(ang)).toFixed(1));ln.setAttribute('y2',(cy+r1*Math.sin(ang)).toFixed(1));
  ln.setAttribute('stroke','#1f2937');ln.setAttribute('stroke-width',major?'3':'2');g.appendChild(ln);
  if(major){
   const rl=126,tx=cx+rl*Math.cos(ang),ty=cy+rl*Math.sin(ang);
   const t=document.createElementNS(ns,'text');
   t.setAttribute('x',tx.toFixed(1));t.setAttribute('y',(ty+4).toFixed(1));
   t.setAttribute('text-anchor','middle');t.setAttribute('fill','#3f2a1d');t.setAttribute('font-size','12');t.setAttribute('font-family','Georgia, serif');
   t.textContent=c>0?'+'+c:String(c);g.appendChild(t)}}}
function drawDial(result){
 ensureTicks();
 const g=$p('pdRings');if(!g)return;g.innerHTML='';
 const cx=160,cy=160;
 const parts=(result&&result.partials||[]).filter(p=>!(p.n===1&&result&&!result.f1Heard));
 parts.forEach((p,i)=>{
  const radius=58+i*12;
  const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',radius);
  c.setAttribute('fill','none');c.setAttribute('stroke','#8a7760');c.setAttribute('stroke-width','2.5');
  c.setAttribute('stroke-dasharray','3 4');g.appendChild(c);
  const pt=ringPoint(cx,cy,radius,p.cents);
  const m=document.createElementNS('http://www.w3.org/2000/svg','circle');
  m.setAttribute('cx',pt.x.toFixed(1));m.setAttribute('cy',pt.y.toFixed(1));m.setAttribute('r','8');
  m.setAttribute('fill','#1f6b45');m.dataset.n=String(p.n);g.appendChild(m)});
 const note=$p('pdNote'),cents=$p('pdCents');
 if(note)note.textContent=result&&result.note?result.note:'--';
 if(cents){
  const p1=result&&result.f1Heard&&result.partials.find(p=>p.n===1);
  cents.textContent=p1?(p1.cents>=0?'+':'')+p1.cents.toFixed(1)+' cents':'Partial 1 not heard';
  cents.classList.toggle('long',!p1)}}
function statusLine(r){
 if(!r)return '';
 if(r.reason==='chord'||r.reason==='unison'||r.reason==='silence'||r.reason==='short')return 'Not sure yet.';
 if(r.bStatus==='measured'&&r.confidence==='high')return 'Confidence high.';
 if(r.bStatus==='measured')return 'Confidence low.';
 if(r.partials&&r.partials.length)return 'Stiffness unavailable.';
 return 'Not sure yet.'}
function renderListen(){
 const cue=PartialCore.listenLine(S.target!=null?PartialCore.label(S.target):'',S.result);
 const el=$p('pdListen');if(el)el.textContent=cue.plain+' '+(S.listening||S.sim?cue.state:'Microphone is off.');
 const d=$p('pdDetail');if(d)d.textContent=cue.detail||'';
 const st=$p('pdStatus');if(st)st.textContent=statusLine(S.result);
 const side=$p('pdTarget');
 if(side){const land=window.matchMedia('(orientation: landscape)').matches;
  side.hidden=!(land&&S.target!=null);
  const nm=$p('pdTargetName');if(nm)nm.textContent=S.target!=null?PartialCore.label(S.target):''}}
function renderTable(){
 const tb=$p('pdTable');if(!tb)return;
 const r=S.result;
 if(!r||!r.partials||!r.partials.length){tb.textContent='Partials: unavailable.';return}
 const rows=r.partials.map(p=>'Overtone '+p.n+': '+(p.hz).toFixed(1)+' Hz, '+(p.cents>=0?'+':'')+p.cents.toFixed(1)+' cents').join('. ');
 const b=r.bStatus==='measured'&&r.B!=null?('Stiffness B measured '+r.B.toExponential(2)+'. Confidence '+r.confidence+'.'):'Stiffness B unavailable.';
 const f1=r.f1Heard?'Partial 1 was heard.':(r.f1?'Estimated first partial '+r.f1.toFixed(2)+' Hz. Not heard, so ring 1 is hidden.':'Partial 1 was not heard.');
 tb.textContent=rows+'. '+f1+' '+b+' f0 is the unstiffened fundamental, not partial 1.'}
function renderStretch(){
 const box=$p('pdStretch');if(!box)return;
 const more=$p('pdStretchMore');
 const samples=Object.keys(S.profile.notes||{}).map(k=>S.profile.notes[k]);
 const out=PartialCore.experimentalStretch(samples,S.a4);
 const shown=out.points.filter(p=>p.source!=='unavailable').slice(0,8).map(p=>p.label+' '+(p.cents>=0?'+':'')+p.cents.toFixed(1)+' cents ('+p.source+')').join('. ');
 const missing=out.points.filter(p=>p.source==='unavailable').length;
 const long=out.reason+(shown?' '+shown:'')+(missing?'. '+missing+' octave stops are unavailable.':'');
 if(out.status!=='experimental'){box.textContent='Stretch unavailable. Not a tuning target.';if(more)more.textContent=out.reason;return}
 box.textContent='Experimental stretch. Not a tuning target.';
 if(more)more.textContent=long}
function renderKeep(){
 const k=$p('pdKeep');if(!k)return;
 if(S.refused){k.textContent='Not accepted. The reading is not sure enough.';return}
 const saved=S.target!=null&&S.profile.notes[S.target]&&S.profile.notes[S.target].bStatus==='measured';
 if(saved){k.textContent='Measurement accepted. Not tuned.';return}
 k.textContent=''}
function renderAll(){renderListen();drawDial(S.result);renderTable();renderStretch();renderKeep();markKeys();
 const sim=$p('pdSim');if(sim)sim.hidden=!S.sim}
function keys(){
 const box=$p('pdKeys');if(!box||box.querySelector('button'))return;
 const whites=[];for(let m=21;m<=108;m++)if(!NAMES_BLACK(m))whites.push(m);
 whites.forEach(m=>{const k=document.createElement('button');k.type='button';k.className='wk';k.dataset.m=m;k.setAttribute('aria-label',PartialCore.label(m));k.onclick=()=>pick(m);box.appendChild(k)});
 whites.forEach((m,i)=>{const n=m+1;if(n>108||!NAMES_BLACK(n))return;const k=document.createElement('button');k.type='button';k.className='bk';k.dataset.m=n;k.setAttribute('aria-label',PartialCore.label(n));k.style.left=((i+0.62)/whites.length*100)+'%';k.onclick=()=>pick(n);box.appendChild(k)});
}
function markKeys(){
 const box=$p('pdKeys');if(!box)return;
 box.querySelectorAll('button').forEach(el=>{
  const m=+el.dataset.m;
  el.classList.toggle('on',m===S.target);
  const saved=S.profile.notes&&S.profile.notes[m];
  el.classList.toggle('measured',!!(saved&&saved.bStatus==='measured'))});
 let flag=box.querySelector('.pdFlag');
 if(!flag){flag=document.createElement('div');flag.className='pdFlag';box.appendChild(flag)}
 const on=box.querySelector('button.on');
 if(!on||S.target==null){flag.hidden=true;return}
 flag.hidden=false;flag.textContent=PartialCore.label(S.target);
 flag.style.left=(on.offsetLeft+on.offsetWidth/2)+'px'}
function NAMES_BLACK(m){const n=((m%12)+12)%12;return n===1||n===3||n===6||n===8||n===10}
function pick(m){S.target=m;S.sim=false;S.refused=false;S.result=null;clearWave();renderAll()}
function loop(){
 if(!S.listening||!S.an||S.sim)return;
 S.an.getFloatTimeDomainData(S.buf);
 if(S.target!=null){appendWave(S.buf,S.ctx.sampleRate);
  const need=Math.floor(S.waveSr*1);
  if(S.waveN>=need&&(!S.at||performance.now()-S.at>500)){S.at=performance.now();
   S.result=PartialCore.analyzeSingleNote(waveSlice(need),S.waveSr,{hintHz:PartialCore.etFreq(S.target,S.a4),midi:S.target,a4:S.a4});
   renderAll()}}
 S.raf=requestAnimationFrame(loop)}
async function startMic(){
 if(S.listening||S.sim)return;
 try{if(window.Tuner&&Tuner.leave)Tuner.leave();if(window.PianoTune&&PianoTune.close)PianoTune.close();
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  const AC=window.AudioContext||window.webkitAudioContext;const ctx=new AC();if(ctx.state!=='running'&&ctx.resume)await ctx.resume();
  const src=ctx.createMediaStreamSource(stream);const an=ctx.createAnalyser();an.fftSize=8192;an.smoothingTimeConstant=0;src.connect(an);
  S.stream=stream;S.ctx=ctx;S.an=an;S.buf=new Float32Array(an.fftSize);S.listening=true;S.raf=requestAnimationFrame(loop)}catch(e){S.listening=false;renderListen()}}
function openDial(){
 try{if(window.Tuner&&Tuner.leave)Tuner.leave()}catch(e){}
 try{if(window.PianoTune&&PianoTune.close)PianoTune.close()}catch(e){}
 S.on=true;S.a4=(window.Tuner&&Tuner.T&&Tuner.T.a4)||440;
 const el=$p('pdial');if(el)el.hidden=false;
 document.body.classList.add('pdOpen');
 keys();renderAll();if(!S.sim)startMic()}
function setDetails(open){const d=$p('pdDetails'),b=$p('pdDetailsBtn');if(d)d.hidden=!open;if(b){b.setAttribute('aria-expanded',open?'true':'false');b.textContent=open?'Hide details':'Details'}}
function closeDial(){S.on=false;S.hold=false;S.sim=false;stopMic();clearWave();setDetails(false);const el=$p('pdial');if(el)el.hidden=true;document.body.classList.remove('pdOpen');const b=$p('pdHelpBack');if(b)b.hidden=true}
function openHelp(){if(!S.on)return;S.hold=true;stopMic();$p('pdial').hidden=true;document.body.classList.remove('pdOpen');const b=$p('pdHelpBack');if(b)b.hidden=false;if(window.tab)tab('help');const h=$p('h-partial-dial');if(h)h.scrollIntoView({block:'start'})}
function returnHelp(){if(!S.hold)return;S.hold=false;const b=$p('pdHelpBack');if(b)b.hidden=true;const on=document.querySelector('nav button.on');if(!on||on.dataset.t!=='tun'){if(window.tab)tab('tun')}try{if(window.Tuner&&Tuner.leave)Tuner.leave()}catch(e){}$p('pdial').hidden=false;document.body.classList.add('pdOpen');renderAll();if(!S.sim)startMic()}
function preview(opts){
 opts=opts||{};S.sim=true;stopMic();S.target=opts.midi!=null?opts.midi:69;S.a4=opts.a4||440;
 const ns=opts.partials||[1,2,3,4,5,6];
 const buf=PartialCore.synthNote(48000,1.1,opts.f1||440,opts.B==null?0.0004:opts.B,ns,{tau:opts.tau,noise:opts.noise,raw:opts.raw,seed:opts.seed});
 if(opts.extra){for(let i=0;i<buf.length;i++)buf[i]+=opts.extra[i]||0}
 S.result=PartialCore.analyzeSingleNote(buf,48000,{hintHz:PartialCore.etFreq(S.target,S.a4),midi:S.target,a4:S.a4});
 const sim=$p('pdSim');if(sim){sim.hidden=false;sim.textContent='Simulated preview. Not a live microphone.'}
 renderAll();return S.result}
function storeCurrent(){
 const r=S.result;
 if(!r||r.bStatus!=='measured'||!(r.B>0)||S.target==null){S.refused=true;renderKeep();return false}
 S.refused=false;
 S.profile.notes[S.target]={midi:S.target,B:r.B,bStatus:'measured',f1Heard:r.f1Heard,partials:r.partials.map(p=>p.n),at:Date.now()};
 renderStretch();markKeys();renderKeep();return true}
function saveNamed(){
 const name=($p('pdName')&&$p('pdName').value||'').trim();if(!name){$p('pdName')&&$p('pdName').focus();return}
 const id='pd'+Date.now();
 const rec={id,name,a4:S.a4,at:new Date().toISOString(),notes:S.profile.notes};
 const list=loadProfiles().filter(p=>p.name!==name);list.push(rec);list.sort((a,b)=>a.name.localeCompare(b.name));saveProfiles(list)}
function init(){
 const b=$p('pdOpen');if(!b||S.ready)return;S.ready=true;
 b.onclick=openDial;
 if($p('pdClose'))$p('pdClose').onclick=closeDial;
 if($p('pdHelp'))$p('pdHelp').onclick=openHelp;
 if($p('pdHelpBack'))$p('pdHelpBack').onclick=returnHelp;
 if($p('pdSaveNote'))$p('pdSaveNote').onclick=storeCurrent;
 if($p('pdRetry'))$p('pdRetry').onclick=()=>{if(S.target!=null)delete S.profile.notes[S.target];S.refused=false;S.result=null;S.sim=false;clearWave();renderAll();if(!S.listening)startMic()};
 if($p('pdSave'))$p('pdSave').onclick=saveNamed;
 if($p('pdDetailsBtn'))$p('pdDetailsBtn').onclick=()=>{const d=$p('pdDetails');setDetails(!!(d&&d.hidden))};
 window.addEventListener('resize',()=>{renderListen();markKeys()})}
window.PartialDial={Core:PartialCore,open:openDial,close:closeDial,holdingHelp:()=>!!S.hold,returnFromHelp:returnHelp,preview,init,storeCurrent,_profile:()=>S.profile};
document.addEventListener('DOMContentLoaded',init);
if(document.readyState!=='loading')init();
}
