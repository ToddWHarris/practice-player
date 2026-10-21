// Pitch shifter AudioWorklet (vanilla JS, no libraries).
// Method: two-tap delay-line granular shifter. Each tap reads the recent input at a rate of
// `ratio` while sliding through a window; the two taps are half a window apart and crossfaded with
// complementary Hann gains (g1+g2=1), which is an overlap-add of short grains. Speed is unchanged.
class PitchShiftCore{
  constructor(sampleRate,winMs=50){this.W=Math.max(256,Math.round(sampleRate*winMs/1000));this.N=1;while(this.N<this.W*2+4)this.N<<=1;this.mask=this.N-1;this.buf=new Float32Array(this.N);this.w=0;this.p=0}
  read(d){let pos=this.w-d;while(pos<0)pos+=this.N;const i=Math.floor(pos),f=pos-i;const a=this.buf[i&this.mask],b=this.buf[(i+1)&this.mask];return a+(b-a)*f}
  process(input,output,ratio){const W=this.W,step=(1-ratio)/W;for(let n=0;n<input.length;n++){this.buf[this.w]=input[n];
    let p=this.p;const p2=(p+0.5)%1;const g1=0.5-0.5*Math.cos(2*Math.PI*p),g2=1-g1;
    output[n]=g1*this.read(p*W+1)+g2*this.read(p2*W+1);
    p+=step;p-=Math.floor(p);this.p=p;this.w=(this.w+1)&this.mask}}
}
if(typeof registerProcessor==='function'){
  class PitchShiftProcessor extends AudioWorkletProcessor{
    constructor(){super();this.ratio=1;this.cores=[];this.port.onmessage=e=>{if(e.data&&typeof e.data.semitones==='number')this.ratio=Math.pow(2,e.data.semitones/12)}}
    process(inputs,outputs){const inp=inputs[0],out=outputs[0];if(!inp||!inp.length){for(const ch of out)ch.fill(0);return true}
      for(let c=0;c<out.length;c++){const src=inp[c]||inp[0];if(!this.cores[c])this.cores[c]=new PitchShiftCore(sampleRate);
        if(this.ratio===1)out[c].set(src);else this.cores[c].process(src,out[c],this.ratio)}return true}
  }
  registerProcessor('pitch-shift',PitchShiftProcessor);
}
if(typeof module!=='undefined')module.exports={PitchShiftCore};
