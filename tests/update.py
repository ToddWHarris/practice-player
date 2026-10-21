# v21 Bug A: simulate an update from 19 to the current version: the old version's page, a new service worker
# taking control (controllerchange reload right at launch), and the V20 nav restore; What's new must show with Close.
import re
from playwright.sync_api import sync_playwright
V=int(re.search(r'APP_VERSION=(\d+)',open('app.js').read()).group(1))
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome');ctx=b.new_context(viewport={'width':390,'height':844});pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_function('navigator.serviceWorker.controller',timeout=10000);pg.wait_for_timeout(500)
  # state of a Version 19 user who last had Playlists open and has seen the welcome
  pg.click('nav button[data-t=pls]');ev("localStorage.setItem('pp-lastVersion','19')")
  # first launch of the new version; the SW update reload fires within a few hundred ms (before the old 400 ms timer)
  pg.reload();pg.wait_for_timeout(150);pg.reload();pg.wait_for_timeout(1200)
  assert pg.is_visible('#wnModal'),'whats new shows after the update reload'
  assert pg.inner_text('#wnTitle')==f"What's new in Version {V}" and pg.is_visible('#wnClose') and pg.inner_text('#wnClose')=='Close'
  assert pg.locator('#wnList li').all_inner_texts()==ev('RELEASE_NOTES[APP_VERSION]')
  assert ev("document.querySelector('nav button.on').dataset.t")=='pls','nav restore still happens behind it'
  pg.click('#wnClose');assert not pg.is_visible('#wnModal') and ev("localStorage.getItem('pp-lastVersion')")==str(V)
  pg.reload();pg.wait_for_timeout(1000);assert not pg.is_visible('#wnModal'),'once per version'
  # a real controllerchange after the update must not lose it either
  ev("localStorage.setItem('pp-lastVersion','19')");pg.reload();pg.wait_for_timeout(1000);assert pg.is_visible('#wnModal')
  ev("sessionStorage.clear();navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))");pg.wait_for_timeout(1500)
  assert pg.is_visible('#wnModal'),'still shown after SW reload'
  # fresh install: no popup, version recorded
  ctx2=b.new_context();pg2=ctx2.new_page();pg2.goto('http://localhost:8765/');pg2.wait_for_timeout(1200)
  assert not pg2.is_visible('#wnModal') and pg2.evaluate("localStorage.getItem('pp-lastVersion')")==str(V)
  b.close()
assert not errs,errs;print('update ok')
