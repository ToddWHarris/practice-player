// V45 checks that do not need a piano: order, stretch, anyway, storage, copy.
const a=require('assert');const fs=require('fs');
const V=require('../v44core.js');
const P=require('../pianotune.js');
a.equal(P.PRESCAN[0],21);
a.equal(P.PRESCAN[P.PRESCAN.length-1],108);
const seq=P.buildSequence({});
a.equal(seq[0].title.indexOf('Pre-scan A0'),0);
a.equal(seq.filter(s=>s.phase==='prescan').length,88);
a.ok(P.buildSequence({raise:true}).some(s=>s.phase==='remind'));
a.ok(P.buildSequence({raise:true}).some(s=>s.title.indexOf('Re-measure')===0));
a.ok(seq.some(s=>s.title==='Contiguous intervals C3 to C5'));
a.ok(Math.abs(V.facTargets(8,7,6,440).targets[93].cents-9.5)<1);
a.ok(Math.abs(V.facTargets(8,7,6,440).targets[105].cents-26.9)<1);
const stretched=[
 {status:'measured',midi:45,B:0.0005,residualCents:0.2,confidence:'high',partials:[],heardCents:0},
 {status:'measured',midi:53,B:0.0004,residualCents:0.2,confidence:'high',partials:[],heardCents:0,stretchS:8},
 {status:'measured',midi:69,B:0.0003,residualCents:0.2,confidence:'high',partials:[],heardCents:0,stretchS:7},
 {status:'measured',midi:84,B:0.0004,residualCents:0.2,confidence:'high',partials:[],heardCents:0,stretchS:6},
 {status:'measured',midi:93,B:0.0005,residualCents:0.2,confidence:'high',partials:[],heardCents:0}
];
const facCal=P.deriveCalibration(stretched,440,'concert');
a.equal(facCal.stretch.used,true);
a.equal(facCal.stretch.f3Source,'measured');
a.ok(Math.abs(facCal.targets[69].cents)<1e-6);
a.ok(Math.abs(facCal.targets[93].cents-(9.5-8.7))<0.3);
const missingC=stretched.map(n=>n.midi===84?Object.assign({},n,{stretchS:undefined}):n);
const fb=P.deriveCalibration(missingC,440,'concert');
a.equal(fb.stretch.c6Source,'default');
a.equal(fb.stretch.used,true);
const two=P.synthUnison(48000,1.2,[{f1:440,B:0.0004,partials:[1,2,3,4,5,6],amp:1},{f1:440*Math.pow(2,15/1200),B:0.0004,partials:[1,2,3,4,5,6],amp:1}]);
const bad=P.analyzeCalibrationNote(two,48000,{midi:69,a4:440});
a.equal(bad.reason,'multiple-strings');
a.ok(bad.secondPeak&&Math.abs(bad.secondPeak.cents)>8,bad.secondPeak);
const kept=P.analyzeCalibrationNote(two,48000,{midi:69,a4:440,anyway:true});
a.equal(kept.status,'measured');
a.equal(kept.maybeTwoStrings,true);
a.equal(kept.confidence,'low');
a.ok(kept.B>0);
const html=fs.readFileSync('index.html','utf8');
a.ok(!html.includes('id="gtSteps"')&&!html.includes('id="gtList"'));
a.ok(!html.includes('>flat<')&&!html.includes('>sharp<'));
a.ok(html.includes('Try again')&&html.includes('Skip to next note')&&html.includes('>Start<'));
a.ok(html.includes('Pause and keep my place'));
a.ok(!html.includes('Back</b> and <b>Steps'));
const notes=fs.readFileSync('app.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
a.ok(notes.includes('APP_VERSION=46')&&sw.includes('const V=46'));
a.ok(!notes.includes('\u2014'));
const at=fs.readFileSync('pianotune.js','utf8').indexOf('function savePiano()');
const body=fs.readFileSync('pianotune.js','utf8').slice(at,at+700);
a.ok(body.includes('style:')&&!body.includes('partials:')&&!body.includes('pp-v45'));
console.log('v45 ok');
