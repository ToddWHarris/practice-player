# v31 Metronome voice latency: fake SpeechRecognition feeds interim then final results.
# Measures event->action time, start->first click lead, stop cancelling scheduled clicks, tempo on next beat, dedupe.
import json,sys
from playwright.sync_api import sync_playwright
FAKE="""(()=>{class FR{constructor(){window.__rec=this;window.__recN=(window.__recN||0)+1}start(){this.on=true;setTimeout(()=>this.onstart&&this.onstart(),0)}abort(){this.on=false}stop(){this.on=false}}
window.SpeechRecognition=FR;window.webkitSpeechRecognition=FR;
window.__say=(idx,tr,fin)=>{const r=window.__rec;const res=[];for(let i=0;i<=idx;i++){const a=[{transcript:i===idx?tr:'x'}];a.isFinal=i===idx?fin:true;res.push(a)}
 const t0=performance.now();r.onresult({resultIndex:idx,results:res});return t0}})()"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx=b.new_context(viewport={'width':390,'height':844});ctx.add_init_script(FAKE);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  pg.click('nav button[data-t=met]');pg.click('#mMic');pg.wait_for_timeout(100)
  R={}
  # warm the AudioContext once (user tap), then stop
  pg.click('#mGo');pg.wait_for_timeout(150);pg.click('#mGo')
  f0=ev("Metro.M.fired||0")
  # start on interim
  R['start_interim_ms']=ev("(()=>{const t=__say(0,'start',false);return Metro.M.on?performance.now()-t:null})()")
  R['first_click_lead_ms']=ev("Metro.M.firstLead!=null?Metro.M.firstLead*1000:null")
  ev("__say(0,'start',true)")  # final of same result: must not re-fire
  R['start_count']=ev("Metro.M.fired||0")-f0
  # stop on interim, scheduled clicks cancelled
  pg.wait_for_timeout(400)
  R['stop_interim_ms']=ev("(()=>{const t=__say(1,'stop',false);return !Metro.M.on?performance.now()-t:null})()")
  R['nodes_after_stop']=ev("Metro.M.nodes?Metro.M.nodes.length:null")
  R['flash_after_stop']=ev("document.getElementById('mDisp').className")
  # tempo: interim 'one' must not apply; 'one twenty' interim applies after stability; final correction
  ev("Metro.setBpm(90)")
  ev("__say(2,'one',false)");pg.wait_for_timeout(500);R['bpm_after_interim_one']=ev("Metro.M.bpm")
  R['tempo_interim_ms']=ev("""new Promise(res=>{const t=__say(2,'one twenty',false);const c=()=>{if(Metro.M.bpm===120)res(performance.now()-t);else if(performance.now()-t>3000)res(null);else setTimeout(c,5)};c()})""")
  ev("__say(2,'one twenty five',true)");R['bpm_after_final_correction']=ev("Metro.M.bpm")
  R['tempo_digits_ms']=ev("(()=>{const t=__say(3,'140',false);return Metro.M.bpm===140?performance.now()-t:null})()")
  # restart gap
  R['restart_gap_ms']=ev("""new Promise(res=>{const n=__recN,r=__rec;r.on=false;r.onend();const t=performance.now();const c=()=>{if(__recN>n||(__rec===r&&r.on))res(performance.now()-t);else if(performance.now()-t>2000)res(null);else setTimeout(c,1)};c()})""")
  # tempo change lands on the next beat while running
  pg.click('#mGo');pg.wait_for_timeout(300)
  R['tempo_next_beat']=ev("""(()=>{Metro.setBpm(60);return {next_gap_s:Math.round((Metro.M.next-Metro.M.lastT)*1000)/1000}})()""")
  pg.click('#mGo')
  print(json.dumps(R))
  if True:
    assert R['start_interim_ms'] is not None and R['start_interim_ms']<20,R
    assert R['first_click_lead_ms'] is not None and R['first_click_lead_ms']<=50,R
    assert R['start_count']==1,R
    assert R['stop_interim_ms'] is not None and R['nodes_after_stop']==0 and 'f1' not in R['flash_after_stop'] and 'fn' not in R['flash_after_stop'],R
    assert R['bpm_after_interim_one']==90 and R['tempo_interim_ms'] is not None and R['tempo_interim_ms']<500 and R['bpm_after_final_correction']==125,R
    assert R['tempo_digits_ms'] is not None and R['tempo_digits_ms']<20,R
    assert R['restart_gap_ms'] is not None and R['restart_gap_ms']<50,R
    assert R['tempo_next_beat']['next_gap_s']==1.0,R
    assert not errs,errs
    print('metvoice ok')
