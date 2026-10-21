// node: MP3 frame slicing, CBR and VBR, duration within one frame, tags, source untouched
const fs=require('fs'),cp=require('child_process'),C=require('../clip.js');const {ID3}=require('../logic.js');
const assert=require('assert');
function mk(f,args,src){if(!fs.existsSync(f))cp.execFileSync('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i',src||'sine=440:duration=30',...args,'-metadata','title=Polka','-metadata','artist=Band','-metadata','album=Hits',f])}
function probe(f){return parseFloat(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString())}
for(const [name,args,sr,gen] of [['cbr',['-c:a','libmp3lame','-b:a','128k'],44100],['vbr',['-c:a','libmp3lame','-q:a','4'],44100,"aevalsrc='sin(440*2*PI*t)*0.5+(random(0)-0.5)*0.6*(mod(floor(t),2))':d=30:s=44100"],['m2',['-ar','22050','-c:a','libmp3lame','-b:a','32k','-ac','1'],22050]]){
 const f=`/tmp/clipsrc-${name}.mp3`;mk(f,args,gen);const src=fs.readFileSync(f),copy=Buffer.from(src);
 const r=C.clip(new Uint8Array(src),5.3,12.8,{title:'My clip',artist:'Band',album:'Hits',comment:'Clip from Polka, 0:05 to 0:12'});
 assert.ok(r&&r.frames>0,name);assert.ok(Buffer.compare(src,copy)===0,'source untouched');
 const spf=C.info(new Uint8Array(src)).first.spf/sr;
 assert.ok(Math.abs(r.duration-7.5)<=1/sr+1e-9,name+' dur '+r.duration);assert.ok(Math.abs(r.start-5.3)<1/sr+1e-9,'start '+r.start);assert.ok(r.warm>=2&&r.warm<=5,'two or more warm-up frames '+r.warm);
 const out=`/tmp/clipout-${name}.mp3`;fs.writeFileSync(out,r.bytes);
 const pd=probe(out);assert.ok(pd>=r.duration&&pd<=r.duration+0.25,name+' container estimate '+pd+' vs '+r.duration);
 // decodes cleanly
 const err=cp.spawnSync('ffmpeg',['-v','error','-i',out,'-f','null','-']).stderr.toString();assert.ok(!/Invalid|Error/i.test(err),name+' decode: '+err);
 const t=ID3.parse(r.bytes.subarray(0,4096),r.bytes.subarray(r.bytes.length-128));assert.strictEqual(t.title,'My clip');assert.strictEqual(t.artist,'Band');assert.strictEqual(t.album,'Hits')
 const ci=C.info(r.bytes);assert.strictEqual(ci.frames,r.frames,'xing frame excluded on re-read');
 if(name==='vbr')assert.ok(r.vbr,'vbr detected')
}
assert.strictEqual(C.clip(new Uint8Array([1,2,3,4,5,6,7,8]),0,1,{}),null,'not mp3');
require('./clipgap.inc.js');
console.log('clip slicing ok')
