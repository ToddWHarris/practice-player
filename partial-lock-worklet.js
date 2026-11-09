// Heterodyne one partial near a known target. The main thread reads the phase slope.
class PartialLockProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.target=440;
    this.pr=0;this.pi=0;this.ang=0;
    this.port.onmessage=e=>{if(e.data&&e.data.targetHz>0)this.target=+e.data.targetHz};
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
    }
    this.pr=pr;this.pi=pi;this.ang=ang;
    this.port.postMessage({re:pr,im:pi,level:Math.hypot(pr,pi)});
    return true;
  }
}
registerProcessor('partial-lock',PartialLockProcessor);
