# v26 Favorites: swipe Favorite/Unfavorite on songs and clips, check marks in Library and playlists,
# persistence across reload, built-in Favorites playlist kept in sync both ways
import os,subprocess,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-fav';os.makedirs(D,exist_ok=True);files=[]
for i in range(4):
  f=f'{D}/tune{i}.mp3';files.append(f)
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={300+i*40}:duration=30','-c:a','libmp3lame','-b:a','64k',f],check=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  ans={'v':'1'};pg.on('dialog',lambda d:d.accept(ans['v']) if d.type=='prompt' else d.accept())
  cdp=ctx.new_cdp_session(pg);ev=pg.evaluate
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(loc):
    bb=loc.bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;touch('touchStart',x+80,y)
    for k in range(1,11):touch('touchMove',x+80-280*k/10,y);time.sleep(0.016)
    touch('touchEnd',x-200,y);pg.wait_for_timeout(350)
  lib=lambda i:pg.locator(f'#tree li.lrow:nth-child({i+2})')
  pli=lambda i:pg.locator(f'#plDetail li.prow:nth-child({i+1})')
  ids=lambda:ev("(S.pls.find(p=>p.id==='favs')||{ids:[]}).ids")
  def tap(loc):
    x,y=(lambda bb:(bb['x']+bb['width']/2,bb['y']+bb['height']/2))(loc.bounding_box())
    assert ev(f"document.elementFromPoint({x},{y}).classList.contains('pfav')"),'fav button covered';loc.click();pg.wait_for_timeout(250)
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800);pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1500)
  assert ev("S.pls[0].id==='clips'&&S.pls[1].id==='favs'&&S.pls[1].builtin"),'Favorites playlist after Custom Clips'
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200)
  assert pg.locator('#tree .favck').count()==0
  # toggle on from the Library swipe
  swipe(lib(1));b1=lib(1).locator('.pfav');assert b1.inner_text()=='Favorite';
  pg.screenshot(path='/workspace/shots/v26-swipe-favorite.png');tap(b1)
  assert lib(1).locator('.favck').count()==1 and pg.locator('#tree .favck').count()==1,'check in library'
  col=ev("getComputedStyle(document.querySelector('#tree .favck')).color");ac=ev("getComputedStyle(document.documentElement).getPropertyValue('--ac')")
  swipe(lib(3));tap(lib(3).locator('.pfav'));assert len(ids())==2
  # toggle off then on again
  swipe(lib(3));assert lib(3).locator('.pfav').inner_text()=='Unfavorite';tap(lib(3).locator('.pfav'));assert len(ids())==1 and lib(3).locator('.favck').count()==0
  swipe(lib(3));tap(lib(3).locator('.pfav'));assert len(ids())==2
  pg.screenshot(path='/workspace/shots/v26-library-checks.png')
  # color setting is respected
  ev("applyAccent('#f59e0b',true)");pg.wait_for_timeout(100)
  assert ev("getComputedStyle(document.querySelector('#tree .favck')).color")=='rgb(245, 158, 11)','accent color'
  # persistence
  pg.reload();pg.wait_for_timeout(1200);pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200)
  assert len(ids())==2 and lib(1).locator('.favck').count()==1 and lib(3).locator('.favck').count()==1 and pg.locator('#tree .favck').count()==2,'persisted'
  # user playlist: check marks and swipe toggle
  ans['v']='Mix';pg.click('nav button[data-t=pls]');pg.click('#newPl');pg.wait_for_timeout(200)
  ev("S.pls.find(p=>p.name==='Mix').ids=S.songs.filter(s=>!s.clip).sort((a,b)=>a.path.localeCompare(b.path)).map(s=>s.id);savePls();S.openPl=S.pls.find(p=>p.name==='Mix').id;renderPls()");pg.wait_for_timeout(200)
  assert pli(1).locator('.favck').count()==1 and pli(0).locator('.favck').count()==0 and pg.locator('#plDetail .favck').count()==2,'checks in playlist'
  swipe(pli(0));tap(pli(0).locator('.pfav'));assert len(ids())==3 and pli(0).locator('.favck').count()==1
  pg.evaluate("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(150)
  pg.screenshot(path='/workspace/shots/v26-playlist-checks.png')
  swipe(pli(2));assert pli(2).locator('.pfav').count()==1;pg.screenshot(path='/workspace/shots/v26-playlist-swipe.png');ev('closeRow()');pg.wait_for_timeout(200)
  # Custom Clips: favorite a clip
  ev("makeClip(S.songs.find(s=>!s.clip).id,5,9,'Bridge').then(()=>{S.openPl='clips';renderPls()})");pg.wait_for_function('S.songs.length===5');pg.wait_for_timeout(300)
  assert pg.locator('#plDetail li.prow').count()==1;swipe(pli(0));tap(pli(0).locator('.pfav'))
  cid=ev("S.songs.find(s=>s.clip).id");assert cid in ids() and pli(0).locator('.favck').count()==1,'clip fav'
  assert ev("S.pls.find(p=>p.id==='clips').ids.includes('%s')"%cid),'clip stays in Custom Clips'
  pg.screenshot(path='/workspace/shots/v26-clips-checks.png')
  # Favorites playlist holds them all; removing there unfavorites
  ev("S.openPl='favs';renderPls()");pg.wait_for_timeout(200)
  assert pg.locator('#plDetail li.prow').count()==4 and pg.locator('#plDetail .favck').count()==4
  assert pg.locator('#plList li.builtinPl:has-text("Favorites (4)")').count()==1 and pg.locator('#plList li:has-text("Favorites") button:has-text("Delete")').count()==0
  pg.evaluate("document.getElementById('plList').scrollIntoView({block:'start'})");pg.wait_for_timeout(150)
  pg.screenshot(path='/workspace/shots/v26-favorites-playlist.png')
  first=ids()[0];swipe(pli(0));pli(0).locator('.prm').click();pg.wait_for_timeout(250)
  assert first not in ids() and len(ids())==3 and pg.locator('#plDetail li.prow').count()==3
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200);assert pg.locator('#tree .favck').count()==2 and lib(1).locator('.favck').count()==0,'unfavorited in library too'
  # addToPl and Save In do not offer the built-in lists
  assert ev("S.pls.filter(x=>!isBuiltin(x)).map(p=>p.name)")==['Mix']
  # deleting a clip removes it from Favorites
  ev("confirm=()=>true;deleteClip('%s')"%cid);pg.wait_for_timeout(400);assert cid not in ids()
  pg.reload();pg.wait_for_timeout(1200);assert len(ids())==2 and ev("S.pls[1].id")=='favs'
  assert not errs,errs
  b.close()
print('favorites OK')
