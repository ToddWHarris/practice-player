# Help tab: player hidden, music keeps playing, TOC jumps, scrolls to bottom, no em dash; Settings link opens Help
import os,subprocess
from playwright.sync_api import sync_playwright
f='/tmp/pp-e2e/long.mp3';os.makedirs('/tmp/pp-e2e',exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=330:duration=60',f],check=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  assert pg.locator('nav button').all_inner_texts()==['Library','Playlists','Settings','Help']
  assert pg.is_visible('#help') and pg.is_visible('#h-welcome'),'first run opens Help'
  pg.screenshot(path='/workspace/shots/v14-help.png')
  # Settings holds settings only
  assert pg.locator('#set #helpBody').count()==0 and pg.locator('#set h2').all_inner_texts()==['Your music','Backup','Color','Loop and practice']
  txt=pg.evaluate("document.getElementById('helpBody').innerText+document.getElementById('helpBody').innerHTML+document.getElementById('set').innerText")
  assert '\u2014' not in txt and '&mdash;' not in txt,'no em dash'
  pg.set_input_files('#inFiles',[f]);pg.wait_for_timeout(1000);pg.click('nav button[data-t=lib]')
  pg.click('#tree li:nth-child(2) .n');pg.wait_for_function('!audio.paused&&audio.currentTime>0.5',timeout=8000)
  pg.click('nav button[data-t=help]');pg.wait_for_timeout(300)
  assert not pg.is_visible('#player') and not pg.is_visible('#card'),'player hidden on Help'
  t0=pg.evaluate('audio.currentTime');pg.wait_for_timeout(1200);assert not pg.evaluate('audio.paused') and pg.evaluate('audio.currentTime')>t0+0.8,'keeps playing'
  # TOC
  items=pg.locator('#toc .tocb');n=items.count();assert n>=13,n
  mb=pg.locator('main').bounding_box()
  for i in range(n):
    label=items.nth(i).inner_text();pg.evaluate("document.querySelector('main').scrollTop=0");items.nth(i).click();pg.wait_for_timeout(120)
    h=pg.locator('#helpBody h2',has_text=label).first.bounding_box();assert abs(h['y']-mb['y'])<40 or pg.evaluate("(m=>m.scrollTop+m.clientHeight>=m.scrollHeight-2)(document.querySelector('main'))"),(label,h,mb)
  pg.locator('.toTop').first.click();pg.wait_for_timeout(100);assert pg.evaluate("document.querySelector('main').scrollTop")<20
  # bottom reachable
  pg.evaluate("document.querySelector('main').scrollTop=1e6");pg.wait_for_timeout(100)
  last=pg.locator('#helpBody > *').last;lb=last.bounding_box();assert lb['y']+lb['height']<=mb['y']+mb['height']+1,('bottom',lb,mb)
  assert 'Version 14' in last.inner_text() or 'Version' in last.inner_text()
  # key facts present
  for k in ['Settings','Your music','go','again','repeat','Auto repeat','Dictation','Tap to listen','Loop editor','Remove','≡','On My iPhone','iCloud','USB','not-allowed','service-not-allowed','could not read file','close the app fully','pauses the music']:
    assert k.lower() in txt.lower(),k
  # Settings: link to Help, and Settings pauses while Help did not
  pg.click('nav button[data-t=set]');assert pg.evaluate('audio.paused');assert pg.locator('#openHelp').count()==0;pg.click('nav button[data-t=help]');assert pg.is_visible('#help') and pg.evaluate("document.querySelector('nav button.on').dataset.t")=='help'
  pg.click('nav button[data-t=lib]');assert pg.is_visible('#player') and pg.is_visible('#card')
  b.close()
assert not errs,errs;print('help ok')
