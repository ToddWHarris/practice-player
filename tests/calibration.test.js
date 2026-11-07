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
a.equal(cal.algorithm,'cal-4:2-v1');
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
console.log('calibration ok', 'A6', cal.targets[93].cents.toFixed(2), 'A2ish', cal.targets[33].cents.toFixed(2), 'unison', two.fundamentalBeat.toFixed(2));
