# Experimental partial dial: rings from real partials, landscape target, no Play again.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]

def fit(pg):
  return pg.evaluate("""()=>{
    const box=el=>{if(!el||el.hidden||el.closest('[hidden]'))return null; const r=el.getBoundingClientRect(); if(r.width<2||r.height<2)return null; return {id:el.id,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
    const note=box(document.getElementById('pdNote'));
    const listen=box(document.getElementById('pdListen'));
    const keys=box(document.getElementById('pdKeys'));
    const svg=box(document.getElementById('pdSvg'));
    const target=box(document.getElementById('pdTarget'));
    const status=box(document.getElementById('pdStatus'));
    const g=document.getElementById('pdial').getBoundingClientRect();
    const overlap=(a,b)=>a&&b&&Math.min(a.r,b.r)-Math.max(a.l,b.l)>2&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>2;
    const hits=[];
    if(overlap(note,listen))hits.push('note/listen');
    if(overlap(listen,keys))hits.push('listen/keys');
    if(overlap(note,keys))hits.push('note/keys');
    if(overlap(target,svg))hits.push('target/dial');
    if(overlap(target,listen))hits.push('target/listen');
    const measure=box(document.getElementById('pdMeasure'));
    const useBtn=box(document.getElementById('pdSaveNote'));
    const dropBtn=box(document.getElementById('pdRetry'));
    [measure,useBtn,dropBtn].forEach(el=>{
      if(!el)return;
      if(overlap(el,svg))hits.push(el.id+'/dial');
      if(overlap(el,listen))hits.push(el.id+'/listen');
      if(overlap(el,keys))hits.push(el.id+'/keys');
    });
    const els=[note,listen,keys,svg,status,measure,useBtn,dropBtn].filter(Boolean);
    const clip=els.filter(e=>e.l<g.left-2||e.r>g.right+2||e.t<g.top-2||e.b>g.bottom+2).map(e=>e.id);
    const whites=[...document.querySelectorAll('#pdKeys .wk')];
    const a0=whites[0]&&whites[0].getBoundingClientRect();
    const c8=whites.length&&whites[whites.length-1].getBoundingClientRect();
    const mid=(svg.l+svg.r)/2, center=(g.left+g.right)/2;
    return {hits, clip, font:parseFloat(getComputedStyle(document.getElementById('pdListen')).fontSize),
      dialW:svg&&svg.w, dialH:svg&&svg.h, keyH:keys&&keys.h, keyTop:keys&&keys.t, viewW:g.width, viewH:g.height,
      off:svg?Math.abs(mid-center):null, whites:whites.length, blacks:document.querySelectorAll('#pdKeys .bk').length,
      a0:a0&&a0.left, c8:c8&&c8.right, keyL:keys&&keys.l, keyR:keys&&keys.r,
      note:note&&parseFloat(getComputedStyle(document.getElementById('pdNote')).fontSize)};
  }""")

