# v19: losing focus (hidden + visibilitychange, blur, pagehide, freeze) never pauses; pitch 0 means no Web Audio;
# pitch back to 0 swaps to a plain <audio>; unexpected background pause resumes on return; A-B waiting survives hiding
import os,subprocess
from playwright.sync_api import sync_playwright
f='/tmp/pp-bg.mp3'
if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=440:duration=40','-c:a','libmp3lame','-b:a','64k',f],check=True)
INIT="""window.__ms={};if(navigator.mediaSession){const o=navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);navigator.mediaSession.setActionHandler=(a,f)=>{__ms[a]=f;try{o(a,f)}catch(e){}}}
window.SpeechRecognition=window.webkitSpeechRecognition=class{start(){__rs++}abort(){}stop(){}};window.__rs=0;navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
window.__hidden=false;Object.defineProperty(Document.prototype,'hidden',{get(){return __hidden},configurable:true});Object.defineProperty(Document.prototype,'visibilityState',{get(){return __hidden?'hidden':'visible'},configurable:true});
window.__ctx=0;const AC=window.AudioContext;window.AudioContext=class extends AC{constructor(...a){super(...a);__ctx++}};
window.goAway=()=>{__hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));document.dispatchEvent(new Event('freeze'))};
window.comeBack=()=>{__hidden=false;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.dispatchEvent(new Event('focus'))};"""
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  pg=b.new_page(viewport={'width':390,'height':844});pg.add_init_script(INIT);pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  pg.click('nav button[data-t=set]');pg.set_input_files('#inFiles',f);pg.wait_for_timeout(1200)
  pg.click('nav button[data-t=lib]');pg.locator('#tree li.lrow .n').first.click();pg.wait_for_function('!audio.paused&&audio.currentTime>0.3',timeout=8000)
  # 1. plain song: background events never pause, no AudioContext
  for tabname in ['lib','pls','help']:
    pg.click(f'nav button[data-t={tabname}]');ev('goAway()');pg.wait_for_timeout(500);assert not ev('audio.paused'),'paused on hide in '+tabname
    t=ev('audio.currentTime');pg.wait_for_timeout(400);assert ev('audio.currentTime')>t,'still advancing hidden';ev('comeBack()');pg.wait_for_timeout(200);assert not ev('audio.paused')
  assert ev('__ctx')==0 and ev('PR.ctx')==None,'no Web Audio at pitch 0'
  # 2. popup open (Library indicator path) then hide: no pause
  ev('openPR()');ev('goAway()');pg.wait_for_timeout(400);assert not ev('audio.paused');ev('comeBack()');pg.click('#prCancel');pg.wait_for_timeout(200);assert not ev('audio.paused'),'popup close on Library does not pause'
  # 3. pitch on -> graph; pitch back to 0 -> graph torn down, fresh plain element, still playing at same spot
  pg.click('nav button[data-t=lib]');ev('openPR()');ev("p=document.getElementById('pit');p.value=2;p.dispatchEvent(new Event('input'))");pg.wait_for_function('PR.ctx&&PR.node',timeout=5000)
  ev("p=document.getElementById('pit');p.value=0;p.dispatchEvent(new Event('input'))");old=ev('window.__old=audio,1');pg.click('#prDone');pg.wait_for_timeout(800)
  assert ev('PR.ctx')==None and ev('audio!==__old') and ev("document.querySelectorAll('audio').length")==1,'swapped to plain audio'
  assert not ev('audio.paused') and ev('audio.currentTime')>1,ev('[audio.paused,audio.currentTime]')
  # handlers still work on the new element (timeupdate drives UI, pause updates button state)
  pg.wait_for_timeout(300);ev('goAway()');pg.wait_for_timeout(400);assert not ev('audio.paused'),'new element survives hide';ev('comeBack()')
  pg.click('#play');pg.wait_for_timeout(200);assert ev('audio.paused');pg.click('#play');pg.wait_for_timeout(300);assert not ev('audio.paused')
  # 4. unexpected pause while hidden (iOS interruption) resumes on return; our own pause does not
  ev('goAway()');ev('HTMLMediaElement.prototype.pause.call(audio)');pg.wait_for_timeout(200);assert ev('audio.paused');ev('comeBack()');pg.wait_for_timeout(500);assert not ev('audio.paused'),'resumed on return'
  ev('goAway()');ev("navigator.mediaSession&&1");ev('audio.pause()');pg.wait_for_timeout(200);ev('comeBack()');pg.wait_for_timeout(400);assert ev('audio.paused'),'user pause stays paused'
  # CarPlay: interruption while hidden (Siri / nav prompt) resumes by itself, no return to app needed
  pg.click('#play');pg.wait_for_timeout(300);assert not ev('audio.paused')
  # v21: an interruption while hidden (call, voice chat, other app) stays paused while hidden, no retries
  ev('goAway()');ev('HTMLMediaElement.prototype.pause.call(audio)');pg.wait_for_timeout(3500);assert ev('audio.paused') and ev('S.bgWant'),'no auto resume while hidden'
  ev('comeBack()');pg.wait_for_timeout(500);assert not ev('audio.paused'),'resumes when visible again'
  ev('goAway()');ev('HTMLMediaElement.prototype.pause.call(audio)');pg.wait_for_timeout(300);ev('__ms.play()');pg.wait_for_timeout(400);assert not ev('audio.paused') and not ev('S.bgWant'),'lock screen / CarPlay play resumes manually'
  assert ev("typeof bgRetry")=='undefined'
  # CarPlay / lock screen pause via Media Session is respected, and play/seek/next handlers exist
  assert all(k in ev('Object.keys(__ms)') for k in ['play','pause','nexttrack','previoustrack','seekto','seekbackward','seekforward','stop'])
  ev('__ms.pause()');pg.wait_for_timeout(1500);assert ev('audio.paused'),'CarPlay pause respected'
  ev('__ms.play()');pg.wait_for_timeout(400);assert not ev('audio.paused'),'CarPlay play';t=ev('audio.currentTime');ev('__ms.seekforward({})');assert ev('audio.currentTime')>=t+9
  assert ev("navigator.mediaSession.metadata&&navigator.mediaSession.metadata.title")
  ev('comeBack()')
  # 5. Settings tab still pauses on tap only
  ev('audio.paused&&audio.play()');pg.wait_for_timeout(300);assert not ev('audio.paused');pg.click('nav button[data-t=set]');pg.wait_for_timeout(200);assert ev('audio.paused')
  # 6. A-B loop waiting for voice cue survives hide/return
  pg.click('nav button[data-t=lib]');ev("audio.currentTime=1;S.A=1;S.B=2;renderMarks()");pg.click('#abBox summary');pg.click('#abOn');pg.wait_for_function('S.waiting',timeout=8000)
  ev('goAway()');ev('S.rec&&S.rec.onend&&S.rec.onend()');pg.wait_for_timeout(300);assert ev('S.ab&&S.waiting'),'still waiting while hidden';n=ev('__rs')
  ev('comeBack()');pg.wait_for_timeout(300);assert ev('S.ab&&S.waiting') and ev('__rs')>n,'listening restarted on return'
  ev("S.ab&&document.getElementById('abOn').click()")
  # hidden A-B in voice mode: reaching B repeats from A after the gap instead of going silent
  ev("document.getElementById('gap').value=1;audio.currentTime=3;S.A=3;S.B=4;renderMarks()");pg.click('#abOn');pg.wait_for_timeout(200);ev('goAway()')
  pg.wait_for_function('S.waiting',timeout=8000);pg.wait_for_function('!S.waiting&&!audio.paused&&audio.currentTime<4',timeout=5000);assert ev('S.ab')
  ev('comeBack()');ev("S.ab&&document.getElementById('abOn').click()")
  # pitched song: AudioContext suspended/interrupted gets resumed
  ev('openPR()');ev("p=document.getElementById('pit');p.value=1;p.dispatchEvent(new Event('input'))");pg.wait_for_function('PR.ctx&&PR.node',timeout=5000);pg.click('#prDone')
  if ev('audio.paused'):pg.click('#play') if pg.is_visible('#play') else ev('audio.play()')
  pg.wait_for_timeout(300);ev('PR.ctx.suspend()');pg.wait_for_timeout(600);assert ev("PR.ctx.state")=='running','ctx resumed'
  b.close()
assert not errs,errs;print('background ok')
