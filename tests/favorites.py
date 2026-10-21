# v26/v27 Favorites: press and hold (about 1 s) toggles Favorite on songs and clips, star marks in Library and playlists,
# short tap still plays, a moving finger does not toggle, no Favorite button in swipe menus,
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
  def c(loc):
    loc.scroll_into_view_if_needed();bb=loc.locator('.n').bounding_box();return bb['x']+min(40,bb['width']/2),bb['y']+bb['height']/2
  def swipe(loc):
    x,y=c(loc);x+=150;touch('touchStart',x,y)
    for k in range(1,11):touch('touchMove',x-280*k/10,y);time.sleep(0.016)
    touch('touchEnd',x-280,y);pg.wait_for_timeout(350)
  def hold(loc,secs=1.3,drift=0):
    x,y=c(loc);touch('touchStart',x,y);t0=time.time();k=0
    while time.time()-t0<secs:
      time.sleep(0.05);k+=1
      if drift:touch('touchMove',x+min(drift,k*2),y+min(drift,k*2)*0.3)
    touch('touchEnd',x,y);pg.wait_for_timeout(350)
  def tapq(loc):
    x,y=c(loc);touch('touchStart',x,y);time.sleep(0.08);touch('touchEnd',x,y);pg.wait_for_timeout(400)
  toast=lambda:ev("(document.getElementById('toast')||{}).textContent||''")
  lib=lambda i:pg.locator(f'#tree li.lrow:nth-child({i+2})')
  pli=lambda i:pg.locator(f'#plDetail li.prow:nth-child({i+1})')
  ids=lambda:ev("(S.pls.find(p=>p.id==='favs')||{ids:[]}).ids")
  playing=lambda:ev("S.Q?S.Q.list[S.Q.qi]:null")
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800);pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1500)
  assert ev("S.pls[0].id==='clips'&&S.pls[1].id==='favs'&&S.pls[1].builtin"),'Favorites playlist after Custom Clips'
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200)
  assert pg.locator('#tree .favck').count()==0
  # swipe menu has no Favorite button and the original widths
  swipe(lib(1));assert 'open' in lib(1).get_attribute('class') and lib(1).locator('.pfav').count()==0 and pg.locator('#tree button:has-text("Favorite")').count()==0
  assert ev("getComputedStyle(document.querySelector('#tree li.open .acts')).getPropertyValue('--bw').trim()")=='86px'
  ev('closeRow()');pg.wait_for_timeout(250)
  # rows do not select text or show the callout
  assert ev("getComputedStyle(document.querySelector('#tree li.lrow')).userSelect")=='none'
  # hold toggles on, shows toast, does not play
  assert playing() is None
  hold(lib(1));assert len(ids())==1 and toast()=='Added to Favorites' and lib(1).locator('.favck').count()==1,('hold on',ids(),toast())
  assert playing() is None,'a hold must not play'
  assert ev("[...document.querySelectorAll('.favck')].every(m=>m.textContent==='★')") and '✓' not in pg.inner_text('#tree'),'star mark'
  hold(lib(3));assert len(ids())==2
  # hold again toggles off
  hold(lib(3));assert len(ids())==1 and toast()=='Removed from Favorites' and lib(3).locator('.favck').count()==0
  # a moving finger (about 20 px) does not toggle and does not play
  hold(lib(3),drift=20);assert len(ids())==1 and playing() is None,'moving finger must not toggle'
  # a short tap still plays
  tapq(lib(2));assert playing()==ev("S.songs.find(s=>s.name==='tune2').id"),'short tap plays';assert len(ids())==1
  ev("au.pause()");hold(lib(3));assert len(ids())==2
  pg.screenshot(path='/workspace/shots/v27-library-stars.png')
  # color setting is respected
  ev("applyAccent('#f59e0b',true)");pg.wait_for_timeout(100)
  assert ev("getComputedStyle(document.querySelector('#tree .favck')).color")=='rgb(245, 158, 11)','accent color'
  # persistence
  pg.reload();pg.wait_for_timeout(1200);pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200)
  assert len(ids())==2 and lib(1).locator('.favck').count()==1 and lib(3).locator('.favck').count()==1 and pg.locator('#tree .favck').count()==2,'persisted'
  # user playlist: stars and hold toggle, swipe has no Favorite button
  ans['v']='Mix';pg.click('nav button[data-t=pls]');pg.click('#newPl');pg.wait_for_timeout(200)
  ev("S.pls.find(p=>p.name==='Mix').ids=S.songs.filter(s=>!s.clip).sort((a,b)=>a.path.localeCompare(b.path)).map(s=>s.id);savePls();S.openPl=S.pls.find(p=>p.name==='Mix').id;renderPls()");pg.wait_for_timeout(200)
  assert pli(1).locator('.favck').count()==1 and pli(0).locator('.favck').count()==0 and pg.locator('#plDetail .favck').count()==2,'stars in playlist'
  q0=playing();hold(pli(0));assert len(ids())==3 and pli(0).locator('.favck').count()==1 and playing()==q0,'playlist hold'
  n0=ev("S.pls.find(p=>p.name==='Mix').ids.slice()")
  hold(pli(2),drift=25);assert len(ids())==3 and ev("S.pls.find(p=>p.name==='Mix').ids")==n0,'drift in playlist: no toggle, no reorder'
  swipe(pli(2));assert pli(2).locator('.pfav').count()==0 and pli(2).locator('.prm').count()==1;ev('closeRow()');pg.wait_for_timeout(250)
  ev("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(2700)
  pg.screenshot(path='/workspace/shots/v27-stars.png')
  assert ev("[...document.querySelectorAll('#plDetail .favck')].every(m=>m.textContent==='★')"),'star in playlist'
  # Custom Clips: hold a clip
  ev("makeClip(S.songs.find(s=>!s.clip).id,5,9,'Bridge').then(()=>{S.openPl='clips';renderPls()})");pg.wait_for_function('S.songs.length===5');pg.wait_for_timeout(300)
  assert pg.locator('#plDetail li.prow').count()==1;hold(pli(0))
  cid=ev("S.songs.find(s=>s.clip).id");assert cid in ids() and pli(0).locator('.favck').count()==1,'clip fav'
  assert ev("S.pls.find(p=>p.id==='clips').ids.includes('%s')"%cid),'clip stays in Custom Clips'
  pg.wait_for_timeout(2700);pg.screenshot(path='/workspace/shots/v27-clips-stars.png')
  # Favorites playlist holds them all; hold there unfavorites; Remove there unfavorites
  ev("S.openPl='favs';renderPls()");pg.wait_for_timeout(200)
  assert pg.locator('#plDetail li.prow').count()==4 and pg.locator('#plDetail .favck').count()==4
  assert pg.locator('#plList li.builtinPl:has-text("Favorites (4)")').count()==1 and pg.locator('#plList li:has-text("Favorites") button:has-text("Delete")').count()==0
  ev("document.getElementById('plList').scrollIntoView({block:'start'})");pg.wait_for_timeout(2700)
  pg.screenshot(path='/workspace/shots/v27-favorites-playlist.png')
  last=ids()[-1];hold(pli(3));assert last not in ids() and len(ids())==3 and toast()=='Removed from Favorites' and pg.locator('#plDetail li.prow').count()==3,'hold in Favorites'
  ev(f"toggleFav('{last}')");assert len(ids())==4
  first=ids()[0];swipe(pli(0));pli(0).locator('.prm').click();pg.wait_for_timeout(250)
  assert first not in ids() and len(ids())==3 and pg.locator('#plDetail li.prow').count()==3
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200);assert pg.locator('#tree .favck').count()==2 and lib(1).locator('.favck').count()==0,'unfavorited in library too'
  assert ev("S.pls.filter(x=>!isBuiltin(x)).map(p=>p.name)")==['Mix']
  ev("confirm=()=>true;deleteClip('%s')"%cid);pg.wait_for_timeout(400);assert cid not in ids()
  pg.reload();pg.wait_for_timeout(1200);assert len(ids())==2 and ev("S.pls[1].id")=='favs'
  assert not errs,errs
  b.close()
print('favorites OK')
