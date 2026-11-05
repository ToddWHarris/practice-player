// v32 Tuner: YIN on sine + harmonic-rich tones, transposition, Railsback stretch, profile interpolation
const a=require('assert');const T=require('../tuner.js');
const SR=48000;
function centsErr(got,exp){return 1200*Math.log2(got/exp)}
for(const [f,kind] of [[41.2,'sine'],[41.2,'rich'],[82.4,'sine'],[82.4,'rich'],[440,'sine'],[440,'rich'],[30.87,'rich']]){
  const y=T.yin(T.tone(f,SR,1.2,kind),SR);a.ok(y,`no pitch ${f} ${kind}`);
  const c=Math.abs(centsErr(y,f));a.ok(c<2,`${f} ${kind}: ${c.toFixed(3)} cents (got ${y})`);
}
// Trumpet: written = concert + major 2nd
a.equal(T.writtenLabel(60,2),'D4'); // concert C4 -> written D4
a.equal(T.transpose(58,2),60); // concert Bb3 -> written C4
// Euphonium Bb treble: + major 9th (14 semitones)
a.equal(T.writtenLabel(34,14),'C3'); // concert Bb1 -> written C3
a.equal(T.writtenLabel(46,14),'C4'); // concert Bb2 -> written C4
// Stretch: Fernhart Grand standard anchors
a.ok(Math.abs(T.stretchCents(21)-(-12))<0.01);
a.ok(Math.abs(T.stretchCents(69)-0)<0.01);
a.ok(Math.abs(T.stretchCents(108)-29.7)<0.01);
a.ok(T.stretchCents(24)<-5&&T.stretchCents(24)>-12); // C1 between A0 and C2
a.ok(T.stretchCents(96)>10&&T.stretchCents(96)<20); // C7
// analyze uses stretch target
{const f=T.midiToFreq(21,440)*Math.pow(2,T.stretchCents(21)/1200);
 const info=T.analyze(f,440,{midi:21,stretch:true});a.ok(Math.abs(info.cents)<0.5,'on-stretch A0 ~0');a.ok(Math.abs(info.targetCents-(-12))<0.01)}
// Profile interpolation fills gaps
{const samples={21:-20,45:-5,69:0,90:10,108:28};const curve=T.interpolateCurve(samples);
 a.equal(curve[21],-20);a.equal(curve[69],0);a.equal(curve[108],28);
 a.ok(Math.abs(curve[33]-(-12.5))<0.01||(curve[33]<-5&&curve[33]>-20),'bass fill');
 a.ok(curve[80]>0&&curve[80]<10,'treble fill between 69 and 90');
 // needle against profile
 const tgt=curve[69];const f=T.midiToFreq(69,440)*Math.pow(2,(tgt+5)/1200);
 const info=T.analyze(f,440,{midi:69,targetCents:tgt,mode:'profile'});a.ok(Math.abs(info.cents-5)<0.2,'profile +5')}
a.ok(T.isStable([1,1.1,0.9,1.0,0.95,1.05],2.5));
a.ok(!T.isStable([1,5,1,5,1,5],2.5));
console.log('tuner ok');
