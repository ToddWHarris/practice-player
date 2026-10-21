# Highlight color popup: live preview, Cancel/outside/Escape revert, Done persists, contrast, landscape scroll
import os
from playwright.sync_api import sync_playwright
errs=[];os.makedirs('/workspace/shots',exist_ok=True)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome');ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,is_mobile=True);pg=ctx.new_page()
  pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
  v=lambda:pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()")
  bg=lambda sel:pg.evaluate(f"getComputedStyle(document.querySelector('{sel}')).backgroundColor")
  ls=lambda:pg.evaluate("localStorage.getItem('accent')")
  assert v()=='#22c55e'
  pg.click('nav button[data-t=lib]');pg.click('#abBox summary');pg.wait_for_timeout(200);pg.screenshot(path='/workspace/shots/green.png')
  pg.click('nav button[data-t=set]')
  assert pg.locator('#set .sw').count()==0 and pg.is_visible('#colorBtn') and pg.inner_text('#colorName')=='Green' and not pg.is_visible('#colorModal')
  pg.screenshot(path='/workspace/shots/v16-color-button.png')
  # opens popup
  pg.click('#colorBtn');assert pg.is_visible('#colorModal') and pg.locator('#colorModal .sw').count()==8 and pg.is_visible('#customColor')
  # live change before Done
  pg.click('.sw:has-text("Pink")');assert v()=='#ec4899' and ls() is None,'live, not saved'
  assert bg('#colorDone')=='rgb(236, 72, 153)' and bg('#colorSw')=='rgb(236, 72, 153)' and pg.inner_text('#colorName')=='Pink','popup + button update live'
  assert pg.evaluate("document.querySelector('meta[name=theme-color]').content")=='#ec4899'
  pg.screenshot(path='/workspace/shots/v16-color-popup.png')
  # Cancel reverts
  pg.click('#colorCancel');assert v()=='#22c55e' and not pg.is_visible('#colorModal') and pg.inner_text('#colorName')=='Green' and ls() is None
  # tap outside reverts
  pg.click('#colorBtn');pg.click('.sw:has-text("Blue")');assert v()=='#3b82f6';pg.mouse.click(195,60);pg.wait_for_timeout(100)
  assert v()=='#22c55e' and not pg.is_visible('#colorModal'),'outside reverts'
  # Escape reverts
  pg.click('#colorBtn');pg.click('.sw:has-text("Red")');pg.keyboard.press('Escape');assert v()=='#22c55e' and not pg.is_visible('#colorModal')
  # custom color + readable text, then Done persists
  pg.click('#colorBtn');pg.evaluate("c=document.getElementById('customColor');c.value='#123456';c.dispatchEvent(new Event('input'))")
  assert v()=='#123456' and pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--on-ac').trim()")=='#ffffff' and 'Custom' in pg.inner_text('#colorName')
  pg.click('.sw:has-text("Pink")');pg.click('#colorDone');assert not pg.is_visible('#colorModal') and ls()=='#ec4899'
  pg.reload();pg.wait_for_timeout(800);assert v()=='#ec4899','persist';pg.click('nav button[data-t=set]');assert pg.inner_text('#colorName')=='Pink'
  pg.click('#colorBtn');assert pg.locator('.sw.sel').inner_text()=='Pink';pg.click('#colorCancel');assert v()=='#ec4899','cancel keeps saved color'
  pg.click('nav button[data-t=lib]');pg.click('#abBox summary');pg.wait_for_timeout(200);pg.screenshot(path='/workspace/shots/pink.png')
  # landscape small screen: sheet fits and scrolls
  pg.set_viewport_size({'width':667,'height':320});pg.click('nav button[data-t=set]');pg.click('#colorBtn');sb=pg.locator('#colorModal .sheet').bounding_box()
  assert sb['height']<=320 and pg.evaluate("(s=>s.scrollHeight>=s.clientHeight)(document.querySelector('#colorModal .sheet'))")
  pg.locator('#customColor').scroll_into_view_if_needed();assert pg.locator('#customColor').is_visible();pg.click('#colorDone')
  pg.set_viewport_size({'width':320,'height':480});pg.click('#colorBtn');pg.locator('.preview').scroll_into_view_if_needed();assert pg.locator('.preview').is_visible();pg.click('#colorCancel')
  b.close()
assert not errs,errs;print('color e2e ok')
