# Library rows: clean names, swipe left shows Add to list + Delete; Add to list works; Delete needs tap + confirm
import os,subprocess,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-pl';os.makedirs(D,exist_ok=True)
files=[]
for i in range(5):
  f=f'{D}/song{i:02d}.mp3';files.append(f)
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={300+i*20}:duration=4','-c:a','libmp3lame','-b:a','64k',f],check=True)
errs=[];dialogs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  answer={'v':'1'}
  def dlg(d):dialogs.append((d.type,d.message));(d.accept(answer['v']) if d.type=='prompt' else (d.accept() if answer.get('ok',True) else d.dismiss()))
  pg.on('dialog',dlg);cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def gesture(x0,y0,x1,y1,steps=10):
    touch('touchStart',x0,y0)
    for k in range(1,steps+1):touch('touchMove',x0+(x1-x0)*k/steps,y0+(y1-y0)*k/steps);time.sleep(0.016)
    touch('touchEnd',x1,y1);pg.wait_for_timeout(350)
  row=lambda i:pg.locator(f'#tree li.lrow:nth-child({i+2})')
  ctr=lambda bb:(bb['x']+bb['width']/2,bb['y']+bb['height']/2)
  def swipe(i,left=True):
    bb=row(i).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2
    gesture(x+60,y,x-170,y) if left else gesture(x-60,y,x+170,y)
  isopen=lambda i:'open' in (row(i).get_attribute('class') or '')
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800);pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1200)
  answer['v']='Set';pg.click('nav button[data-t=pls]');pg.click('#newPl');answer['v']='1'
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200)
  assert row(0).locator('.pfg').inner_text().strip()=='♪ song00' and pg.locator('#tree .pfg button').count()==0,('clean rows',pg.inner_text('#tree'))
  assert pg.locator('#tree li:has-text("+List")').count()==0
  dialogs.clear()
  # swipe reveals both buttons, nothing changes
  swipe(1);assert isopen(1)
  for sel in ['.padd','.prm']:
    x,y=ctr(row(1).locator(sel).bounding_box());assert pg.evaluate(f"document.elementFromPoint({x},{y}).classList.contains('{sel[1:]}')"),sel
  pg.screenshot(path='/workspace/shots/v14-library-swipe.png')
  assert pg.evaluate('S.songs.length')==5 and dialogs==[]
  # swipe right closes; tap row closes without playing; another row's swipe closes the first
  swipe(1,False);assert not isopen(1)
  swipe(1);pg.tap('#tree li.lrow:nth-child(3) .n');pg.wait_for_timeout(300);assert not isopen(1) and pg.evaluate('!S.Q'),'tap closes, no play'
  swipe(1);swipe(3);assert not isopen(1) and isopen(3) and pg.locator('#tree li.open').count()==1;swipe(3,False)
  # Add to list
  swipe(2);pg.tap('#tree li.lrow:nth-child(4) .padd');pg.wait_for_timeout(300)
  assert dialogs and dialogs[-1][0]=='prompt';assert pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids.map(id=>byId(id).name)")==['song02'] and not isopen(2)
  # Remove: swipe alone changes nothing; tap Remove hides it (no erase, no confirm)
  n=len(dialogs);swipe(4);assert pg.evaluate('S.songs.filter(s=>!s.removed).length')==5 and len(dialogs)==n
  assert row(4).locator('.prm').inner_text()=='Remove'
  pg.tap('#tree li.lrow:nth-child(6) .prm');pg.wait_for_timeout(500);assert len(dialogs)==n and pg.evaluate('S.songs.length')==5 and pg.evaluate('S.songs.filter(s=>!s.removed).length')==4
  assert 'song04' not in pg.locator('#tree li.lrow').all_inner_texts().__str__() and 'Removed (1)' in pg.inner_text('#tree')
  # tap plays; folder rows unchanged
  pg.tap('#tree li.lrow:nth-child(2) .n');pg.wait_for_function('!audio.paused',timeout=5000);assert pg.inner_text('#now')=='song00'
  pg.reload();pg.wait_for_timeout(900);pg.click('nav button[data-t=lib]');assert pg.evaluate('S.songs.filter(s=>!s.removed).length')==4 and pg.evaluate('S.songs.length')==5 and len(pg.evaluate('S.pls.filter(p=>!p.builtin)[0].ids'))==1
  b.close()
assert not errs,errs;print('library swipe ok')
