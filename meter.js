// v33 Level meter: RMS digital level (dBFS), smoothed for reading, peak hold of that RMS,
// and an optional user calibration to an external reference meter (estimated dB SPL).
// 0 dBFS means a digital sample at full scale (amplitude 1). A full-scale sine is about -3.01 dBFS RMS.
// Nothing here is A-weighted, time-weighted to a standard, or a safety measurement.
const MeterCore=(()=>{
 const SILENCE_DB=-80; // smoothed RMS at or below this is shown as silence
 const CLIP=0.99; // sample amplitude at or above this is digital full-scale clipping
 const TAU=0.35; // seconds, exponential smoothing of power
 const BAR_LO=-60,BAR_HI=0; // bar maps digital dBFS, not sound pressure
 function rms(buf){
  if(!buf||!buf.length)return{rms:0,peak:0};
  let s=0,peak=0;
  for(let i=0;i<buf.length;i++){const x=+buf[i]||0,a=x<0?-x:x;if(a>peak)peak=a;s+=x*x}
  return{rms:Math.sqrt(s/buf.length),peak}}
 function dbFromRms(r){if(!(r>0)||!isFinite(r))return -Infinity;return 20*Math.log10(r)}
 function smoothPower(prev,power,dt,tau){
  if(!isFinite(power)||power<0)power=0;
  if(!isFinite(prev)||prev<0)prev=0;
  tau=tau==null?TAU:tau;
  if(!(dt>0)||!isFinite(dt))return power;
  const a=Math.exp(-dt/tau);
  return a*prev+(1-a)*power}
 function holdPeak(peak,db){
  if(!isFinite(db))return isFinite(peak)?peak:-Infinity;
  if(!isFinite(peak))return db;
  return Math.max(peak,db)}
 function resetPeak(db){return isFinite(db)?db:-Infinity}
 // offset is defined only from a user-supplied reference reading and the meter's dBFS at that moment
 function makeCal(dbfs,refSpl,dev){
  if(!isFinite(dbfs)||!isFinite(refSpl))return null;
  dev=dev||{};
  return{offset:refSpl-dbfs,refSpl:+refSpl,refDbfs:+dbfs,
   deviceId:dev.deviceId||'',label:dev.label||'',sampleRate:dev.sampleRate||0,
   agc:dev.agc,ns:dev.ns,ec:dev.ec,savedAt:new Date().toISOString()}}
 function spl(dbfs,offset){if(!isFinite(dbfs)||!isFinite(offset))return null;return dbfs+offset}
 function barPct(dbfs){if(!isFinite(dbfs))return 0;const t=(dbfs-BAR_LO)/(BAR_HI-BAR_LO);return Math.max(0,Math.min(100,t*100))}
 function isSilence(dbfs){return !isFinite(dbfs)||dbfs<=SILENCE_DB}
 function validCal(o){return !!(o&&isFinite(o.offset)&&isFinite(o.refSpl)&&isFinite(o.refDbfs)&&Math.abs((o.refSpl-o.refDbfs)-o.offset)<1e-6)}
 function sameDevice(cal,dev){
  if(!cal||!dev)return true;
  if(cal.deviceId&&dev.deviceId)return cal.deviceId===dev.deviceId;
  if(cal.label&&dev.label)return cal.label===dev.label;
  return true}
 return{SILENCE_DB,CLIP,TAU,BAR_LO,BAR_HI,rms,dbFromRms,smoothPower,holdPeak,resetPeak,makeCal,spl,barPct,isSilence,validCal,sameDevice}})();
if(typeof module!=='undefined')module.exports=MeterCore;

