# V35 Help chart: five stretch curves, sourced vs derived, fits a portrait phone.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts',exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page()
  pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/');pg.wait_for_timeout(700)
  pg.locator('#toc .tocb',has_text='Piano stretch curves').click();pg.wait_for_timeout(200)
  h=pg.locator('#h-stretch')
  assert h.is_visible()
  sec=pg.evaluate("""()=>{const h=document.getElementById('h-stretch');let t='';let n=h.nextElementSibling;
    while(n&&n.tagName!=='H2'){t+=n.innerText+'\\n'+n.innerHTML;n=n.nextElementSibling}return t}""")
  assert 'Smaller pianos stretch more' in sec
  assert 'inharmonicity' in sec
  assert 'sourced' in sec and 'derived' in sec
  assert 'Real tuners fit each piano' in sec
  assert '\u2014' not in sec and '&mdash;' not in sec
  for name in ['Concert grand (9 ft)','Baby grand','Studio upright','Spinet','Typical']:
    assert name in sec,name
  assert pg.locator('#stretchChart path[data-curve]').count()==5
  assert pg.locator('#stretchChart circle[data-sourced]').count()==11
  box=pg.locator('#stretchChart').bounding_box()
  main=pg.locator('main').bounding_box()
  assert box and box['width']>280 and box['width']<=main['width']+1 and box['height']>120,(box,main)
  pg.screenshot(path='/opt/cursor/artifacts/v35-stretch-chart-help.png')
  b.close()
assert not errs,errs
print('STRETCH CHART OK')
