# V46: run buttons sit above the keyboard, and Pause / key / Resume does not freeze on a sharp hold.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]

def overlap(a,b):
  return a['r']>b['l']+1 and a['l']<b['r']-1 and a['b']>b['t']+1 and a['t']<b['b']-1

STUB=r'''
() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  Object.defineProperty(AC.prototype, 'audioWorklet', {configurable:true, get(){return {addModule: async ()=>{}}}});
  window.__graphs = 0;
  window.AudioWorkletNode = function(){
    const node = {alive:true, connect(){}, disconnect(){ if(node.alive){node.alive=false; window.__graphs--;} }, port:{postMessage(){}}};
    Object.defineProperty(node.port, 'onmessage', {configurable:true, set(){}});
    window.__graphs++;
    return node;
  };
  AC.prototype.createMediaStreamSource = function(){ return {connect(){}, disconnect(){}}; };
  navigator.mediaDevices.getUserMedia = async () => ({getTracks:()=>[{stop(){}, getSettings(){return {sampleRate:48000}}}]});
  return 'ok';
}
'''

with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  pg=b.new_context(viewport={'width':440,'height':956}, permissions=['microphone']).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(500)
  pg.evaluate(STUB)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext'); pg.wait_for_timeout(80)
  pg.click('#gtCalModel'); pg.click('#gtSplitsStart'); pg.wait_for_timeout(400)
  c2=pg.evaluate("""()=>{const t=PianoTune.stepTitles(); return t.findIndex(s=>s.indexOf('C2')>=0 && s.indexOf('Pre-scan')!==0);}""")
  assert c2>0, c2
  pg.evaluate('(i)=>PianoTune.jump(i)', c2); pg.wait_for_timeout(200)
  sizes=[(440,956,'iphone17'),(956,440,'iphone17-land'),(1032,1376,'ipad13'),(1376,1032,'ipad13-land')]
  for w,h,name in sizes:
    pg.set_viewport_size({'width':w,'height':h}); pg.wait_for_timeout(200)
    info=pg.evaluate("""()=>{
      const box=id=>{const e=document.getElementById(id); const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
        return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,hidden:e.hidden||s.display==='none'||s.visibility==='hidden', font:parseFloat(s.fontSize)};};
      const ids=['gtPause','gtSaveProgressTune','gtLog'];
      const o={}; ids.forEach(id=>o[id]=box(id));
      return {view:{w:innerWidth,h:innerHeight}, keys:box('gtKeys'), ring:box('strobeRing'), o,
        scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth};
    }""")
    assert info['scrollW']<=info['clientW']+2, (name, info['scrollW'])
    left=min(info['o'][i]['l'] for i in info['o'])
    right=max(info['o'][i]['r'] for i in info['o'])
    mid=(left+right)/2
    assert abs(mid-info['view']['w']/2)<36, (name, mid, info['view'])
    for i,box in info['o'].items():
      assert not box['hidden'], (name, i, box)
      assert box['h']>=44 and box['font']>=16, (name, i, box)
      assert box['b']<=info['keys']['t']+1, (name, 'on keys', i, box, info['keys'])
      assert not overlap(box, info['ring']), (name, 'on ring', i, box, info['ring'])
      assert box['t']>=-1 and box['b']<=info['view']['h']+1 and box['l']>=-1 and box['r']<=info['view']['w']+1, (name, i, box)
    pg.screenshot(path='/opt/cursor/artifacts/v46-%s.png'%name)
  # A keyboard jump from pre-scan into a guided step must drop the pre-scan timer.
  pg.evaluate('PianoTune.jump(10)'); pg.wait_for_timeout(120)
  armed=pg.evaluate('PianoTune._counts()')
  assert armed['phase']=='prescan' and armed['armed'] is True and armed['live']==1, armed
  pg.evaluate('(i)=>PianoTune.jump(i)', c2); pg.wait_for_timeout(900)
  left=pg.evaluate('PianoTune._counts()')
  assert left['phase']=='down' and left['armed'] is False and left['live']==1, left
  # Pause, pick C2, no preview tone.
  pg.wait_for_timeout(1300)
  pg.click('#gtPause'); pg.wait_for_timeout(150)
  assert pg.inner_text('#gtPause')=='Resume'
  before=pg.evaluate('PianoTune._counts()')
  assert before['sounding'] is False, before
  pg.evaluate('(i)=>PianoTune.jump(i)', c2); pg.wait_for_timeout(80)
  paused=pg.evaluate('PianoTune._counts()')
  assert paused['paused'] is True and paused['sounding'] is False and paused['live']==0, paused
  assert 'C2' in pg.inner_text('#gtTitle')
  # Resume and hold +12 cents for a simulated 30 seconds. Saves stay sparse.
  pg.evaluate('PianoTune._resetCounts()')
  pg.click('#gtPause'); pg.wait_for_timeout(250)
  assert pg.inner_text('#gtPause')=='Pause'
  live=pg.evaluate('PianoTune._counts()')
  assert live['listening'] is True and live['live']==1 and pg.evaluate('window.__graphs')==1, (live, pg.evaluate('window.__graphs'))
  fed=pg.evaluate("""()=>{
    PianoTune._resetCounts();
    const midi=36;
    const base=PianoTune.curveFor('concert').cents[midi];
    const tgt=PianoTune.targetFreq(midi, base, 440);
    const f=tgt*Math.pow(2, 12/1200);
    const t0=performance.now();
    for(let i=0;i<1800;i++) PianoTune.feedHz(f, t0+i*16);
    return PianoTune._counts();
  }""")
  assert fed['saves']<=15, fed
  assert fed['renders']<500, fed
  assert fed['renders']>10, fed
  pg.wait_for_function("document.getElementById('gtPartialLine').innerText.indexOf('Sharp')>=0", timeout=2000)
  pg.click('#gtPause', timeout=3000)
  assert pg.inner_text('#gtPause')=='Resume'
  # A second Resume must not stack another audio graph.
  pg.click('#gtPause'); pg.wait_for_timeout(200)
  assert pg.evaluate('window.__graphs')==1, pg.evaluate('window.__graphs')
  assert pg.evaluate('PianoTune._counts().live')==1
  b.close()
assert not errs, errs
print('v46 ok')
