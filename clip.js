// Custom Clips: cut an MP3 at frame boundaries without re-encoding. Pure, no DOM (also runs in node tests).
const MP3Clip=(()=>{
 const BR={ // kbps tables [versionKey][layer]
  1:{1:[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],2:[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],3:[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]},
  2:{1:[0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],2:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],3:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160]}};
 const SR={3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]};
 function hdr(u,i){if(i+4>u.length||u[i]!==0xFF||(u[i+1]&0xE0)!==0xE0)return null;
  const ver=(u[i+1]>>3)&3,lay=(u[i+1]>>1)&3,prot=u[i+1]&1,bri=u[i+2]>>4,sri=(u[i+2]>>2)&3,pad=(u[i+2]>>1)&1,ch=u[i+3]>>6;
  if(ver===1||lay===0||bri===0||bri===15||sri===3)return null;
  const layer=4-lay,vk=ver===3?1:2,br=BR[vk][layer][bri]*1000,sr=SR[ver][sri];
  const spf=layer===1?384:(layer===3&&ver!==3?576:1152);
  const len=layer===1?((12*br/sr|0)+pad)*4:(((layer===3&&ver!==3)?72:144)*br/sr|0)+pad;
  if(len<21)return null;return{ver,layer,prot,br,sr,spf,len,ch,mono:ch===3}}
 function id3Size(u){if(u.length>=10&&u[0]===0x49&&u[1]===0x44&&u[2]===0x33)return 10+(((u[6]&127)<<21)|((u[7]&127)<<14)|((u[8]&127)<<7)|(u[9]&127))+((u[5]&0x10)?10:0);return 0}
 function sideLen(h){return h.ver===3?(h.mono?17:32):(h.mono?9:17)}
 function isInfo(u,i,h){if(h.layer!==3)return false;const o=i+4+(h.prot?0:2)+sideLen(h),t=String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
  if(t==='Xing'||t==='Info')return true;const v=String.fromCharCode(u[i+36],u[i+37],u[i+38],u[i+39]);return v==='VBRI'}
 // list audio frames (skips ID3v2, a leading Xing/Info/VBRI frame, ID3v1/APE tails and junk)
 function frames(u){let i=id3Size(u);const out=[];let first=true,miss=0;
  while(i+4<=u.length){const h=hdr(u,i);
   if(!h||i+h.len>u.length){if(u[i]===0x54&&u[i+1]===0x41&&u[i+2]===0x47)break;i++;if(++miss>65536&&!out.length)break;continue}
   if(out.length===0&&!first){}// keep scanning
   const nx=i+h.len;if(!out.length&&nx+4<=u.length&&!hdr(u,nx)&&nx!==u.length){i++;continue}// require a following frame for the first match
   if(first&&isInfo(u,i,h)){first=false;i=nx;continue}first=false;out.push({o:i,len:h.len,h});i=nx}
  return out}
 function info(u){const f=frames(u);if(!f.length)return null;const sr=f[0].h.sr;let samples=0;f.forEach(x=>samples+=x.h.spf);
  const vbr=f.some(x=>x.h.br!==f[0].h.br);return{frames:f.length,duration:samples/sr,sr,vbr,first:f[0].h}}
 // ID3v2.3 text frames in UTF-16 with BOM
 function u16(s){const b=[0xFF,0xFE];for(const c of String(s)){let cp=c.codePointAt(0);if(cp>0xFFFF){cp-=0x10000;const hi=0xD800+(cp>>10),lo=0xDC00+(cp&1023);b.push(hi&255,hi>>8,lo&255,lo>>8)}else b.push(cp&255,cp>>8)}return b}
 function fr(id,body){const n=body.length;return[...id].map(c=>c.charCodeAt(0)).concat([n>>>24&255,n>>>16&255,n>>>8&255,n&255,0,0],body)}
 function tag(t){let b=[];const tx=(id,v)=>{if(v)b=b.concat(fr(id,[1].concat(u16(v))))};
  tx('TIT2',t.title);tx('TPE1',t.artist);tx('TALB',t.album);if(t.year)tx('TYER',String(t.year));
  if(t.comment)b=b.concat(fr('COMM',[1,0x65,0x6E,0x67].concat(u16(''),[0,0],u16(t.comment))));
  const n=b.length;return new Uint8Array([0x49,0x44,0x33,3,0,0,(n>>21)&127,(n>>14)&127,(n>>7)&127,n&127].concat(b))}
 // a fresh Xing (VBR) or Info (CBR) header frame so players show the right duration
 function xing(h,nFrames,nBytes,vbr){const b=new Uint8Array(h.len);const pad=0;
  // header: copy version/layer, no CRC, same bitrate/sr, no padding, same channel mode
  const ver=h.ver,lay=4-h.layer;b[0]=0xFF;b[1]=0xE0|(ver<<3)|(lay<<1)|1;
  const bri=BR[ver===3?1:2][h.layer].indexOf(h.br/1000),sri=SR[ver].indexOf(h.sr);b[2]=(bri<<4)|(sri<<2)|(pad<<1);b[3]=(h.ch<<6);
  const hh=hdr(b,0);const out=new Uint8Array(hh.len);out.set(b.subarray(0,4));const o=4+sideLen(hh);
  const tagName=vbr?'Xing':'Info';for(let k=0;k<4;k++)out[o+k]=tagName.charCodeAt(k);out[o+7]=3;// flags: frames + bytes
  const w=(p,v)=>{out[p]=v>>>24&255;out[p+1]=v>>>16&255;out[p+2]=v>>>8&255;out[p+3]=v&255};w(o+8,nFrames);w(o+12,nBytes+hh.len);return out}
 // cut [a,b) seconds. Returns {bytes:Uint8Array, start, end, duration, frames} or null if not an MP3
 function clip(u,a,b,t){const f=frames(u);if(f.length<2)return null;const sr=f[0].h.sr;
  let tm=0,s=-1,e=-1;for(let k=0;k<f.length;k++){const st=tm;tm+=f[k].h.spf/sr;if(s<0&&tm>a+1e-9)s=k;if(st<b-1e-9)e=k}
  if(s<0||e<s)return null;const keep=f.slice(s,e+1);let n=0;keep.forEach(x=>n+=x.len);
  let t0=0;for(let k=0;k<s;k++)t0+=f[k].h.spf/sr;let dur=0;keep.forEach(x=>dur+=x.h.spf/sr);
  const vbr=keep.some(x=>x.h.br!==keep[0].h.br);const head=tag(t||{}),xf=xing(keep[0].h,keep.length,n,vbr);
  const out=new Uint8Array(head.length+xf.length+n);out.set(head,0);out.set(xf,head.length);let p=head.length+xf.length;
  for(const x of keep){out.set(u.subarray(x.o,x.o+x.len),p);p+=x.len}
  return{bytes:out,start:t0,end:t0+dur,duration:dur,frames:keep.length,vbr}}
 return{frames,info,clip,tag,hdr}})();
if(typeof module!=='undefined')module.exports=MP3Clip;
