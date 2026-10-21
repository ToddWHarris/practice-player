from playwright.sync_api import sync_playwright
import re
V=int(re.search(r'const V=(\d+)',open('sw.js').read()).group(1))
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome');ctx=b.new_context();pg=ctx.new_page()
  pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:8765/');pg.wait_for_function('navigator.serviceWorker.controller',timeout=10000);pg.wait_for_timeout(500)
  assert pg.locator('.ver').last.inner_text().endswith('Version '+str(V))
  ctx.set_offline(True);pg.reload();pg.wait_for_timeout(800)
  assert pg.locator('.ver').last.inner_text().endswith('Version '+str(V)) and pg.locator('#play').is_visible(),'offline reload'
  assert pg.evaluate("caches.keys()")==['pp-v'+str(V)]
  b.close()
assert not errs,errs;print('offline ok')
