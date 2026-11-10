# V45 screen checks: no Steps list, no flat/sharp circle, miss choices, Measure Start/Stop, layout.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]

def inside(box, view):
  return box['l']>=-1 and box['t']>=-1 and box['r']<=view['w']+1 and box['b']<=view['h']+1 and box['w']>8 and box['h']>8

with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  pg=b.new_context(viewport={'width':390,'height':844}, permissions=['microphone']).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(500)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(150)
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext'); pg.wait_for_timeout(80)
  pg.click('#gtCalOpen'); pg.wait_for_timeout(80)
  if pg.locator('#gtMuteOk').is_visible(): pg.click('#gtMuteOk')
  assert pg.locator('#gtSteps').count()==0 and pg.locator('#gtList').count()==0
  assert pg.inner_text('#gtCalHear')=='Start'
  assert 'Tap Start' in pg.inner_text('#gtCalStatus') and 'microphone is off' in pg.inner_text('#gtCalStatus')
  calls={'n':0,'stops':0}
  pg.evaluate("""()=>{
    window.__mic=0; window.__stops=0;
    navigator.mediaDevices.getUserMedia=async()=>{window.__mic++; return {getTracks:()=>[{stop(){window.__stops++}}]}};
    const AC=window.AudioContext||window.webkitAudioContext;
    AC.prototype.createMediaStreamSource=function(){return {connect(){},disconnect(){}}};
    AC.prototype.createScriptProcessor=function(){
      const node={connect(){},disconnect(){}};
      Object.defineProperty(node,'onaudioprocess',{set(fn){
        const id=setInterval(()=>fn({inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(0.05)}}),30);
        node.disconnect=()=>clearInterval(id);
      }});
      return node};
    PianoTune.analyzeCalibrationNote=()=>({status:'measured',reason:'ok',midi:21,B:0.0004,residualCents:0.2,partials:[{n:1,hz:1},{n:2,hz:2},{n:3,hz:3}],heardCents:-4,confidence:'high'});
    return 'ok';
  }""")
  assert pg.evaluate('window.__mic')==0
  pg.click('#gtCalHear')
  pg.wait_for_function("document.getElementById('gtCalHear').textContent==='Stop'")
  assert pg.evaluate('window.__mic')==1
  pg.click('#gtCalHear')
  pg.wait_for_function("document.getElementById('gtCalHear').textContent==='Start'")
  assert pg.evaluate('window.__stops')>=1
  assert 'A0' in pg.inner_text('#gtCalPrompt')
  assert 'Stopped' in pg.inner_text('#gtCalStatus')
  # a full take moves the prompt and does not listen again by itself
  pg.evaluate("PianoTune.analyzeCalibrationNote=(samples,sr,opts)=>{opts=opts||{midi:21}; return {status:'measured',reason:'ok',midi:opts.midi,B:0.0004,residualCents:0.2,partials:[{n:1,hz:1},{n:2,hz:2},{n:3,hz:3}],heardCents:-4,confidence:'high'}}")
  before=pg.evaluate('window.__mic')
  pg.click('#gtCalHear'); pg.wait_for_timeout(1600)
  assert pg.inner_text('#gtCalHear')=='Start'
  assert 'Now play' in pg.inner_text('#gtCalStatus') and 'Tap Start' in pg.inner_text('#gtCalStatus')
  assert pg.evaluate('window.__mic')==before+1
  pg.click('#gtCalBack')
  # pre-scan starts at A0 and hides the old circle
  pg.evaluate("""()=>{TunerCore.yin=()=>null; PianoTune._setPrescanWait(200);}""")
  pg.click('#gtCalModel'); pg.click('#gtSplitsStart'); pg.wait_for_timeout(300)
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0'), pg.inner_text('#gtTitle')+' | '+pg.inner_text('#gtCents')
  cents=pg.inner_text('#gtCents')
  assert ('Next: A 0' in cents) or cents=='Not read', cents
  face=pg.evaluate("""()=>{
    const svg=document.getElementById('pdSvg');
    const vis=getComputedStyle(svg).visibility;
    return {vis, text:svg.textContent, prescan:document.getElementById('gtune').classList.contains('prescan')};
  }""")
  assert face['vis']=='hidden' and face['prescan'] and 'flat' not in face['text'] and 'sharp' not in face['text'], face
  pg.wait_for_selector('#gtMiss:not([hidden])', timeout=4000)
  assert 'Try again' in pg.inner_text('#gtMiss') and 'Skip to next note' in pg.inner_text('#gtMiss')
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  pg.click('#gtMissAgain'); pg.wait_for_timeout(150)
  assert pg.locator('#gtMiss').is_hidden()
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  pg.wait_for_selector('#gtMiss:not([hidden])', timeout=4000)
  pg.click('#gtMissSkip'); pg.wait_for_timeout(200)
  rec=pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).prescan['21']")
  assert rec and rec['confidence']=='unread', rec
  assert pg.locator('#gtRetry').is_visible()
  pg.click('#gtRetry'); pg.wait_for_timeout(200)
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  # guided tuning still has the ring, not the white circle
  labels=pg.evaluate("()=>PianoTune.stepTitles()")
  a4=next(i for i,t in enumerate(labels) if 'Set A4 string 1 of 3' in t)
  pg.evaluate('(i)=>PianoTune.jump(i)', a4); pg.wait_for_timeout(200)
  tune=pg.evaluate("""()=>{
    const svg=getComputedStyle(document.getElementById('pdSvg')).visibility;
    const ring=getComputedStyle(document.getElementById('strobeRing')).visibility;
    return {svg, ring, prescan:document.getElementById('gtune').classList.contains('prescan'), note:document.getElementById('gtNote').innerText};
  }""")
  assert tune['svg']=='hidden' and tune['ring']=='visible' and not tune['prescan'] and tune['note']=='A4', tune
  for w,h,name in [(390,844,'phone'),(844,390,'phone-land'),(768,1024,'ipad'),(1024,768,'ipad-land')]:
    pg.set_viewport_size({'width':w,'height':h}); pg.wait_for_timeout(150)
    info=pg.evaluate("""()=>{
      const ids=['gtClose','gtBack','gtNote','gtCents','gtPrompt','gtKeys','gtHold','gtZero'];
      const view={w:innerWidth,h:innerHeight};
      const boxes={};
      ids.forEach(id=>{
        const e=document.getElementById(id);
        const r=e.getBoundingClientRect();
        const s=getComputedStyle(e);
        boxes[id]={l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,hidden:e.hidden||s.display==='none'||s.visibility==='hidden'};
      });
      return {view, scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth, boxes};
    }""")
    assert info['scrollW']<=info['clientW']+2, (name, info['scrollW'])
    for i,box in info['boxes'].items():
      assert not box['hidden'], (name, i, box)
      assert inside(box, info['view']), (name, i, box, info['view'])
    pg.screenshot(path='/opt/cursor/artifacts/v45-%s.png'%name)
  b.close()
assert not errs, errs
print('v45 ui ok')
