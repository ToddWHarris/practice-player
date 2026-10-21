# Now playing card: ID3 fields, cover art, placeholder, queue position, placement; Your music in Settings
import os,subprocess
from playwright.sync_api import sync_playwright
D='/tmp/pp-card';os.makedirs(D,exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
subprocess.run(['python3','-c',"from PIL import Image,ImageDraw;im=Image.new('RGB',(300,300),'#7c3aed');d=ImageDraw.Draw(im);d.ellipse([60,60,240,240],fill='#fbbf24');im.save('cover.jpg')"],cwd=D,check=True)
ff=lambda *a:subprocess.run(['ffmpeg','-loglevel','error','-y',*a],cwd=D,check=True)
ff('-f','lavfi','-i','sine=440:duration=20','-i','cover.jpg','-map','0','-map','1','-c:a','libmp3lame','-b:a','128k','-c:v','mjpeg','-disposition:v','attached_pic','-id3v2_version','3',
   '-metadata','title=Wooden Heart Polka','-metadata','artist=Test Band','-metadata','album=Sample Album','-metadata','date=1998','-metadata','track=3/8','01 tagged.mp3')
ff('-f','lavfi','-i','sine=550:duration=5','-c:a','libmp3lame','-b:a','96k','-map_metadata','-1','02 plain.mp3')
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept('Practice set'))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  # import controls live in Settings now, not Library
  pg.click('nav button[data-t=set]');assert pg.is_visible('#set #inFiles >> xpath=..') and pg.locator('#clearLib').count()==0 and 'Remove all' not in pg.inner_text('#set')
  pg.click('nav button[data-t=lib]');assert pg.locator('#lib label:has-text("Import")').count()==0
  assert 'Settings' in pg.inner_text('#tree');assert pg.inner_text('#now')=='Nothing playing' and pg.is_visible('#card')
  pg.set_input_files('#inFiles',[f'{D}/01 tagged.mp3',f'{D}/02 plain.mp3']);pg.wait_for_timeout(1200)
  pg.click('#tree li:nth-child(2) .n');pg.wait_for_function("document.querySelector('#cArt img')&&document.querySelector('#cArt img').naturalWidth>0",timeout=8000);pg.wait_for_timeout(400)
  t=lambda s:pg.inner_text(s)
  assert t('#now')=='Wooden Heart Polka',t('#now');assert t('#cSub')=='Test Band · Sample Album · 1998',t('#cSub')
  m=t('#cMeta');assert all(x in m for x in ['Track 3','1 of 2','0:20','KB','128 kbps']),m
  assert t('#from')=='Playing from: Library' and 'Top level' in t('#cPath')
  cb=pg.locator('#card').bounding_box();mb=pg.locator('main').bounding_box();assert cb['y']+cb['height']<=mb['y']+1 and cb['height']<130,('card above list, compact',cb)
  assert pg.evaluate("DB.get('meta:'+cur()).then(m=>!!(m&&m.title==='Wooden Heart Polka'&&m.art))"),'cached'
  pg.evaluate('audio.pause()');pg.screenshot(path='/workspace/shots/v12-library.png')
  pg.click('#next');pg.wait_for_timeout(800)
  assert t('#now')=='02 plain' and pg.locator('#cArt img').count()==0 and t('#cArt')=='♪' and '2 of 2' in t('#cMeta') and '96 kbps' in t('#cMeta') and t('#cSub')=='',(t('#now'),t('#cMeta'))
  # playlist: card on top of Playlists
  pg.click('nav button[data-t=pls]');pg.click('#newPl');pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids=S.songs.map(s=>s.id).sort();savePls();renderPls()")
  pg.click('#plList li:not(.builtinPl) .n');pg.click('#plDetail li:nth-child(1) .n');pg.wait_for_function("document.querySelector('#cArt img')",timeout=5000);pg.wait_for_timeout(400)
  assert pg.is_visible('#card') and t('#from')=='Playing from: Practice set' and '1 of 2' in t('#cMeta')
  cb=pg.locator('#card').bounding_box();assert cb['y']<pg.locator('#plList').bounding_box()['y']
  pg.evaluate('audio.pause()');pg.screenshot(path='/workspace/shots/v12-playlists.png')
  pg.click('nav button[data-t=set]');assert not pg.is_visible('#card') and not pg.is_visible('#player');assert '2 songs' in t('#libCount')
  pg.evaluate('document.querySelector("main").scrollTop=0');pg.screenshot(path='/workspace/shots/v12-settings.png')
  # restore after reload (cached meta)
  pg.reload();pg.wait_for_timeout(1200);pg.click('nav button[data-t=lib]');pg.wait_for_timeout(500);assert t('#now')=='Wooden Heart Polka',t('#now')
  b.close()
assert not errs,errs;print('card ok')
