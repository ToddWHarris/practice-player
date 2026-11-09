// v43 Piano session diagnostic log.
// Local only: entries live in memory on this device. Nothing is uploaded, sent, or shared by
// this module. The only way a log leaves the device is the user tapping Download session log
// in the piano screens and sending the file themselves.
const SessionLog=(function(){
 const FORMAT=1,MAX_ENTRIES=2000,MAX_SERIES=300,LOG_KEY='pp-v44-log';
 let session=null,entries=[],seq=0,t0=0;
 function clock(){return (typeof performance!=='undefined'&&performance.now)?performance.now():Date.now()}
 function start(meta){
  session={format:FORMAT,startedAt:new Date().toISOString(),meta:meta||{}};
  entries=[];seq=0;t0=clock();
  record('session-start',meta||{});
  return session}
 function record(type,data){
  if(!session)start({});
  const e={seq:++seq,ms:Math.round(clock()-t0),type:String(type||'event')};
  if(data)for(const k in data)e[k]=data[k];
  entries.push(e);
  if(entries.length>MAX_ENTRIES){const drop=entries.length-(MAX_ENTRIES-1);entries.splice(0,drop);entries.push({seq:++seq,ms:Math.round(clock()-t0),type:'log-trimmed',dropped:drop})}
  try{if(typeof localStorage!=='undefined')localStorage.setItem(LOG_KEY,toJSON())}catch(err){}
  return e}
 function trimSeries(arr){
  if(!Array.isArray(arr))return arr;
  let s=arr;
  if(s.length>MAX_SERIES){const step=Math.ceil(s.length/MAX_SERIES);s=s.filter((v,i)=>i%step===0)}
  return s.map(v=>(typeof v==='number'&&isFinite(v))?Math.round(v*10000)/10000:v)}
 function all(){return entries.slice()}
 function count(){return entries.length}
 function toJSON(){
  return JSON.stringify({app:'Harris Music Studio',log:'piano-session',format:FORMAT,
   startedAt:session?session.startedAt:null,meta:session?session.meta:{},entries:entries},null,1)}
 function toText(){
  const lines=['Harris Music Studio piano session log',
   'Started: '+(session?session.startedAt:'(not started)'),
   'Entries: '+entries.length,''];
  entries.forEach(e=>{
   const parts=['+'+e.ms+'ms',e.type];
   for(const k in e){if(k==='seq'||k==='ms'||k==='type')continue;const v=e[k];
    if(v==null)continue;
    if(typeof v==='number'||typeof v==='string'||typeof v==='boolean')parts.push(k+'='+v);
    else if(Array.isArray(v)&&v.length&&typeof v[0]==='string')parts.push(k+'='+v.join(','))}
   lines.push(parts.join(' '))});
  return lines.join('\n')}
 function clear(){session=null;entries=[];seq=0}
 function restore(){try{if(typeof localStorage==='undefined')return false;const o=JSON.parse(localStorage.getItem(LOG_KEY)||'null');if(!o||!o.entries)return false;entries=o.entries;session={startedAt:o.startedAt,meta:o.meta||{}};seq=entries.reduce((m,e)=>Math.max(m,e.seq||0),0);t0=clock();return true}catch(e){return false}}
 const api={FORMAT,MAX_ENTRIES,MAX_SERIES,LOG_KEY,start,record,trimSeries,all,count,toJSON,toText,clear,restore};
 try{restore()}catch(e){}
 if(typeof module!=='undefined')module.exports=api;
 return api})();
if(typeof window!=='undefined')window.SessionLog=SessionLog;
