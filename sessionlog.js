// v43 Piano session diagnostic log.
// Local only: entries live in memory on this device. Nothing is uploaded, sent, or shared by
// this module. The only way a log leaves the device is the user tapping Download session log
// in the piano screens and sending the file themselves.
const SessionLog=(function(){
 const FORMAT=1,MAX_ENTRIES=800,MAX_SERIES=300;
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
  if(entries.length>MAX_ENTRIES)entries.splice(0,entries.length-MAX_ENTRIES);
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
 const api={FORMAT,MAX_ENTRIES,MAX_SERIES,start,record,trimSeries,all,count,toJSON,toText,clear};
 if(typeof module!=='undefined')module.exports=api;
 return api})();
if(typeof window!=='undefined')window.SessionLog=SessionLog;
