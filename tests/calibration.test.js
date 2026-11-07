// Calibration: stiffness from partial spacing, targets anchored at the chosen A, not at the heard pitch.
const a=require('assert');const P=require('../pianotune.js');
function note(f1,B,partials){
 return {f1,B,partials:partials||[1,2,3,4,5,6],amp:1}}
function fit(f1,B,opt){
 const buf=P.synthUnison(48000,1.2,[note(f1,B,opt&&opt.ns)],opt);
 return P.analyzeCalibrationNote(buf,48000,{midi:opt&&opt.midi!=null?opt.midi:69,a4:440,searchB:0.0003})}
const mid=fit(440,0.0004,{midi:69});
a.equal(mid.status,'measured');
a.ok(Math.abs(mid.B/0.0004-1)<0.2,mid.B);
a.ok(Math.abs(mid.heardCents)<2,mid.heardCents);
const sharp=fit(440*Math.pow(2,20/1200),0.0004,{midi:69});
a.equal(sharp.status,'measured');
a.ok(Math.abs(sharp.B-mid.B)/mid.B<0.25,'B stays put when the whole note is sharp');
a.ok(sharp.heardCents>12,'heard offset is recorded and is not a target');
const few=fit(440,0.0004,{midi:69,ns:[1,2]});
a.equal(few.status,'rejected');
const wrong=fit(440,0.0004,{midi:57});
a.equal(wrong.reason,'wrong-note');
const c15=440*Math.pow(2,15/1200);
const multi=P.analyzeCalibrationNote(P.synthUnison(48000,1.2,[note(440,0.0004),note(c15,0.0004)]),48000,{midi:69,a4:440});
a.equal(multi.reason,'multiple-strings');
const steady=P.analyzeCalibrationNote(P.synthUnison(48000,1.2,[note(440,0.0004)],{noise:4,seed:9}),48000,{midi:69,a4:440});
a.equal(steady.status,'measured');
a.ok(Math.abs(steady.B/0.0004-1)<0.2,steady.B);
const noisy=P.analyzeCalibrationNote(P.synthUnison(48000,1.2,[note(440,0.0004)],{noise:20,seed:9}),48000,{midi:69,a4:440});
a.notEqual(noisy.status,'measured');
const quiet=P.analyzeCalibrationNote(new Float32Array(48000),48000,{midi:69,a4:440});
a.equal(quiet.reason,'silence');
const notes=[
 {status:'measured',midi:33,B:0.0008,residualCents:0.4,confidence:'high',partials:[{n:1,hz:55}],heardCents:-30},
 {status:'measured',midi:45,B:0.00055,residualCents:0.3,confidence:'high',partials:[{n:1,hz:110}],heardCents:-15},
 {status:'measured',midi:69,B:0.0003,residualCents:0.2,confidence:'high',partials:[{n:1,hz:430}],heardCents:-40},
 {status:'measured',midi:93,B:0.0011,residualCents:0.8,confidence:'high',partials:[{n:1,hz:1700}],heardCents:-50}
];
const cal=P.deriveCalibration(notes,440,'concert');
a.equal(cal.status,'accepted');
a.equal(cal.algorithm,'cal-4:2-v2');
a.equal(cal.targets[69].cents,0);
a.equal(cal.targets[69].source,'anchor');
a.ok(cal.targets[93].cents>0,'treble sits sharp of the anchor');
a.ok(cal.targets[33].cents<0,'bass sits flat of the anchor');
a.equal(cal.targets[21].source,'unavailable');
a.equal(cal.targets[21].cents,null);
a.notEqual(cal.targets[69].cents,-40);
const again=P.deriveCalibration(notes.map(n=>Object.assign({},n,{heardCents:n.heardCents+25})),440,'concert');
a.equal(again.targets[93].cents,cal.targets[93].cents);
const curve=P.curveFromCalibration(cal,'concert');
a.equal(curve.origin[69],'anchor');
a.equal(curve.origin[21],'unavailable');
a.equal(curve.cents[21],null);
const fb=P.curveFromCalibration(Object.assign({},cal,{fallback:'model'}),'concert');
a.equal(fb.origin[21],'model-fallback');
a.ok(isFinite(fb.cents[21]));
a.ok(Math.abs(fb.cents[21]-P.curveFor('concert').cents[21])<1e-9);
const beat=P.expectedBeat(curve.cents,midi=>curve.b(midi),440,57,'M3');
a.ok(beat&&isFinite(beat.beat));
const missing=P.expectedBeat(curve.cents,midi=>curve.b(midi),440,21,'P8');
a.equal(missing,null);
const k=P.MODELS['kawai-k200'];
a.equal(k.maker,'Kawai');
a.equal(k.model,'K-200');
a.equal(k.heightCm,114);
a.equal(k.widthCm,149);
a.equal(k.depthCm,57);
a.equal(k.weightKg,208);
a.equal(k.speakingNo1Mm,1157);
a.equal(k.duplex,false);
a.equal(k.agraffes,false);
a.equal(k.layoutStart,'studio');
a.equal(k.layoutNote,'generic-studio-start');
a.equal(k.split2,undefined);
a.equal(k.B,undefined);
a.equal(k.cents,undefined);
a.equal(P.curveFor('kawai-k200'),null);
a.ok(k.sources[0].indexOf('kawaius.com')>=0&&k.sources[1].indexOf('kawai.co.uk')>=0);
const concert=P.curveFor('concert');
a.equal(concert.origin[69],'derived');
a.ok(Math.abs(concert.cents[69])<1e-9);
const thin=P.deriveCalibration(notes.slice(0,2),440,'concert');
a.equal(thin.status,'insufficient');
a.equal(thin.accepted,false);
const two=P.analyzeUnison(P.synthUnison(48000,1.2,[note(440,0.0003),note(444,0.0003)]),48000,{f1:440,strings:2,searchB:0.0003});
a.equal(two.pass,false);
a.equal(two.status,'ok');
a.ok(two.fundamentalBeat>3.2&&two.fundamentalBeat<4.8,two.fundamentalBeat);
a.equal(two.pattern,'offset');
const slow=P.analyzeUnison(P.synthUnison(48000,1.2,[note(440,0.0003),note(440.4,0.0003)]),48000,{f1:440,strings:2,searchB:0.0003});
a.equal(slow.pass,false);
a.notEqual(slow.status,'ok');
const stiff=P.analyzeUnison(P.synthUnison(48000,1.2,[note(440,0),note(440,0.0008)]),48000,{f1:440,strings:2,searchB:0});
a.equal(stiff.pass,false);
a.ok(stiff.pattern==='higher-partials'||stiff.status==='uncertain',stiff.pattern||stiff.reason);
const cue=P.listenCue({phase:'a4',midi:69,stringIndex:2,stringCount:3},null);
a.ok(cue.plain.indexOf('together')>=0&&cue.hearing==='unison');
a.ok(cue.detail.indexOf('not a pass')>=0);
const first=P.listenCue({phase:'a4',midi:69,stringIndex:1,stringCount:3},null);
a.ok(first.plain.indexOf('Play A4 alone')>=0&&first.hearing==='pitch');
function lawB(midi){const f=440*Math.pow(2,(midi-69)/12);return 0.00025*Math.pow(f/440,1.3)}
const smooth=[21,33,45,57,69,81,93].map(midi=>({status:'measured',midi,B:lawB(midi),residualCents:0.3,confidence:'high',partials:[{n:1,hz:1},{n:2,hz:2},{n:3,hz:3}],heardCents:12}));
const wide=P.deriveCalibration(smooth,440,'concert');
a.equal(wide.targets[108].source,'extrapolated');
a.equal(wide.targets[108].bSource,'extrapolated');
a.ok(wide.targets[108].cents>wide.targets[93].cents);
a.notEqual(wide.targets[108].source,'measured');
a.notEqual(wide.targets[108].source,'model-fallback');
const withTop=P.deriveCalibration(smooth.concat([{status:'measured',midi:108,B:lawB(108),residualCents:0.3,confidence:'high',partials:[{n:1,hz:1}],heardCents:-8}]),440,'concert');
a.equal(withTop.targets[108].source,'measured');
a.ok(Math.abs(wide.targets[108].cents-withTop.targets[108].cents)<8,wide.targets[108].cents+' vs '+withTop.targets[108].cents);
a.equal(wide.targets[21].source,'measured');
const three=P.analyzeUnison(P.synthUnison(48000,1.4,[note(440,0.0003),note(444,0.0003),note(448,0.0003)]),48000,{f1:440,strings:3,searchB:0.0003});
a.equal(three.pass,false);
a.equal(three.strings,3);
a.equal(three.status,'ok');
a.ok(three.partials[0].pairs.length>=2,three.partials[0].pairs.length);
const extra=P.analyzeUnison(P.synthUnison(48000,1.4,[note(432,0.0002),note(436,0.0002),note(444,0.0002),note(448,0.0002)]),48000,{f1:440,strings:3,searchB:0.0002});
a.equal(extra.pass,false);
a.equal(extra.status,'uncertain');
a.equal(extra.reason,'ambiguous');
const a0f=440*Math.pow(2,(21-69)/12);
function hearA0(f1,B,ns,opt,midi){
 return P.analyzeCalibrationNote(P.synthUnison(48000,1.2,[{f1:f1,B:B,partials:ns||[1,2,3,4,5,6]}],opt||{}),48000,{midi:midi==null?21:midi,a4:440})}
