# Run: python3 -m http.server 8765 (in mp3player) then python3 tests/e2e.py
import subprocess,os
from playwright.sync_api import sync_playwright
T='/tmp/pp-e2e';errs=[];files=[]
for d in ('A','B'):
  os.makedirs(f'{T}/{d}',exist_ok=True)
  for i in range(4):
    f=f'{T}/{d}/{d}{i}.mp3';files.append(f)
    if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={300+i*50}:duration=2',f],check=True)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page()
  pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('dialog',lambda d:d.accept('Mix'))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1000)
  # import via file picker has no folder path, so put songs in folders A and B
  pg.evaluate("""async()=>{for(const s of S.songs){const b=await DB.blob(s.id);await DB.delSong(s.id);s.path=s.name[0]+'/'+s.name+'.mp3';s.id=s.path;await DB.putSong(s,b)}S.songs=await DB.allSongs();
   const order=['A0','B0','A1','B1','A2','B2','A3','B3'].map(n=>n[0]+'/'+n+'.mp3');S.pls=[{id:'p1',name:'Mix',ids:order}];await savePls();renderAll()}""")
  name=lambda:pg.inner_text('#now')
  pg.click('nav button[data-t=pls]');pg.click('#plList li:not(.builtinPl)');pg.click('#plDetail li:nth-child(1)');pg.wait_for_timeout(400)
  assert pg.inner_text('#from')=='Playing from: Mix',pg.inner_text('#from')
  seen=[name()]
  for _ in range(3):pg.click('#next');pg.wait_for_timeout(300);seen.append(name())
  assert seen==['A0','B0','A1','B1'],seen
  pg.click('#prev');pg.wait_for_timeout(300);assert name()=='A1',name()
  pg.evaluate("audio.currentTime=audio.duration-0.2");pg.wait_for_timeout(1200);assert name()=='B1','auto '+name()
  pg.evaluate("navigator.mediaSession&&0");pg.evaluate("step(1)");pg.wait_for_timeout(300);assert name()=='A2','lock '+name()
  pg.click('#shuf');pg.wait_for_timeout(200);q=pg.evaluate('S.Q.list');assert q[0]=='A/A2.mp3' and sorted(q)==sorted(pg.evaluate('S.pls.filter(p=>!p.builtin)[0].ids')),q
  for _ in range(7):pg.click('#next');pg.wait_for_timeout(200)
  pg.click('#shuf');assert pg.evaluate('S.Q.list')==pg.evaluate('S.pls.filter(p=>!p.builtin)[0].ids');pg.wait_for_timeout(400)
  pg.reload();pg.wait_for_timeout(900);assert pg.inner_text('#from')=='Playing from: Mix'
  c=name();pg.click('#next');pg.wait_for_timeout(300);order=['A0','B0','A1','B1','A2','B2','A3','B3']
  assert name()==order[(order.index(c)+1)%8] or c=='B3',(c,name())
  pg.click('nav button[data-t=lib]');pg.click('#tree li:has-text("A")');pg.click('#tree li:has-text("A1")');pg.wait_for_timeout(300)
  assert pg.inner_text('#from')=='Playing from: Folder A';pg.click('#next');pg.wait_for_timeout(300);assert name()=='A2'
  b.close()
assert not errs,errs
print('e2e ok')
