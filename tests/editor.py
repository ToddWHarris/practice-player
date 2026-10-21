# Loop editor: drag, snap, clamp, no crossing, pre/post setting; portrait and landscape
import os,subprocess
from playwright.sync_api import sync_playwright
f='/tmp/pp-e2e/long.mp3';os.makedirs('/tmp/pp-e2e',exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=330:duration=60',f],check=True)
errs=[]
def drag(pg,h,t):
  # drag handle h to song time t using mouse pointer events
  box=pg.locator('#'+h).bounding_box();tl=pg.locator('#edTl').bounding_box();ws,we=pg.evaluate('[ED.ws,ED.we]')
  x=tl['x']+(t-ws)/(we-ws)*tl['width'];y=box['y']+box['height']/2
  pg.mouse.move(box['x']+box['width']/2,y);pg.mouse.down();pg.mouse.move(x,y,steps=8);pg.mouse.up();pg.wait_for_timeout(50)
  return pg.evaluate('[S.A,S.B]')
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  for name,vp in [('portrait',{'width':390,'height':844}),('landscape',{'width':844,'height':390})]:
    ctx=b.new_context(viewport=vp,has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/');pg.wait_for_timeout(800);pg.set_input_files('#inFiles',[f]);pg.wait_for_timeout(1000)
    pg.click('nav button[data-t=lib]');pg.click('#tree li:nth-child(2) .n');pg.wait_for_function('audio.duration>59',timeout=8000);pg.evaluate('audio.pause()')
    pg.click('#abBox summary');assert not pg.is_visible('#edOpen'),'hidden without loop'
    pg.evaluate('S.A=4;S.B=20;renderMarks()');assert pg.is_visible('#edOpen');pg.click('#edOpen')
    assert pg.evaluate('[ED.ws,ED.we]')==[0,30],pg.evaluate('[ED.ws,ED.we]')
    assert pg.inner_text('#edLen')=='16 s'
    eb=pg.locator('#ed').bounding_box();assert eb['width']>=vp['width']-1,'full width'
    pb=pg.locator('#ed .panel').bounding_box();assert pb['width']>=vp['width']-2,('panel full width',pb)
    pg.screenshot(path=f'/workspace/shots/editor-{name}.png')
    assert drag(pg,'hA',-5)==[0,20],'A clamps to 0'
    a,bb=drag(pg,'hA',25);assert (a,bb)==(19,20),('no crossing',a,bb)
    r=drag(pg,'hA',7.3);assert r==[7,20],('snap',r,pg.evaluate('[ED.ws,ED.we]'))
    assert drag(pg,'hB',1)==[7,8],'B min 1s after A'
    assert drag(pg,'hB',29)==[7,29]
    ws,we=pg.evaluate('[ED.ws,ED.we]');assert [ws,we]==[0,39],('window refits after drag',ws,we)
    assert drag(pg,'hB',39)==[7,39];drag(pg,'hB',49);drag(pg,'hB',59);assert drag(pg,'hB',70)[1]<=pg.evaluate('audio.duration')
    # touch drag on handle A
    h=pg.locator('#hA').bounding_box();tl=pg.locator('#edTl').bounding_box();cx,cy=h['x']+h['width']/2,h['y']+h['height']/2
    pg.evaluate("""([x,y,tx])=>{const el=document.getElementById('edTl');const ev=(t,cx)=>el.dispatchEvent(new PointerEvent(t,{pointerId:7,pointerType:'touch',clientX:cx,clientY:y,bubbles:true,isPrimary:true}));ev('pointerdown',x);ev('pointermove',(x+tx)/2);ev('pointermove',tx);ev('pointerup',tx)}""",[cx,cy,tl['x']+2])
    assert pg.evaluate('S.A')==pg.evaluate('Math.round(ED.ws)') or pg.evaluate('S.A')<=pg.evaluate('ED.ws')+1,('touch drag',pg.evaluate('[S.A,ED.ws]'))
    # pre/post setting persisted and applied
    pg.click('#edDone');assert not pg.is_visible('#ed')
    pg.click('nav button[data-t=set]');pg.click('#prBtn');pg.fill('#ctxPre','3');pg.fill('#ctxPost','2');pg.click('#prDone')
    pg.reload();pg.wait_for_timeout(800);pg.click('nav button[data-t=set]');pg.click('#prBtn');assert pg.input_value('#ctxPre')=='3' and pg.input_value('#ctxPost')=='2';pg.click('#prCancel')
    pg.click('nav button[data-t=lib]');pg.click('#tree li:nth-child(2) .n');pg.wait_for_function('audio.duration>59',timeout=8000);pg.evaluate('audio.pause();S.A=10;S.B=20;renderMarks()')
    pg.click('#abBox summary');pg.click('#edOpen');assert pg.evaluate('[ED.ws,ED.we]')==[7,22]
    # play loop from editor reaches B and waits (auto repeat continues)
    pg.evaluate("document.getElementById('autoRep').checked=true;document.getElementById('gap').value=0");pg.evaluate('S.A=10;S.B=11.5;renderMarks()')
    pg.click('#edPlay');pg.wait_for_timeout(2500);assert pg.evaluate('S.ab'),'loop running';pg.click('#edDone');pg.click('#abOn')
    ctx.close()
  b.close()
assert not errs,errs;print('editor ok')
