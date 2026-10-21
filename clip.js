// Custom Clips: cut an MP3 at frame boundaries without re-encoding. Pure, no DOM (also runs in node tests).
const MP3Clip=(()=>{
 const DEC=529,WARM=2;// mp3 decoder delay in samples; minimum warm-up frames before A
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
  const L=lameOf(u);if(L)samples=Math.max(0,samples-L.delay-DEC-Math.max(0,L.padding-DEC));/* audible length when gapless info is present */
  const vbr=f.some(x=>x.h.br!==f[0].h.br);return{frames:f.length,duration:samples/sr,sr,vbr,first:f[0].h,gapless:!!L}}
 // ID3v2.3 text frames in UTF-16 with BOM
 function u16(s){const b=[0xFF,0xFE];for(const c of String(s)){let cp=c.codePointAt(0);if(cp>0xFFFF){cp-=0x10000;const hi=0xD800+(cp>>10),lo=0xDC00+(cp&1023);b.push(hi&255,hi>>8,lo&255,lo>>8)}else b.push(cp&255,cp>>8)}return b}
 function fr(id,body){const n=body.length;return[...id].map(c=>c.charCodeAt(0)).concat([n>>>24&255,n>>>16&255,n>>>8&255,n&255,0,0],body)}
 function tag(t){let b=[];const tx=(id,v)=>{if(v)b=b.concat(fr(id,[1].concat(u16(v))))};
  tx('TIT2',t.title);tx('TPE1',t.artist);tx('TALB',t.album);if(t.year)tx('TYER',String(t.year));
  if(t.comment)b=b.concat(fr('COMM',[1,0x65,0x6E,0x67].concat(u16(''),[0,0],u16(t.comment))));
  if(t.smpb)b=b.concat(fr('COMM',[0,0x65,0x6E,0x67].concat([...'iTunSMPB'].map(c=>c.charCodeAt(0)),[0],[...t.smpb].map(c=>c.charCodeAt(0)))));// gapless info for iOS/AVFoundation
  const n=b.length;return new Uint8Array([0x49,0x44,0x33,3,0,0,(n>>21)&127,(n>>14)&127,(n>>7)&127,n&127].concat(b))}
 // read encoder delay/padding from a LAME/Lavc Info tag in the source's first frame (null when absent)
 function lameOf(u){let i=id3Size(u),k=0;while(i+4<=u.length&&k<65536){const h=hdr(u,i);if(h&&h.layer===3){if(!isInfo(u,i,h))return null;const o=i+4+(h.prot?0:2)+sideLen(h);
    const fl=(u[o+4]<<24|u[o+5]<<16|u[o+6]<<8|u[o+7])>>>0;let p=o+8+(fl&1?4:0)+(fl&2?4:0)+(fl&4?100:0)+(fl&8?4:0);
    const id=String.fromCharCode(...u.subarray(p,p+4));if(!/^(LAME|Lavf|Lavc|GOGO|L3.9)/.test(id))return null;p+=21;
    return{delay:(u[p]<<4)|(u[p+1]>>4),padding:((u[p+1]&15)<<8)|u[p+2]}}i++;k++}return null}
 function crc16(b,n){let c=0;for(let i=0;i<n;i++){c^=b[i];for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xA001:c>>>1}return c}
 // a fresh Xing (VBR) or Info (CBR) frame with a LAME extension carrying encoder delay and padding, so decoders
 // drop the warm-up samples at the start and the excess at the end (gapless). nFrames counts the audio frames.
 function xing(h,nFrames,nBytes,vbr,delay,padding){const ver=h.ver,lay=4-h.layer,vk=ver===3?1:2,sri=SR[ver].indexOf(h.sr);
  const mk=bri=>{const b=new Uint8Array(4);b[0]=0xFF;b[1]=0xE0|(ver<<3)|(lay<<1)|1;b[2]=(bri<<4)|(sri<<2);b[3]=h.ch<<6;return b};
  const need=4+sideLen(h)+16+36;let bri=BR[vk][h.layer].indexOf(h.br/1000);// grow the bitrate until the LAME tag fits
  while(bri<14&&hdr(mk(bri),0).len<need)bri++;const b4=mk(bri),hh=hdr(b4,0),out=new Uint8Array(hh.len);out.set(b4);const o=4+sideLen(hh);
  const w=(p,v)=>{out[p]=v>>>24&255;out[p+1]=v>>>16&255;out[p+2]=v>>>8&255;out[p+3]=v&255};
  const tn=vbr?'Xing':'Info';for(let k=0;k<4;k++)out[o+k]=tn.charCodeAt(k);out[o+7]=3;w(o+8,nFrames);w(o+12,nBytes+hh.len);
  let p=o+16;const id='LAME3.100';for(let k=0;k<9;k++)out[p+k]=id.charCodeAt(k);p+=9;
  out[p]=vbr?0x04:0x01;p+=1+1+4+2+2;/* method, lowpass, peak, gains */out[p++]=0;out[p++]=Math.min(255,h.br/1000);
  out[p]=delay>>4;out[p+1]=((delay&15)<<4)|(padding>>8);out[p+2]=padding&255;p+=3;p+=1+1+2;// misc, mp3gain, preset
  w(p,nBytes+hh.len);p+=4;p+=2;/* music crc */const c=crc16(out,p);out[p]=c>>8;out[p+1]=c&255;return out}
 // cut [a,b) seconds, sample accurate. Two warm-up frames before A refill the bit reservoir and prime the decoder,
 // one extra frame after B gives the tail its overlap; the LAME tag and an iTunSMPB comment tell players to skip them.
 // Returns {bytes, start, end, duration, frames, delay, padding, samples} or null if not an MP3
 function clip(u,a,b,t){const f=frames(u);if(f.length<2)return null;const sr=f[0].h.sr,spf=f[0].h.spf;if(f.some(x=>x.h.spf!==spf||x.h.sr!==sr))return null;
  const L=lameOf(u),D0=L?L.delay+DEC:0,total=f.length*spf-(L?L.delay+DEC+Math.max(0,L.padding-DEC):0);
  let sa=Math.max(0,Math.round(a*sr)),sb=Math.min(total,Math.round(b*sr));if(sb<=sa)return null;
  let rA=D0+sa,rB=D0+sb;const fA=Math.floor(rA/spf),W=spf<1152?WARM+1:WARM;let fs=Math.max(0,fA-W);/* short MPEG-2 frames need one more to prime */
  // VBR or high bitrate: the bit reservoir can reach back further than 2 frames; add warm-up until the frame before A decodes fully
  const pay=x=>x.len-4-(x.h.prot?0:2)-sideLen(x.h),mdb=x=>{const o=x.o+4+(x.h.prot?0:2);return x.h.ver===3?(u[o]<<1)|(u[o+1]>>7):u[o]};
  for(let j=fA-W+1;j<=fA;j++){if(j<1||j>=f.length)continue;let need=mdb(f[j]),k=j;while(need>0&&k>0){k--;need-=pay(f[k])}if(k<fs)fs=k}
  while(fs<fA&&rA-fs*spf-DEC>4095)fs++;// the LAME delay field is 12 bits
  if(rA-fs*spf<DEC){rA=fs*spf+DEC;sa=rA-D0;if(sb<=sa)return null}// A at the very start (no source tag): first 529 samples are decoder delay
  const fe=Math.min(f.length,Math.ceil(rB/spf)+1);const keep=f.slice(fs,fe);let n=0;keep.forEach(x=>n+=x.len);
  const delay=rA-fs*spf-DEC,N=sb-sa,padding=keep.length*spf-delay-N;
  const vbr=keep.some(x=>x.h.br!==keep[0].h.br);
  const smpb=' 00000000 '+[delay+DEC,padding-DEC].map(v=>Math.max(0,v).toString(16).toUpperCase().padStart(8,'0')).join(' ')+' '+N.toString(16).toUpperCase().padStart(16,'0')+' 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000';
  const head=tag(Object.assign({},t||{},{smpb})),xf=xing(keep[0].h,keep.length,n,vbr,delay,padding);
  const out=new Uint8Array(head.length+xf.length+n);out.set(head,0);out.set(xf,head.length);let p=head.length+xf.length;
  for(const x of keep){out.set(u.subarray(x.o,x.o+x.len),p);p+=x.len}
  return{bytes:out,start:sa/sr,end:sb/sr,duration:N/sr,frames:keep.length,vbr,delay,padding,samples:N,warm:Math.floor(rA/spf)-fs}}
 return{frames,info,clip,tag,hdr}})();
if(typeof module!=='undefined')module.exports=MP3Clip;
