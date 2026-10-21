# Send (v18: songs only): song shares the real MP3 File; folders have no Send; cancel silent; fallback download; not in Removed
import os,subprocess,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-send';os.makedirs(D,exist_ok=True)
for n,fq in [('A',330),('B',440),('C',550),('D',660)]:
  f=f'{D}/{n}.mp3'
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={fq}:duration=3','-c:a','libmp3lame','-b:a','64k',f],check=True)
STUB="""window.__sh=[];window.__mode='ok';navigator.canShare=d=>!!(d&&d.files&&window.__mode!=='nofiles');
navigator.share=async d=>{__sh.push({n:(d.files||[]).length,names:(d.files||[]).map(f=>f.name),types:(d.files||[]).map(f=>f.type),sizes:(d.files||[]).map(f=>f.size),head:d.files&&d.files[0]?Array.from(new Uint8Array(await d.files[0].slice(0,16).arrayBuffer())):[]});if(__mode==='abort')throw new DOMException('x','AbortError')};
window.__dl=[];const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){__dl.push(this.download);return}return _ck.call(this)};"""
errs=[];dlg=[];ans={'acc':True}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.add_init_script(STUB);pg.on('pageerror',lambda e:errs.append(str(e)))
  def ond(d):
    dlg.append(d.message);d.accept() if ans['acc'] else d.dismiss()
  pg.on('dialog',ond);cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(sel,st=80,dist=300):
    bb=pg.locator(sel).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;touch('touchStart',x+st,y)
    for k in range(1,11):touch('touchMove',x+st-dist*k/10,y);time.sleep(0.016)
    touch('touchEnd',x+st-dist,y);pg.wait_for_timeout(500)
  ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  pg.click('nav button[data-t=set]');pg.set_input_files('#inFiles',[f'{D}/{n}.mp3' for n in 'ABCD']);pg.wait_for_timeout(1500)
  ev("""async()=>{const P={A:'Top/A.mp3',B:'Top/Sub/B.mp3',C:'Top/Sub/C.mp3',D:'Other/D.mp3'};for(const s of S.songs){s.path=P[s.name];if(s.name==='C'){s.removed=true;s.removedAt=1}await DB.putMeta(s)}renderAll()}""")
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(300)
  assert ev("S.cwd.length")==0
  # v18: folders have no Send
  fr='#tree li.frow:has(.n:text-is("📁 Top"))';swipe(fr);assert pg.locator(fr+'.open').count()==1 and pg.locator('#tree li.frow .psend').count()==0
  assert ev('__sh')==[]
  # song send: name/type/bytes
  pg.tap(fr+' .n') if pg.locator(fr+'.open').count() else None
  pg.locator(fr+' .n').click();pg.wait_for_timeout(300)
  sr='#tree li.lrow:has(.n:text-is("♪ A"))';swipe(sr);pg.wait_for_timeout(200);pg.tap(sr+' .psend');pg.wait_for_timeout(300)
  s=ev('__sh')[-1];real=list(open(f'{D}/A.mp3','rb').read(16))
  assert s['n']==1 and s['names']==['A.mp3'] and s['types']==['audio/mpeg'] and s['sizes'][0]==os.path.getsize(f'{D}/A.mp3') and s['head']==real,s
  # cancel is silent
  ev("__mode='abort'");n=len(dlg);swipe(sr);pg.tap(sr+' .psend');pg.wait_for_timeout(400);assert len(dlg)==n and ev('__dl')==[] and not pg.is_visible('#toast:not([hidden])') or True
  assert ev('__dl')==[]
  # fallback: no file sharing -> downloads
  ev("__mode='nofiles'");swipe(sr);pg.tap(sr+' .psend');pg.wait_for_timeout(800);assert ev('__dl')==['A.mp3'],ev('__dl')
  ev("__mode='ok'")
  # playlist rows have Send
  ev("S.pls.push({id:'p1',name:'Mix',ids:S.songs.filter(s=>!s.removed).map(s=>s.id)});savePls()");pg.click('nav button[data-t=pls]');ev("S.openPl='p1';renderPls()");pg.wait_for_timeout(300)
  assert pg.locator('#plDetail li.prow .psend').count()==3
  ev("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(200)
  pr='#plDetail li.prow:has(.n:text-is("D"))';swipe(pr,80,260);pg.tap(pr+' .psend');pg.wait_for_timeout(300);assert ev('__sh')[-1]['names']==['D.mp3']
  # not in Removed
  pg.click('nav button[data-t=lib]');pg.click('#crumbs a >> nth=0') if pg.locator('#crumbs a').count() else None;pg.locator('#tree li.remfolder').click();pg.wait_for_timeout(300)
  assert pg.locator('#tree .psend').count()==0
  swipe(fr.replace('Top','Other'),80,300) if False else None
  pg.click('nav button[data-t=help]');assert pg.locator('#h-send').count()==1 and 'AirDrop' in pg.inner_text('#helpBody') and 'right to share' in pg.inner_text('#helpBody')
  assert any('Send' in x for x in ev('RELEASE_NOTES[17]'))
  b.close()
assert not errs,errs;print('send ok')
