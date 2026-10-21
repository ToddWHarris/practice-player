// Minimal ZIP (STORE, no compression) writer and reader. Entries are Blobs, so big files are not copied into memory.
const Zip=(()=>{
 const T=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0}
 function crc32(u,c){c=(c===undefined?0:c)^0xFFFFFFFF;for(let i=0;i<u.length;i++)c=T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
 const enc=s=>new TextEncoder().encode(s);
 function dos(d){d=d||new Date();return{t:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),d:((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()}}
 // crc of a Blob, read in 1 MB chunks to keep memory low
 async function blobCrc(b){let c=0,o=0;const CH=1<<20;while(o<b.size){const u=new Uint8Array(await b.slice(o,o+CH).arrayBuffer());c=crc32(u,c);o+=CH}return c}
 // entries: [{name, blob, crc?}] -> Blob (zip). The result is composed of the entry Blobs and small header arrays; no file bytes are copied.
 async function build(entries,onStep,onCrc){const parts=[],cd=[];let off=0;const dt=dos();
  for(let k=0;k<entries.length;k++){const e=entries[k];const nm=enc(e.name),b=e.blob,crc=e.crc!=null?e.crc>>>0:await blobCrc(b),sz=b.size;if(onCrc&&e.crc==null)onCrc(e,crc);
   const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
   h.setUint16(10,dt.t,true);h.setUint16(12,dt.d,true);h.setUint32(14,crc,true);h.setUint32(18,sz,true);h.setUint32(22,sz,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
   parts.push(new Uint8Array(h.buffer),nm,b);
   const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
   c.setUint16(12,dt.t,true);c.setUint16(14,dt.d,true);c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
   cd.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+sz;if(onStep)onStep(k+1,entries.length)}
  let cdLen=0;cd.forEach(x=>cdLen+=x.byteLength);
  const z=new DataView(new ArrayBuffer(22));z.setUint32(0,0x06054b50,true);z.setUint16(8,entries.length,true);z.setUint16(10,entries.length,true);z.setUint32(12,cdLen,true);z.setUint32(16,off,true);
  return new Blob([...parts,...cd,new Uint8Array(z.buffer)],{type:'application/zip'})}
 // Blob (zip) -> [{name, blob, crc, size}]
 async function read(zb){const tailN=Math.min(zb.size,65557),tail=new DataView(await zb.slice(zb.size-tailN).arrayBuffer());let e=-1;
  for(let i=tailN-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50){e=i;break}if(e<0)throw new Error('Not a zip file');
  const n=tail.getUint16(e+10,true),cdLen=tail.getUint32(e+12,true),cdOff=tail.getUint32(e+16,true);
  const cd=new DataView(await zb.slice(cdOff,cdOff+cdLen).arrayBuffer());const out=[];let p=0;const dec=new TextDecoder();
  for(let k=0;k<n;k++){if(cd.getUint32(p,true)!==0x02014b50)throw new Error('Bad zip directory');const meth=cd.getUint16(p+10,true),crc=cd.getUint32(p+16,true),sz=cd.getUint32(p+20,true),nl=cd.getUint16(p+28,true),xl=cd.getUint16(p+30,true),cl=cd.getUint16(p+32,true),lo=cd.getUint32(p+42,true);
   const name=dec.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nl));p+=46+nl+xl+cl;
   const lh=new DataView(await zb.slice(lo,lo+30).arrayBuffer());const st=lo+30+lh.getUint16(26,true)+lh.getUint16(28,true);
   if(meth!==0)throw new Error('This zip is compressed. Use a Practice Player backup file.');out.push({name,crc,size:sz,blob:zb.slice(st,st+sz)})}
  return out}
 return{crc32,blobCrc,build,read}})();
if(typeof module!=='undefined')module.exports=Zip;
