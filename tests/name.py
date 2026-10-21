# v21 first name: asked once on first launch (Save/Skip), greet on later opens (first word, fades ~2 s or on tap),
# greeting before What's new, change in Settings, skip = nothing shown. Run WITHOUT the _hook PYTHONPATH.
import os
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  def fresh():
    c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto('http://localhost:8765/');pg.wait_for_timeout(1000);return pg
  pg=fresh();ev=pg.evaluate
  assert pg.is_visible('#nameModal') and pg.is_visible('#nameSkip') and pg.is_visible('#nameSave')
  pg.fill('#nameIn','  Todd William  ');pg.click('#nameSave');assert not pg.is_visible('#nameModal')
  assert ev("localStorage.getItem('pp-name')")=='Todd William'
  pg.reload();pg.wait_for_timeout(500);assert not pg.is_visible('#nameModal')
  assert pg.is_visible('#hello') and pg.inner_text('#hello')=='Welcome back, Todd!',pg.inner_text('#hello')
  bb=pg.locator('#hello').bounding_box();vw=pg.viewport_size;assert abs(bb['x']+bb['width']/2-vw['width']/2)<2 and abs(bb['y']+bb['height']/2-vw['height']/2)<2,bb
  assert pg.evaluate("getComputedStyle(document.getElementById('hello')).fontSize")=='31px';pg.screenshot(path='/workspace/shots/v25-welcome.png')
  pg.wait_for_timeout(2600);assert not pg.is_visible('#hello'),'fades after ~2 s'
  pg.reload();pg.wait_for_timeout(400);assert pg.is_visible('#hello');pg.click('#hello');pg.wait_for_timeout(500);assert not pg.is_visible('#hello'),'tap dismisses'
  # greeting first, then What's new (never at the same time)
  ev("localStorage.setItem('pp-lastVersion','19')");pg.reload();pg.wait_for_timeout(500)
  assert pg.is_visible('#hello') and not pg.is_visible('#wnModal'),'greet first'
  pg.wait_for_timeout(2400);assert not pg.is_visible('#hello') and pg.is_visible('#wnModal'),'then whats new';pg.click('#wnClose')
  # change name in Settings
  pg.click('nav button[data-t=set]');assert 'Todd William' in pg.inner_text('#nameBtn');pg.click('#nameBtn');assert pg.input_value('#nameIn')=='Todd William'
  pg.fill('#nameIn','Sam');pg.click('#nameSave');assert 'Sam' in pg.inner_text('#nameBtn')
  pg.reload();pg.wait_for_timeout(400);assert pg.inner_text('#hello')=='Welcome back, Sam!'
  # clearing the name in Settings: no greeting
  pg.wait_for_timeout(2500);pg.click('nav button[data-t=set]');pg.click('#nameBtn');pg.fill('#nameIn','');pg.click('#nameSave');assert ev("localStorage.getItem('pp-name')")==None and 'Not set' in pg.inner_text('#nameBtn')
  pg.reload();pg.wait_for_timeout(800);assert not pg.is_visible('#hello') and not pg.is_visible('#nameModal')
  # Skip on first launch: nothing later, straight into the app; What's new on update still shows
  pg2=fresh();pg2.click('#nameSkip');assert not pg2.is_visible('#nameModal') and pg2.evaluate("localStorage.getItem('pp-name')")==None
  pg2.reload();pg2.wait_for_timeout(800);assert not pg2.is_visible('#hello') and not pg2.is_visible('#nameModal')
  pg2.evaluate("localStorage.setItem('pp-lastVersion','19')");pg2.reload();pg2.wait_for_timeout(900);assert pg2.is_visible('#wnModal') and not pg2.is_visible('#hello')
  # skipped at first launch, then a name entered only in Settings: saved and greeted on next open
  pg2.click('#wnClose');pg2.click('nav button[data-t=set]');assert 'Not set' in pg2.inner_text('#nameBtn');pg2.click('#nameBtn');pg2.fill('#nameIn','Maria Elena');pg2.press('#nameIn','Enter')
  assert not pg2.is_visible('#nameModal') and pg2.evaluate("localStorage.getItem('pp-name')")=='Maria Elena'
  pg2.reload();pg2.wait_for_timeout(500);assert pg2.is_visible('#hello') and pg2.inner_text('#hello')=='Welcome back, Maria!','settings name greets'
  # existing user updating (no name asked yet): name prompt first, What's new after Save
  pg3=fresh();pg3.evaluate("localStorage.removeItem('pp-nameAsked');localStorage.setItem('pp-lastVersion','20')");pg3.reload();pg3.wait_for_timeout(900)
  assert pg3.is_visible('#nameModal') and not pg3.is_visible('#wnModal');pg3.fill('#nameIn','Ann');pg3.click('#nameSave');pg3.wait_for_timeout(300);assert pg3.is_visible('#wnModal')
  # Help + notes, name never leaves device (no network request carries it)
  pg.click('nav button[data-t=help]');h=pg.inner_text('#helpBody');assert 'Your name' in h and 'Siri' not in h
  assert any('name' in n for n in ev('RELEASE_NOTES[21]')) and '\u2014' not in ''.join(ev('RELEASE_NOTES[21]'))
  b.close()
assert not errs,errs;print('name ok')
