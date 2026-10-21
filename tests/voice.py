# A-B voice loop with a mocked SpeechRecognition and getUserMedia
import os,subprocess
from playwright.sync_api import sync_playwright
f='/tmp/pp-e2e/v.mp3'
os.makedirs('/tmp/pp-e2e',exist_ok=True)
if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=400:duration=8',f],check=True)
MOCK="""window.__recs=[];window.__gum=0;
class FakeSR{constructor(){this.started=0;__recs.push(this)}start(){this.started++;this.running=true;setTimeout(()=>this.onstart&&this.onstart(),10)}abort(){this.running=false}stop(){this.running=false}
 say(t,final){const r=[{0:{transcript:t},isFinal:!!final,length:1}];this.onresult&&this.onresult({resultIndex:0,results:r})}
 fail(code){this.onerror&&this.onerror({error:code});this.running=false;this.onend&&this.onend()}}
window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;
navigator.mediaDevices.getUserMedia=async()=>{__gum++;return{getTracks:()=>[{stop(){}}]}};"""
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page()
  pg.add_init_script(MOCK);pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  pg.set_input_files('#inFiles',[f]);pg.wait_for_timeout(800);pg.click('nav button[data-t=lib]');pg.click('#tree li:nth-child(2)');pg.wait_for_timeout(800)
  pg.click('#abBox summary');pg.evaluate('S.A=0.5;S.B=1.2;renderMarks()')
  assert pg.locator('#listen button:has-text("Stop loop")').count()==0 and pg.locator('button:has-text("Stop loop"):visible').count()<=1
  pg.click('#abOn');pg.wait_for_timeout(200)
  st=pg.evaluate('({gum:__gum,n:__recs.length,cont:__recs[0]&&__recs[0].continuous,interim:__recs[0]&&__recs[0].interimResults})');print(st)
  assert st['gum']==1 and st['n']==1 and st['cont'] and st['interim']
  pg.wait_for_function('S.waiting',timeout=5000);assert 'Listening' in pg.inner_text('#listenTxt')
  pg.evaluate("__recs[0].say('ok Again')");pg.wait_for_timeout(100);assert pg.evaluate('!S.waiting&&!audio.paused')
  pg.evaluate("__recs[0].say('again now')");assert pg.evaluate('!S.waiting'),'ignored while playing'
  pg.wait_for_function('S.waiting',timeout=5000);assert pg.evaluate('__recs.length')==1,'reused recognizer'
  pg.evaluate("__recs[0].onend()");pg.wait_for_timeout(400);assert pg.evaluate('__recs[0].started')==2,'restart on end'
  pg.evaluate("__recs[0].say('Repeat',false)");pg.wait_for_timeout(100);assert pg.evaluate('!S.waiting')
  pg.wait_for_function('S.waiting',timeout=5000);pg.evaluate("__recs[0].say('STOP')");assert pg.evaluate('!S.ab'),'stop'
  # not-allowed at B shows code, hint and Tap to listen
  pg.click('#abOn');pg.wait_for_timeout(100);r=pg.evaluate('__recs.length-1')
  pg.wait_for_function('S.waiting',timeout=5000);pg.evaluate(f"__recs[{r}].fail('not-allowed')");t=pg.inner_text('#listenTxt');print(t)
  assert 'not-allowed' in t and 'Microphone' in t and pg.is_visible('#tapListen')
  pg.click('#tapListen');pg.wait_for_timeout(200);assert pg.evaluate('__recs.length')==r+2 and not pg.is_visible('#tapListen')
  pg.evaluate("__recs[__recs.length-1].fail('service-not-allowed')");assert 'Dictation' in pg.inner_text('#listenTxt')
  pg.click('#again');pg.wait_for_timeout(100);pg.click('#abOn');b.close()
assert not errs,errs;print('voice ok')