const a0full=hearA0(a0f,0.0004);
a.equal(a0full.status,'measured');
a.ok(Math.abs(a0full.B/0.0004-1)<0.25,a0full.B);
a.ok(Math.abs(a0full.heardCents)<8,a0full.heardCents);
const a0miss=hearA0(a0f,0.0004,[2,3,4,5,6]);
a.equal(a0miss.status,'measured',a0miss.reason);
a.equal(a0miss.fundamental,'inferred');
a.ok(!a0miss.partials.some(p=>p.n===1));
a.ok(a0miss.partials.some(p=>p.n%2===1));
a.ok(Math.abs(a0miss.B/a0full.B-1)<0.35,'missing-fundamental B '+a0miss.B+' vs '+a0full.B);
a.ok(Math.abs(a0miss.heardCents)<8,a0miss.heardCents);
const a0gaps=hearA0(a0f,0.0004,[2,3,5,6]);
a.equal(a0gaps.status,'measured',a0gaps.reason);
a.ok(Math.abs(a0gaps.B/a0full.B-1)<0.4,a0gaps.B);
const a0flat=a0f*Math.pow(2,-20/1200);
const a0det=hearA0(a0flat,0.0004,[2,3,4,5,6]);
a.equal(a0det.status,'measured',a0det.reason);
a.ok(a0det.heardCents<-12&&a0det.heardCents>-40,a0det.heardCents);
a.ok(Math.abs(a0det.B/a0full.B-1)<0.4,a0det.B);
const a0far=hearA0(a0f*Math.pow(2,-100/1200),0.0004,[2,3,4,5,6]);
a.equal(a0far.status,'rejected');
a.equal(a0far.reason,'wrong-note');
const a0farFull=hearA0(a0f*Math.pow(2,100/1200),0.0004);
a.equal(a0farFull.reason,'wrong-note');
const evens=hearA0(a0f,0.0004,[2,4,6]);
a.equal(evens.status,'rejected');
a.equal(evens.reason,'wrong-note');
const thinBass=hearA0(a0f,0.0004,[2,3]);
a.equal(thinBass.status,'rejected');
a.notEqual(thinBass.reason,'wrong-note');
a.ok(thinBass.reason==='unclear'||thinBass.reason==='few-partials'||thinBass.reason==='fit',thinBass.reason);
const a1=440*Math.pow(2,(33-69)/12);
const playedA1=hearA0(a1,0.00035,[1,2,3,4,5,6]);
a.equal(playedA1.status,'rejected');
a.equal(playedA1.reason,'wrong-note');
const a0quiet=P.analyzeCalibrationNote(new Float32Array(48000),48000,{midi:21,a4:440});
a.equal(a0quiet.reason,'silence');
const a0short=P.analyzeCalibrationNote(P.synthUnison(48000,0.2,[{f1:a0f,B:0.0004,partials:[2,3,4,5,6]}]),48000,{midi:21,a4:440});
a.equal(a0short.reason,'short');
const a0noise=hearA0(a0f,0.0004,[2,3,4,5,6],{noise:20,seed:3});
a.notEqual(a0noise.status,'measured');
const a0pair=P.analyzeCalibrationNote(P.synthUnison(48000,1.2,[
 {f1:a0f,B:0.0004,partials:[2,3,4,5,6]},
 {f1:a0f*Math.pow(2,15/1200),B:0.0004,partials:[2,3,4,5,6]}
]),48000,{midi:21,a4:440});
a.notEqual(a0pair.status,'measured');
a.ok(a0pair.reason==='multiple-strings'||a0pair.reason==='unclear',a0pair.reason);
const a0mix=P.analyzeCalibrationNote(P.synthUnison(48000,1.2,[
 {f1:a0f,B:0.0004,partials:[2,3,4,5,6]},
 {f1:a0f*Math.pow(2,40/1200),B:0.0004,partials:[2,3,4,5,6]}
]),48000,{midi:21,a4:440});
a.notEqual(a0mix.status,'measured',a0mix.reason);
const oneCue=P.calibrationCue(21,24,53);
a.ok(oneCue.indexOf('A0')>=0&&oneCue.indexOf('one string')>=0&&oneCue.indexOf('Mute')<0&&oneCue.indexOf('not for whether it is in tune')>=0,oneCue);
const manyCue=P.calibrationCue(69,24,53);
a.ok(manyCue.indexOf('one string only')>=0&&manyCue.indexOf('Mute the other strings')>=0,manyCue);
const jagged=[57,69,81,93].map((midi,i)=>({status:'measured',midi,B:[0.0002,0.004,0.00015,0.005][i],residualCents:0.4,confidence:'high',partials:[{n:1,hz:1},{n:2,hz:2},{n:3,hz:3}],heardCents:5}));
const low=[33,45].map(midi=>({status:'measured',midi,B:0.0006,residualCents:0.4,confidence:'high',partials:[{n:1,hz:1},{n:2,hz:2},{n:3,hz:3}],heardCents:-10}));
const rough=P.deriveCalibration(low.concat(jagged),442,'concert');
a.equal(rough.targets[108].source,'unavailable');
a.equal(rough.targets[108].cents,null);
a.notEqual(rough.targets[108].source,'measured');
a.notEqual(rough.targets[69].cents,5);
const roughCurve=P.curveFromCalibration(rough,'concert');
a.equal(roughCurve.origin[108],'unavailable');
a.equal(roughCurve.cents[108],null);
a.notEqual(roughCurve.origin[108],'model-fallback');
const roughModel=P.curveFromCalibration(Object.assign({},rough,{fallback:'model'}),'concert');
a.equal(roughModel.origin[108],'model-fallback');
console.log('calibration ok', 'A6', cal.targets[93].cents.toFixed(2), 'A2ish', cal.targets[33].cents.toFixed(2), 'unison', two.fundamentalBeat.toFixed(2), 'A0B', a0miss.B.toFixed(6));