with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  pg=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, permissions=['microphone']).new_page()
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('http://127.0.0.1:8765/'); pg.wait_for_timeout(700)
  assert pg.locator('#gtAgain').count()==0
  assert pg.locator('button', has_text='Play again').count()==0
  assert 'Play again' not in pg.inner_text('#helpBody')
  assert pg.locator('#again').count()==1
  assert pg.locator('#edAgain').count()==1
  pg.click('nav button[data-t=tun]')
  pg.wait_for_function("document.getElementById('tun').classList.contains('on')")
  pg.evaluate("localStorage.setItem('pp-pianotune', JSON.stringify({v:3,keep:1})); localStorage.setItem('pp-piano-profiles','[]')")
  pg.locator('#pdOpen').scroll_into_view_if_needed(); pg.click('#pdOpen'); pg.wait_for_timeout(300)
  assert pg.evaluate('PianoTune.PRESCAN.length')==88
  assert pg.is_hidden('#pdTarget')
  r=pg.evaluate("()=>PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[1,2,3,4,5,6]})")
  assert r['f1Heard'] and r['bStatus']=='measured', r
  assert pg.locator('#pdRings [data-n="1"]').count()>=1
  assert 'Play A4 alone' in pg.inner_text('#pdListen') and 'overtones' in pg.inner_text('#pdListen')
  assert 'Confidence high' in pg.inner_text('#pdStatus')
  assert 'Simulated preview' in pg.inner_text('#pdSim')
  vis=pg.inner_text('#pdial')
  assert 'Overtone 1' not in vis and 'unstiffened' not in vis and '3.99' not in vis
  assert pg.locator('#pdKeys .wk').count()==52 and pg.locator('#pdKeys .bk').count()==36
  assert pg.locator('#pdSamples').count()==0 and pg.locator('.pdEx').count()==0
  assert 'Example notes' not in pg.inner_text('#pdial')
  assert pg.inner_text('#pdSaveNote')=='Use this measurement'
  assert pg.inner_text('#pdRetry')=='Discard and measure again'
  assert "does not mark the note as tuned" in pg.inner_text('#pdMeasure')
  assert 'Use this measurement' in pg.inner_text('#helpBody') and 'Discard and measure again' in pg.inner_text('#helpBody')
  assert 'Keep this note' not in pg.inner_text('#helpBody') and 'Retry note' not in pg.inner_text('#helpBody')
  assert 'Tap a key on the keyboard' in pg.inner_text('#helpBody')
  assert 'example notes' not in pg.inner_text('#helpBody').lower()
  pg.click('#pdDetailsBtn'); pg.wait_for_timeout(100)
  assert 'Overtone 1' in pg.inner_text('#pdTable') and 'unstiffened' in pg.inner_text('#pdTable')
  pg.click('#pdDetailsBtn'); pg.wait_for_timeout(80)
  assert pg.is_hidden('#pdDetails')
  f=fit(pg); assert not f['hits'] and not f['clip'] and f['font']>=14, f
  assert f['dialW']>=280 and f['note']>=48, f
  assert f['whites']==52 and f['a0']<=f['keyL']+8 and f['c8']>=f['keyR']-8, f
  pg.screenshot(path='/opt/cursor/artifacts/partial-dial-zero.png')
  sharp=pg.evaluate("()=>PartialDial.preview({midi:69,f1:440*Math.pow(2,12/1200),B:0.0003,partials:[1,2,3,4,5]})")
  p1=next(x for x in sharp['partials'] if x['n']==1)
  assert p1['cents']>8
  pg.screenshot(path='/opt/cursor/artifacts/partial-dial-sharp.png')
  miss=pg.evaluate("()=>PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[2,3,4,5,6]})")
  assert miss['f1Heard'] is False
  assert pg.locator('#pdRings [data-n="1"]').count()==0
  assert 'Partial 1 not heard' in pg.inner_text('#pdCents')
  pg.screenshot(path='/opt/cursor/artifacts/partial-dial-no-fundamental.png')
  pg.set_viewport_size({'width':844,'height':390}); pg.wait_for_timeout(200)
  pg.evaluate("()=>PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[1,2,3,4,5,6]})")
  assert pg.is_visible('#pdTarget') and pg.inner_text('#pdTargetName')=='A4'
  f=fit(pg); assert not f['hits'] and not f['clip'], f
  assert f['dialW']>=320 and f['dialW']/f['viewW']>0.36, f
  assert f['off']<30, f
  assert f['keyTop']/f['viewH']>0.80, f
  assert f['a0']<=f['keyL']+8 and f['c8']>=f['keyR']-8, f
  assert 'Overtone 1' not in pg.inner_text('#pdial')
  pg.screenshot(path='/opt/cursor/artifacts/partial-dial-landscape.png')
  pg.set_viewport_size({'width':932,'height':430}); pg.wait_for_timeout(150)
  f=fit(pg); assert not f['hits'] and not f['clip'] and pg.is_visible('#pdTarget'), f
  assert f['dialW']/f['viewW']>0.36 and f['off']<36 and f['keyTop']/f['viewH']>0.80, f
  # Help returns to the same target note.
  pg.click('#pdHelp'); pg.wait_for_timeout(250)
  assert 'Partial dial (experimental)' in pg.inner_text('#h-partial-dial')
  assert pg.is_hidden('#pdial')
  pg.click('#pdHelpBack'); pg.wait_for_timeout(200)
  assert pg.is_visible('#pdial') and pg.inner_text('#pdTargetName')=='A4'
  # One measured note is not a curve. Three makes an experimental walk, not a guided-tune target.
  pg.evaluate("()=>{PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[1,2,3,4,5,6]}); PartialDial.storeCurrent()}")
  assert 'unavailable' in pg.inner_text('#pdStretch').lower()
  pg.evaluate("""()=>{
    PartialDial.preview({midi:45,f1:110,B:0.0005,partials:[1,2,3,4,5]}); PartialDial.storeCurrent();
    PartialDial.preview({midi:93,f1:1760,B:0.001,partials:[1,2,3,4]}); PartialDial.storeCurrent();
  }""")
  stretch=pg.inner_text('#pdStretch')
  assert 'not a tuning target' in stretch.lower() and 'experimental' in stretch.lower()
  pg.fill('#pdName','Shop upright')
  pg.click('#pdSave')
  assert pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).keep")==1
  assert pg.evaluate("localStorage.getItem('pp-piano-profiles')")=='[]'
  assert 'Shop upright' in pg.evaluate("localStorage.getItem('pp-partial-profiles')")
  assert 'pp-partial-profiles' in pg.evaluate('BK.PREFS')
  pg.click('#pdKeys button[data-m="57"]')
  pg.wait_for_timeout(150)
  assert 'Play A3 alone' in pg.inner_text('#pdListen')
  assert pg.inner_text('#pdKeys .pdFlag')=='A3'
  assert pg.inner_text('#pdTargetName')=='A3'
  assert pg.locator('#gtKeys').count()==1
  assert pg.locator('#pdial button', has_text='A0').count()==0
  pg.evaluate("()=>PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[1,2,3,4,5,6]})")
  assert pg.evaluate('()=>PartialDial.storeCurrent()') is True
  assert 'Measurement accepted' in pg.inner_text('#pdKeep') and 'Not tuned' in pg.inner_text('#pdKeep')
  pg.evaluate("()=>PartialDial.preview({midi:60,f1:261.63,B:0.0004,partials:[1]})")
  assert pg.evaluate('()=>PartialDial.storeCurrent()') is False
  assert 'Not accepted' in pg.inner_text('#pdKeep')
  assert pg.evaluate("()=>!PartialDial._profile().notes[60]")
  pg.click('#pdRetry')
  pg.wait_for_timeout(100)
  assert pg.inner_text('#pdKeep')==''
  assert pg.evaluate("()=>!PartialDial._profile().notes[60]")
  b.close()
assert not errs, errs
print('PARTIAL DIAL OK')
