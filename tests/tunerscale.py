# Tuner meter preview: fixed cents, moving green zone, sliding note band.
# The static Tune label is piano + landscape only.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs = []

def read(pg):
  return pg.evaluate("""() => {
    const box = el => { if(!el) return null; const r=el.getBoundingClientRect(); const s=getComputedStyle(el);
      return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,show:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}; };
    const win = document.querySelector('.tuNoteWin').getBoundingClientRect();
    const notes = [...document.querySelectorAll('.tuSlideNote')].map(el => ({note:el.dataset.note, ...box(el)}));
    const labs = [...document.querySelectorAll('.tuLab')].map(el => ({text:el.textContent, ...box(el)}));
    const zone = box(document.getElementById('tuNeedle'));
    const red = box(document.querySelector('.tuRedNeedle'));
    const tgt = box(document.getElementById('tuTargetNote'));
    const g = document.getElementById('tuDisp').getBoundingClientRect();
    labs.sort((a,b)=>a.l-b.l);
    const hits=[];
    for (let i=1;i<labs.length;i++) if (labs[i].l < labs[i-1].r-1) hits.push('lab:'+labs[i-1].text+'/'+labs[i].text);
    const shown = notes.filter(n => n.l < win.right-8 && n.r > win.left+8);
    shown.sort((a,b)=>a.l-b.l);
    for (let i=1;i<shown.length;i++) if (shown[i].l < shown[i-1].r-2) hits.push('note:'+shown[i-1].note+'/'+shown[i].note);
    const clip = labs.filter(e => e.l < g.l-1 || e.r > g.r+1).map(e => e.text);
    const a4 = notes.find(n => n.note==='A4');
    const gsh = notes.find(n => n.note==='G#4');
    const ash = notes.find(n => n.note==='A#4');
    return {hits, clip, notes:notes.map(n=>n.note),
      a4:a4&& (a4.l+a4.r)/2, gsh:gsh&& (gsh.l+gsh.r)/2, ash:ash&& (ash.l+ash.r)/2,
      zone:(zone.l+zone.r)/2, red:(red.l+red.r)/2,
      tgtShow:!!(tgt&&tgt.show), tgtText:(document.getElementById('tuNote').textContent||'')+(document.getElementById('tuOct').textContent||''),
      tgtL:tgt&&tgt.l, cents:document.getElementById('tuCents').textContent,
      sim:document.getElementById('tuSim')?document.getElementById('tuSim').textContent:'',
      piano:document.getElementById('tuStage').classList.contains('forPiano'),
      trackH:document.querySelector('.tuTrack').getBoundingClientRect().height,
      scroll:document.querySelector('.tuTrack').scrollWidth<=document.querySelector('.tuTrack').clientWidth+2};
  }""")

def order_ok(g):
  assert g['gsh'] < g['a4'] < g['ash'], g
  assert g['scroll'] and not g['hits'] and not g['clip'], g
  assert 'Simulated preview' in g['sim']

