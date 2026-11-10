// Heterodyne one partial near a known target, and optionally copy the mic for a Measure take.
class PartialLockProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.target=440;
    this.capture=false;
    this.pr=0;this.pi=0;this.ang=0;
    this.buf=new Float32Array(2048);
    this.n=0;
    this.lastPost=-1;
    this.port.onmessage=e=>{
      const d=e.data||{};
      if(d.targetHz>0)this.target=+d.targetHz;
      if(d.capture!=null)this.capture=!!d.capture};
  }
  process(inputs){
    const ch=inputs[0]&&inputs[0][0];
    if(!ch)return true;
    const a=Math.exp(-2*Math.PI*15/sampleRate);
    const w=2*Math.PI*this.target/sampleRate;
    let pr=this.pr,pi=this.pi,ang=this.ang;
    for(let i=0;i<ch.length;i++){
      const x=ch[i];
      pr=a*pr+(1-a)*x*Math.cos(ang);
      pi=a*pi+(1-a)*x*(-Math.sin(ang));
      ang+=w;
      if(this.capture){
        this.buf[this.n++]=x;
        if(this.n>=this.buf.length){
          this.port.postMessage({samples:this.buf.slice(0)});
          this.n=0}}}
    this.pr=pr;this.pi=pi;this.ang=ang;
    if(currentTime-this.lastPost>=0.016){
      this.lastPost=currentTime;
      this.port.postMessage({re:pr,im:pi,level:Math.hypot(pr,pi)});}
    return true;
  }
}
registerProcessor('partial-lock',PartialLockProcessor);
