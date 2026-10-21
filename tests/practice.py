# Per-song speed/pitch: popup edits current song, independent per song, swipe toggle (Library + Playlists), badge, live apply,
# reload persistence, worklet only when needed, A-B at 75%, offline worklet, delete forever clears
import os,subprocess,re,time
from playwright.sync_api import sync_playwright
D='/tmp/pp-pr';os.makedirs(D,exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
for n,fq in [('A',330),('B',440),('C',550)]:
  f=f'{D}/{n}.mp3'
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={fq}:duration=30','-c:a','libmp3lame','-b:a','64k',f],check=True)
V=re.search(r'const V=(\d+)',open('sw.js').read()).group(1)
MOCK="""window.SpeechRecognition=window.webkitSpeechRecognition=class{start(){}abort(){}stop(){}};navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
window.__mes=0;const _c=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(e){__mes++;return _c.call(this,e)};
window.__ctx=0;const AC=window.AudioContext;window.AudioContext=class extends AC{constructor(...a){super(...a);__ctx++}};"""
errs=[];ans={'v':'1'}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.add_init_script(MOCK);pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.on('dialog',lambda d:d.accept(ans['v']) if d.type=='prompt' else d.accept());cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(sel,st=150,dist=300):
    bb=pg.locator(sel).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;touch('touchStart',x+st,y)
    for k in range(1,11):touch('touchMove',x+st-dist*k/10,y);time.sleep(0.016)
    touch('touchEnd',x+st-dist,y);pg.wait_for_timeout(350)
  ev=pg.evaluate;rate=lambda:ev('audio.playbackRate');now=lambda:pg.inner_text('#now')
  def setPR(speed,pitch):
    pg.click('nav button[data-t=set]');pg.click('#prBtn');pg.evaluate(f"s=document.getElementById('spd');s.value={speed};s.dispatchEvent(new Event('input'))")
    pg.evaluate(f"p=document.getElementById('pit');p.value={pitch};p.dispatchEvent(new Event('input'))");pg.wait_for_timeout(300);pg.click('#prDone');pg.wait_for_timeout(200);pg.click('nav button[data-t=lib]')
  def go(name):pg.tap(f'#tree li.lrow:has(.n:text-is("♪ {name}")) .n');pg.wait_for_function(f"document.getElementById('now').textContent.startsWith('{name}')&&audio.readyState>0",timeout=6000);pg.wait_for_timeout(300)
  pg.goto('http://localhost:8765/');pg.wait_for_function('navigator.serviceWorker.controller',timeout=10000)
  # no song loaded: section disabled
  pg.click('nav button[data-t=set]');pg.click('#prBtn');assert ev("document.getElementById('prSect').disabled") and pg.is_visible('#prNoSong') and 'Play a song' in pg.inner_text('#prNoSong');pg.click('#prCancel')
  pg.set_input_files('#inFiles',[f'{D}/{n}.mp3' for n in 'ABC']);pg.wait_for_timeout(1200)
  ans['v']='Mix';pg.click('nav button[data-t=pls]');pg.click('#newPl');ans['v']='1';ev("S.pls.filter(p=>!p.builtin)[0].ids=S.songs.map(s=>s.id).sort();savePls()")
  pg.click('nav button[data-t=lib]');assert ev('__ctx')==0
  # A: 75% / -2
  go('A');pg.click('nav button[data-t=set]');pg.click('#prBtn');assert pg.inner_text('#prSong')=='A' and not ev("document.getElementById('prSect').disabled")
  pg.click('.spdq[data-v="75"]');assert rate()==0.75 and ev('audio.preservesPitch')==True,'live'
  pg.click('#pitM');pg.click('#pitM');pg.wait_for_timeout(500);assert ev('!!PR.node') and ev('__mes')==1,'worklet created for pitch'
  pg.screenshot(path='/workspace/shots/v17-loop-popup.png')
  pg.click('#prDone');pg.wait_for_timeout(200);pg.click('nav button[data-t=lib]')
  assert pg.inner_text('#prInd')=='75% · -2 st'
  # B: 110% / +1 ; switching applies/clears
  go('B');assert rate()==1 and ev('PR.pitch')==0 and not pg.is_visible('#prInd'),'B starts normal'
  setPR(110,1);assert rate()==1.1 and ev('PR.pitch')==1 and pg.inner_text('#prInd')=='110% · +1 st'
  go('C');assert rate()==1 and ev('PR.pitch')==0 and not pg.is_visible('#prInd'),'C untouched'
  go('A');assert rate()==0.75 and ev('PR.pitch')==-2
  go('B');assert rate()==1.1 and ev('PR.pitch')==1
  st=ev('Object.fromEntries(Object.entries(S.pr).map(([k,v])=>[byId(k).name,v]))');assert st=={'A':{'speed':0.75,'pitch':-2,'enabled':True},'B':{'speed':1.1,'pitch':1,'enabled':True}},st
  # Cancel reverts only the live change on B
  pg.click('nav button[data-t=set]');pg.click('#prBtn');pg.click('.spdq[data-v="50"]');assert rate()==0.5;pg.click('#prCancel');assert rate()==1.1 and ev('S.pr[cur()].speed')==1.1
  pg.click('nav button[data-t=lib]')
  # badges
  bad=lambda n:pg.locator(f'#tree li.lrow:has(.n:text-is("♪ {n}")) .prBadge')
  assert bad('A').inner_text()=='75% · -2 st' and bad('B').inner_text()=='110% · +1 st' and bad('C').count()==0
  # Library swipe toggle on A (not playing): only A changes, B keeps playing at 1.1
  swipe('#tree li.lrow:has(.n:text-is("♪ A"))');tg='#tree li.lrow:has(.n:text-is("♪ A")) .ptog';assert pg.inner_text(tg).replace('\n',' ')=='Speed On 75% -2' and 'on' in pg.get_attribute(tg,'class')
  assert pg.locator('#tree li.lrow:has(.n:text-is("♪ C")) .ptog').count()==0
  pg.tap(tg);pg.wait_for_timeout(300);assert ev('Object.values(S.pr).map(v=>v.enabled)')==[False,True] or ev("S.pr[S.songs.find(s=>s.name==='A').id].enabled")==False
  assert ev("S.pr[S.songs.find(s=>s.name==='B').id].enabled")==True and rate()==1.1 and 'off' in bad('A').get_attribute('class')
  # toggle B (playing) off -> live 1.0, on -> 1.1
  swipe('#tree li.lrow:has(.n:text-is("♪ B"))');pg.tap('#tree li.lrow:has(.n:text-is("♪ B")) .ptog');pg.wait_for_timeout(300);assert rate()==1 and ev('PR.pitch')==0 and not pg.is_visible('#prInd')
  assert ev("S.pr[S.songs.find(s=>s.name==='A').id].enabled")==False,'A unchanged'
  swipe('#tree li.lrow:has(.n:text-is("♪ B"))');assert 'Speed Off' in pg.inner_text('#tree li.lrow:has(.n:text-is("♪ B")) .ptog');pg.tap('#tree li.lrow:has(.n:text-is("♪ B")) .ptog');pg.wait_for_timeout(300);assert rate()==1.1 and ev('PR.pitch')==1
  # Playlist swipe toggle on A back on
  pg.click('nav button[data-t=pls]');pg.locator('#plList li:not(.builtinPl) .n').first.click();pr='#plDetail li.prow:has(.n:text-is("A"))'
  assert pg.locator(pr+' .prBadge.off').count()==1;swipe(pr,80,260);assert 'Speed Off' in pg.inner_text(pr+' .ptog');pg.tap(pr+' .ptog');pg.wait_for_timeout(300)
  assert ev("S.pr[S.songs.find(s=>s.name==='A').id].enabled")==True and rate()==1.1 and pg.locator(pr+' .prBadge.off').count()==0
  pg.tap(pr+' .n');pg.wait_for_function("document.getElementById('now').textContent.startsWith('A')");pg.wait_for_timeout(300);assert rate()==0.75,'A plays at its own speed'
  # A-B loop at 75% stops at B
  ev('S.A=1;S.B=2.5;renderMarks()');pg.click('#abBox summary');pg.click('#abOn');pg.wait_for_function('S.waiting',timeout=8000)
  t=ev('audio.currentTime');assert abs(t-2.5)<0.1 and rate()==0.75,t;pg.click('#again');pg.wait_for_timeout(300);assert ev('!audio.paused&&audio.currentTime<2');pg.click('#abOn')
  # audio flows through worklet
  sig=ev("""async()=>{await PR.ctx.resume();audio.play();const an=PR.ctx.createAnalyser();PR.node.connect(an);await new Promise(r=>setTimeout(r,500));const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);return Math.max(...d.map(Math.abs))}""");assert sig>0.01,sig
  # Reset this song (A) needs Done
  pg.click('nav button[data-t=set]');pg.click('#prBtn');pg.click('#prSongReset');assert rate()==1;pg.click('#prCancel');assert rate()==0.75
  pg.click('#prBtn');pg.click('#prSongReset');pg.click('#prDone');pg.wait_for_timeout(200);assert ev("!S.pr[S.songs.find(s=>s.name==='A').id]") and rate()==1
  # reload: persistence, no AudioContext until a pitched song plays
  setPR(75,-2)
  pg.reload();pg.wait_for_timeout(1000);assert ev('__ctx')==0;pg.click('nav button[data-t=lib]')
  assert bad('A').inner_text()=='75% · -2 st' and bad('B').inner_text()=='110% · +1 st'
  go('C');assert rate()==1 and ev('__ctx')==0;go('B');assert rate()==1.1 and ev('PR.pitch')==1
  # remove/restore keeps; delete forever clears
  swipe('#tree li.lrow:has(.n:text-is("♪ B"))');pg.tap('#tree li.lrow:has(.n:text-is("♪ B")) .prm');pg.wait_for_timeout(300);pg.locator('#tree li.remfolder').click()
  swipe('#tree li.rrow:has(.n span:text-is("♪ B"))');pg.tap('#tree li.rrow:has(.n span:text-is("♪ B")) .padd');pg.wait_for_timeout(300);assert ev("S.pr[S.songs.find(s=>s.name==='B').id].speed")==1.1
  pg.click('#crumbs a:has-text("Home")') if pg.locator('#crumbs a:has-text("Home")').count() else None
  swipe('#tree li.lrow:has(.n:text-is("♪ A"))');pg.tap('#tree li.lrow:has(.n:text-is("♪ A")) .prm');pg.wait_for_timeout(300);pg.locator('#tree li.remfolder').click()
  idA=ev("S.songs.find(s=>s.name==='A').id");swipe('#tree li.rrow:has(.n span:text-is("♪ A"))');pg.tap('#tree li.rrow:has(.n span:text-is("♪ A")) .prm');pg.wait_for_timeout(500)
  assert ev(f"!S.pr['{idA}']") and ev(f"DB.get('pr:{idA}').then(v=>v===undefined)"),'delete forever clears'
  # offline worklet
  assert ev(f"caches.open('pp-v{V}').then(c=>c.match('./pitch-worklet.js')).then(r=>!!r)");ctx.set_offline(True);pg.reload();pg.wait_for_timeout(800);assert ev("fetch('pitch-worklet.js').then(r=>r.ok)")
  b.close()
assert not errs,errs;print('practice ok')
