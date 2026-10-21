// ID3 parser tests with ffmpeg-generated fixtures (needs ffmpeg + python3 PIL for the cover)
const {execSync}=require('child_process'),fs=require('fs'),a=require('assert');const {ID3}=require('../logic.js');
const D='/tmp/pp-id3';fs.mkdirSync(D,{recursive:true});const ff=c=>execSync('ffmpeg -loglevel error -y '+c,{cwd:D});
execSync(`python3 -c "from PIL import Image;Image.new('RGB',(64,64),'#7c3aed').save('cover.jpg')"`,{cwd:D});
ff(`-f lavfi -i sine=440:duration=3 -i cover.jpg -map 0 -map 1 -c:a libmp3lame -b:a 128k -c:v mjpeg -disposition:v attached_pic -id3v2_version 3 -write_id3v1 1 -metadata title="Wooden Heart Polka" -metadata artist="Test Band" -metadata album="Sample Album" -metadata date=1998 -metadata track=3/8 t23.mp3`);
ff(`-f lavfi -i sine=440:duration=2 -c:a libmp3lame -b:a 192k -id3v2_version 4 -metadata title="Über Café ♪" -metadata artist="Ärtist" -metadata date=2021-05-01 -metadata track=7 t24.mp3`);
ff(`-f lavfi -i sine=440:duration=2 -c:a libmp3lame -b:a 96k -map_metadata -1 -id3v2_version 0 v1raw.mp3`);
{const f=(s,n)=>{const b=Buffer.alloc(n);b.write(s,'latin1');return b};const tag=Buffer.concat([Buffer.from('TAG'),f('Old Tag',30),f('V1 Artist',30),f('V1 Album',30),f('1985',4),f('',28),Buffer.from([0,5,12])]);
 fs.writeFileSync(D+'/v1.mp3',Buffer.concat([fs.readFileSync(D+'/v1raw.mp3'),tag]))}
ff(`-f lavfi -i sine=440:duration=2 -c:a libmp3lame -b:a 160k -map_metadata -1 -id3v2_version 0 plain.mp3`);
const P=f=>{const b=new Uint8Array(fs.readFileSync(D+'/'+f));return ID3.parse(b.subarray(0,Math.min(b.length,ID3.tagSize(b)+65536)),b.subarray(b.length-128))};
let r=P('t23.mp3');a.equal(r.title,'Wooden Heart Polka');a.equal(r.artist,'Test Band');a.equal(r.album,'Sample Album');a.equal(r.year,'1998');a.equal(r.track,'3/8');
a.ok(r.pic&&r.pic.mime==='image/jpeg'&&r.pic.data[0]===0xff&&r.pic.data[1]===0xd8,'jpeg cover');a.equal(r.kbps,128);
r=P('t24.mp3');a.equal(r.title,'Über Café ♪');a.equal(r.artist,'Ärtist');a.equal(r.year,'2021');a.equal(r.track,'7');a.equal(r.kbps,192);a.ok(!r.pic);
r=P('v1.mp3');a.equal(r.title,'Old Tag');a.equal(r.artist,'V1 Artist');a.equal(r.album,'V1 Album');a.equal(r.year,'1985');a.equal(r.track,'5');a.equal(r.kbps,96);
r=P('plain.mp3');a.ok(!r.title&&!r.artist);a.equal(r.kbps,160);
a.deepEqual(ID3.parse(new Uint8Array(10),new Uint8Array(0)),{});a.deepEqual(ID3.parse(Uint8Array.from([73,68,51,3,0,0,0,0,1,0,0xff,0xff]),null),{});
// hand-built v2.2 PIC + UTF-16 text frame
const frame=(id,data)=>[...Buffer.from(id),(data.length>>16)&255,(data.length>>8)&255,data.length&255,...data];
const t=[1,0xff,0xfe,...Buffer.from('Hi','utf16le'),0,0];const pic=[0,...Buffer.from('PNG'),3,0,0x89,0x50,0x4e,0x47];
const body=[...frame('TT2',t),...frame('PIC',pic)];const hdr=[73,68,51,2,0,0,0,0,(body.length>>7)&127,body.length&127];
r=ID3.parse(Uint8Array.from([...hdr,...body]),null);a.equal(r.title,'Hi');a.equal(r.pic.mime,'image/png');a.deepEqual([...r.pic.data],[0x89,0x50,0x4e,0x47]);
console.log('id3 tests ok');
