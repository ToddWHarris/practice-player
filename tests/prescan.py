# V36 pre-scan: A0 to C8, large offsets are data, Got it then Next, ring is ignored, unread can be retried.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts',exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx=b.new_context(viewport={'width':844,'height':390},device_scale_factor=2,permissions=['microphone'])
  pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://127.0.0.1:8765/');pg.wait_for_timeout(800)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed();pg.click('#gtOpen');pg.wait_for_timeout(250)
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  assert 'Next: A 0' in pg.inner_text('#gtCents')
  note_h=pg.locator('#gtNote').bounding_box()['height']
  assert note_h>=80,note_h
  assert pg.locator('#gtKeys button.blink').count()>=1 or pg.locator('#gtKeys button.next').count()>=1
  # +80 cents, steady, must be saved and must not be pinned off the number
  ev('PianoTune._setSounding(false)')
  advanced=ev("""()=>{const t=PianoTune.targetFreq(21,PianoTune.curveFor('concert').cents[21],440);
    const f=t*Math.pow(2,80/1200);let last;for(let i=0;i<8;i++)last=PianoTune.feedHz(f*(i%2?1.002:0.998),i*80);return last}""")
  assert advanced['step']==1,advanced
  rec=ev("JSON.parse(localStorage.getItem('pp-pianotune')).prescan['21']")
  assert abs(rec['cents']-80)<8 and rec['confidence']=='low',rec
  assert pg.inner_text('#gtCents')=='Got it'
  assert '✓' in pg.inner_text('#gtNote')
  pg.screenshot(path='/opt/cursor/artifacts/v36-prescan-got-it.png')
  pg.wait_for_timeout(900)
  assert 'Next: B flat 0' in pg.inner_text('#gtCents')
  assert pg.locator('#gtKeys button[data-m="22"].blink, #gtKeys button[data-m="22"].next').count()>=1
  # Ring of the captured A0 must not count as B flat 0
  ev("""()=>{const t=PianoTune.targetFreq(21,PianoTune.curveFor('concert').cents[21],440);
    const f=t*Math.pow(2,80/1200);const n=performance.now();
    PianoTune.feedHz(f,n);PianoTune.feedHz(f,n+80);PianoTune.feedHz(f,n+160)}""")
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step")==1
  # -120 on the new note, with an attack, is data
  ev('PianoTune._attack()')
  ev("""()=>{const t=PianoTune.targetFreq(22,PianoTune.curveFor('concert').cents[22],440);
    const f=t*Math.pow(2,-120/1200);const n=performance.now();
    for(let i=0;i<8;i++)PianoTune.feedHz(f,n+i*80)}""")
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step")==2
  flat=ev("JSON.parse(localStorage.getItem('pp-pianotune')).prescan['22'].cents")
  assert abs(flat+120)<8,flat
  b.close()
assert not errs,errs
print('PRESCAN OK')
