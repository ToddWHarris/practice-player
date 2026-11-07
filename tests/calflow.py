# Calibration controls, missing-fundamental path is covered in calibration.test.js.
# This checks the screen: button states, result vs coverage, advance, retry, skip, close, A4, layout.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
STUB = r'''
() => {
  window.__n = 0;
  window.__heard = -11;
  window.__mode = 'measured';
  window.__last = null;
  PianoTune.analyzeCalibrationNote = (samples, sr, opts) => {
    window.__n++;
    window.__last = {n: window.__n, midi: opts.midi, a4: opts.a4, mode: window.__mode, heard: window.__heard};
    if (window.__mode === 'reject') return {status:'rejected', reason:'wrong-note', midi:opts.midi, B:null, heardCents:null, partials:[], confidence:'withheld'};
    if (window.__mode === 'unclear') return {status:'rejected', reason:'unclear', midi:opts.midi, B:null, heardCents:null, partials:[], confidence:'withheld'};
    return {status:'measured', reason:'ok', midi:opts.midi, B:0.0004, residualCents:0.2, partials:[{n:2,hz:1},{n:3,hz:2},{n:4,hz:3}], heardCents:window.__heard, confidence:'high'};
  };
  navigator.mediaDevices.getUserMedia = async () => ({getTracks:()=>[{stop(){}}]});
  const AC = window.AudioContext || window.webkitAudioContext;
  AC.prototype.createMediaStreamSource = function(){ return {connect(){}, disconnect(){}}; };
  AC.prototype.createScriptProcessor = function(){
    const node = {connect(){}, disconnect(){}};
    Object.defineProperty(node, 'onaudioprocess', {set(fn){
      const ev = {inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(0.05)}};
      fn(ev);
    }});
    return node;
  };
  return 'ok';
}
'''
def snap(pg):
  return pg.evaluate('''() => {
    const b = document.getElementById('gtCalHear');
    const cov = document.getElementById('gtCalCoverage');
    return {
      hear: b.textContent, disabled: b.disabled, busy: b.getAttribute('aria-busy'), cls: b.className,
      result: document.getElementById('gtCalStatus').textContent,
      prompt: document.getElementById('gtCalPrompt').textContent,
      coverage: cov ? cov.textContent : '',
      useOff: document.getElementById('gtCalUse').disabled,
      a4: document.getElementById('gtA4').value,
      sess: PianoTune._session().a4,
      n: window.__n, last: window.__last
    };
  }''')

errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  pg=b.new_context(viewport={'width':1024,'height':768}, permissions=['microphone']).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(400)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(150)
  assert pg.input_value('#gtA4')=='440', pg.input_value('#gtA4')
  assert pg.evaluate('PianoTune._session().a4')==440
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext'); pg.wait_for_timeout(80)
  assert pg.input_value('#gtA4')=='440'
  pg.fill('#gtA4','442'); pg.dispatch_event('#gtA4','change')
  assert pg.input_value('#gtA4')=='442' and pg.evaluate('PianoTune._session().a4')==442
  pg.fill('#gtA4',''); pg.dispatch_event('#gtA4','change')
  assert pg.input_value('#gtA4')=='442' and pg.evaluate('PianoTune._session().a4')==442, 'empty must not change the reference'
  pg.evaluate("document.getElementById('gtA4').value='nope'"); pg.dispatch_event('#gtA4','change')
  assert pg.input_value('#gtA4')=='442' and pg.evaluate('PianoTune._session().a4')==442
  pg.fill('#gtA4','999'); pg.dispatch_event('#gtA4','change')
  assert pg.input_value('#gtA4')=='450' and pg.evaluate('PianoTune._session().a4')==450
  pg.fill('#gtA4','442'); pg.dispatch_event('#gtA4','change')
  pg.click('#gtCalOpen'); pg.wait_for_timeout(80)
  prompt=pg.inner_text('#gtCalPrompt')
  assert 'A0' in prompt and 'one string' in prompt and 'Mute' not in prompt and 'not for whether it is in tune' in prompt, prompt
  assert pg.input_value('#gtA4')=='442'
  pg.evaluate(STUB)
  pg.click('#gtCalHear')
  early=snap(pg)
  assert early['hear']=='Listening...' and early['disabled'] and early['busy']=='true', early
  assert 'Listening to A0' in early['result'] and 'notes measured' not in early['result'], early
  assert '0 notes measured' in early['coverage'] or '0 note' in early['coverage'], early
  pg.screenshot(path='/opt/cursor/artifacts/cal-listening-1024.png')
  pg.wait_for_timeout(1500)
  ok=snap(pg)
  assert ok['hear']=='Measurement accepted' and not ok['disabled'], ok
  assert 'A0 accepted' in ok['result'] and 'Now play A1' in ok['result'] and '-11.0' in ok['result'], ok
  assert 'notes measured' not in ok['result'] and 'Not enough coverage' not in ok['result'], ok
  assert '1 note measured' in ok['coverage'] and 'Not enough coverage' in ok['coverage'], ok
  assert 'A1' in ok['prompt'] and 'Mute' in ok['prompt'], ok['prompt']
  assert ok['last']['a4']==442 and ok['last']['midi']==21, ok['last']
  pg.screenshot(path='/opt/cursor/artifacts/cal-accepted-1024.png')
  pg.evaluate("window.__mode='reject'")
  pg.click('#gtCalHear'); pg.wait_for_timeout(1500)
  bad=snap(pg)
  assert bad['hear']=='Not accepted. Try again.' and not bad['disabled'], bad
  assert 'did not sound like A1' in bad['result'], bad
  assert 'notes measured' not in bad['result'], bad
  assert '1 note measured' in bad['coverage'], bad
  assert 'Play A1' in bad['prompt'], bad['prompt']
  pg.screenshot(path='/opt/cursor/artifacts/cal-rejected-1024.png')
  # retry during capture must drop the in-flight reading
  pg.evaluate("window.__mode='measured'; window.__heard=-11; window.__n=0")
  pg.click('#gtCalHear'); pg.wait_for_timeout(120)
  pg.evaluate("window.__heard=-22")
  pg.click('#gtCalRetry')
  mid=snap(pg)
  assert mid['hear']=='Listening...' and mid['disabled'], mid
  pg.wait_for_timeout(1600)
  late=snap(pg)
  assert '-22.0' in late['result'] and '-11.0' not in late['result'], late
  assert 'A1 accepted' in late['result'] and 'Now play A2' in late['result'], late
  assert '2 notes measured' in late['coverage'], late
  assert late['n']==1, late
  # skip during capture does not store and advances once
  pg.evaluate("window.__mode='measured'; window.__heard=-3; window.__n=0")
  pg.click('#gtCalHear'); pg.wait_for_timeout(100)
  pg.click('#gtCalSkip')
  pg.wait_for_timeout(1500)
  sk=snap(pg)
  assert 'A2 skipped' in sk['result'] and 'Now play E3' in sk['result'], sk
  assert '2 notes measured' in sk['coverage'], sk
  assert 'E3' in sk['prompt'] and sk['hear']=='Listen to this note', sk
  assert sk['n']==0, sk
  # close during capture
  pg.click('#gtCalHear'); pg.wait_for_timeout(80)
  pg.click('#gtCalBack')
  pg.wait_for_timeout(1500)
  assert pg.is_hidden('#gtCal') and pg.is_visible('#gtSplits')
  pg.click('#gtCalOpen'); pg.wait_for_timeout(80)
  fresh=snap(pg)
  assert 'A0' in fresh['prompt'] and '0 notes measured' in fresh['coverage'] and fresh['hear']=='Listen to this note', fresh
  # no microphone
  pg.evaluate("""() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), {name:'NotAllowedError'})); }""")
  pg.click('#gtCalHear'); pg.wait_for_timeout(200)
  mic=snap(pg)
  assert mic['hear']=='Not accepted. Try again.' and 'Microphone not allowed' in mic['result'], mic
  assert '0 notes measured' in mic['coverage'], mic
  # unclear copy
  pg.evaluate(STUB)
  pg.evaluate("window.__mode='unclear'")
  pg.click('#gtCalHear'); pg.wait_for_timeout(1500)
  un=snap(pg)
  assert 'Not enough reliable partials' in un['result'] and un['hear']=='Not accepted. Try again.', un
  assert 'A0' in un['prompt'], un
  # last sample note stays put
  pg.evaluate("window.__mode='measured'; window.__heard=1.2")
  for _ in range(11):
    pg.click('#gtCalSkip')
  assert 'C8' in pg.inner_text('#gtCalPrompt')
  pg.click('#gtCalHear'); pg.wait_for_timeout(1500)
  last=snap(pg)
  assert 'C8 accepted' in last['result'] and 'last sample note' in last['prompt'], last
  assert 'Now play' not in last['result'], last
  assert last['hear']=='Measurement accepted', last
  assert '1 note measured' in last['coverage'], last
  pg.screenshot(path='/opt/cursor/artifacts/cal-last-note-1024.png')
  # saved reference survives reload and a named profile
  pg.evaluate("""()=>{localStorage.setItem('pp-pianotune', JSON.stringify({v:3,a4:442,type:null,step:0,prescan:{},ready:false,tuningOk:false}));
    localStorage.setItem('pp-piano-profiles', JSON.stringify([{id:'p442',name:'Bench',style:'concert',a4:442,split2:24,split3:53,prescan:{},step:0,tuningOk:false}]));}""")
  pg.reload(); pg.wait_for_timeout(400)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(150)
  assert pg.input_value('#gtA4')=='442', pg.input_value('#gtA4')
  pg.get_by_role('button', name='Load').click(); pg.wait_for_timeout(400)
  assert pg.input_value('#gtA4')=='442' and pg.evaluate('PianoTune._session().a4')==442
  pg.screenshot(path='/opt/cursor/artifacts/cal-a4-442.png')
  # layout of the measure screen
  pg.evaluate("PianoTune.close()")
  sizes=[(390,844,'phone-portrait'),(844,390,'phone-landscape'),(768,1024,'tablet-portrait'),(1024,768,'tablet-landscape')]
  for w,h,name in sizes:
    pg.set_viewport_size({'width':w,'height':h}); pg.wait_for_timeout(150)
    pg.click('#gtOpen'); pg.wait_for_timeout(100)
    pg.click('#gtNew'); pg.click('#gtStyle button[data-style=kawai-k200]'); pg.click('#gtStyleNext'); pg.wait_for_timeout(80)
    pg.click('#gtCalOpen'); pg.wait_for_timeout(80)
    info=pg.evaluate('''()=>{
      const box=document.getElementById('gtCal');
      const ids=['gtCalHear','gtCalRetry','gtCalSkip','gtCalUse','gtCalBack','gtA4','gtCalPrompt','gtCalStatus','gtCalCoverage'];
      const view={w:innerWidth,h:innerHeight};
      const out={};
      ids.forEach(id=>{
        const e=document.getElementById(id);
        e.scrollIntoView({block:'center',inline:'nearest'});
        const r=e.getBoundingClientRect();
        out[id]={l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};
      });
      return {view, scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth, boxW:box.scrollWidth, boxC:box.clientWidth, out,
        prompt:document.getElementById('gtCalPrompt').textContent};
    }''')
    assert info['scrollW']<=info['clientW']+2, (name, info['scrollW'], info['clientW'])
    assert info['boxW']<=info['boxC']+2, (name, info['boxW'], info['boxC'])
    assert 'one string' in info['prompt'] and 'Mute' not in info['prompt'], (name, info['prompt'])
    for i,box in info['out'].items():
      assert box['w']>8 and box['h']>8, (name, i, box)
      assert box['l']>=-1 and box['r']<=info['view']['w']+1, (name, i, box)
      assert box['t']>=-1 and box['b']<=info['view']['h']+1, (name, i, box)
    pg.screenshot(path='/opt/cursor/artifacts/cal-layout-%s.png'%name)
    pg.click('#gtCalBack'); pg.click('#gtClose'); pg.wait_for_timeout(80)
  b.close()
assert not errs, errs
print('calflow ok')
