# Toolbar stays on screen: no horizontal overflow, every control fully visible, one instruction.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]
IDS=['gtClose','gtHelp','pdHelp','gtBack','gtType','gtA4','gtModelBadge','gtPrompt','gtKeys','pdDetailsBtn','pdSaveNote','pdRetry']
SIZES=[(390,844,'phone-portrait'),(844,390,'phone-landscape'),(768,1024,'tablet-portrait'),(1024,768,'tablet-landscape')]

def inside(box, view):
  return box['l']>=-1 and box['t']>=-1 and box['r']<=view['w']+1 and box['b']<=view['h']+1 and box['w']>8 and box['h']>8

with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  for w,h,name in SIZES:
    pg=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, permissions=['microphone']).new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(400)
    pg.click('nav button[data-t=tun]')
    pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
    pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(150)
    pg.click('#gtNew'); pg.click('#gtStyle button[data-style=kawai-k200]'); pg.wait_for_timeout(80)
    assert pg.input_value('#gtSerial')==''
    pg.click('#gtStyleNext'); pg.wait_for_timeout(120)
    pg.click('#gtCalModel'); pg.click('#gtSplitsStart'); pg.wait_for_timeout(250)
    if name=='phone-portrait':
      pg.evaluate("()=>PartialDial.preview({midi:21,f1:27.5,B:0.0008,partials:[1,2,3,4,5]})")
      pg.wait_for_timeout(100)
    info=pg.evaluate("""(ids)=>{
      const view={w:innerWidth,h:innerHeight};
      const doc=document.documentElement;
      const boxes={};
      ids.forEach(id=>{
        const e=document.getElementById(id);
        const r=e.getBoundingClientRect();
        const s=getComputedStyle(e);
        boxes[id]={l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,hidden:e.hidden||s.display==='none'||s.visibility==='hidden'};
      });
      const prompt=document.getElementById('gtPrompt').innerText;
      return {view, scrollW:doc.scrollWidth, clientW:doc.clientWidth, boxes, prompt,
        badge:document.getElementById('gtModelBadge').innerText,
        size:document.getElementById('gtType').value,
        listen:document.getElementById('pdListen').innerText};
    }""", IDS)
    assert info['scrollW']<=info['clientW']+2, (name, info['scrollW'], info['clientW'])
    assert info['badge']=='Model: Kawai K-200', (name, info['badge'])
    assert info['size']=='studio', (name, info['size'])
    assert info['listen']=='', (name, info['listen'])
    assert info['prompt'].count('Play')==1, (name, info['prompt'])
    assert 'Rings are what was heard' in info['prompt'] or 'Rings stay off' in info['prompt'], info['prompt']
    for i in IDS:
      box=info['boxes'][i]
      assert not box['hidden'], (name, i, box)
      assert inside(box, info['view']), (name, i, box, info['view'])
    pg.screenshot(path='/opt/cursor/artifacts/toolbar-%s.png'%name)
    pg.context.close()
  b.close()
assert not errs, errs
print('toolbar ok')
