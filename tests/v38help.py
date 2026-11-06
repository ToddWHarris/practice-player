# V38: Help button on the piano guide opens only Piano tuning tools, and Back returns.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs = []
with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  pg = b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, permissions=['microphone']).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(800)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(250)
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext'); pg.click('#gtSplitsStart'); pg.wait_for_timeout(300)
  assert pg.inner_text('#gtHelp') == 'Help'
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  pg.screenshot(path='/opt/cursor/artifacts/v38-piano-help-button.png')
  pg.click('#gtHelp'); pg.wait_for_timeout(250)
  assert pg.evaluate("document.querySelector('nav button.on').dataset.t") == 'help'
  assert pg.is_hidden('#gtune')
  assert pg.is_visible('#gtHelpBack') and pg.inner_text('#gtHelpBack') == 'Back to piano'
  assert pg.inner_text('#gtToolsBack') == 'Back to piano'
  pos = pg.evaluate("""() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const h = document.getElementById('h-piano-tools').getBoundingClientRect();
    const top = document.getElementById('h-top').getBoundingClientRect();
    return {hy:h.top, my:main.top, hh:h.height, ty:top.top, title:document.getElementById('h-piano-tools').textContent};
  }""")
  assert pos['title'] == 'Piano tuning tools', pos
  assert abs(pos['hy'] - pos['my']) < 90, pos
  assert pos['ty'] < pos['my'] - 20, pos
  sec = pg.evaluate("""() => { const h=document.getElementById('h-piano-tools'); let t=h.innerText; let n=h.nextElementSibling;
    while(n && n.tagName!=='H2'){ t += '\\n' + n.innerText; n=n.nextElementSibling } return t }""")
  assert 'Tuning hammer' in sec and 'Mute strip' in sec and 'Papp' in sec and 'notch tuning' in sec
  assert '\u2014' not in sec and '&mdash;' not in sec
  assert pg.locator('#toc .tocb', has_text='Piano tuning tools').count() == 1
  assert pg.locator('#h-stretch').count() == 1 and pg.locator('#h-tun').count() == 1
  pg.set_viewport_size({'width':390,'height':844}); pg.wait_for_timeout(200)
  pg.evaluate("document.getElementById('h-piano-tools').scrollIntoView({block:'start'})")
  pg.wait_for_timeout(150)
  pg.screenshot(path='/opt/cursor/artifacts/v38-piano-tools-help.png')
  pg.set_viewport_size({'width':844,'height':390}); pg.wait_for_timeout(100)
  pg.click('#gtHelpBack'); pg.wait_for_timeout(250)
  assert pg.is_visible('#gtune') and pg.is_hidden('#gtHelpBack')
  assert pg.evaluate("document.querySelector('nav button.on').dataset.t") == 'tun'
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  assert pg.inner_text('#gtToolsBack') == 'Back to topics'
  # The same section from the Help tab still jumps here, and Back to topics stays on Help.
  pg.click('#gtClose'); pg.wait_for_timeout(150)
  pg.click('nav button[data-t=help]'); pg.wait_for_timeout(200)
  pg.locator('#toc .tocb', has_text='Piano tuning tools').click(); pg.wait_for_timeout(200)
  again = pg.evaluate("""() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const h = document.getElementById('h-piano-tools').getBoundingClientRect();
    return {hy:h.top, my:main.top};
  }""")
  assert abs(again['hy'] - again['my']) < 40, again
  assert pg.is_hidden('#gtHelpBack')
  pg.locator('#gtToolsBack').click(); pg.wait_for_timeout(150)
  assert pg.evaluate("document.querySelector('main').scrollTop") < 30
  assert pg.evaluate("document.querySelector('nav button.on').dataset.t") == 'help'
  b.close()
assert not errs, errs
print('V38 HELP OK')
