// node: STORE zip round trip, CRC, readable by the system unzip
const Z=require('../zip.js'),fs=require('fs'),cp=require('child_process'),assert=require('assert');
(async()=>{const a=new Uint8Array(300000).map((_,i)=>i*7&255);const e=[{name:'music/Band/Live/ä song.mp3',blob:new Blob([a])},{name:'backup.json',blob:new Blob([JSON.stringify({x:1})])}];
 const z=await Z.build(e);fs.writeFileSync('/tmp/t.zip',Buffer.from(await z.arrayBuffer()));
 const l=cp.execFileSync('unzip',['-t','/tmp/t.zip']).toString();assert.ok(/No errors/.test(l),l);
 const r=await Z.read(z);assert.deepStrictEqual(r.map(x=>x.name),e.map(x=>x.name));const b=new Uint8Array(await r[0].blob.arrayBuffer());assert.ok(Buffer.compare(Buffer.from(b),Buffer.from(a))===0);
 assert.strictEqual(r[0].crc,Z.crc32(a));assert.strictEqual(JSON.parse(await r[1].blob.text()).x,1);console.log('zip ok')})().catch(e=>{console.error(e);process.exit(1)})
