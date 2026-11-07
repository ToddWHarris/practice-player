# v34 Guided piano tune UI: landscape fit, type, back/jump, step completion, screenshots.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts',exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx=b.new_context(viewport={'width':844,'height':390},device_scale_factor=2,permissions=['microphone'])
  pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://127.0.0.1:8765/');pg.wait_for_timeout(900)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed()
  pg.click('#gtOpen');pg.wait_for_timeout(250)
  assert pg.is_visible('#gtPick') and pg.inner_text('#gtPick').find('Choose a piano')>=0
  pg.click('#gtNew');pg.click('#gtStyle button[data-style=concert]');pg.click('#gtStyleNext');pg.click('#gtCalModel');pg.click('#gtSplitsStart');pg.wait_for_timeout(400)
  assert pg.is_visible('#gtune') and pg.is_hidden('#gtRotate') and pg.is_hidden('#gtPick')
  assert pg.locator('#gtKeys button').count()==88
  fit=ev("""()=>{const g=document.getElementById('gtune');const k=document.getElementById('gtKeys');const n=document.getElementById('pdSvg');
    const kb=k.getBoundingClientRect(),nb=n.getBoundingClientRect();
    return {scroll:g.scrollHeight<=g.clientHeight+2,doc:document.documentElement.scrollHeight<=window.innerHeight+2,
      keyBottom:kb.bottom,keyTop:kb.top,needle:nb.top,note:document.getElementById('gtNote').getBoundingClientRect().height}}""")
  assert fit['scroll'] and fit['doc'],fit
  assert fit['keyBottom']<=392 and fit['needle']<fit['keyTop'] and fit['note']>30,fit
  opts=pg.locator('#gtType option').all_inner_texts()
  for name in ['Concert grand (9 ft)','Baby grand','Studio upright','Spinet','Typical']:
    assert name in opts,opts
  pg.select_option('#gtType','spinet')
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).type")=='spinet'
  pg.select_option('#gtType','concert')
  # Jump to Set A4 and to the thirds check
  ev("""()=>{const i=PianoTune._session?null:null;const seq=document;return 0}""")
  i=ev("""()=>{let i=0;const s=JSON.parse(localStorage.getItem('pp-pianotune'));return s.step}""")
  ev("""()=>{const steps=[...document.querySelectorAll('#gtList button')];return 0}""")
  ev("""()=>{window.__idx=0;const hold=1}""")
  # Use the Steps list after opening it once so buttons exist
  pg.click('#gtSteps');pg.wait_for_timeout(100)
  labels=pg.locator('#gtList button').all_inner_texts()
  a4=next(i for i,t in enumerate(labels) if 'Set A4 string 1 of 3' in t)
  thirds=next(i for i,t in enumerate(labels) if 'Progressive thirds' in t)
  ev('(i)=>PianoTune.jump(i)',a4);pg.wait_for_timeout(200)
  assert pg.inner_text('#gtNote')=='A4'
  assert 'Play A4 alone' in pg.inner_text('#gtPrompt') and 'Mute the other strings' in pg.inner_text('#gtPrompt') and 'pitch' in pg.inner_text('#gtPrompt')
  assert pg.locator('#gtKeys button.next').count()>=1
  ev("document.getElementById('gtList').hidden=true")
  pg.screenshot(path='/opt/cursor/artifacts/v34-guided-tune-a4-landscape.png')
  ev('(i)=>PianoTune.jump(i)',thirds);pg.wait_for_timeout(200)
  assert pg.locator('#gtKeys button.next').count()==4
  assert 'beats' in pg.inner_text('#gtBeats').lower()
  ev("document.getElementById('gtList').hidden=true")
  pg.screenshot(path='/opt/cursor/artifacts/v34-guided-tune-thirds-landscape.png')
  # Back returns to the previous step
  before=pg.inner_text('#gtTitle')
  pg.click('#gtBack');pg.wait_for_timeout(150)
  assert pg.inner_text('#gtTitle')!=before
  # In-tune hold advances one single-note step; the app's own tone is ignored
  ev('(i)=>PianoTune.jump(i)',a4);pg.wait_for_timeout(100)
  ev('PianoTune._setSounding(true)')
  ev('PianoTune.feedHz(440,1000)')
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step")==a4
  ev('PianoTune._setSounding(false)')
  step_now=ev("""()=>{PianoTune.feedHz(440,0);PianoTune.feedHz(440,500);return JSON.parse(localStorage.getItem('pp-pianotune')).step}""")
  assert step_now==a4+1,step_now
  # Existing backup keys still present
  prefs=ev('BK.PREFS')
  for k in ['accent','pp-beats','pp-tuner-profiles','pp-meter','pp-pianotune']:
    assert k in prefs
  b.close()
assert not errs,errs
print('GUIDE OK')
