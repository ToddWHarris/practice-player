// V43 session log: attempts (including rejections, with reasons), scans and checks are
// recorded on the device, and the export is a serialisation of what was recorded.
// The module must never reach the network: export is a file the user sends by hand.
const a=require('assert');const fs=require('fs');const S=require('../sessionlog.js');
S.clear();
a.equal(S.count(),0);
S.start({screen:'piano',appVersion:'V43'});
a.equal(S.count(),1,'session-start is the first entry');
S.record('cal-attempt',{note:'A6',midi:93,status:'rejected',reason:'silence',segRms:0.00364,strikeRms:0.0031,attackDetected:false,frameRms:[0.001,0.002,0.0015]});
S.record('cal-attempt',{note:'A6',midi:93,status:'rejected',reason:'early',startedHot:true});
S.record('cal-attempt',{note:'A6',midi:93,status:'measured',reason:'ok',B:0.0011,partials:6,keptPrior:false});
S.record('prescan',{midi:69,note:'A4',cents:-12.3});
S.record('prescan-unread',{midi:105,note:'A7'});
S.record('interval-check',{step:40,pairs:['F3-A3'],status:'ok',beat:7.1,reason:'ok'});
S.record('unison-check',{midi:69,note:'A4',status:'ok',fundamentalBeat:0.4,pattern:'offset'});
S.record('step',{index:41,phase:'temperament',midi:65});
const json=S.toJSON();
const parsed=JSON.parse(json);
a.equal(parsed.app,'Harris Music Studio');
a.equal(parsed.log,'piano-session');
a.ok(parsed.startedAt&&parsed.meta.appVersion==='V43');
a.equal(parsed.entries.length,S.count());
const rej=parsed.entries.filter(e=>e.type==='cal-attempt'&&e.status==='rejected');
a.equal(rej.length,2,'both rejections are in the log');
a.deepEqual(rej.map(e=>e.reason).sort(),['early','silence'],'rejection reasons are kept');
const att=parsed.entries.find(e=>e.type==='cal-attempt'&&e.status==='measured');
a.ok(att&&att.B===0.0011&&att.partials===6,'the accepted measurement is in the log');
a.ok(parsed.entries.some(e=>e.type==='prescan'&&e.midi===69),'pre-scan readings are in the log');
a.ok(parsed.entries.some(e=>e.type==='interval-check'&&e.beat===7.1),'interval checks are in the log');
a.ok(parsed.entries.some(e=>e.type==='unison-check'&&e.pattern==='offset'),'unison checks are in the log');
a.ok(parsed.entries.every((e,i)=>e.seq===i+1),'entries stay in order');
const text=S.toText();
a.ok(text.indexOf('A6')>=0&&text.indexOf('silence')>=0&&text.indexOf('cal-attempt')>=0,'text form names the note, the event and the reason');
// Frame series are capped and rounded so a long session stays a sane file size.
const big=[];for(let i=1;i<=1000;i++)big.push(0.123456/i);
const trimmed=S.trimSeries(big);
a.ok(trimmed.length<=S.MAX_SERIES,'series is capped at '+S.MAX_SERIES+': '+trimmed.length);
a.ok(trimmed.every(v=>Math.abs(v*10000-Math.round(v*10000))<1e-9),'series values are rounded');
// The entry store itself is capped.
S.clear();S.start({});
for(let i=0;i<S.MAX_ENTRIES+50;i++)S.record('step',{index:i});
a.ok(S.count()<=S.MAX_ENTRIES,'entry count is capped: '+S.count());
S.clear();a.equal(S.count(),0);
// Nothing in the module can send the log anywhere.
const src=fs.readFileSync('sessionlog.js','utf8');
a.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src),'session log has no network calls');
console.log('sessionlog ok');
