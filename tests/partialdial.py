# Experimental partial dial: rings from real partials, landscape target, no Play again.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]

def fit(pg):
  return pg.evaluate("""()=>{
    const ids=['pdSvg','pdListen','pdKeys','pdTable'];
    const box=el=>{if(!el||el.hidden)return null; const r=el.getBoundingClientRect(); if(r.width<2||r.height<2)return null; return {id:el.id,l:r.left,t:r.top,r:r.right,b:r.bottom};};
    const els=ids.map(id=>box(document.getElementById(id))).filter(Boolean);
    const hits=[];
    for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
      const a=els[i],b=els[j];
      if(Math.min(a.r,b.r)-Math.max(a.l,b.l)>2 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>2) hits.push(a.id+'/'+b.id);
    }
    const g=document.getElementById('pdial').getBoundingClientRect();
    const clip=els.filter(e=>e.l<g.left-2||e.r>g.right+2||e.t<g.top-2).map(e=>e.id);
    return {hits, clip, font:parseFloat(getComputedStyle(document.getElementById('pdListen')).fontSize)};
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
  assert 'Simulated preview' in pg.inner_text('#pdSim')
  assert pg.locator('#pdKeys button').count()>40
  f=fit(pg); assert not f['hits'] and not f['clip'] and f['font']>=14, f
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
  pg.screenshot(path='/opt/cursor/artifacts/partial-dial-landscape.png')
  pg.set_viewport_size({'width':932,'height':430}); pg.wait_for_timeout(150)
  f=fit(pg); assert not f['hits'] and not f['clip'] and pg.is_visible('#pdTarget'), f
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
  b.close()
assert not errs, errs
print('PARTIAL DIAL OK')