if(typeof document!=='undefined'){
const LV_K='pp-meter';
const L={on:false,stream:null,ctx:null,src:null,an:null,raf:0,buf:null,power:0,dbfs:-Infinity,peak:-Infinity,clip:false,cal:null,dev:null,lastT:0,err:''};
const $v=id=>document.getElementById(id);
function lvLoad(){try{const o=JSON.parse(localStorage.getItem(LV_K)||'null');L.cal=MeterCore.validCal(o)?o:null}catch(e){L.cal=null}}
function lvSave(){try{if(L.cal)localStorage.setItem(LV_K,JSON.stringify(L.cal));else localStorage.removeItem(LV_K)}catch(e){}}
function procLine(dev){
 const name={agc:'automatic gain',ns:'noise suppression',ec:'echo cancellation'};
 const parts=['automatic gain','noise suppression','echo cancellation'].map(label=>{
  const key=label==='automatic gain'?'agc':label==='noise suppression'?'ns':'ec';
  const v=dev?dev[key]:undefined;
  if(v===false)return label+' off';
  if(v===true)return label+' still on';
  return label+' not reported'});
 return 'Asked the browser to turn off automatic gain, noise suppression and echo cancellation. Browser reports: '+parts.join(', ')+'. Browsers do not always honor that request.'}
function devFrom(track,ctx){
 const s=track&&track.getSettings?track.getSettings():{};
 return{deviceId:s.deviceId||'',label:(track&&track.label)||'',sampleRate:ctx?ctx.sampleRate:0,
  agc:s.autoGainControl,ns:s.noiseSuppression,ec:s.echoCancellation}}
function render(){
  const sil=MeterCore.isSilence(L.dbfs),cal=L.cal;
  $v('lvKind').textContent=cal?'Estimated':'Not calibrated';
  $v('lvUnit').textContent=cal?'dB SPL est.':'dBFS';
  if(!L.on&&!isFinite(L.dbfs)){$v('lvNum').textContent='--'}
  else if(sil){$v('lvNum').textContent='Silence'}
  else if(cal){$v('lvNum').textContent=MeterCore.spl(L.dbfs,cal.offset).toFixed(1)}
  else $v('lvNum').textContent=L.dbfs.toFixed(1);
  const pct=MeterCore.barPct(L.dbfs);
  $v('lvFill').style.width=pct+'%';
  const pk=isFinite(L.peak)?L.peak:-Infinity;
  $v('lvPeakMark').style.left=(isFinite(pk)?MeterCore.barPct(pk):0)+'%';
  $v('lvPeakMark').style.display=isFinite(pk)?'block':'none';
  if(!isFinite(pk)){$v('lvPeak').textContent='Peak hold (highest smoothed RMS): --'}
  else if(cal){$v('lvPeak').textContent='Peak hold (highest smoothed RMS): '+MeterCore.spl(pk,cal.offset).toFixed(1)+' dB SPL est.'}
  else $v('lvPeak').textContent='Peak hold (highest smoothed RMS): '+pk.toFixed(1)+' dBFS';
  $v('lvNotice').textContent=cal
   ?'Approximate estimate from your calibration. Not a safety meter. Not A-weighted. Not a standards measurement. A different microphone, or browser gain and processing, can make it wrong.'
   :'Digital level only (dBFS). This is not a sound pressure reading in dB SPL, and it is not calibrated.';
  const bits=[];
  if(L.err)bits.push(L.err);
  else if(!L.on)bits.push('Mic off. Tap Start.');
  else if(L.clip)bits.push('Digital clipping: the signal hit full scale.');
  else if(sil)bits.push('Silence.');
  else bits.push('Listening.');
  if(cal&&L.dev&&!MeterCore.sameDevice(cal,L.dev))bits.push('This calibration was saved for a different microphone. Calibrate again.');
  $v('lvStatus').textContent=bits.join(' ');
  const info=$v('lvCalInfo');
  if(!cal)info.textContent='Not calibrated. Enter the number from your own reference meter while this meter is running, then tap Save calibration.';
  else{const when=cal.savedAt?cal.savedAt.slice(0,16).replace('T',' '):'';
   const who=cal.label||(cal.deviceId?'a named microphone':'microphone not named by the browser');
   info.textContent='Saved '+when+' against '+cal.refSpl+' on the reference meter, when this meter read '+cal.refDbfs.toFixed(1)+' dBFS ('+who+'). Reset calibration clears it.'}
  $v('lvProc').textContent=L.on?procLine(L.dev):'When you tap Start, the app asks the browser to turn off automatic gain, noise suppression and echo cancellation. It will show what the browser reports. That request is not guaranteed.';
  const go=$v('lvGo');if(go){go.textContent=L.on?'Stop':'Start';go.classList.toggle('on',L.on)}}
function feed(samples,dt){
  const m=MeterCore.rms(samples);
  const now=performance.now();
  if(!(dt>0))dt=L.lastT?(now-L.lastT)/1000:0.05;
  L.lastT=now;
  L.power=MeterCore.smoothPower(L.power,m.rms*m.rms,dt,MeterCore.TAU);
  L.dbfs=MeterCore.dbFromRms(Math.sqrt(L.power));
  L.clip=m.peak>=MeterCore.CLIP;
  if(!MeterCore.isSilence(L.dbfs))L.peak=MeterCore.holdPeak(L.peak,L.dbfs);
  render();
  return{dbfs:L.dbfs,peak:L.peak,clip:L.clip}}
function resetPeak(){L.peak=MeterCore.resetPeak(MeterCore.isSilence(L.dbfs)?-Infinity:L.dbfs);render()}
function releaseMic(){
  if(L.raf){cancelAnimationFrame(L.raf);L.raf=0}
  if(L.src){try{L.src.disconnect()}catch(e){}L.src=null}
  if(L.an){try{L.an.disconnect()}catch(e){}L.an=null}
  if(L.stream){L.stream.getTracks().forEach(tr=>{try{tr.stop()}catch(e){}});L.stream=null}
  if(L.ctx){try{L.ctx.close()}catch(e){}L.ctx=null}
  L.on=false;L.dev=null;L.buf=null}
function loop(){
  if(!L.on||!L.an||!L.buf)return;
  L.an.getFloatTimeDomainData(L.buf);
  const now=performance.now(),dt=L.lastT?(now-L.lastT)/1000:0.05;
  feed(L.buf,dt);
  L.raf=requestAnimationFrame(loop)}
function exclusive(){
  try{if(window.Tuner&&Tuner.T&&Tuner.T.on)Tuner.leave()}catch(e){}
  try{if(window.Metro){if(Metro.M&&Metro.M.on)Metro.stop();if(Metro.M&&Metro.M.mic&&Metro.leave)Metro.leave()}}catch(e){}
  try{if(typeof au!=='undefined'&&au&&!au.paused)au.pause()}catch(e){}}
async function lvStart(){
  if(L.on)return;L.err='';
  try{
   if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){L.err='No microphone available.';render();return}
   exclusive();
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
   const tr=stream.getAudioTracks()[0];
   if(tr&&tr.applyConstraints){try{await tr.applyConstraints({echoCancellation:false,noiseSuppression:false,autoGainControl:false})}catch(e){}}
   const AC=window.AudioContext||window.webkitAudioContext;const ctx=new AC();
   if(ctx.state!=='running'&&ctx.resume)await ctx.resume();
   const src=ctx.createMediaStreamSource(stream);const an=ctx.createAnalyser();
   an.fftSize=2048;an.smoothingTimeConstant=0;src.connect(an);
   L.stream=stream;L.ctx=ctx;L.src=src;L.an=an;L.buf=new Float32Array(an.fftSize);
   L.dev=devFrom(tr,ctx);L.on=true;L.lastT=0;L.err='';
   render();L.raf=requestAnimationFrame(loop)}
  catch(e){releaseMic();
   const n=e&&e.name;
   L.err=n==='NotAllowedError'?'Microphone not allowed. Allow the microphone for this site, then tap Start.':
    n==='NotFoundError'||n==='OverconstrainedError'?'No microphone found.':'Could not open the microphone.';
   render()}}
