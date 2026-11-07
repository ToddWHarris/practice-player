# Calibration gate and stored-profile target labels. Synthetic notes only. No microphone piano.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx=b.new_context(viewport={'width':1024,'height':768}, device_scale_factor=1, permissions=['microphone'])
  pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(700)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext')
  assert pg.is_disabled('#gtSplitsStart')
  assert 'not a measurement' in pg.inner_text('#gtSplits').lower()
  pg.screenshot(path='/opt/cursor/artifacts/cal-ipad-choice-1024x768.png')
  pg.click('#gtCalOpen')
  prompt=pg.inner_text('#gtCalPrompt')
  assert 'A0' in prompt and 'Mute' in prompt and 'not for whether it is in tune' in prompt
  assert pg.is_disabled('#gtCalUse')
  pg.click('#gtCalSkip'); pg.click('#gtCalSkip')
  assert pg.is_disabled('#gtCalUse')
  pg.screenshot(path='/opt/cursor/artifacts/cal-ipad-measure-1024x768.png')
  pg.click('#gtCalBack')
  pg.click('#gtCalModel')
  assert pg.is_enabled('#gtSplitsStart')
  pg.click('#gtSplitsStart'); pg.wait_for_timeout(400)
  src=pg.inner_text('#gtTargetSrc')
  assert 'size model' in src and 'Not a measurement' in src
  pg.set_viewport_size({'width':768,'height':1024})
  pg.wait_for_timeout(200)
  assert pg.is_hidden('#gtRotate')
  pg.screenshot(path='/opt/cursor/artifacts/cal-ipad-model-768x1024.png')
  stored=pg.evaluate("""()=>{
    const notes=[33,45,69,93].map(midi=>({status:'measured',midi,B:0.00035+Math.abs(midi-69)*0.000008,residualCents:0.4,confidence:'high',partials:[{n:1,hz:100},{n:2,hz:200},{n:3,hz:300}],heardCents:-20}));
    const cal=PianoTune.deriveCalibration(notes,442,'concert');
    const rec={id:'kcal',name:'Bench',style:'concert',a4:442,split2:24,split3:53,prescan:{},step:0,tuningOk:false,calibration:cal,targetChoice:'measured'};
    localStorage.setItem('pp-piano-profiles', JSON.stringify([rec]));
    localStorage.removeItem('pp-pianotune');
    return {accepted:cal.accepted, a4:cal.targets[69].cents, a4src:cal.targets[69].source, a6:cal.targets[93].cents, low:cal.targets[21].source, heard:cal.notes[0].heardCents, algo:cal.algorithm, partials:cal.notes[0].partials.length};
  }""")
  assert stored['accepted'] and stored['a4']==0 and stored['a4src']=='anchor'
  assert stored['a6']!=-20 and stored['low']=='unavailable'
  assert stored['algo']=='cal-4:2-v1' and stored['partials']==3
  pg.reload(); pg.wait_for_timeout(700)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  pg.get_by_role('button', name='Load').click(); pg.wait_for_timeout(500)
  low=pg.inner_text('#gtTargetSrc')
  assert 'unavailable' in low and 'size model is not being substituted' in low
  pg.click('#gtSteps'); pg.wait_for_timeout(100)
  labels=pg.locator('#gtList button').all_inner_texts()
  a4=next(i for i,t in enumerate(labels) if 'Set A4 string 1 of 3' in t)
  pg.locator('#gtList button').nth(a4).click(); pg.wait_for_timeout(300)
  anchor=pg.inner_text('#gtTargetSrc')
  assert 'anchored' in anchor and 'not at the pitch the microphone heard' in anchor
  assert 'size model' not in anchor
  pg.set_viewport_size({'width':1180,'height':820})
  pg.wait_for_timeout(200)
  pg.screenshot(path='/opt/cursor/artifacts/cal-ipad-anchor-1180x820.png')
  pg.click('#gtSteps'); pg.wait_for_timeout(100)
  labels=pg.locator('#gtList button').all_inner_texts()
  u=next(i for i,t in enumerate(labels) if 'Set A4 string 2 of 3' in t)
  pg.locator('#gtList button').nth(u).click(); pg.wait_for_timeout(250)
  up=pg.inner_text('#gtPrompt')
  assert 'together' in up and 'beats' in up and 'Play A4 alone' not in up
  box=pg.evaluate("""()=>{
    const ids=['gtNote','gtCents','gtNeedleWrap','gtPrompt','gtTargetSrc','gtKeys'];
    const r=id=>{const e=document.getElementById(id); const b=e.getBoundingClientRect(); return {t:b.top,b:b.bottom,l:b.left,r:b.right,h:b.height,w:b.width};};
    const o={}; ids.forEach(id=>o[id]=r(id));
    return o;
  }""")
  assert box['gtKeys']['h']>=150, box['gtKeys']
  assert box['gtNeedleWrap']['h']>80, box['gtNeedleWrap']
  assert box['gtPrompt']['b']<=box['gtKeys']['t']+2, box
  pg.screenshot(path='/opt/cursor/artifacts/cal-ipad-unison-1180x820.png')
  pg.set_viewport_size({'width':844,'height':390})
  pg.wait_for_timeout(200)
  phone=pg.evaluate("""()=>{const g=document.getElementById('gtune'); const k=document.getElementById('gtKeys');
    return {scroll:g.scrollHeight<=g.clientHeight+2, keyBottom:k.getBoundingClientRect().bottom, note:document.getElementById('gtNote').getBoundingClientRect().height};}""")
  assert phone['scroll'] and phone['keyBottom']<=392 and phone['note']>30, phone
  pg.screenshot(path='/opt/cursor/artifacts/cal-phone-anchor-844x390.png')
  b.close()
assert not errs, errs
print('calibration ui ok')
