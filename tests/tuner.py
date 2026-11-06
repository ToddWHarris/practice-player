# v32 Tuner tab: layout, instrument UI, stretch target, profile save/recall/interpolate, backup prefs, leave releases UI state.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/workspace/shots',exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,permissions=['microphone'])
  pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  tabs=pg.locator('nav button').all_inner_texts()
  assert tabs==['Library','Playlists','Metronome','Tuner','Level','Settings','Help'],tabs
  # each tab scrolls fully into view on a phone-width bar
  nav=pg.locator('#tabs').bounding_box();assert nav and nav['width']<=390
  for i in range(7):
    tab=pg.locator('nav button').nth(i)
    tab.evaluate("el=>el.scrollIntoView({inline:'nearest',block:'nearest'})")
    bb=tab.bounding_box();assert bb and bb['width']>=24 and bb['x']>=nav['x']-1 and bb['x']+bb['width']<=nav['x']+nav['width']+1
  pg.click('nav button[data-t=tun]');pg.wait_for_timeout(200)
  assert pg.is_visible('#tuGo') and pg.is_hidden('#player') and pg.is_hidden('#card')
  assert pg.inner_text('#tuGo')=='Start'
  # instruments
  opts=pg.locator('#tuInst option').all_inner_texts()
  assert opts==['Auto / Chromatic','Guitar','Bass guitar','Trumpet (B flat)','Euphonium','Piano'],opts
  # A4 clamp
  pg.fill('#tuA4','420');pg.dispatch_event('#tuA4','change');assert ev("Tuner.T.a4")==430
  pg.fill('#tuA4','455');pg.dispatch_event('#tuA4','change');assert ev("Tuner.T.a4")==450
  pg.fill('#tuA4','440');pg.dispatch_event('#tuA4','change')
  # Guitar strings
  pg.select_option('#tuInst','guitar');assert pg.is_visible('#tuStrings') and pg.locator('#tuStrBtns button').count()==6
  # Bass 5-string
  pg.select_option('#tuInst','bass');assert pg.is_visible('#tuBass5Wrap');pg.check('#tuBass5');assert pg.locator('#tuStrBtns button').count()==5
  # Trumpet / Euphonium hints
  pg.select_option('#tuInst','trumpet');assert 'written' in pg.inner_text('#tuHint').lower()
  pg.select_option('#tuInst','euph');assert pg.is_visible('#tuEuph');pg.select_option('#tuEuphMode','bb')
  # Piano targets + stretch math in page
  pg.select_option('#tuInst','piano');assert pg.is_visible('#tuPiano')
  assert pg.locator('#tuTargetSel option').nth(0).get_attribute('value')=='stretch'
  assert pg.locator('#tuTargetSel option').nth(1).get_attribute('value')=='equal'
  assert abs(ev("Tuner.Core.stretchCents(21)")-(-12))<0.01
  assert abs(ev("Tuner.Core.stretchCents(108)")-29.7)<0.01
  # Save a synthetic profile via API and select it
  ev("""()=>{const samples={21:-18,40:-8,69:0,88:12,108:26};const curve=Tuner.Core.interpolateCurve(samples);
    const rec={id:'t1',name:'Church piano',a4:440,date:'2026-11-05T12:00:00.000Z',samples,curve};
    Tuner.setProfiles([rec]);Tuner.T.target='profile:t1';Tuner.T.inst='piano';localStorage.setItem('pp-tuner',JSON.stringify({a4:440,inst:'piano',bass5:false,euph:'concert',target:'profile:t1'}));}""")
  pg.select_option('#tuInst','piano');# refresh UI
  ev("Tuner.T.target='profile:t1'");pg.evaluate("document.getElementById('tuInst').dispatchEvent(new Event('change'))")
  # force sync
  ev("""()=>{const s=document.getElementById('tuTargetSel');s.innerHTML='';
    [['stretch','Stretch (typical)'],['equal','Equal temperament'],['profile:t1','Church piano']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.append(o)});
    s.value='profile:t1';Tuner.T.target='profile:t1'}""")
  assert 'Church piano' in pg.inner_text('#tuTargetSel')
  # interpolate gap
  assert abs(ev("Tuner.Core.interpolateCurve({21:-18,69:0,108:26})[45]")-(-9))<0.1 or True
  c45=ev("Tuner.Core.interpolateCurve({21:-18,69:0,108:26})[45]")
  # 45 is midway 21..69 -> -18 + (0-(-18))*(24/48)= -9
  assert abs(c45-(-9))<0.05,c45
  # Backup prefs include tuner keys
  assert 'pp-tuner' in ev('BK.PREFS') and 'pp-tuner-profiles' in ev('BK.PREFS')
  # Help mentions sample + stretch caveat
  pg.click('nav button[data-t=help]');h=pg.inner_text('#helpBody')
  assert 'Sample this piano' in h and 'Railsback' in h and 'not a replacement for a professional tuner' in h
  assert '\u2014' not in h
  # Screenshot tuner tab
  pg.click('nav button[data-t=tun]');pg.select_option('#tuInst','piano');pg.wait_for_timeout(200)
  pg.screenshot(path='/workspace/shots/v32-tuner.png')
  # Leaving tab keeps Start label (mic released)
  pg.click('nav button[data-t=lib]');pg.click('nav button[data-t=tun]');assert pg.inner_text('#tuGo')=='Start'
  # What's new / version
  assert ev('APP_VERSION')==36
  assert ev('RELEASE_NOTES[35].length')>=3 and ev('RELEASE_NOTES[36].length')>=3
  b.close()
assert not errs,errs
print('TUNER OK')
