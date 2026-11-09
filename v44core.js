// V44 pure helpers: register partials, stretch numbers, ring motion, K-200 breaks.
// No product names are used as control labels. No accuracy claim.
const V44Core=(function(){
 const EXAMPLE={f3:8,a4:7,c6:6,dob:0,cents:{21:-13.5,33:-4.4,45:0.9,57:1.2,69:8.7,81:7.7,93:9.5,105:26.9}};
 function autoPartial(midi){
  midi=midi|0;
  if(midi<=47)return 6;
  if(midi<=71)return 4;
  if(midi<=83)return 2;
  return 1}
 function stretchCents(fn,fm,n,m){
  if(!(fn>0)||!(fm>0)||!(n>0)||!(m>0))return null;
  return 1200*Math.log2((fm/m)/(fn/n))}
 function bFromStretch(n,m,S){
  const r=Math.pow(2,S/600);
  const den=m*m-r*n*n;
  if(!(den>0))return null;
  const B=(r-1)/den;
  return B>0?B:null}
 function stretchFromB(B,n,m){
  if(!(B>=0))return null;
  return 600*Math.log2((1+B*m*m)/(1+B*n*n))}
 function a4DisplayedFromStretch(a4Stretch){return a4Stretch/0.8}
 function k200Splits(){return {split2:36,split3:53,note:'Counted on this K-200: one string through B1, two from C2, three from F3. Still adjustable. Not a stiffness measurement.'}}
 const A_ORDER=[69,57,45,49,53,61,65,58,54,59,56,60,55];
 const F_ORDER=[69,57,53,61,65];
 function temperamentOrder(which){return which==='f3f4'?F_ORDER.slice():A_ORDER.slice()}
 function ringFrame(phaseDeg,offsetHz,divisor,dt,heard){
  divisor=+divisor||1;dt=+dt||0;phaseDeg=+phaseDeg||0;offsetHz=+offsetHz||0;
  if(!heard)return {grey:true,frozen:true,center:false,angle:phaseDeg,revPerSec:0,clockwise:false,blur:false,lights:[0,0,0,0]};
  const rev=offsetHz/2/divisor;
  const angle=phaseDeg+rev*360*dt;
  const blur=Math.abs(offsetHz)/divisor>8;
  const phi=angle*Math.PI/180;
  const lights=[];
  for(let j=0;j<4;j++)lights.push(Math.max(0,Math.cos(phi-j*Math.PI/2)));
  return {grey:false,frozen:Math.abs(offsetHz)<0.05,center:offsetHz>0.05,angle,revPerSec:rev,clockwise:offsetHz>0,blur,lights}}
 function facB(f3,a4,c6){
  return {f3:bFromStretch(4,8,f3),a4:bFromStretch(2,4,a4),c6:bFromStretch(1,2,c6)}}
 function bAt(midi,bs){
  const pts=[[53,bs.f3],[69,bs.a4],[84,bs.c6]].filter(p=>p[1]>0);
  if(!pts.length)return 0.0004;
  if(pts.length===1)return pts[0][1];
  if(midi<=pts[0][0]){
   const k=(Math.log(pts[1][1])-Math.log(pts[0][1]))/(pts[1][0]-pts[0][0]);
   return Math.exp(Math.log(pts[0][1])+k*(midi-pts[0][0]))}
  if(midi>=pts[pts.length-1][0]){
   const a=pts[pts.length-2],b=pts[pts.length-1];
   const k=(Math.log(b[1])-Math.log(a[1]))/(b[0]-a[0]);
   return Math.exp(Math.log(b[1])+k*(midi-b[0]))}
  let lo=pts[0],hi=pts[1];
  for(let i=0;i<pts.length-1;i++)if(midi>=pts[i][0]&&midi<=pts[i+1][0]){lo=pts[i];hi=pts[i+1]}
  const t=(midi-lo[0])/(hi[0]-lo[0]);
  return Math.exp(Math.log(lo[1])*(1-t)+Math.log(hi[1])*t)}
 function partialCents(midi,B,n,a4){
  a4=a4||440;n=n||autoPartial(midi);
  const et=a4*Math.pow(2,(midi-69)/12);
  const fp=n*et*Math.sqrt((1+B*n*n)/(1+B));
  return 1200*Math.log2(fp/(n*et))}
 function facTargets(f3,a4s,c6,a4hz){
  const bs=facB(f3,a4s,c6);
  const targets={};
  for(let m=21;m<=108;m++){
   const n=autoPartial(m);
   let B=bAt(m,bs);
   if(!(B>0))B=0.0004;
   B=Math.max(1e-6,Math.min(0.02,B));
   let cents=partialCents(m,B,n,a4hz||440);
   if(m===69)cents=a4DisplayedFromStretch(a4s);
   targets[m]={partial:n,cents,B,source:'modeled'}}
  return {bs,targets}}
 function median(xs){const a=xs.slice().sort((p,q)=>p-q);return a[a.length>>1]}
 function strikeGreen(readings){
  if(!readings||readings.length<3)return {green:false,median:null,spread:null};
  const last=readings.slice(-3);
  const s=last.slice().sort((p,q)=>p-q);
  const med=s[1],spread=s[2]-s[0];
  return {green:Math.abs(med)<=2&&spread<=3,median:med,spread}}
 function lockPartial(samples,sampleRate,targetHz){
  const sr=+sampleRate,x=samples,n=x?x.length|0:0;
  if(!(sr>=8000)||n<32||!(targetHz>0))return null;
  const a=Math.exp(-2*Math.PI*12/sr);
  let pr=0,pi=0,ang=0,energy=0;
  const step=Math.max(1,Math.floor(sr/80));
  const phases=[];
  for(let i=0;i<n;i++){
   const smp=x[i];energy+=smp*smp;
   pr=a*pr+(1-a)*smp*Math.cos(ang);
   pi=a*pi+(1-a)*smp*(-Math.sin(ang));
   ang+=2*Math.PI*targetHz/sr;
   if(i%step===0)phases.push(Math.atan2(pi,pr))}
  if(phases.length<6)return null;
  let prev=phases[0],acc=0;const un=[0];
  for(let i=1;i<phases.length;i++){
   let d=phases[i]-prev;
   while(d>Math.PI)d-=2*Math.PI;
   while(d<-Math.PI)d+=2*Math.PI;
   acc+=d;prev=phases[i];un.push(acc)}
  const dt=step/sr,start=Math.floor(un.length*0.35);
  let nn=0,sx=0,sy=0,sxx=0,sxy=0;
  for(let i=start;i<un.length;i++){const xx=(i-start)*dt,yy=un[i];nn++;sx+=xx;sy+=yy;sxx+=xx*xx;sxy+=xx*yy}
  const den=nn*sxx-sx*sx;
  if(!(Math.abs(den)>1e-12))return null;
  const slope=(nn*sxy-sx*sy)/den;
  const offsetHz=slope/(2*Math.PI);
  const rms=Math.sqrt(energy/n);
  return {offsetHz,cents:1200*Math.log2((targetHz+offsetHz)/targetHz),rms,level:Math.hypot(pr,pi)}}
 const api={EXAMPLE,autoPartial,stretchCents,bFromStretch,stretchFromB,a4DisplayedFromStretch,k200Splits,temperamentOrder,A_ORDER,F_ORDER,ringFrame,facB,facTargets,partialCents,median,strikeGreen,lockPartial};
 if(typeof module!=='undefined')module.exports=api;
 return api})();
if(typeof window!=='undefined')window.V44Core=V44Core;
