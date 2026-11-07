# Main Tuner scale preview: fixed 10-cent ticks, green zone moves, note beside the scale.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs = []

def place(pg):
  return pg.evaluate("""() => {
    const vis = el => { if(!el) return null; const s=getComputedStyle(el); const r=el.getBoundingClientRect();
      return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,show:s.display!=='none'&&s.visibility!=='hidden'}; };
    const track = document.querySelector('.tuTrack');
    const zone = document.getElementById('tuNeedle');
    const mid = document.querySelector('.tuMeterMid');
    const note = document.querySelector('.tuNoteBig');
    const labs = [...document.querySelectorAll('.tuLab')].map(el => ({c:el.dataset.cents, text:el.textContent, ...vis(el)}));
    const tr = vis(track), zn = vis(zone), md = vis(mid), nt = vis(note);
    const zmid = (zn.l+zn.r)/2, xmid = (md.l+md.r)/2;
    const hits = [];
    const boxes = [nt, tr, vis(document.getElementById('tuCents'))].filter(Boolean);
    for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++){
      const a=boxes[i], b=boxes[j];
      if (Math.min(a.r,b.r)-Math.max(a.l,b.l)>1 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>1) hits.push('stage');
    }
    labs.sort((a,b)=>a.l-b.l);
    for (let i=1;i<labs.length;i++) if (labs[i].l < labs[i-1].r-1) hits.push('lab:'+labs[i-1].text+'/'+labs[i].text);
    const g = document.getElementById('tuDisp').getBoundingClientRect();
    const clip = labs.filter(e => e.l < g.l-1 || e.r > g.r+1 || e.t < g.t-1).map(e => e.text);
    return {hits, clip, zmid, xmid, trackH:tr.h, trackW:tr.w, note:document.getElementById('tuNote').textContent+document.getElementById('tuOct').textContent,
      noteSize:parseFloat(getComputedStyle(document.querySelector('.tuNoteBig')).fontSize),
      labSize:parseFloat(getComputedStyle(document.querySelector('.tuLab')).fontSize),
      scroll:track.scrollWidth<=track.clientWidth+2,
      nLabs:labs.length, cents:document.getElementById('tuCents').textContent,
      sim:document.getElementById('tuSim')?document.getElementById('tuSim').textContent:'',
      zoneColor:getComputedStyle(zone).backgroundColor,
      ok:document.getElementById('tuMeter').classList.contains('ok')};
  }""")

def check(pg, label, expect):
  g = place(pg)
  assert not g['hits'], (label, g)
  assert not g['clip'], (label, g)
  assert g['scroll'], (label, g)
  assert g['nLabs']==11, (label, g)
  assert g['trackH']>=64, (label, g)
  assert g['note']=='A4', (label, g)
  assert g['noteSize']>=48, (label, g)
  assert g['labSize']>=12, (label, g)
  assert 'Simulated preview' in g['sim'], g
  if expect=='zero':
    assert abs(g['zmid']-g['xmid'])<4, (label, g)
    assert g['ok'] and '+0.0 cents' in g['cents']
  elif expect=='flat':
    assert g['zmid'] < g['xmid']-24, (label, g)
    assert not g['ok'] and g['cents'].startswith('-')
  elif expect=='sharp':
    assert g['zmid'] > g['xmid']+24, (label, g)
    assert not g['ok'] and g['cents'].startswith('+')
  assert '34, 197, 94' in g['zoneColor'] or '74, 222, 128' in g['zoneColor'], g['zoneColor']
  return g

with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
  pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(700)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  assert pg.locator('.tuLab').count()==11
  texts = pg.locator('.tuLab').all_inner_texts()
  assert texts==['-50','-40','-30','-20','-10','0','+10','+20','+30','+40','+50'], texts
  css = open('style.css').read()
  assert 'safe-area-inset-left' in css and 'safe-area-inset-right' in css
  # Guided piano meter is unchanged
  assert 'height:22px' in css and '.gtNeedle' in css
  pg.evaluate("Tuner.previewPitch(0,'A4')"); pg.wait_for_timeout(120)
  check(pg, 'portrait zero', 'zero')
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-zero.png')
  pg.evaluate("Tuner.previewPitch(-30,'A4')"); pg.wait_for_timeout(150)
  check(pg, 'portrait flat', 'flat')
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-flat.png')
  pg.evaluate("Tuner.previewPitch(25,'A4')"); pg.wait_for_timeout(150)
  check(pg, 'portrait sharp', 'sharp')
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-sharp.png')
  for vp, name in [({'width':844,'height':390},'land844'), ({'width':932,'height':430},'land932')]:
    pg.set_viewport_size(vp); pg.wait_for_timeout(150)
    pg.evaluate("Tuner.previewPitch(0,'A4')"); pg.wait_for_timeout(150)
    check(pg, name+' zero', 'zero')
    pg.evaluate("Tuner.previewPitch(-30,'A4')"); pg.wait_for_timeout(150)
    check(pg, name+' flat', 'flat')
    pg.evaluate("Tuner.previewPitch(25,'A4')"); pg.wait_for_timeout(150)
    check(pg, name+' sharp', 'sharp')
  pg.evaluate("Tuner.previewPitch(0,'A4')"); pg.wait_for_timeout(150)
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-zero-landscape.png')
  # Beyond the existing range, the zone stays pinned and the number is not clipped.
  pg.evaluate("Tuner.previewPitch(80,'A4')"); pg.wait_for_timeout(150)
  pinned = pg.evaluate("""() => {
    const track=document.querySelector('.tuTrack').getBoundingClientRect();
    const zone=document.getElementById('tuNeedle').getBoundingClientRect();
    return {edge:Math.abs((zone.left+zone.right)/2 - track.right)<track.width*0.08, text:document.getElementById('tuCents').textContent}; }""")
  assert pinned['edge'] and pinned['text'].startswith('+80'), pinned
  b.close()
assert not errs, errs
print('TUNER SCALE OK')
