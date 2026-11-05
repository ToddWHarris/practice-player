// v32 Tuner: YIN pitch detection (buffer large enough for B0 ~31 Hz), instruments,
// piano stretch (Railsback), and saved piano sampling profiles.
const TunerCore=(()=>{
 const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
 // Fernhart Labs "Grand, standard" stretch (cents vs equal temperament), A4=0.
 // Typical-piano inharmonicity model; shape matches the Railsback curve (O.L. Railsback, 1938).
 const STRETCH_PTS=[[21,-12.0],[24,-8.9],[36,-3.7],[48,-2.2],[57,-1.7],[60,-1.3],[69,0.0],[72,0.9],[84,6.5],[96,12.9],[108,29.7]];
 const PIANO_LO=21,PIANO_HI=108; // A0..C8
 function stretchCents(midi){
  const m=+midi;if(!isFinite(m))return 0;
  const pts=STRETCH_PTS;if(m<=pts[0][0])return pts[0][1];if(m>=pts[pts.length-1][0])return pts[pts.length-1][1];
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(m>=a[0]&&m<=b[0]){const t=(m-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s}}
  return 0}
 // Fill unsampled keys by linear interpolation along the sampled curve; flat beyond ends.
 function interpolateCurve(samples){
  const keys=Object.keys(samples||{}).map(Number).filter(m=>m>=PIANO_LO&&m<=PIANO_HI&&isFinite(samples[m])).sort((a,b)=>a-b);
  const out={};if(!keys.length){for(let m=PIANO_LO;m<=PIANO_HI;m++)out[m]=0;return out}
  for(let m=PIANO_LO;m<=PIANO_HI;m++){
   if(samples[m]!=null&&isFinite(samples[m])){out[m]=+samples[m];continue}
   let lo=null,hi=null;for(const k of keys){if(k<m)lo=k;if(k>m&&hi==null)hi=k}
   if(lo==null)out[m]=+samples[keys[0]];
   else if(hi==null)out[m]=+samples[keys[keys.length-1]];
   else{const t=(m-lo)/(hi-lo);out[m]=samples[lo]+(samples[hi]-samples[lo])*t}
  }return out}
 function clampA4(a){a=+a;if(!isFinite(a))return 440;return Math.max(430,Math.min(450,Math.round(a*10)/10))}
 function freqToMidi(f,a4){return 69+12*Math.log2(f/clampA4(a4))}
 function midiToFreq(m,a4){return clampA4(a4)*Math.pow(2,(m-69)/12)}
 function noteFromMidi(m){const r=Math.round(m),n=((r%12)+12)%12,oct=Math.floor(r/12)-1;return{midi:r,name:NAMES[n],octave:oct,label:NAMES[n]+oct}}
 // opts.targetCents overrides; opts.stretch uses Railsback; else 0 (equal temperament)
 function analyze(f,a4,opts){
  opts=opts||{};if(!(f>0)||!isFinite(f))return null;
  const a=clampA4(a4),raw=freqToMidi(f,a);let midi=opts.midi!=null?+opts.midi:Math.round(raw);
  let target=0,mode='equal';
  if(opts.targetCents!=null&&isFinite(opts.targetCents)){target=+opts.targetCents;mode=opts.mode||'profile'}
  else if(opts.stretch){target=stretchCents(midi);mode='stretch'}
  const etFreq=midiToFreq(midi,a),targetFreq=etFreq*Math.pow(2,target/1200);
  const cents=1200*Math.log2(f/targetFreq);
  const n=noteFromMidi(midi);
  return{freq:f,midi,name:n.name,octave:n.octave,label:n.label,cents,targetCents:target,targetFreq,etFreq,mode}}
 function yin(buf,sampleRate,threshold){
  threshold=threshold==null?0.15:threshold;const N=buf.length|0,half=N>>1;if(half<32||!sampleRate)return null;
  let energy=0;for(let i=0;i<N;i++)energy+=buf[i]*buf[i];const rms=Math.sqrt(energy/N);if(rms<0.01)return null;
  const d=new Float32Array(half);
  for(let tau=0;tau<half;tau++){let s=0;for(let i=0;i<half;i++){const x=buf[i]-buf[i+tau];s+=x*x}d[tau]=s}
  const cmnd=new Float32Array(half);cmnd[0]=1;let run=0;
  for(let tau=1;tau<half;tau++){run+=d[tau];cmnd[tau]=run>0?(d[tau]*tau)/run:1}
  const minTau=Math.max(2,Math.floor(sampleRate/4200)),maxTau=Math.min(half-2,Math.ceil(sampleRate/27));
  let tauEst=-1;
  for(let tau=minTau;tau<=maxTau;tau++){if(cmnd[tau]<threshold){while(tau+1<=maxTau&&cmnd[tau+1]<cmnd[tau])tau++;tauEst=tau;break}}
  if(tauEst<0){let best=1,bt=-1;for(let tau=minTau;tau<=maxTau;tau++)if(cmnd[tau]<best){best=cmnd[tau];bt=tau}
   if(bt<0||best>0.45)return null;tauEst=bt}
  const x0=tauEst>0?tauEst-1:tauEst,x2=tauEst+1<half?tauEst+1:tauEst;let better=tauEst;
  if(x0!==tauEst&&x2!==tauEst){const s0=cmnd[x0],s1=cmnd[tauEst],s2=cmnd[x2],den=2*(2*s1-s2-s0);if(Math.abs(den)>1e-12)better=tauEst+(s2-s0)/den}
  const f=sampleRate/better;return(f>=27&&f<=4200)?f:null}
 function tone(freq,sampleRate,secs,kind){
  const n=Math.max(1,Math.round(sampleRate*secs)),buf=new Float32Array(n);
  for(let i=0;i<n;i++){const t=i/sampleRate;if(kind==='rich'){let s=0;for(let h=1;h<=8;h++)s+=(1/h)*Math.sin(2*Math.PI*freq*h*t);buf[i]=0.35*s}
   else buf[i]=0.5*Math.sin(2*Math.PI*freq*t)}
  return buf}
 // Stable offset from equal temperament for a held note (used by sampling + tests)
 function etCents(f,midi,a4){return 1200*Math.log2(f/midiToFreq(midi,a4))}
 function isStable(hist,maxSpread){if(!hist||hist.length<6)return false;let lo=hist[0],hi=hist[0];for(const x of hist){if(x<lo)lo=x;if(x>hi)hi=x}return(hi-lo)<=(maxSpread==null?3:maxSpread)}
 const GUITAR=[40,45,50,55,59,64],BASS4=[28,33,38,43],BASS5=[23,28,33,38,43];
 function nearestString(midi,strings){let best=strings[0],bd=1e9;for(const s of strings){const d=Math.abs(midi-s);if(d<bd){bd=d;best=s}}return best}
 function transpose(concertMidi,semitones){return concertMidi+(+semitones||0)}
 function writtenLabel(concertMidi,semitones){return noteFromMidi(Math.round(transpose(concertMidi,semitones))).label}
 function newId(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
 return{NAMES,STRETCH_PTS,PIANO_LO,PIANO_HI,stretchCents,interpolateCurve,clampA4,freqToMidi,midiToFreq,noteFromMidi,analyze,yin,tone,etCents,isStable,GUITAR,BASS4,BASS5,nearestString,transpose,writtenLabel,newId}})();
if(typeof module!=='undefined')module.exports=TunerCore;

if(typeof document!=='undefined'){
const TK='pp-tuner',PK='pp-tuner-profiles',INSTS=[
 {id:'auto',label:'Auto / Chromatic'},
 {id:'guitar',label:'Guitar'},
 {id:'bass',label:'Bass guitar'},
 {id:'trumpet',label:'Trumpet (B flat)'},
 {id:'euph',label:'Euphonium'},
 {id:'piano',label:'Piano'}
];
const T={on:false,stream:null,ctx:null,src:null,an:null,raf:0,a4:440,inst:'auto',bass5:false,euph:'concert',
 target:'stretch', // stretch | equal | profile:<id>
 buf:null,smooth:null,hist:[],string:null,
 sample:null // {midi, samples:{}, hist:[], editId|null}
};
const $t=id=>document.getElementById(id);
function profiles(){try{const a=JSON.parse(localStorage.getItem(PK)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function setProfiles(a){try{localStorage.setItem(PK,JSON.stringify(a))}catch(e){}}
function findProfile(id){return profiles().find(p=>p.id===id)||null}
function tLoad(){try{const o=JSON.parse(localStorage.getItem(TK)||'{}');
 if(o.a4!=null)T.a4=TunerCore.clampA4(o.a4);if(INSTS.some(x=>x.id===o.inst))T.inst=o.inst;
 if(o.bass5!=null)T.bass5=!!o.bass5;if(o.euph==='bb'||o.euph==='concert')T.euph=o.euph;
 if(o.target)T.target=o.target;else if(o.stretch===false)T.target='equal';
 if(o.string!=null)T.string=o.string}catch(e){}}
function tSave(){try{localStorage.setItem(TK,JSON.stringify({a4:T.a4,inst:T.inst,bass5:T.bass5,euph:T.euph,target:T.target,string:T.string}))}catch(e){}}
function strings(){if(T.inst==='guitar')return TunerCore.GUITAR;if(T.inst==='bass')return T.bass5?TunerCore.BASS5:TunerCore.BASS4;return null}
function writeOffset(){if(T.inst==='trumpet')return 2;if(T.inst==='euph'&&T.euph==='bb')return 14;return 0}
function setA4(v){T.a4=TunerCore.clampA4(v);$t('tuA4').value=T.a4;$t('tuA4v').textContent=T.a4;tSave()}
function setInst(id){if(!INSTS.some(x=>x.id===id))return;T.inst=id;T.string=null;if(id!=='piano'&&T.sample)endSample(false);tSave();tSyncUI()}
function currentTargetCents(midi){
 if(T.inst!=='piano')return{cents:0,mode:'equal',label:''};
 if(T.target==='equal')return{cents:0,mode:'equal',label:'equal temperament'};
 if(T.target==='stretch')return{cents:TunerCore.stretchCents(midi),mode:'stretch',label:'stretch'};
 if(String(T.target).startsWith('profile:')){const p=findProfile(T.target.slice(8));
  if(p){const c=(p.curve&&p.curve[midi]!=null)?+p.curve[midi]:0;return{cents:c,mode:'profile',label:p.name}}}
 return{cents:TunerCore.stretchCents(midi),mode:'stretch',label:'stretch'}}
function fillTargets(){const s=$t('tuTargetSel');if(!s)return;const cur=T.target;s.innerHTML='';
 const add=(v,lab)=>{const o=document.createElement('option');o.value=v;o.textContent=lab;s.append(o)};
 add('stretch','Stretch (typical)');add('equal','Equal temperament');
 profiles().forEach(p=>add('profile:'+p.id,p.name+(p.date?' · '+p.date.slice(0,10):'')));
 if(![...s.options].some(o=>o.value===cur))T.target='stretch';s.value=T.target}
function tSyncUI(){
 const ss=strings(),piano=T.inst==='piano';
 $t('tuStrings').hidden=!ss;$t('tuBass5Wrap').hidden=T.inst!=='bass';$t('tuEuph').hidden=T.inst!=='euph';
 $t('tuPiano').hidden=!piano;$t('tuBass5').checked=T.bass5;$t('tuEuphMode').value=T.euph;$t('tuInst').value=T.inst;
 if(piano)fillTargets();
 if(ss){const box=$t('tuStrBtns');box.innerHTML='';ss.forEach(m=>{const n=TunerCore.noteFromMidi(m);const b=document.createElement('button');b.type='button';b.className='btn tuStr'+(T.string===m?' on':'');b.textContent=n.label;b.onclick=()=>{T.string=T.string===m?null:m;tSave();tSyncUI()};box.append(b)})}
 $t('tuHint').textContent=hint();
 const sampling=!!T.sample;$t('tuSampleBox').hidden=!sampling;$t('tuPianoActs').hidden=!piano||sampling;
 if(sampling){const n=TunerCore.noteFromMidi(T.sample.midi);const got=Object.keys(T.sample.samples).length;
  $t('tuSampleProg').textContent='Sampling '+n.label+' ('+(T.sample.midi-TunerCore.PIANO_LO+1)+' of 88). Saved '+got+' key'+(got===1?'':'s')+'.';
  $t('tuSampleNote').textContent='Play '+n.label+' and hold it steady.'}}
function hint(){if(T.inst==='trumpet')return 'Shows written pitch (a major second above concert).';
 if(T.inst==='euph')return T.euph==='bb'?'Treble clef B flat: written a major 9th above concert.':'Concert pitch (bass clef).';
 if(T.inst==='piano'){if(T.target==='equal')return 'Equal temperament (no stretch).';
  if(T.target==='stretch')return 'Targets follow a typical piano stretch (Railsback).';
  const p=findProfile(String(T.target).slice(8));return p?'Tuning to saved profile "'+p.name+'".':'Pick a target below.' }
 if(T.inst==='guitar')return 'Tap a string or let Auto pick the nearest open string.';
 if(T.inst==='bass')return T.bass5?'5-string with low B0.':'4-string (E A D G).';
 return 'Chromatic: any note.'}
function needle(cents){const c=Math.max(-50,Math.min(50,cents)),pct=(c+50)/100*100;$t('tuNeedle').style.left=pct+'%';
 const ok=Math.abs(cents)<=5;$t('tuMeter').classList.toggle('ok',ok);$t('tuCents').classList.toggle('ok',ok)}
function showIdle(msg){$t('tuNote').textContent='-';$t('tuOct').textContent='';$t('tuCents').textContent=msg||'Waiting…';$t('tuCents').classList.remove('ok');
 $t('tuHz').textContent='';$t('tuTarget').textContent='';$t('tuMeter').classList.remove('ok');$t('tuNeedle').style.left='50%'}
function showPitch(info,disp,tgt){
 $t('tuNote').textContent=disp.name;$t('tuOct').textContent=String(disp.octave);
 const c=info.cents,sign=c>=0?'+':'';$t('tuCents').textContent=sign+c.toFixed(1)+' cents';
 $t('tuHz').textContent=info.freq.toFixed(2)+' Hz';
 if(tgt&&(tgt.mode==='stretch'||tgt.mode==='profile')){const t=info.targetCents,ts=t>=0?'+':'';
  $t('tuTarget').textContent='Target '+ts+t.toFixed(1)+' cents ('+(tgt.mode==='stretch'?'stretch':tgt.label)+')'}
 else if(writeOffset()){$t('tuTarget').textContent='Written '+disp.label+' (concert '+info.label+')'}
 else if(T.string!=null)$t('tuTarget').textContent='String '+TunerCore.noteFromMidi(T.string).label;
 else $t('tuTarget').textContent='';
 needle(c)}
function releaseMic(){if(T.raf){cancelAnimationFrame(T.raf);T.raf=0}if(T.src){try{T.src.disconnect()}catch(e){}T.src=null}
 if(T.an){try{T.an.disconnect()}catch(e){}T.an=null}
 if(T.stream){T.stream.getTracks().forEach(tr=>{try{tr.stop()}catch(e){}});T.stream=null}
 if(T.ctx){try{T.ctx.close()}catch(e){}T.ctx=null}T.smooth=null;T.hist=[];T.on=false;
 const go=$t('tuGo');if(go){go.textContent='Start';go.classList.remove('on')}}
function loop(){if(!T.on||!T.an||!T.buf)return;T.an.getFloatTimeDomainData(T.buf);
 let f=TunerCore.yin(T.buf,T.ctx.sampleRate,0.15);
 if(f){T.hist.push(f);if(T.hist.length>5)T.hist.shift();const sorted=T.hist.slice().sort((a,b)=>a-b);const med=sorted[sorted.length>>1];
  T.smooth=T.smooth==null?med:T.smooth*0.6+med*0.4;f=T.smooth}
 if(T.sample){handleSample(f);T.raf=requestAnimationFrame(loop);return}
 if(!f){showIdle('Listening…');T.raf=requestAnimationFrame(loop);return}
 let midiHint=null;const ss=strings();
 if(T.string!=null)midiHint=T.string;else if(ss)midiHint=TunerCore.nearestString(Math.round(TunerCore.freqToMidi(f,T.a4)),ss);
 const midi=midiHint!=null?midiHint:Math.round(TunerCore.freqToMidi(f,T.a4));
 const tgt=currentTargetCents(midi);
 const info=TunerCore.analyze(f,T.a4,{midi,targetCents:tgt.cents,mode:tgt.mode});
 if(!info){showIdle('Listening…');T.raf=requestAnimationFrame(loop);return}
 const off=writeOffset();const disp=TunerCore.noteFromMidi(info.midi+off);
 showPitch(info,disp,tgt);
 if(ss&&T.string==null){const box=$t('tuStrBtns');[...box.children].forEach((b,i)=>{b.classList.toggle('near',ss[i]===info.midi);b.classList.toggle('on',false)})}
 T.raf=requestAnimationFrame(loop)}
function handleSample(f){
 const sm=T.sample;if(!sm)return;const n=TunerCore.noteFromMidi(sm.midi);
 if(!f){showIdle('Play '+n.label+'…');$t('tuSampleNote').textContent='Play '+n.label+' and hold it steady.';return}
 const got=Math.round(TunerCore.freqToMidi(f,T.a4));
 // Accept the intended key or very nearby (±1) so soft attacks still land
 if(Math.abs(got-sm.midi)>1){showIdle('Hearing '+TunerCore.noteFromMidi(got).label+'. Play '+n.label+'.');sm.hist=[];return}
 const cents=TunerCore.etCents(f,sm.midi,T.a4);sm.hist.push(cents);if(sm.hist.length>10)sm.hist.shift();
 const info=TunerCore.analyze(f,T.a4,{midi:sm.midi,targetCents:0,mode:'equal'});
 showPitch(info,n,{mode:'equal',label:''});
 $t('tuTarget').textContent='Offset '+((cents>=0?'+':'')+cents.toFixed(1))+' cents from equal temperament';
 if(TunerCore.isStable(sm.hist,2.5)){sm.samples[sm.midi]=sm.hist.reduce((a,b)=>a+b,0)/sm.hist.length;sm.hist=[];
  if(sm.editId){finishResample();return}
  advanceSample(1)}}
function advanceSample(dir){if(!T.sample)return;let m=T.sample.midi+dir;
 while(m>=TunerCore.PIANO_LO&&m<=TunerCore.PIANO_HI&&dir>0&&T.sample.samples[m]!=null)m++;
 if(m>TunerCore.PIANO_HI){saveSamplePrompt();return}
 if(m<TunerCore.PIANO_LO){T.sample.midi=TunerCore.PIANO_LO;tSyncUI();return}
 T.sample.midi=m;T.sample.hist=[];tSyncUI()}
function skipSample(){if(!T.sample)return;advanceSample(1)}
function saveSamplePrompt(){if(!T.sample)return;const got=Object.keys(T.sample.samples).length;
 if(!got){alert('No keys were sampled.');endSample(false);return}
 const def=T.sample.editId?(findProfile(T.sample.editId)||{}).name||'':'Church piano';
 const name=(prompt('Name for this piano profile ('+got+' keys sampled)',def)||'').trim();
 if(!name){if(confirm('Discard this sample run?'))endSample(false);return}
 const curve=TunerCore.interpolateCurve(T.sample.samples);
 const list=profiles();const rec={id:T.sample.editId||TunerCore.newId(),name,a4:T.a4,date:new Date().toISOString(),samples:Object.assign({},T.sample.samples),curve};
 const i=list.findIndex(p=>p.id===rec.id);if(i>=0)list[i]=rec;else list.push(rec);
 list.sort((a,b)=>a.name.localeCompare(b.name));setProfiles(list);T.target='profile:'+rec.id;tSave();endSample(false);tSyncUI();
 if(typeof toast==='function')toast('Saved '+name)}
function endSample(keepMic){T.sample=null;tSyncUI();if(!keepMic){/* stay listening if already on */}}
function startSample(editId,startMidi){
 if(T.inst!=='piano')setInst('piano');
 T.sample={midi:startMidi!=null?startMidi:TunerCore.PIANO_LO,samples:{},hist:[],editId:editId||null};
 if(editId){const p=findProfile(editId);if(p&&p.samples)T.sample.samples=Object.assign({},p.samples)}
 tSyncUI();if(!T.on)tStart()}
function finishResample(){const sm=T.sample;if(!sm||!sm.editId)return;const p=findProfile(sm.editId);if(!p){endSample(false);return}
 p.samples=Object.assign({},sm.samples);p.curve=TunerCore.interpolateCurve(p.samples);p.date=new Date().toISOString();p.a4=T.a4;
 const list=profiles();const i=list.findIndex(x=>x.id===p.id);if(i>=0)list[i]=p;setProfiles(list);endSample(false);tSyncUI();
 if(typeof toast==='function')toast('Updated '+p.name)}
async function tStart(){if(T.on)return;try{if(window.Meter&&Meter.L&&Meter.L.on)Meter.stop();if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){showIdle('Microphone not available.');return}
 const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
 const AC=window.AudioContext||window.webkitAudioContext;const ctx=new AC();if(ctx.state!=='running'&&ctx.resume)await ctx.resume();
 const src=ctx.createMediaStreamSource(stream);const an=ctx.createAnalyser();an.fftSize=16384;an.smoothingTimeConstant=0;src.connect(an);
 T.stream=stream;T.ctx=ctx;T.src=src;T.an=an;T.buf=new Float32Array(an.fftSize);T.on=true;T.smooth=null;T.hist=[];
 $t('tuGo').textContent='Stop';$t('tuGo').classList.add('on');showIdle('Listening…');
 try{if(typeof au!=='undefined'&&!au.paused)au.pause()}catch(e){}
 T.raf=requestAnimationFrame(loop)}catch(e){releaseMic();showIdle(e&&e.name==='NotAllowedError'?'Microphone not allowed. Allow it for this site.':'Could not open the microphone.')}}
function tStop(){if(T.sample&&!confirm('Stop and leave sampling? Unsaved keys will be lost unless you save first.'))return;
 if(T.sample)endSample(false);releaseMic();showIdle('Mic off. Tap Start to tune.')}
function tLeave(){if(T.sample)endSample(false);releaseMic();showIdle('Mic off. Tap Start to tune.')}
function tEnter(){}
function renameProfile(){const id=String(T.target).startsWith('profile:')?T.target.slice(8):null;const p=id&&findProfile(id);if(!p){alert('Pick a saved profile first.');return}
 const n=(prompt('Rename profile',p.name)||'').trim();if(!n)return;p.name=n;const list=profiles();const i=list.findIndex(x=>x.id===p.id);if(i>=0)list[i]=p;setProfiles(list);tSyncUI()}
function deleteProfile(){const id=String(T.target).startsWith('profile:')?T.target.slice(8):null;const p=id&&findProfile(id);if(!p){alert('Pick a saved profile first.');return}
 if(!confirm('Delete the profile "'+p.name+'"?'))return;setProfiles(profiles().filter(x=>x.id!==p.id));T.target='stretch';tSave();tSyncUI()}
function resampleOne(){const id=String(T.target).startsWith('profile:')?T.target.slice(8):null;const p=id&&findProfile(id);if(!p){alert('Pick a saved profile first.');return}
 const lab=(prompt('Which note to re-sample? (for example A4 or C2)','A4')||'').trim();if(!lab)return;
 const m=parseNoteLabel(lab);if(m==null){alert('Could not read that note.');return}
 startSample(p.id,m)}
function parseNoteLabel(s){const m=String(s).trim().match(/^([A-Ga-g])([#b]?)(-?[0-9])$/);if(!m)return null;
 let n={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11}[m[1].toUpperCase()+(m[2]==='b'? 'b':m[2])];
 if(n==null&&m[2]==='#')n={C:1,D:3,F:6,G:8,A:10}[m[1].toUpperCase()];
 if(n==null&&m[2]==='b')n={D:1,E:3,G:6,A:8,B:10}[m[1].toUpperCase()];
 if(n==null&&!m[2])n={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()];
 if(n==null)return null;const midi=(+m[3]+1)*12+n;return(midi>=TunerCore.PIANO_LO&&midi<=TunerCore.PIANO_HI)?midi:null}
function tInit(){tLoad();const sel=$t('tuInst');INSTS.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.label;sel.append(o)});
 setA4(T.a4);tSyncUI();showIdle('Mic off. Tap Start to tune.');
 $t('tuGo').onclick=()=>T.on?tStop():tStart();
 $t('tuA4').oninput=e=>setA4(e.target.value);$t('tuA4').onchange=e=>setA4(e.target.value);
 $t('tuInst').onchange=e=>setInst(e.target.value);
 $t('tuBass5').onchange=e=>{T.bass5=!!e.target.checked;T.string=null;tSave();tSyncUI()};
 $t('tuEuphMode').onchange=e=>{T.euph=e.target.value==='bb'?'bb':'concert';tSave();tSyncUI()};
 $t('tuTargetSel').onchange=e=>{T.target=e.target.value;tSave();tSyncUI()};
 $t('tuSampleStart').onclick=()=>startSample(null,TunerCore.PIANO_LO);
 $t('tuSampleSkip').onclick=skipSample;$t('tuSampleSave').onclick=saveSamplePrompt;$t('tuSampleCancel').onclick=()=>{if(confirm('Cancel sampling?'))endSample(false)};
 $t('tuProfRename').onclick=renameProfile;$t('tuProfDelete').onclick=deleteProfile;$t('tuProfResample').onclick=resampleOne;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)tLeave()})}
window.Tuner={T,init:tInit,start:tStart,stop:tStop,leave:tLeave,enter:tEnter,Core:TunerCore,profiles,setProfiles,findProfile,interpolateCurve:TunerCore.interpolateCurve};
}