with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
  pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(700)
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  assert pg.locator('.tuLab').all_inner_texts()==['-50','-40','-30','-20','-10','0','+10','+20','+30','+40','+50']
  css=open('style.css').read()
  assert 'safe-area-inset-left' in css and '.gtNeedle' in css and 'height:22px' in css
  pg.select_option('#tuInst','piano')
  # Portrait piano: no static left label, even if a target was passed.
  pg.evaluate("Tuner.previewPitch(0,'A4','E2')"); pg.wait_for_timeout(160)
  z=read(pg)
  order_ok(z)
  assert not z['tgtShow'] and z['piano'], z
  assert abs(z['a4']-z['red'])<8 and abs(z['zone']-z['red'])<8, z
  assert z['cents']=='+0.0 cents'
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-zero.png')
  x0=z['a4']
  pg.evaluate("Tuner.previewPitch(-30,'A4','A4')"); pg.wait_for_timeout(160)
  flat=read(pg)
  order_ok(flat)
  assert not flat['tgtShow'], flat
  assert flat['a4'] < x0-20 and flat['zone'] < flat['red']-20, flat
  assert flat['cents'].startswith('-30')
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-flat.png')
  pg.evaluate("Tuner.previewPitch(25,'A4','A4')"); pg.wait_for_timeout(160)
  sharp=read(pg)
  order_ok(sharp)
  assert not sharp['tgtShow'], sharp
  assert sharp['a4'] > x0+20 and sharp['zone'] > sharp['red']+20, sharp
  assert sharp['cents'].startswith('+25')
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-sharp.png')
  # Octave neighbors stay in pitch order.
  pg.evaluate("Tuner.previewPitch(0,'C4')"); pg.wait_for_timeout(160)
  names=pg.evaluate("[...document.querySelectorAll('.tuSlideNote')].map(n=>n.dataset.note)")
  assert names[names.index('C4')-1]=='B3' and names[names.index('C4')+1]=='C#4', names
  # Landscape piano shows a static Tune label, and it is the target, not the heard note.
  pg.set_viewport_size({'width':844,'height':390}); pg.wait_for_timeout(150)
  pg.evaluate("Tuner.previewPitch(0,'A4','A4')"); pg.wait_for_timeout(160)
  land=read(pg)
  order_ok(land)
  assert land['tgtShow'] and land['tgtText']=='A4', land
  assert abs(land['a4']-land['red'])<8, land
  left0=land['tgtL']
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-zero-landscape.png')
  pg.evaluate("Tuner.previewPitch(-30,'A4','A4')"); pg.wait_for_timeout(160)
  lf=read(pg); order_ok(lf)
  assert lf['tgtShow'] and lf['tgtText']=='A4' and abs(lf['tgtL']-left0)<2, lf
  assert lf['a4'] < land['a4']-20 and lf['zone'] < lf['red']-20, lf
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-flat-landscape.png')
  pg.evaluate("Tuner.previewPitch(25,'A4','A4')"); pg.wait_for_timeout(160)
  ls=read(pg); order_ok(ls)
  assert ls['tgtShow'] and ls['tgtText']=='A4' and abs(ls['tgtL']-left0)<2, ls
  assert ls['a4'] > land['a4']+20 and ls['zone'] > ls['red']+20, ls
  pg.screenshot(path='/opt/cursor/artifacts/tuner-a4-sharp-landscape.png')
  # Heard A4, but the note to tune is E2. The side label must not copy the heard note.
  pg.evaluate("Tuner.previewPitch(12,'A4','E2')"); pg.wait_for_timeout(160)
  mix=read(pg)
  assert mix['tgtShow'] and mix['tgtText']=='E2', mix
  assert 'A4' in mix['notes'] and 'E2' not in mix['notes'], mix
  # Non-piano landscape: no side label. The moving band remains.
  for inst in ['auto','guitar','bass','trumpet','euph']:
    pg.select_option('#tuInst', inst)
    pg.evaluate("Tuner.previewPitch(12,'A4','E2')"); pg.wait_for_timeout(160)
    g=read(pg)
    assert not g['tgtShow'] and g['tgtText']=='' and not g['piano'], (inst, g)
    assert 'A4' in g['notes'] and g['gsh'] < g['a4'] < g['ash'], (inst, g)
  pg.select_option('#tuInst','guitar')
  pg.evaluate("Tuner.previewPitch(12,'A4','E2')"); pg.wait_for_timeout(160)
  pg.screenshot(path='/opt/cursor/artifacts/tuner-guitar-no-target-landscape.png')
  # Same instruments in portrait stay unlabeled.
  pg.set_viewport_size({'width':390,'height':844}); pg.wait_for_timeout(120)
  pg.select_option('#tuInst','piano')
  pg.evaluate("Tuner.previewPitch(0,'A4','E2')"); pg.wait_for_timeout(160)
  assert not read(pg)['tgtShow']
  for inst in ['auto','guitar']:
    pg.select_option('#tuInst', inst)
    pg.evaluate("Tuner.previewPitch(-20,'G3','C4')"); pg.wait_for_timeout(160)
    g=read(pg)
    assert not g['tgtShow'] and g['tgtText']=='', (inst, g)
    assert 'G3' in g['notes']
  b.close()
assert not errs, errs
print('TUNER SCALE OK')
