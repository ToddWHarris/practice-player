# Share this app: buttons in Settings + Help, navigator.share payload, AbortError ignored, clipboard fallback, selectable link fallback
from playwright.sync_api import sync_playwright
URL='https://toddwharris.github.io/practice-player/'
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  def page(init):
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.add_init_script(init);pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto('http://localhost:8765/');pg.wait_for_timeout(700);return pg
  # 1. navigator.share stubbed
  pg=page("window.__sh=[];navigator.share=async d=>{__sh.push(d)};")
  pg.click('nav button[data-t=set]');assert pg.locator('#set .shareBtn').is_visible()
  sb=pg.locator('#set .shareBtn').bounding_box();assert sb['y']<250,('near top',sb)
  assert 'never shared' in pg.inner_text('#set')
  pg.screenshot(path='/workspace/shots/v15-share.png')
  pg.click('#set .shareBtn');pg.wait_for_timeout(100);d=pg.evaluate('__sh[0]')
  assert d['url']==URL and d['title']=='Practice Player' and 'A-B loop and voice cues' in d['text'] and 'Safari' in d['text'],d
  pg.click('nav button[data-t=help]');assert pg.locator('#h-share').count()==1 and pg.locator('#toc .tocb:has-text("Share this app")').count()==1
  pg.locator('#help .shareBtn').scroll_into_view_if_needed();pg.click('#help .shareBtn');pg.wait_for_timeout(100);assert pg.evaluate('__sh.length')==2 and pg.evaluate('__sh[1].url')==URL
  assert 'never shared' in pg.inner_text('#helpBody')
  # 2. AbortError ignored: no toast, no link box, no error
  pg=page("navigator.share=async()=>{throw new DOMException('cancel','AbortError')};window.__cb=[];navigator.clipboard.writeText=async t=>{__cb.push(t)};")
  pg.click('nav button[data-t=set]');pg.click('#set .shareBtn');pg.wait_for_timeout(200);assert pg.evaluate('__cb.length')==0 and not pg.is_visible('#shareLink')
  # 3. no share API: clipboard + toast
  pg=page("delete Navigator.prototype.share;navigator.share=undefined;window.__cb=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{__cb.push(t)}}});")
  pg.click('nav button[data-t=set]');pg.click('#set .shareBtn');pg.wait_for_timeout(200)
  assert pg.evaluate('__cb')==[URL] and pg.inner_text('#toast')=='Link copied' and pg.is_visible('#toast')
  # 4. clipboard fails too: link shown selectable
  pg=page("navigator.share=undefined;Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied')}}});")
  pg.click('nav button[data-t=set]');pg.click('#set .shareBtn');pg.wait_for_timeout(300)
  assert pg.is_visible('#shareUrl') and pg.input_value('#shareUrl')==URL and pg.evaluate("document.activeElement.id")=='shareUrl'
  assert pg.evaluate("(i=>i.selectionEnd-i.selectionStart)(document.getElementById('shareUrl'))")==len(URL)
  b.close()
assert not errs,errs;print('share ok')
# v16: About card with credit, only in Settings
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome');pg=b.new_page();pg.goto('http://localhost:8765/');pg.wait_for_timeout(700)
  import re,json;V=re.search(r'APP_VERSION=(\d+)',open('app.js').read()).group(1)
  pg.click('nav button[data-t=set]');card=pg.locator('#set .setCard.about')
  assert card.count()==1 and pg.locator('#set > *').last.get_attribute('id')=='aboutCard','About card at bottom'
  assert pg.locator('#aboutCard h3').inner_text()=='About' and pg.evaluate("getComputedStyle(document.querySelector('#aboutCard h3')).marginTop")=='0px'
  t=pg.inner_text('#aboutCard p:not(.muted)').split('\n');assert t==['Practice Player','Created by Todd W Harris, Hamler, Ohio','Version '+V,'© 2026 Todd W Harris'],t
  assert pg.inner_text('#aboutCard .muted')=='Your songs and playlists stay on this device. They are not part of the app and are never uploaded.'
  top=pg.locator('#set > *').first.inner_text();assert top=='Practice Player, Version '+V,top
  assert pg.inner_text('#set').count('Todd W Harris')==2,'credit only in About'
  pg.click('nav button[data-t=help]');assert 'Todd W Harris' not in pg.inner_text('#helpBody') and 'Developed by' not in pg.content()
  assert pg.evaluate("document.querySelector('meta[name=author]').content")=='Todd W Harris'
  m=json.load(open('manifest.webmanifest'));assert m['description'].endswith(' Created by Todd W Harris.')
  b.close();print('about ok')