function lvStop(){releaseMic();L.clip=false;render()}
function lvLeave(){if(L.on)lvStop();else render()}
function lvEnter(){}
function saveCal(){
  if(!L.on){L.err='Tap Start and play the reference sound, then tap Save calibration.';render();return}
  const ref=parseFloat($v('lvRef').value);
  if(!isFinite(ref)){L.err='Enter the number from your reference meter.';render();return}
  if(MeterCore.isSilence(L.dbfs)){L.err='The meter is reading silence. Play the reference sound, then tap Save calibration.';render();return}
  const cal=MeterCore.makeCal(L.dbfs,ref,L.dev||{});
  if(!cal){L.err='Could not save that calibration.';render();return}
  L.cal=cal;L.err='';lvSave();render()}
function resetCal(){L.cal=null;lvSave();L.err='';render()}
function lvInit(){lvLoad();render();
 $v('lvGo').onclick=()=>L.on?lvStop():lvStart();
 $v('lvPeakReset').onclick=resetPeak;
 $v('lvCalSave').onclick=saveCal;
 $v('lvCalReset').onclick=resetCal;
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&L.on)lvStop()})}
window.Meter={L,K:LV_K,Core:MeterCore,init:lvInit,start:lvStart,stop:lvStop,leave:lvLeave,enter:lvEnter,feed,resetPeak,saveCal,resetCal,load:lvLoad}}
