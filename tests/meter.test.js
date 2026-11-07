// v33 Level meter math: known amplitudes, silence, smoothing, calibration, peak hold, stored names.
const a=require('assert');const fs=require('fs');const M=require('../meter.js');
function sine(amp,n){const b=new Float32Array(n||4800);for(let i=0;i<b.length;i++)b[i]=amp*Math.sin(2*Math.PI*i/48);return b}
function db(amp){return 20*Math.log10(amp/Math.SQRT2)}

// Full-scale sine is about -3.01 dBFS RMS. Amplitude 0.1 is 20 dB lower.
{const m=M.rms(sine(1));a.ok(Math.abs(m.rms-1/Math.SQRT2)<1e-6);a.ok(Math.abs(M.dbFromRms(m.rms)-db(1))<1e-6);
 const q=M.rms(sine(0.1));a.ok(Math.abs(M.dbFromRms(q.rms)-db(0.1))<1e-4,'0.1 amp');
 a.ok(Math.abs(db(0.1)-(db(1)-20))<1e-6)}
// Silence
{const z=M.rms(new Float32Array(1000));a.equal(z.rms,0);a.equal(z.peak,0);a.equal(M.dbFromRms(0),-Infinity);a.ok(M.isSilence(-Infinity));a.ok(M.isSilence(-80));a.ok(!M.isSilence(-79.9))}
// Clipping is sample peak, not RMS
{const b=sine(0.5);b[10]=1;const m=M.rms(b);a.ok(m.peak>=M.CLIP);a.ok(M.dbFromRms(m.rms)<-3)}
// Smoothing: one time-constant moves about 63% of the way; a long step lands on the target
{const target=0.25;const once=M.smoothPower(0,target,M.TAU,M.TAU);a.ok(Math.abs(once/target-(1-Math.exp(-1)))<1e-9);
 const landed=M.smoothPower(0,target,10,M.TAU);a.ok(Math.abs(landed-target)<1e-6);
 const held=M.smoothPower(target,target,0.05,M.TAU);a.ok(Math.abs(held-target)<1e-9)}
// Calibration is only reference minus the live dBFS. No assumed offset.
{const dbfs=-23.0,ref=72;const c=M.makeCal(dbfs,ref,{deviceId:'mic-a',label:'iPhone Mic',sampleRate:48000,agc:false,ns:false,ec:false});
 a.ok(c&&Math.abs(c.offset-(ref-dbfs))<1e-9);a.equal(c.refSpl,72);a.equal(c.deviceId,'mic-a');a.ok(M.validCal(c));
 a.ok(Math.abs(M.spl(dbfs,c.offset)-72)<1e-9);a.equal(M.makeCal(NaN,70),null);a.equal(M.spl(-10,NaN),null);
 a.ok(!M.sameDevice(c,{deviceId:'mic-b',label:'Other'}));a.ok(M.sameDevice(c,{deviceId:'mic-a',label:'x'}))}
// Peak hold keeps the higher smoothed RMS and reset returns to the current level
{let p=-Infinity;p=M.holdPeak(p,-20);p=M.holdPeak(p,-10);p=M.holdPeak(p,-15);a.equal(p,-10);
 a.equal(M.holdPeak(p,-Infinity),-10);a.equal(M.resetPeak(-15),-15);a.equal(M.resetPeak(-Infinity),-Infinity)}
// Bar is digital dBFS from -60 to 0, not an SPL scale
{a.equal(M.barPct(-60),0);a.equal(M.barPct(0),100);a.equal(M.barPct(-30),50);a.equal(M.barPct(-Infinity),0);a.equal(M.barPct(10),100)}
// Existing storage names stay, and the new pref is added beside them
{const app=fs.readFileSync('app.js','utf8'),db=fs.readFileSync('db.js','utf8'),sw=fs.readFileSync('sw.js','utf8');
 a.ok(app.includes("PREFS:['accent','pp-pre','pp-post','pp-name','pp-beats','pp-met','pp-tuner','pp-tuner-profiles','pp-meter','pp-pianotune','pp-piano-profiles','pp-partial-profiles']"));
 a.ok(db.includes("indexedDB.open('practice-player',1)"));
 a.ok(app.includes('APP_VERSION=38')&&sw.includes('const V=38')&&sw.includes("'./meter.js'")&&sw.includes("'./pianotune.js'"));
 a.ok(!app.includes('pp-preview')&&!sw.includes('pp-preview'))}
console.log('meter ok');
