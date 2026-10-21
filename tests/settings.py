# Settings hides the player and pauses playback; Library shows it again with position kept
import os,subprocess
from playwright.sync_api import sync_playwright
f='/tmp/pp-e2e/long.mp3';os.makedirs('/tmp/pp-e2e',exist_ok=True)
if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=330:duration=60',f],check=True)
MOCK="""window.__recs=[];class FakeSR{constructor(){__recs.push(this)}start(){this.running=true}abort(){this.running=false;this.aborted=true}stop(){this.running=false}}
window.SpeechRecognition=window.webkitSpeechRecognition=FakeSR;navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});"""
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);pg=ctx.new_page();pg.add_init_script(MOCK);pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800);pg.set_input_files('#inFiles',[f]);pg.wait_for_timeout(1000)
  pg.click('nav button[data-t=lib]');assert pg.is_visible('#player')
  pg.click('#tree li:nth-child(2) .n');pg.wait_for_function('!audio.paused&&audio.currentTime>1',timeout=8000)
  # also have a voice loop waiting at B
  pg.evaluate('S.A=0;S.B=audio.currentTime+0.3;renderMarks()');pg.click('#abBox summary');pg.click('#abOn');pg.wait_for_function('S.waiting',timeout=5000)
  pos=pg.evaluate('audio.currentTime');rec=pg.evaluate('__recs.length')
  pg.click('nav button[data-t=set]');pg.wait_for_timeout(300)
  assert not pg.is_visible('#player') and not pg.is_visible('#again') and not pg.is_visible('#play'),'player hidden'
  assert pg.evaluate('audio.paused'),'paused';assert pg.evaluate('!S.waiting&&!S.ab&&!S.rec'),'loop/listen stopped'
  assert pg.evaluate(f'__recs[{rec}-1].aborted'),'mic released'
  last=pg.locator('#set > *').last;last.scroll_into_view_if_needed();lb=last.bounding_box();mb=pg.locator('main').bounding_box()
  assert lb['y']+lb['height']<=mb['y']+mb['height']+1 and lb['y']>=mb['y'],('last line visible',lb,mb)
  pass
  pg.wait_for_timeout(500);assert pg.evaluate('audio.paused'),'no auto resume'
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(300)
  assert pg.is_visible('#player') and pg.evaluate('audio.paused'),'visible, not resumed'
  p2=pg.evaluate('audio.currentTime');assert abs(p2-pos)<0.6,(pos,p2);assert pg.evaluate('S.Q&&S.Q.list.length')==1
  pg.click('#play');pg.wait_for_timeout(500);assert not pg.evaluate('audio.paused') and pg.evaluate('audio.currentTime')>=p2,'resumes'
  pg.click('nav button[data-t=pls]');assert pg.is_visible('#player')
  b.close()
assert not errs,errs;print('settings ok')
