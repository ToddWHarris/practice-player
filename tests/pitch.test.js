// DSP check: pitch shifter on a 440 Hz sine. +12 st -> ~880 Hz, -12 -> ~220 Hz, length unchanged
const a=require('assert');const {PitchShiftCore}=require('../pitch-worklet.js');
const SR=48000;
function freq(x){ // estimate by zero crossings on the steady part
  let z=0;for(let i=1;i<x.length;i++)if(x[i-1]<0&&x[i]>=0)z++;return z/(x.length/SR)}
function run(st,f0=440,secs=2){const ps=new PitchShiftCore(SR);const n=SR*secs,inp=new Float32Array(n),out=new Float32Array(n);
  for(let i=0;i<n;i++)inp[i]=0.5*Math.sin(2*Math.PI*f0*i/SR);
  for(let o=0;o<n;o+=128)ps.process(inp.subarray(o,o+128),out.subarray(o,o+128),Math.pow(2,st/12));
  return {out:out.subarray(SR/2),inp}}
// dominant frequency via Goertzel scan, more robust than zero crossings
function peak(x,lo,hi){let best=0,bf=0;for(let f=lo;f<=hi;f+=2){const w=2*Math.PI*f/SR,c=2*Math.cos(w);let s1=0,s2=0;for(let i=0;i<x.length;i++){const s=x[i]+c*s1-s2;s2=s1;s1=s}const pw=s1*s1+s2*s2-c*s1*s2;if(pw>best){best=pw;bf=f}}return bf}
for(const [st,exp] of [[12,880],[-12,220],[7,659.3],[0,440],[-5,329.6]]){const {out}=run(st);const pk=peak(out,100,1200);const zc=freq(out);
  console.log(`st=${st}: peak ${pk} Hz, zero-crossings ${zc.toFixed(1)} Hz, expected ${exp}`);a.ok(Math.abs(pk-exp)<exp*0.02,`peak ${pk} vs ${exp}`);a.ok(Math.abs(zc-exp)<exp*0.05,`zc ${zc} vs ${exp}`)}
{const {out}=run(5);let mx=0;for(const v of out)mx=Math.max(mx,Math.abs(v));a.ok(mx>0.3&&mx<0.75,'level kept '+mx)}
console.log('pitch dsp ok');
