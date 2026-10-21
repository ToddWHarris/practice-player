# Removed folder: soft remove, hidden from folders/queues, playlist skip, playing song finishes, restore, delete forever, re-import, Remove all
import os,subprocess,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-rm';os.makedirs(D+'/Band',exist_ok=True)
files=[]
for i in range(4):
  f=f'{D}/Band/t{i}.mp3';files.append(f)
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={300+i*40}:duration=3','-c:a','libmp3lame','-b:a','64k',f],check=True)
errs=[];dialogs=[];ans={'ok':True,'v':'1'}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  def dlg(d):dialogs.append((d.type,d.message));(d.accept(ans['v']) if d.type=='prompt' else (d.accept() if ans['ok'] else d.dismiss()))
  pg.on('dialog',dlg);cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(sel):
    bb=pg.locator(sel).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;touch('touchStart',x+60,y)
    for k in range(1,11):touch('touchMove',x+60-230*k/10,y);time.sleep(0.016)
    touch('touchEnd',x-170,y);pg.wait_for_timeout(350)
  live=lambda:pg.evaluate('S.songs.filter(s=>!s.removed).map(s=>s.name).sort()')
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  # import with folder paths
  pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1200)
  pg.evaluate("""async()=>{for(const s of S.songs){const b=await DB.blob(s.id);await DB.delSong(s.id);s.path='Band/'+s.name+'.mp3';s.id=s.path+'|'+s.size;await DB.putSong(s,b)}S.songs=await DB.allSongs();
    S.pls=[{id:'p1',name:'Mix',ids:S.songs.map(s=>s.id).sort()}];await savePls();renderAll()}""")
  ids=pg.evaluate('S.pls.filter(p=>!p.builtin)[0].ids')
  pg.click('nav button[data-t=lib]');assert 'Removed' not in pg.inner_text('#tree'),'no Removed folder when empty'
  pg.click('#tree li:has-text("Band") .n');assert pg.locator('#tree li.lrow').count()==4
  # play t1 from folder, then remove t1 (playing) and t2 (queued)
  pg.tap('#tree li.lrow:has-text("t1") .n');pg.wait_for_function('!audio.paused',timeout=5000)
  swipe('#tree li.lrow:has-text("t1")');pg.tap('#tree li.lrow:has-text("t1") .prm');pg.wait_for_timeout(300)
  swipe('#tree li.lrow:has-text("t2")');pg.tap('#tree li.lrow:has-text("t2") .prm');pg.wait_for_timeout(400)
  assert pg.evaluate('S.songs.length')==4 and live()==['t0','t3'],live()
  assert not pg.evaluate('audio.paused') and pg.inner_text('#now')=='t1','removed playing song keeps playing'
  assert pg.locator('#tree li.lrow').count()==2,'hidden from folder'
  assert pg.evaluate("DB.allSongs().then(a=>a.filter(s=>s.removed).length)")==2 and pg.evaluate("DB.blob(S.songs.find(s=>s.name==='t1').id).then(b=>b&&b.size>1000)"),'flag stored, bytes kept'
  pg.tap('#next');pg.wait_for_timeout(500);assert pg.inner_text('#now')=='t3',('skip removed in folder queue',pg.inner_text('#now'))
  assert pg.evaluate('S.Q.list.map(id=>byId(id).name)')==['t0','t3']
  # Removed folder at root, last, with count; shows origin folder
  pg.click('#crumbs a:has-text("Home")');last=pg.locator('#tree > li').last;assert last.inner_text().strip()=='🗑 Removed (2)',last.inner_text()
  last.click();assert pg.locator('#tree li.rrow').count()==2 and 'From: Band' in pg.inner_text('#tree li.rrow:first-child, #tree li.rrow >> nth=0')
  pg.screenshot(path='/workspace/shots/v14-removed.png')
  # play-all fallback / All songs excludes removed
  assert pg.evaluate("L.makeQueue({},S.songs.map(s=>s.id),0,false,playable).list.length")==2
  # playlist: entries kept, greyed, skipped
  pg.click('nav button[data-t=pls]');pg.locator('#plList li:not(.builtinPl) .n').first.click()
  assert pg.locator('#plDetail li.prow').count()==4 and pg.locator('#plDetail li.gone').count()==2 and '(removed)' in pg.inner_text('#plDetail')
  pg.tap('#plDetail li.prow:nth-child(1) .n');pg.wait_for_timeout(500);assert pg.evaluate('S.Q.list.map(id=>byId(id).name)')==['t0','t3']
  pg.tap('#next');pg.wait_for_timeout(400);assert pg.inner_text('#now')=='t3'
  pg.tap('#plDetail li.prow:nth-child(2) .n');pg.wait_for_timeout(400);assert pg.inner_text('#now')=='t3','tapping removed row starts at next playable'
  # Restore t1
  pg.click('nav button[data-t=lib]');pg.click('#crumbs a:has-text("Home")');pg.locator('#tree li.remfolder').click()
  swipe('#tree li.rrow:has-text("t1")');x=pg.locator('#tree li.rrow:has-text("t1") .padd');assert x.inner_text()=='Restore';x.tap();pg.wait_for_timeout(400)
  assert live()==['t0','t1','t3'] and pg.locator('#tree li.rrow').count()==1;pg.click('#crumbs a:has-text("Home")');assert 'Removed (1)' in pg.inner_text('#tree')
  pg.click('nav button[data-t=pls]');pg.locator('#plList li:not(.builtinPl) .n').first.click();assert pg.locator('#plDetail li.gone').count()==1
  pg.tap('#plDetail li.prow:nth-child(1) .n');pg.wait_for_timeout(400);assert pg.evaluate('S.Q.list.map(id=>byId(id).name)')==['t0','t1','t3'],'restored back in playlist'
  # Delete forever needs swipe + tap + confirm; cancel keeps it
  pg.click('nav button[data-t=lib]');pg.click('#crumbs a:has-text("Home")');pg.locator('#tree li.remfolder').click()
  n=len(dialogs);swipe('#tree li.rrow:has-text("t2")');assert len(dialogs)==n and pg.evaluate('S.songs.length')==4
  ans['ok']=False;pg.locator('#tree li.rrow:has-text("t2") .prm').tap();pg.wait_for_timeout(300);assert dialogs[-1][0]=='confirm' and 'forever' in dialogs[-1][1] and pg.evaluate('S.songs.length')==4
  ans['ok']=True;swipe('#tree li.rrow:has-text("t2")');pg.locator('#tree li.rrow:has-text("t2") .prm').tap();pg.wait_for_timeout(500)
  assert pg.evaluate('S.songs.length')==3 and len(pg.evaluate('S.pls.filter(p=>!p.builtin)[0].ids'))==3 and pg.evaluate("DB.blob(S.pls.filter(p=>!p.builtin)[0].ids[0])!==null")
  assert 'Removed' not in pg.inner_text('#tree') or pg.locator('#tree li.remfolder').count()==0
  # re-importing a removed file restores it
  pg.click('#crumbs a:has-text("Home")');pg.click('#tree li:has-text("Band") .n');swipe('#tree li.lrow:has-text("t0")');pg.tap('#tree li.lrow:has-text("t0") .prm');pg.wait_for_timeout(300)
  assert 't0' not in live();pg.evaluate("""async()=>{const s=S.songs.find(x=>x.name==='t0');const b=await DB.blob(s.id);const f=new File([b],'t0.mp3',{type:'audio/mpeg'});Object.defineProperty(f,'webkitRelativePath',{value:'Band/t0.mp3'});await importFiles([f])}""");pg.wait_for_timeout(500)
  assert 't0' in live() and pg.evaluate('S.songs.length')==3,'reimport restores'
  # survives reload; Remove all is gone
  swipe('#tree li.lrow:has-text("t3")');pg.tap('#tree li.lrow:has-text("t3") .prm');pg.wait_for_timeout(300)
  pg.reload();pg.wait_for_timeout(900);pg.click('nav button[data-t=lib]');pg.click('#crumbs a >> nth=0');pg.wait_for_timeout(200);assert 'Removed (1)' in pg.inner_text('#tree')
  pg.click('nav button[data-t=set]');assert pg.locator('#clearLib').count()==0 and 'Remove all' not in pg.inner_text('#set')
  assert 'remove all' not in pg.evaluate("document.getElementById('helpBody').innerText").lower()
  b.close()
assert not errs,errs;print('removed ok')
