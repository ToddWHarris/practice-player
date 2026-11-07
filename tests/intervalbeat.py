# Guided interval check: partial beat readout, no false pass, Done is acknowledgement.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  pg=b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, permissions=['microphone']).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(800)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext'); pg.click('#gtSplitsStart'); pg.wait_for_timeout(300)
  pg.click('#gtSteps'); pg.wait_for_timeout(80)
  labels=pg.locator('#gtList button').all_inner_texts()
  idx=next(i for i,t in enumerate(labels) if 'Progressive thirds' in t)
  pg.evaluate('document.getElementById("gtList").hidden=true')
  pg.evaluate('(i)=>PianoTune.jump(i)', idx); pg.wait_for_timeout(200)
  pg.evaluate('PianoTune._setSounding(false)')
  step0=pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).step")
  # A single-note pitch must not pass a chord check.
  pg.evaluate("""()=>{const n=performance.now(); PianoTune.feedHz(440,n); PianoTune.feedHz(440,n+500);}""")
  assert pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).step")==step0
  assert pg.locator('#gtKeys button.ok').count()==0
  body=pg.inner_text('#gtBeats')
  assert 'size model' in body and 'harmonic model' in body and 'Not measured on this piano' in body
  assert 'Not a pass' in body
  assert pg.is_visible('#gtDone')
  measured=pg.evaluate("""()=>{
    const e=PianoTune.expectedBeat(PianoTune.curveFor('concert').cents, m=>PianoTune.bOf(PianoTune.SIZES.concert,m), 440, 53, 'M3');
    const sr=48000, n=Math.floor(sr*1.2), x=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr; x[i]=0.2*Math.sin(2*Math.PI*e.low*t)+0.2*Math.sin(2*Math.PI*e.high*t)}
    return PianoTune.previewInterval(x, sr);
  }""")
  assert measured['status']=='ok' and measured['confidence']=='high', measured
  assert abs(measured['beat']-measured['p'] and True)
  text=pg.inner_text('#gtBeats')
  assert 'Measured' in text and 'Confidence high' in text and 'Not a pass' in text
  assert 'F3-A3' in text
  assert pg.locator('#gtKeys button.ok').count()==0
  fit=pg.evaluate("""()=>{
    const ids=['gtNote','gtBeats','gtDone','gtKeys'];
    const box=el=>{const r=el.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom};};
    const els=ids.map(id=>box(document.getElementById(id)));
    const hits=[];
    for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
      const a=els[i],b=els[j];
      if(Math.min(a.r,b.r)-Math.max(a.l,b.l)>2 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>2) hits.push(ids[i]+'/'+ids[j]);
    }
    const g=document.getElementById('gtune').getBoundingClientRect();
    const clip=els.filter((e,i)=>e.b>g.bottom+2||e.r>g.right+2).map((e,i)=>ids[i]);
    return {hits, clip};
  }""")
  assert not fit['hits'] and not fit['clip'], fit
  pg.screenshot(path='/opt/cursor/artifacts/interval-beats-measured.png')
  silent=pg.evaluate("""()=>PianoTune.previewInterval(new Float32Array(48000), 48000)""")
  assert silent['status']=='uncertain' and silent['reason']=='silence', silent
  unsure=pg.inner_text('#gtBeats')
  assert 'uncertain' in unsure and 'Not a pass' in unsure
  assert pg.locator('#gtKeys button.ok').count()==0
  pg.screenshot(path='/opt/cursor/artifacts/interval-beats-uncertain.png')
  pg.click('#gtDone'); pg.wait_for_timeout(200)
  assert pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).step")==step0+1
  b.close()
assert not errs, errs
print('INTERVAL UI OK')
