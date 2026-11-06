# V37: tuning card, per-string Done, style and splits, named pianos, centered landscape layout.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs = []
GEOM = """() => {
  const ids = ['gtNote','gtCents','gtNeedleWrap','gtPrompt','gtBeats','gtDone','gtKeys'];
  const vis = el => { if(!el) return false; const s=getComputedStyle(el); return !el.hidden && s.display!=='none' && s.visibility!=='hidden' && el.getClientRects().length; };
  const box = el => { const r=el.getBoundingClientRect(); return {id:el.id,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}; };
  const els = ids.map(id => document.getElementById(id)).filter(vis).map(box);
  const g = document.getElementById('gtune').getBoundingClientRect();
  const hits = [];
  for (let i=0;i<els.length;i++) for (let j=i+1;j<els.length;j++) {
    const a=els[i], b=els[j];
    if (Math.min(a.r,b.r)-Math.max(a.l,b.l)>1 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>1) hits.push(a.id+'/'+b.id);
  }
  const clip = els.filter(e => e.l < g.left-1 || e.t < g.top-1 || e.r > g.right+1 || e.b > g.bottom+1).map(e => e.id);
  const note = document.getElementById('gtNote').getBoundingClientRect();
  const pr = document.getElementById('gtPrompt');
  return {hits, clip, mid:(note.left+note.right)/2, vw:innerWidth, vh:innerHeight,
    font:parseFloat(getComputedStyle(pr).fontSize), noteH:note.height,
    promptW:pr.scrollWidth<=pr.clientWidth+2, pad:getComputedStyle(document.getElementById('gtune')).paddingLeft};
}"""

def cover_clear(pg, label):
  bad = pg.evaluate("""() => {
    const top = document.querySelector('.gtTop').getBoundingClientRect();
    const g = document.getElementById('gtune').getBoundingClientRect();
    const hits = [];
    [...document.querySelectorAll('.gtCover')].filter(el => !el.hidden).forEach(cover => {
      const cr = cover.getBoundingClientRect();
      [...cover.querySelectorAll('h2,p,button')].forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const x = Math.min(r.right, top.right) - Math.max(r.left, top.left);
        const y = Math.min(r.bottom, top.bottom) - Math.max(r.top, top.top);
        const label = (el.textContent || '').trim().slice(0, 40);
        if (x > 1 && y > 1) hits.push('top:' + label);
        if (r.left < g.left - 1 || r.right > g.right + 1 || r.top < g.top - 1 || r.bottom > cr.bottom + 1) hits.push('clip:' + label);
      });
    });
    return hits;
  }""")
  assert not bad, (label, bad)

def geom(pg, label):
  g = pg.evaluate(GEOM)
  assert not g['hits'], (label, g)
  assert not g['clip'], (label, g)
  assert abs(g['mid'] - g['vw']/2) < 36, (label, g)
  assert g['font'] >= 18, (label, g)
  assert g['noteH'] >= 48, (label, g)
  assert g['promptW'], (label, g)
  return g

