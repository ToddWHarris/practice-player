# v20: remember tab + Library folder (subfolders) + open playlist across launches; graceful fallback; never autoplay
import os,subprocess,json
from playwright.sync_api import sync_playwright
D='/tmp/pp-restore';os.makedirs(D,exist_ok=True)
for n,fq in [('A',330),('B',440),('C',550)]:
  f=f'{D}/{n}.mp3'
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={fq}:duration=5','-c:a','libmp3lame','-b:a','64k',f],check=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844});pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.on('dialog',lambda d:d.accept('Mix') if d.type=='prompt' else d.accept())
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  pg.click('nav button[data-t=set]');pg.set_input_files('#inFiles',[f'{D}/{n}.mp3' for n in 'ABC']);pg.wait_for_timeout(1500)
  ev("""async()=>{const P={A:'Band/Live/A.mp3',B:'Band/Live/Deep/B.mp3',C:'Solo/C.mp3'};for(const s of S.songs){s.path=P[s.name];await DB.putMeta(s)}S.pls.push({id:'p1',name:'Mix',ids:S.songs.map(s=>s.id)},{id:'p2',name:'Other',ids:[]});savePls();renderAll()}""")
  pg.wait_for_timeout(300)
  def relaunch():
    pg.reload();pg.wait_for_timeout(1200)
  on=lambda:ev("document.querySelector('nav button.on').dataset.t")
  # 1. Library deep folder, with a song playing -> restored folder, paused, no autoplay
  pg.click('nav button[data-t=lib]');ev("S.cwd=[];renderLib()")
  for d in ['Band','Live','Deep']:pg.locator(f'#tree li.frow .n:text-is("📁 {d}")').click();pg.wait_for_timeout(150)
  pg.locator('#tree li.lrow .n').first.click();pg.wait_for_function('!audio.paused',timeout=6000)
  assert json.loads(ev("localStorage.getItem('pp-nav')"))['cwd']==['Band','Live','Deep']
  relaunch();assert on()=='lib' and ev('S.cwd')==['Band','Live','Deep'] and 'Deep' in pg.inner_text('#crumbs'),ev('S.cwd')
  assert pg.locator('#tree li.lrow .n:text-is("♪ B")').count()==1
  pg.wait_for_timeout(800);assert ev('audio.paused') and ev('audio.currentTime')==0,'never autoplays'
  assert 'B' in pg.inner_text('#now'),'last song shown, paused'
  # 2. Playlists tab with open playlist
  pg.click('nav button[data-t=pls]');ev("S.openPl='p1';renderPls()");pg.wait_for_timeout(100)
  relaunch();assert on()=='pls' and ev('S.openPl')=='p1' and pg.inner_text('#plDetail h3')=='Mix';assert ev('audio.paused')
  # 3. deleted playlist -> playlist list
  ev("S.pls=S.pls.filter(p=>p.id!=='p1');savePls()");pg.wait_for_timeout(300)
  relaunch();assert on()=='pls' and ev('S.openPl')==None and pg.locator('#plDetail h3').count()==0 and pg.locator('#plList li').count()==3
  # 4. Settings / Help -> Library (folder kept)
  pg.click('nav button[data-t=set]');relaunch();assert on()=='lib'
  pg.click('nav button[data-t=help]');relaunch();assert on()=='lib' and ev('S.cwd')==['Band','Live','Deep']
  # 5. saved folder removed -> nearest existing parent
  ev("""async()=>{for(const s of S.songs)if(s.name==='B'){s.removed=true;s.removedAt=1;s.removedGroup='Band/Live/Deep';await DB.putMeta(s)}}""");pg.wait_for_timeout(300)
  relaunch();assert ev('S.cwd')==['Band','Live'],ev('S.cwd')
  ev("""async()=>{for(const s of S.songs)if(s.name==='A'){s.removed=true;s.removedAt=1;await DB.putMeta(s)}}""");ev("localStorage.setItem('pp-nav',JSON.stringify({tab:'lib',cwd:['Band','Live','Deep'],pl:null}))")
  relaunch();assert ev('S.cwd')==[] and on()=='lib','falls back to Home'
  # 6. garbage in storage is ignored
  ev("localStorage.setItem('pp-nav','{bad')");relaunch();assert on()=='lib' and ev('S.cwd')==[]
  # 7. saved on hide
  ev("S.cwd=['Solo'];document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'))")
  assert json.loads(ev("localStorage.getItem('pp-nav')"))['cwd']==['Solo']
  pg.click('nav button[data-t=help]');h=pg.inner_text('#helpBody');assert 'remembers where you were' in h
  assert ev('RELEASE_NOTES[20].length')>=1 and '\u2014' not in ''.join(ev('RELEASE_NOTES[20]'))
  b.close()
assert not errs,errs;print('restore ok')
