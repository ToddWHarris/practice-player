# Folder rows: swipe Add to list (folder + subfolders), Remove whole folder to Removed group, Restore, Delete forever, single-song restore inside group
import os,subprocess,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-fs';paths=['Band/a.mp3','Band/b.mp3','Band/Live/c.mp3','Band/Live/d.mp3','Solo/e.mp3']
for rel in paths:
  f=f'{D}/{rel}';os.makedirs(os.path.dirname(f),exist_ok=True)
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=400:duration=2','-c:a','libmp3lame','-b:a','64k',f],check=True)
errs=[];dialogs=[];ans={'ok':True,'v':'1'}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  def dlg(d):dialogs.append((d.type,d.message));(d.accept(ans['v']) if d.type=='prompt' else (d.accept() if ans['ok'] else d.dismiss()))
  pg.on('dialog',dlg);cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(sel,left=True):
    bb=pg.locator(sel).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;d=-230 if left else 230;x0=x+60 if left else x-60;touch('touchStart',x0,y)
    for k in range(1,11):touch('touchMove',x0+d*k/10,y);time.sleep(0.016)
    touch('touchEnd',x0+d,y);pg.wait_for_timeout(350)
  live=lambda:pg.evaluate('S.songs.filter(s=>!s.removed).map(s=>s.path).sort()')
  isopen=lambda sel:'open' in (pg.locator(sel).get_attribute('class') or '')
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  pg.set_input_files('#inFiles',[f'{D}/{r}' for r in paths]);pg.wait_for_timeout(1200)
  pg.evaluate("""async(paths)=>{const a=await DB.allSongs();for(const s of a){const rel=paths.find(p=>p.endsWith('/'+s.name+'.mp3'));const b=await DB.blob(s.id);await DB.delSong(s.id);s.path=rel;s.id=rel+'|'+s.size;await DB.putSong(s,b)}S.songs=await DB.allSongs();renderAll()}""",paths)
  ans['v']='Mix';pg.click('nav button[data-t=pls]');pg.click('#newPl');ans['v']='1'
  pg.click('nav button[data-t=lib]');F=lambda n:f'#tree li.frow:has-text("{n}")'
  assert pg.locator('#tree li.frow').count()==2
  # swipe folder shows both buttons; screenshot; tap closes; swipe right closes; one open at a time
  swipe(F('Band'));assert isopen(F('Band'))
  for sel in ['.padd','.prm']:
    bb=pg.locator(F('Band')+' '+sel).bounding_box();assert pg.evaluate(f"document.elementFromPoint({bb['x']+bb['width']/2},{bb['y']+bb['height']/2}).classList.contains('{sel[1:]}')")
  pg.screenshot(path='/workspace/shots/v14-folder-swipe.png')
  swipe(F('Solo'));assert not isopen(F('Band')) and isopen(F('Solo'));swipe(F('Solo'),False);assert not isopen(F('Solo'))
  swipe(F('Band'));pg.tap(F('Band')+' .n');pg.wait_for_timeout(200);assert not isopen(F('Band')) and pg.locator('#tree li.frow').count()==2,'tap closes, stays at root'
  # Add to list adds folder + subfolders
  dialogs.clear();swipe(F('Band'));pg.tap(F('Band')+' .padd');pg.wait_for_timeout(300)
  assert pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids.map(id=>byId(id).path)")==['Band/Live/c.mp3','Band/Live/d.mp3','Band/a.mp3','Band/b.mp3'] or sorted(pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids.map(id=>byId(id).path)"))==sorted(paths[:4])
  # tapping folder opens it
  pg.tap(F('Band')+' .n');pg.wait_for_timeout(200);assert 'Live' in pg.inner_text('#tree');pg.click('#crumbs a:has-text("Home")')
  # Remove whole folder (no confirm)
  n=len(dialogs);swipe(F('Band'));pg.tap(F('Band')+' .prm');pg.wait_for_timeout(500);assert len(dialogs)==n
  assert live()==['Solo/e.mp3'] and pg.locator(F('Band')).count()==0 and pg.evaluate('S.songs.length')==5
  assert pg.locator('#tree li.remfolder').inner_text().strip()=='🗑 Removed (4)'
  pg.locator('#tree li.remfolder').click();g='#tree li.rrow:has-text("Band (4)")';assert pg.locator(g).count()==1 and 'From: Band' in pg.inner_text(g)
  assert pg.locator('#tree li.rrow').count()==1,'kept as one group'
  # playlist skips removed folder songs
  assert pg.evaluate("L.makeQueue({},S.pls.filter(p=>!p.builtin)[0].ids,0,false,playable)")==None
  # open group, restore one song (Live/c)
  pg.tap(g+' .n');pg.wait_for_timeout(200);assert pg.locator('#tree li.rrow').count()==4 and 'From: Band / Live' in pg.inner_text('#tree')
  swipe('#tree li.rrow:has-text("c")');pg.tap('#tree li.rrow:has-text("♪ c") .padd');pg.wait_for_timeout(300);assert 'Band/Live/c.mp3' in live() and pg.locator('#tree li.rrow').count()==3
  # back to Removed, Restore group puts the rest back
  pg.click('#crumbs a:has-text("Removed")');swipe('#tree li.rrow:has-text("Band (3)")');pg.tap('#tree li.rrow:has-text("Band (3)") .padd');pg.wait_for_timeout(400)
  assert live()==sorted(paths) and pg.locator('#tree li.remfolder').count()==0 and pg.locator(F('Band')).count()==1
  # Remove again, Delete forever with cancel then confirm
  swipe(F('Band'));pg.tap(F('Band')+' .prm');pg.wait_for_timeout(400);pg.locator('#tree li.remfolder').click()
  ans['ok']=False;swipe('#tree li.rrow:has-text("Band (4)")');pg.tap('#tree li.rrow:has-text("Band (4)") .prm');pg.wait_for_timeout(300)
  assert dialogs[-1][0]=='confirm' and 'forever' in dialogs[-1][1] and pg.evaluate('S.songs.length')==5
  ans['ok']=True;swipe('#tree li.rrow:has-text("Band (4)")');pg.tap('#tree li.rrow:has-text("Band (4)") .prm');pg.wait_for_timeout(600)
  assert pg.evaluate('S.songs.length')==1 and pg.evaluate('S.pls.filter(p=>!p.builtin)[0].ids.length')==0 and pg.evaluate('DB.allSongs().then(a=>a.length)')==1
  assert pg.locator('#tree li.remfolder').count()==0 and pg.locator('#tree li.frow').count()==1
  pg.reload();pg.wait_for_timeout(900);pg.click('nav button[data-t=lib]');assert pg.evaluate('S.songs.length')==1
  pg.click('nav button[data-t=set]');assert pg.locator('#clearLib').count()==0
  b.close()
assert not errs,errs;print('folder swipe ok')
