# Playlist rows: touch drag reorder (grip + long press), swipe to Remove, vertical scroll. Uses real CDP touch events.
import os,subprocess,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-pl';os.makedirs(D,exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
files=[]
for i in range(14):
  f=f'{D}/song{i:02d}.mp3';files.append(f)
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={300+i*20}:duration=4','-c:a','libmp3lame','-b:a','64k',f],check=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept('Set'))
  cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def gesture(x0,y0,x1,y1,steps=12,hold=0,dt=0.016):
    touch('touchStart',x0,y0)
    if hold:time.sleep(hold)
    for k in range(1,steps+1):touch('touchMove',x0+(x1-x0)*k/steps,y0+(y1-y0)*k/steps);time.sleep(dt)
    touch('touchEnd',x1,y1);pg.wait_for_timeout(350)
  names=lambda:pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids.map(id=>byId(id).name)")
  rowbox=lambda i,sel='.n':pg.locator(f'#plDetail li.prow:nth-child({i+1}) {sel}').bounding_box()
  ctr=lambda bb:(bb['x']+bb['width']/2,bb['y']+bb['height']/2)
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800);pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1500)
  pg.click('nav button[data-t=pls]');pg.click('#newPl');pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids=S.songs.map(s=>s.id).sort();savePls();S.openPl=S.pls.filter(p=>!p.builtin)[0].id;renderPls()");pg.wait_for_timeout(200)
  orig=names();assert pg.locator('#plDetail li.prow').count()==14 and pg.locator('#plDetail button:has-text("↑")').count()==0 and pg.locator('#plDetail .grip').count()==14
  # 1. grip drag: row 0 -> position 3
  pg.evaluate("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(200)
  gx,gy=ctr(rowbox(0,'.grip'));_,ty=ctr(rowbox(2));gesture(gx,gy,gx,ty+4,steps=16)
  n=names();assert n[:3]==orig[1:3]+[orig[0]],(n,gy,ty,pg.evaluate('document.querySelector("main").scrollTop'))
  # persists after reload
  pg.reload();pg.wait_for_timeout(1000);pg.click('nav button[data-t=pls]');pg.locator('#plList li:not(.builtinPl) .n').first.click();pg.wait_for_timeout(200)
  assert names()==n and pg.inner_text('#plDetail li.prow:nth-child(3) .n')==orig[0],'persisted'
  # 1b. auto-scroll: hold a dragged row near the bottom edge (v26: Favorites adds a row above, so scroll the list into view first)
  pg.evaluate("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(200)
  gx,gy=ctr(rowbox(1,'.grip'));mb=pg.locator('main').bounding_box();touch('touchStart',gx,gy)
  for k in range(1,9):touch('touchMove',gx,gy+(mb['y']+mb['height']-8-gy)*k/8);time.sleep(0.02)
  time.sleep(0.8);st=pg.evaluate("document.querySelector('main').scrollTop");touch('touchEnd',0,0);pg.wait_for_timeout(300)
  assert st>50,('autoscroll',st);na=names();assert na.index(n[1])>4,na
  pg.evaluate("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(100);n=na
  # 2. long-press drag on the name: row 4 -> top
  x,y=ctr(rowbox(2));_,ty=ctr(rowbox(0));gesture(x,y,x,ty-6,steps=14,hold=0.5)
  n2=names();assert n2[0]==n[2],(n2[:3],n[2])
  # 3. vertical scroll still works (quick flick on names, no long press)
  sc=pg.locator('main');top0=pg.evaluate("document.querySelector('main').scrollTop")
  x,y=ctr(rowbox(2));gesture(x,y,x,y-300,steps=10,dt=0.01);pg.wait_for_timeout(500)
  top1=pg.evaluate("document.querySelector('main').scrollTop");assert top1>top0+100,('scroll',top0,top1);assert names()==n2,'no reorder from scroll'
  pg.evaluate("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(200)
  # 4. swipe left on row 2 reveals Remove, nothing removed
  x,y=ctr(rowbox(2));gesture(x+60,y,x-120,y,steps=10)
  assert pg.locator('#plDetail li.prow:nth-child(3)').get_attribute('class').find('open')>=0
  rb=pg.locator('#plDetail li.prow:nth-child(3) .prm').bounding_box();rx,ry=ctr(rb)
  assert pg.evaluate(f"document.elementFromPoint({rx},{ry}).classList.contains('prm')"),'Remove exposed';assert names()==n2 and len(names())==14
  pg.screenshot(path='/workspace/shots/v13-swipe.png')
  # 5. swipe right closes, nothing removed
  gesture(x-40,y,x+120,y,steps=10);assert 'open' not in pg.locator('#plDetail li.prow:nth-child(3)').get_attribute('class') and names()==n2
  assert not pg.evaluate(f"document.elementFromPoint({rx},{ry}).classList.contains('prm')")
  # 6. short swipe snaps back
  gesture(x+40,y,x+10,y,steps=6);assert 'open' not in pg.locator('#plDetail li.prow:nth-child(3)').get_attribute('class')
  # 7. tapping the open row closes it without playing; swiping another row closes the first; only one open
  gesture(x+60,y,x-120,y);pg.tap('#plDetail li.prow:nth-child(3) .n');pg.wait_for_timeout(300)
  assert 'open' not in pg.locator('#plDetail li.prow:nth-child(3)').get_attribute('class') and pg.evaluate('!S.Q'),'tap closes, no play'
  gesture(x+60,y,x-120,y);x5,y5=ctr(rowbox(0));gesture(x5+60,y5,x5-120,y5)
  assert pg.locator('#plDetail li.prow.open').count()==1 and 'open' in pg.locator('#plDetail li.prow:nth-child(1)').get_attribute('class')
  gesture(x5-40,y5,x5+120,y5)
  # 8. play row 1, then swipe and Remove the playing song: keeps playing, queue fixed, library intact
  pg.tap('#plDetail li.prow:nth-child(2) .n');pg.wait_for_function('!audio.paused',timeout=5000);playing=n2[1]
  x1,y1=ctr(rowbox(1));gesture(x1+60,y1,x1-120,y1);pg.tap('#plDetail li.prow:nth-child(2) .prm');pg.wait_for_timeout(300)
  n3=names();assert len(n3)==13 and playing not in n3,'removed from playlist';assert pg.evaluate('S.songs.length')==14 and pg.evaluate('S.songs.every(s=>!s.removed)'),'still in library, not in Removed'
  assert not pg.evaluate('audio.paused') and pg.inner_text('#now')==playing,'keeps playing'
  pg.tap('#next');pg.wait_for_timeout(600);assert pg.inner_text('#now')==n3[1],('next after removed',pg.inner_text('#now'),n3[1])
  assert pg.evaluate('S.Q.list.length')==13 and (str(pg.evaluate('S.Q.qi+1'))+' of 13') in pg.inner_text('#cMeta')
  # 9. drag while queue active keeps the playing song current
  cur=pg.inner_text('#now');gx,gy=ctr(rowbox(0,'.grip'));_,ty=ctr(rowbox(2));gesture(gx,gy,gx,ty+4,steps=16)
  assert pg.evaluate('byId(cur()).name')==cur and pg.evaluate('S.Q.list.map(id=>byId(id).name)')==names(),'queue follows playlist order'
  pg.reload();pg.wait_for_timeout(1000);assert len(pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids"))==13
  b.close()
assert not errs,errs;print('playlist gestures ok')