with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx = b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, permissions=['microphone'])
  pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); ev = pg.evaluate
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(800)
  ev("""() => { localStorage.setItem('pp-tuner-profiles', JSON.stringify([{id:'keep',name:'Do not touch'}])); localStorage.setItem('pp-name','Todd'); }""")
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  assert pg.inner_text('#gtPick') == '' or 'Choose a piano' in pg.inner_text('#gtPick')
  assert pg.inner_text('#gtNew') == 'New piano'
  assert 'Choose a piano' in pg.inner_text('#gtPick')
  assert ev("PianoTune._session().type") is None
  assert ev("PianoTune._session().ready") is False
  pg.screenshot(path='/opt/cursor/artifacts/v37-profile-picker.png')
  cover_clear(pg, 'picker')
  pg.click('#gtNew')
  assert pg.is_visible('#gtStyle')
  for name in ['Concert grand (9 ft)','Baby grand','Studio upright','Spinet']:
    assert name in pg.inner_text('#gtStyle')
  assert pg.locator('#gtStyleNext').is_disabled()
  pg.screenshot(path='/opt/cursor/artifacts/v37-style-picker.png')
  cover_clear(pg, 'style')
  pg.click('#gtStyle button[data-style=concert]')
  assert pg.locator('#gtStyleNext').is_enabled()
  pg.click('#gtStyleNext'); pg.wait_for_timeout(150)
  body = pg.inner_text('#gtSplits')
  assert 'String layout' in body
  assert 'Lowest 3-string key: F3' in body
  assert 'Lowest 2-string key: C1' in body
  assert 'Set lowest 3-string key' in body and 'Set lowest 2-string key' in body
  assert 'Start pre-scan' in body
  assert 'Tap a key' in body
  pg.screenshot(path='/opt/cursor/artifacts/v37-split-picker.png')
  cover_clear(pg, 'splits')
  pg.click('#gtSplits button[data-which="2"]')
  pg.click('#gtKeys button[data-m="28"]')
  assert 'Lowest 2-string key: E1' in pg.inner_text('#gtSplits')
  pg.click('#gtSplitsStart'); pg.wait_for_timeout(250)
  assert pg.inner_text('#gtTitle').startswith('Pre-scan A0')
  assert 'Next: A 0' in pg.inner_text('#gtCents')
  g844 = geom(pg, '844 prescan')
  assert g844['noteH'] >= 80
  pg.set_viewport_size({'width':932,'height':430})
  pg.wait_for_timeout(200)
  geom(pg, '932 prescan')
  pg.set_viewport_size({'width':844,'height':390})
  pg.wait_for_timeout(150)
  # last pre-scan note shows the Tuning mode card and does not move on
  pg.click('#gtSteps'); pg.wait_for_timeout(80)
  labels = pg.locator('#gtList button').all_inner_texts()
  c8 = next(i for i,t in enumerate(labels) if t.endswith('Pre-scan C8'))
  a4last = next(i for i,t in enumerate(labels) if 'Set A4 string 3 of 3' in t)
  one = next(i for i,t in enumerate(labels) if 'Bass A0 string 1 of 1' in t)
  two = next(i for i,t in enumerate(labels) if 'Bass E1 string 2 of 2' in t)
  mid = next(i for i,t in enumerate(labels) if 'Set A4 string 2 of 3' in t)
  ev("document.getElementById('gtList').hidden=true")
  ev('(i)=>PianoTune.jump(i)', c8); pg.wait_for_timeout(150)
  before = ev("JSON.parse(localStorage.getItem('pp-pianotune')).step")
  ev("""() => { const midi=108; const cents=PianoTune.curveFor('concert').cents[midi];
    const t=PianoTune.targetFreq(midi,cents,440); const n=performance.now();
    for (let i=0;i<8;i++) PianoTune.feedHz(t*Math.pow(2,((i%2?6:-6))/1200), n+i*80); }""")
  assert pg.is_visible('#gtTuneCard')
  assert 'Tuning mode' in pg.inner_text('#gtTuneCard')
  assert pg.inner_text('#gtTuneOk') == 'OK'
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step") == before
  pg.screenshot(path='/opt/cursor/artifacts/v37-tuning-mode.png')
  cover_clear(pg, 'tuning card')
  pg.click('#gtTuneOk'); pg.wait_for_timeout(200)
  assert pg.is_hidden('#gtTuneCard')
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step") != before
  # prompts
  ev('(i)=>PianoTune.jump(i)', one); pg.wait_for_timeout(80)
  assert pg.inner_text('#gtPrompt') == 'Tune this string.'
  ev('(i)=>PianoTune.jump(i)', two); pg.wait_for_timeout(80)
  assert pg.inner_text('#gtPrompt') == 'Tune the other string to match.'
  ev('(i)=>PianoTune.jump(i)', mid); pg.wait_for_timeout(80)
  assert pg.inner_text('#gtPrompt') == 'Tune the next string to match.'
  ev('(i)=>PianoTune.jump(i)', a4last); pg.wait_for_timeout(120)
  held = ev("JSON.parse(localStorage.getItem('pp-pianotune')).step")
  ev("""() => { PianoTune._setSounding(false); PianoTune.feedHz(440, 0); PianoTune.feedHz(440, 500); }""")
  assert pg.is_visible('#gtDone')
  assert pg.inner_text('#gtDone') == 'Done'
  assert pg.inner_text('#gtPrompt') == 'Tune the last string to match.'
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step") == held
  geom(pg, '844 done')
  pg.set_viewport_size({'width':932,'height':430}); pg.wait_for_timeout(150)
  geom(pg, '932 done')
  pg.set_viewport_size({'width':844,'height':390}); pg.wait_for_timeout(100)
  ev("""() => { PianoTune._setSounding(false); PianoTune.feedHz(440, 0); PianoTune.feedHz(440, 500); PianoTune._setSounding(true); }""")
  pg.screenshot(path='/opt/cursor/artifacts/v37-string-done.png')
  pg.click('#gtDone'); pg.wait_for_timeout(150)
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step") == held+1
  assert pg.is_hidden('#gtDone')
  # save, reload, rename, delete. Other storage stays put.
  pg.fill('#gtPianoName', 'Church')
  pg.click('#gtSave')
  saved_step = ev("JSON.parse(localStorage.getItem('pp-pianotune')).step")
  assert ev("JSON.parse(localStorage.getItem('pp-tuner-profiles'))[0].name") == 'Do not touch'
  assert ev("localStorage.getItem('pp-name')") == 'Todd'
  pg.click('#gtClose'); pg.wait_for_timeout(100)
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  assert pg.is_visible('#gtPick')
  assert 'Church' in pg.inner_text('#gtSaved')
  assert pg.inner_text('#gtSaved button').find('Load') >= 0 or 'Load' in pg.inner_text('#gtSaved')
  assert 'Rename' in pg.inner_text('#gtSaved') and 'Delete' in pg.inner_text('#gtSaved')
  pg.screenshot(path='/opt/cursor/artifacts/v37-profile-picker.png')
  cover_clear(pg, 'saved piano')
  pg.click('#gtSaved button:text("Load")'); pg.wait_for_timeout(250)
  assert ev("JSON.parse(localStorage.getItem('pp-pianotune')).step") == saved_step
  assert pg.is_hidden('#gtPick')
  pg.click('#gtClose'); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  pg.once('dialog', lambda d: d.accept('Chapel'))
  pg.click('#gtSaved button:text("Rename")'); pg.wait_for_timeout(150)
  assert 'Chapel' in pg.inner_text('#gtSaved')
  pg.once('dialog', lambda d: d.accept())
  pg.click('#gtSaved button:text("Delete")'); pg.wait_for_timeout(150)
  assert 'Chapel' not in pg.inner_text('#gtSaved')
  assert ev("JSON.parse(localStorage.getItem('pp-tuner-profiles'))[0].name") == 'Do not touch'
  css = open('style.css').read()
  assert 'safe-area-inset' in css
  b.close()
assert not errs, errs
print('V37 OK')
