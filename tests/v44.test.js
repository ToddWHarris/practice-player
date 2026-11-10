// V44 acceptance checks that do not need a piano.
const a=require('assert');const fs=require('fs');
const V=require('../v44core.js');
const P=require('../pianotune.js');
const T=require('../tuner.js');

// T9 register table
[[21,6],[47,6],[48,4],[71,4],[72,2],[83,2],[84,1],[108,1]].forEach(([m,n])=>a.equal(V.autoPartial(m),n,'partial '+m));

// T2 ring
const sharp=V.ringFrame(0,2,1,1,true);
a.ok(sharp.clockwise&&sharp.angle>0&&!sharp.center===false);
a.ok(Math.abs(sharp.revPerSec-1)<1e-9);
a.equal(sharp.center,true);
const flat=V.ringFrame(0,-2,1,1,true);
a.ok(!flat.clockwise&&flat.angle<0&&flat.center===false);
const still=V.ringFrame(10,0,1,1,true);
a.ok(still.frozen&&Math.abs(still.revPerSec)<1e-9);
const quiet=V.ringFrame(10,5,1,1,false);
a.ok(quiet.grey&&quiet.frozen&&quiet.center===false);
const half=V.ringFrame(0,2,2,1,true);
a.ok(Math.abs(half.revPerSec-0.5)<1e-9);

// T4 two partials: 5 cents on partial 4
const f4=1760;
const off=f4*(Math.pow(2,5/1200)-1);
const turn=V.ringFrame(0,off,1,1,true);
a.ok(Math.abs(turn.revPerSec-(off/2))<1e-6);
const on=V.ringFrame(0,0,1,1,true);
a.ok(on.frozen);

// T8 A4 row from the 0.8 relation, and S from a known B
const shown=V.a4DisplayedFromStretch(7);
a.ok(Math.abs(shown-8.7)<0.1,shown);
const B=V.bFromStretch(2,4,7);
const back=V.stretchFromB(B,2,4);
a.ok(Math.abs(back-7)<0.2,back);
const fac=V.facTargets(8,7,6,440);
const rows=[];
[21,33,45,57,69,81,93,105].forEach(m=>{
 const got=fac.targets[m].cents, want=V.EXAMPLE.cents[m];
 a.ok(isFinite(got));
 a.equal(fac.targets[m].partial,V.autoPartial(m));
 a.equal(fac.targets[m].source,'modeled');
 rows.push(m+' modeled '+got.toFixed(2)+' manual table '+want+' difference '+(got-want).toFixed(2));
 if(m===69)a.ok(Math.abs(got-want)<0.1,got);
});
console.log('T8 comparison (patent stretch equation was not available, so only A4 is required to match; other rows are reported):\n'+rows.join('\n'));

// T3 synthetic decaying high notes
function strike(freq,sec,peak,noise){
 const sr=48000,n=Math.floor(sr*sec),x=new Float32Array(n);
 let s=5;
 for(let i=0;i<n;i++){
  const t=i/sr,env=Math.exp(-t/0.15);
  let v=peak*Math.sin(2*Math.PI*freq*t)*env;
  if(noise){s=(s*16807)%2147483647;v+=((s/2147483647)*2-1)*noise}
  x[i]=v}
 return x}
function centsOf(lock,target){return 1200*Math.log2((target+lock.offsetHz)/target)}
[1046.5,2093,4258].forEach(f=>{
 const reads=[];
 for(let k=0;k<3;k++){
  const buf=strike(f*Math.pow(2,0.4/1200),0.2,0.02,0.0005);
  const lock=V.lockPartial(buf,48000,f);
  a.ok(lock&&lock.rms>0.001,f);
  reads.push(centsOf(lock,f))}
 const med=V.median(reads);
 a.ok(Math.abs(med-0.4)<1,f+' med '+med+' reads '+reads.join(','));
});
const noiseOnly=new Float32Array(48000*0.3);let ns=3;
for(let i=0;i<noiseOnly.length;i++){ns=(ns*16807)%2147483647;noiseOnly[i]=((ns/2147483647)*2-1)*0.0005}
const none=V.lockPartial(noiseOnly,48000,4258);
a.ok(!none||Math.abs(none.offsetHz)>30||none.level<1e-4);

// T5 gates: yin defaults unchanged, piano opts can read a soft high tone
const soft=strike(4258,0.2,0.02,0.0002);
a.equal(T.yin(soft,48000,0.15),null);
const loud=T.tone(440,48000,0.5,'rich');
const y=T.yin(loud,48000,0.15);
a.ok(y&&y<4200&&y>27);
const high=T.yin(soft,48000,0.15,{minRms:0.001,maxHz:9000});
a.ok(high&&high>4000,high);

// green from three close strikes, not from one
a.equal(V.strikeGreen([1,1]).green,false);
a.equal(V.strikeGreen([1,0.5,1.2]).green,true);
a.equal(V.strikeGreen([1,8,-6]).green,false);

// K-200 counted breaks: C2 and F3, model object stays free of a baked split
a.deepEqual(V.k200Splits().split2,36);
a.deepEqual(V.k200Splits().split3,53);
a.equal(P.MODELS['kawai-k200'].split2,undefined);
a.equal(P.stringCount(35,36,53),1);
a.equal(P.stringCount(36,36,53),2);
a.equal(P.stringCount(52,36,53),2);
a.equal(P.stringCount(53,36,53),3);

// 14 measure notes include F3 and C6
a.ok(P.CAL_NOTES.indexOf(53)>=0&&P.CAL_NOTES.indexOf(84)>=0);
a.equal(P.CAL_NOTES.length,14);

// temperament default is A2 to A4; F3 to F4 remains available
const aOrder=P.buildSequence({}).filter(s=>s.phase==='a4'||s.phase==='temper').map(s=>s.midi);
a.deepEqual(aOrder.slice(0,5),[69,57,45,49,53]);
const fOrder=P.buildSequence({temperament:'f3f4'}).filter(s=>s.phase==='a4'||s.phase==='temper').map(s=>s.midi);
a.deepEqual(fOrder.slice(0,5),[69,57,53,61,65]);

// profile record written by savePiano does not gain the new keys
const src=fs.readFileSync('pianotune.js','utf8');
const at=src.indexOf('function savePiano()');
const body=src.slice(at,at+900);
['style:','a4:','split2:','split3:','prescan:','calibration:','pianoModel:','serial:'].forEach(k=>a.ok(body.includes(k),k));
a.ok(!body.includes('pp-v44'));

// storage names
const app=fs.readFileSync('app.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
a.ok(app.includes('APP_VERSION=45'));
a.ok(sw.includes('const V=45'));
a.ok(fac.targets[93].cents!==0&&fac.targets[105].cents!==0,'treble stretch must not collapse');
a.ok(sw.includes('v44core.js')&&sw.includes('partial-lock-worklet.js'));
a.ok(app.includes('pp-v44-resume')||src.includes('pp-v44-resume'));
a.ok(fs.readFileSync('sessionlog.js','utf8').includes('pp-v44-log'));
const help=fs.readFileSync('index.html','utf8');
a.ok(help.includes('About this meter'));
a.ok(!help.includes('Inventronics'));
a.ok(help.includes('modeled on how the Sanderson Accu-Tuner works'));
console.log('v44 ok');
