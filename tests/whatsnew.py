# What's new: button opens notes for the running version; auto-shows once after an update, never on a fresh install
import re
from playwright.sync_api import sync_playwright
V=re.search(r'APP_VERSION=(\d+)',open('app.js').read()).group(1)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome');ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  assert not pg.is_visible('#wnModal'),'fresh install: no auto popup'
  assert pg.evaluate("localStorage.getItem('pp-lastVersion')")==V
  pg.click('nav button[data-t=set]');btn=pg.locator('#wnBtn');assert "What's new in Version "+V in btn.inner_text()
  assert pg.evaluate("document.getElementById('wnBtn').nextElementSibling.id")=='aboutCard','next to About'
  btn.click();assert pg.is_visible('#wnModal') and pg.inner_text('#wnTitle')=="What's new in Version "+V
  items=pg.locator('#wnList li').all_inner_texts()
  if V=='17':assert items==['Loop and practice settings now open in a popup.','Speed control from 50% to 150% that keeps the pitch.','Pitch control from -6 to +6 semitones.','Speed and pitch are saved per song, with an on/off toggle when you swipe left on a song and a badge on songs that have settings.','A Send button when you swipe left on a song or folder, to share the MP3 files with AirDrop, Messages or Mail.',"This What's new button."],items
  assert items==pg.evaluate('RELEASE_NOTES[APP_VERSION]') and '\u2014' not in ''.join(items)
  pg.click('#wnClose');assert not pg.is_visible('#wnModal')
  # simulate update from previous version: auto-shows once
  pg.evaluate("localStorage.setItem('pp-lastVersion',String(APP_VERSION-1))");pg.reload();pg.wait_for_timeout(900)
  assert pg.is_visible('#wnModal'),'auto after update';assert pg.evaluate("localStorage.getItem('pp-lastVersion')")!=V,'not marked seen until closed'
  pg.reload();pg.wait_for_timeout(900);assert pg.is_visible('#wnModal'),'reload before closing (SW update reload) shows it again'
  pg.keyboard.press('Escape');assert not pg.is_visible('#wnModal');assert pg.evaluate("localStorage.getItem('pp-lastVersion')")==V
  pg.reload();pg.wait_for_timeout(900);assert not pg.is_visible('#wnModal'),'only once'
  pg.click('nav button[data-t=set]');pg.click('#wnBtn');pg.mouse.click(195,30);assert not pg.is_visible('#wnModal'),'tap outside closes'
  b.close()
assert not errs,errs;print('whatsnew ok')
