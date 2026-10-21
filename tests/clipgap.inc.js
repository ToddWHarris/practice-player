// v25 gapless clips: no click at the start, exact length. Decodes with ffmpeg and compares to the same span of the original.
const fs=require('fs'),cp=require('child_process'),C=require('../clip.js'),assert=require('assert');
const NOISY="aevalsrc='0.45*sin(440*2*PI*t)+0.25*sin(1234*2*PI*t)*sin(3*t)+0.2*(random(0)-0.5)':d=20:s=44100";
function dec(f){return new Int16Array(new Uint8Array(cp.execFileSync('ffmpeg',['-v','error','-i',f,'-ac','1','-f','s16le','-'],{maxBuffer:1<<28})).buffer)}
function ffpSamples(f){return cp.execFileSync('ffprobe',['-v','error','-select_streams','a','-show_entries','frame=nb_samples','-of','csv=p=0',f]).toString().trim().split('\n').reduce((a,x)=>a+(+x||0),0)}
function rmsDiff(x,y,n){let d=0,e=0;for(let i=0;i<n;i++){d+=(x[i]-y[i])**2;e+=y[i]**2}return Math.sqrt(d/n)/Math.max(1,Math.sqrt(e/n))}
function corr(x,y,n){let a=0,b=0,c=0;for(let i=0;i<n;i++){a+=x[i]*y[i];b+=x[i]*x[i];c+=y[i]*y[i]}return a/Math.sqrt(b*c||1)}
const cases=[['cbr',['-c:a','libmp3lame','-b:a','128k'],44100],['vbr',['-c:a','libmp3lame','-q:a','2'],44100],['m2',['-ar','22050','-ac','1','-c:a','libmp3lame','-b:a','48k'],22050],
 ['notag',['-c:a','libmp3lame','-b:a','160k','-write_xing','0'],44100],['stereo',['-ac','2','-c:a','libmp3lame','-b:a','192k'],44100]];
const report=[];
for(const [nm,args,sr] of cases){const f=`/tmp/gap-${nm}.mp3`;if(!fs.existsSync(f))cp.execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',NOISY,...args,f]);
 const src=new Uint8Array(fs.readFileSync(f)),orig=dec(f);
 for(const [a,b] of [[5.3,12.8],[0,1.5],[0.01,2],[0.04,3],[1.234,1.734],[15,20]]){
  const r=C.clip(src,a,b,{title:'t'});assert.ok(r,nm+' '+a);const o=`/tmp/gapc-${nm}.mp3`;fs.writeFileSync(o,r.bytes);
  const c=dec(o),s0=Math.round(r.start*sr),want=Math.min(Math.round(b*sr),orig.length)-s0;
  assert.strictEqual(c.length,r.samples,nm+' '+a+' decoded '+c.length+' vs '+r.samples);
  assert.ok(Math.abs(c.length-want)<=1,nm+' '+a+' length '+c.length+' vs '+want);
  assert.ok(Math.abs(c.length/sr-(Math.min(b,orig.length/sr)-a))<=0.001||a<0.02&&nm==='notag',nm+' '+a+' within 1 ms');
  const fp=ffpSamples(o);assert.strictEqual(fp,c.length,nm+' ffprobe samples '+fp);
  const n=Math.round(0.05*sr),ref=orig.subarray(s0,s0+n),hd=c.subarray(0,n),k=rmsDiff(hd,ref,n),q=corr(hd,ref,n);
  const tl=c.subarray(c.length-n),tr=orig.subarray(s0+c.length-n,s0+c.length),kt=rmsDiff(tl,tr,n);
  // the first 5 ms carry the click when warm-up is missing
  const n5=Math.round(0.005*sr),k5=rmsDiff(hd,ref,n5);
  report.push(`${nm} ${a}-${b}: start rms ${k.toFixed(4)} (5ms ${k5.toFixed(4)}) corr ${q.toFixed(5)} tail rms ${kt.toFixed(4)} delay ${r.delay} pad ${r.padding} warm ${r.warm}`);
  assert.ok(k<0.05&&k5<0.08&&q>0.998,nm+' '+a+' start mismatch '+k+' '+k5+' '+q);assert.ok(kt<0.05,nm+' '+a+' tail mismatch '+kt);
  const ss=Buffer.from(r.bytes.subarray(0,600)).toString('latin1');assert.ok(ss.includes('iTunSMPB'),'iTunSMPB');
  const m=ss.match(/iTunSMPB\0 00000000 ([0-9A-F]{8}) ([0-9A-F]{8}) ([0-9A-F]{16})/);assert.ok(m&&parseInt(m[3],16)===r.samples&&parseInt(m[1],16)+r.samples+parseInt(m[2],16)===r.frames*C.info(src).first.spf,'smpb fields')}}
if(process.env.GAPLOG)console.log(report.join('\n'));
console.log('gapless clips ok')
{const r=C.clip(new Uint8Array(fs.readFileSync('/tmp/gap-cbr.mp3')),2,4.5,{});const i=C.info(r.bytes);assert.ok(i.gapless&&Math.abs(i.duration-2.5)<1e-4,'info audible duration '+i.duration);console.log('info duration ok')}
