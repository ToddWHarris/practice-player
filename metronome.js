// v30 Metronome: Web Audio look-ahead scheduler, tap tempo, time signatures, saved beats, voice (start, stop, tempo).
const MetroParse=(()=>{
 const ONES={zero:0,oh:0,one:1,won:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,ate:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
 const TENS={twenty:20,thirty:30,forty:40,fourty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 // "one twenty" -> 120, "one hundred twenty" -> 120, "ninety" -> 90, "120" -> 120, "sixty six" -> 66
 function num(text){const t=String(text||'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9 ]/g,' ');const d=t.match(/\d{2,3}/);if(d)return +d[0];
  const w=t.split(/\s+/).filter(Boolean);let chunks=[],cur=null,hund=null,seen=false;
  for(const x of w){if(x==='hundred'){hund=(cur==null?1:cur)*100;cur=null;seen=true;continue}if(x==='and'&&hund!=null)continue;
   if(x in TENS){if(cur!=null&&!(cur>=100))chunks.push(cur);cur=TENS[x];seen=true;continue}
   if(x in ONES){const v=ONES[x];if(cur!=null&&cur>=20&&cur%10===0&&v<10)cur+=v;else{if(cur!=null)chunks.push(cur);cur=v}seen=true;continue}
   if(seen)break}
  if(!seen)return null;if(hund!=null)return hund+(cur||0)+(chunks.reduce((a,b)=>a+b,0));if(cur!=null)chunks.push(cur);
  if(chunks.length>=2&&chunks[0]<10&&chunks[1]<100)return chunks[0]*100+chunks[1];return chunks[0]}
 function cmd(text){const t=' '+String(text||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ')+' ';if(/ (stop|halt|quiet) /.test(t))return{cmd:'stop'};if(/ (start|go|play|begin) /.test(t))return{cmd:'start'};
  const n=num(t);if(n!=null&&n>=20&&n<=400)return{bpm:n};return null}
 const clamp=b=>Math.max(30,Math.min(300,Math.round(+b||0)));
 // tap tempo: average of the last taps, reset after 2 s without a tap
 function tapper(){let ts=[];return t=>{if(ts.length&&t-ts[ts.length-1]>2000)ts=[];ts.push(t);if(ts.length>5)ts.shift();if(ts.length<2)return null;const g=(ts[ts.length-1]-ts[0])/(ts.length-1);return clamp(60000/g)}}
 return{num,cmd,clamp,tapper}})();
if(typeof module!=='undefined')module.exports=MetroParse;
if(typeof document!=='undefined'){
const SIGS={'2/4':2,'3/4':3,'4/4':4,'5/4':5,'6/8':6,'7/8':7,'12/8':12};
const MK='pp-met',BK_BEATS='pp-beats';
const M={nodes:[],done:{},last:{k:'',t:0},stab:null,fired:0,lastT:0,firstLead:null,ctx:null,gain:null,on:false,timer:null,next:0,beat:0,q:[],raf:0,rec:null,mic:false,tap:MetroParse.tapper(),
 bpm:120,sig:'4/4',vol:0.8};
const $m=id=>document.getElementById(id);
function mLoad(){try{const o=JSON.parse(localStorage.getItem(MK)||'{}');if(o.bpm)M.bpm=MetroParse.clamp(o.bpm);if(SIGS[o.sig])M.sig=o.sig;if(o.vol!=null)M.vol=+o.vol}catch(e){}}
function mSave(){try{localStorage.setItem(MK,JSON.stringify({bpm:M.bpm,sig:M.sig,vol:M.vol}))}catch(e){}}
function beats(){try{const a=JSON.parse(localStorage.getItem(BK_BEATS)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function setBeats(a){try{localStorage.setItem(BK_BEATS,JSON.stringify(a))}catch(e){}}
function setBpm(b){const nb=MetroParse.clamp(b),ch=nb!==M.bpm;M.bpm=nb;if(ch&&M.on&&M.ctx){// next beat uses the new tempo, no waiting for the bar
 M.next=Math.max(M.ctx.currentTime+0.01,M.lastT+60/M.bpm)}$m('mBpm').textContent=M.bpm;$m('mBpmIn').value=M.bpm;mSave()}
function setSig(s){if(!SIGS[s])return;M.sig=s;$m('mSig').value=s;M.beat=0;mDots();mSave()}
function mDots(){const d=$m('mDots');d.innerHTML='';for(let i=0;i<SIGS[M.sig];i++){const s=document.createElement('span');s.className='mDot'+(i===0?' one':'');d.append(s)}}
function click(t,acc){const o=M.ctx.createOscillator(),g=M.ctx.createGain();o.frequency.value=acc?1600:1000;o.type='square';
 g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,M.vol*(acc?1:0.6)),t+0.002);g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
 o.connect(g);g.connect(M.gain);o.start(t);o.stop(t+0.06);M.nodes.push(o);o.onended=()=>{const i=M.nodes.indexOf(o);if(i>=0)M.nodes.splice(i,1);try{o.disconnect()}catch(e){}}}
function sched(){const ahead=0.1;while(M.next<M.ctx.currentTime+ahead){const b=M.beat;click(M.next,b===0);M.lastT=M.next;M.q.push({t:M.next,b});M.next+=60/M.bpm;M.beat=(b+1)%SIGS[M.sig]}}
function draw(){if(!M.on)return;const now=M.ctx.currentTime;let hit=null;while(M.q.length&&M.q[0].t<=now){hit=M.q.shift()}
 if(hit){const d=$m('mDisp');d.classList.remove('f1','fn');void d.offsetWidth;d.classList.add(hit.b===0?'f1':'fn');M.lastBeat=hit.b;
  [...$m('mDots').children].forEach((x,i)=>x.classList.toggle('on',i===hit.b));clearTimeout(M.ft);M.ft=setTimeout(()=>d.classList.remove('f1','fn'),Math.min(150,30000/M.bpm))}
 M.raf=requestAnimationFrame(draw)}
function mCtx(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;if(!M.ctx){M.ctx=new AC();M.gain=M.ctx.createGain();M.gain.connect(M.ctx.destination)}if(M.ctx.state!=='running'&&M.ctx.resume)M.ctx.resume();return M.ctx}
function mStart(){if(M.on)return;try{if(window.Meter&&Meter.L&&Meter.L.on)Meter.stop()}catch(e){}if(!mCtx())return;M.gain.gain.cancelScheduledValues(0);M.gain.gain.value=1;M.on=true;M.fired++;M.beat=0;M.q=[];
 // first click almost at once (10 ms is enough for the audio thread to pick it up)
 M.next=M.ctx.currentTime+0.01;M.firstLead=M.next-M.ctx.currentTime;
 try{if(typeof au!=='undefined'&&!au.paused)au.pause()}catch(e){}
 sched();M.timer=setInterval(sched,25);M.raf=requestAnimationFrame(draw);$m('mGo').textContent='Stop';$m('mGo').classList.add('on')}
function mStop(){if(!M.on)return;M.on=false;clearInterval(M.timer);cancelAnimationFrame(M.raf);M.q=[];clearTimeout(M.ft);if(M.gain&&M.ctx)try{M.gain.gain.cancelScheduledValues(0);M.gain.gain.setValueAtTime(0,M.ctx.currentTime)}catch(e){}
 M.nodes.splice(0).forEach(o=>{try{o.onended=null;o.stop(0);o.disconnect()}catch(e){}});
 const d=$m('mDisp');d.classList.remove('f1','fn');[...$m('mDots').children].forEach(x=>x.classList.remove('on'));$m('mGo').textContent='Start';$m('mGo').classList.remove('on')}
// voice: its own recognizer, only while the Metronome tab is open and the mic toggle is on
function mStatus(t){$m('mVoiceTxt').textContent=t}
function mVoiceOn(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){mStatus('Voice is not available in this browser.');return false}
 M.mic=true;$m('mMic').classList.add('on');$m('mMic').setAttribute('aria-pressed','true');$m('mMic').textContent='Mic on';mListen();return true}
function mVoiceOff(){M.mic=false;const r=M.rec;M.rec=null;if(r)try{r.abort()}catch(e){}$m('mMic').classList.remove('on');$m('mMic').setAttribute('aria-pressed','false');$m('mMic').textContent='Mic off';mStatus('Voice is off.')}
// Act once per thing said: same action within 900 ms (any result index) is a repeat
function mAct(k,fn){const now=performance.now();if(M.last.k===k&&now-M.last.t<900)return false;M.last={k,t:now};fn();return true}
function mHeard(tr,fin,idx){tr=String(tr||'');if(idx==null)idx='x'+performance.now();fin=fin!==false;const d=M.done[idx]||(M.done[idx]={});const c=MetroParse.cmd(tr);
 if(!c){return false}
 if(c.cmd){if(d.cmd===c.cmd)return false;d.cmd=c.cmd;mAct(c.cmd,()=>c.cmd==='start'?mStart():mStop());mStatus('Heard "'+tr.trim()+'"');return true}
 const n=c.bpm;if(n<30||n>300)return false;clearTimeout(M.stab);
 const apply=()=>{if(d.bpm===n)return;d.bpm=n;M.last={k:'bpm'+n,t:performance.now()};setBpm(n);mStatus('Heard "'+tr.trim()+'"')};
 // digits are complete as soon as they appear; words like "one twenty" could still grow, so wait for them to settle
 if(fin||/\d{2,3}/.test(tr)){apply();return true}
 M.stab=setTimeout(apply,300);return true}
function mListen(){if(!M.mic||M.rec||document.hidden||!$m('met').classList.contains('on'))return;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;const r=new SR();M.rec=r;
 r.lang=navigator.language||'en-US';r.continuous=true;r.interimResults=true;let fails=0;M.done={};
 r.onresult=e=>{if(M.rec!==r)return;for(let i=e.resultIndex||0;i<e.results.length;i++){const x=e.results[i];mHeard((x[0]&&x[0].transcript)||'',!!x.isFinal,i)}};
 r.onstart=()=>{fails=0;mStatus('Listening. Say "start", "stop" or a tempo like "one twenty".')};
 r.onerror=e=>{const c=e.error||'';if(c==='not-allowed'||c==='service-not-allowed'||c==='audio-capture'){M.rec=null;mVoiceOff();mStatus(c==='not-allowed'?'Microphone not allowed. Turn it on in Settings > Apps > Safari > Microphone.':c==='service-not-allowed'?'Turn on Dictation in Settings > General > Keyboard.':'No microphone found.')}else fails++};
 // sessions end often on iPhone: restart right away so no words fall in the gap
 r.onend=()=>{if(M.rec!==r)return;M.done={};if(!M.mic||document.hidden||fails>20){M.rec=null;return}try{r.start()}catch(e){M.rec=null;setTimeout(mListen,100)}};
 try{r.start()}catch(e){M.rec=null}}
function mLeave(){mStop();const r=M.rec;M.rec=null;if(r)try{r.abort()}catch(e){}}
function mEnter(){if(M.mic)mListen()}
function mRenderBeats(sel){const s=$m('mBeats');s.innerHTML='';const o=document.createElement('option');o.value='';o.textContent='Saved beats ('+beats().length+')';s.append(o);
 beats().forEach((b,i)=>{const x=document.createElement('option');x.value=String(i);x.textContent=b.name+': '+b.bpm+' in '+b.sig;s.append(x)});s.value=sel==null?'':String(sel);$m('mDel').disabled=s.value===''}
function mInit(){mLoad();const sg=$m('mSig');Object.keys(SIGS).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;sg.append(o)});
 setBpm(M.bpm);setSig(M.sig);$m('mVol').value=Math.round(M.vol*100);mRenderBeats();
 $m('mGo').onclick=()=>M.on?mStop():mStart();
 $m('mBpmIn').addEventListener('change',e=>setBpm(e.target.value));$m('mBpmIn').addEventListener('keydown',e=>{if(e.key==='Enter'){setBpm(e.target.value);e.target.blur()}});
 $m('mMinus').onclick=()=>setBpm(M.bpm-1);$m('mPlus').onclick=()=>setBpm(M.bpm+1);
 $m('mTap').onclick=()=>{const b=M.tap(performance.now());if(b)setBpm(b)};
 sg.onchange=()=>setSig(sg.value);$m('mVol').oninput=e=>{M.vol=e.target.value/100;mSave()};
 $m('mMic').onclick=()=>{if(M.mic)mVoiceOff();else{try{if(window.Meter&&Meter.L&&Meter.L.on)Meter.stop()}catch(e){}if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)navigator.mediaDevices.getUserMedia({audio:true}).then(st=>st.getTracks().forEach(t=>t.stop())).catch(()=>{});mCtx();mVoiceOn()}};
 $m('mBeats').onchange=e=>{const b=beats()[+e.target.value];$m('mDel').disabled=!b;if(b){setBpm(b.bpm);setSig(b.sig);if(typeof toast==='function')toast('Loaded '+b.name)}};
 $m('mSave').onclick=()=>{const n=(prompt('Name for this beat ('+M.bpm+' in '+M.sig+')','')||'').trim();if(!n)return;const a=beats();const i=a.findIndex(x=>x.name.toLowerCase()===n.toLowerCase());const rec={name:n,bpm:M.bpm,sig:M.sig};
  if(i>=0)a[i]=rec;else a.push(rec);a.sort((x,y)=>x.name.localeCompare(y.name));setBeats(a);mRenderBeats(a.findIndex(x=>x.name===n));if(typeof toast==='function')toast('Saved '+n)};
 $m('mDel').onclick=()=>{const i=+$m('mBeats').value,a=beats();if($m('mBeats').value===''||!a[i])return;if(!confirm('Delete the saved beat "'+a[i].name+'"?'))return;a.splice(i,1);setBeats(a);mRenderBeats()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){const r=M.rec;M.rec=null;if(r)try{r.abort()}catch(e){}}else mEnter()})}
window.Metro={M,init:mInit,start:mStart,stop:mStop,leave:mLeave,enter:mEnter,setBpm,setSig,heard:mHeard,beats,SIGS};
}
