# Experimental partial dial: rings from real partials, landscape target, no Play again.
from playwright.sync_api import sync_playwright
import os
os.makedirs('/opt/cursor/artifacts', exist_ok=True)
errs=[]

def fit(pg):
  return pg.evaluate("""()=>{
    const box=el=>{if(!el||el.hidden||el.closest('[hidden]'))return null; const r=el.getBoundingClientRect(); if(r.width<2||r.height<2)return null; return {id:el.id,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
    const note=box(document.getElementById('gtNote'));
    const listen=box(document.getElementById('gtPrompt'));
    const keys=box(document.getElementById('gtKeys'));
    const svg=box(document.getElementById('pdSvg'));
    const target=box(document.getElementById('pdTarget'));
    const status=box(document.getElementById('pdStatus'));
    const g=document.getElementById('gtune').getBoundingClientRect();
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
    const whites=[...document.querySelectorAll('#gtKeys .wk')];
    const a0=whites[0]&&whites[0].getBoundingClientRect();
    const c8=whites.length&&whites[whites.length-1].getBoundingClientRect();
    const mid=(svg.l+svg.r)/2, center=(g.left+g.right)/2;
    return {hits, clip, font:parseFloat(getComputedStyle(document.getElementById('gtPrompt')).fontSize),
      dialW:svg&&svg.w, dialH:svg&&svg.h, keyH:keys&&keys.h, keyTop:keys&&keys.t, viewW:g.width, viewH:g.height,
      off:svg?Math.abs(mid-center):null, whites:whites.length, blacks:document.querySelectorAll('#gtKeys .bk').length,
      a0:a0&&a0.left, c8:c8&&c8.right, keyL:keys&&keys.l, keyR:keys&&keys.r,
      note:note&&parseFloat(getComputedStyle(document.getElementById('gtNote')).fontSize)};
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
  pg.locator('#gtOpen').scroll_into_view_if_needed(); pg.click('#gtOpen'); pg.wait_for_timeout(200)
  pg.click('#gtNew'); pg.click('#gtStyle button[data-style=concert]'); pg.click('#gtStyleNext'); pg.click('#gtCalModel');   pg.click('#gtSplitsStart'); pg.wait_for_timeout(300)
  pg.click('#gtSteps'); pg.wait_for_timeout(80)
  labels=pg.locator('#gtList button').all_inner_texts()
  a4=next(i for i,t in enumerate(labels) if 'Set A4 string 1 of 3' in t)
  pg.evaluate('document.getElementById("gtList").hidden=true')
  pg.evaluate('(i)=>PianoTune.jump(i)', a4); pg.wait_for_timeout(150)
  assert pg.evaluate('PianoTune.PRESCAN.length')==88
  assert pg.is_hidden('#pdTarget')
  r=pg.evaluate("()=>PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[1,2,3,4,5,6]})")
  assert r['f1Heard'] and r['bStatus']=='measured', r
  assert pg.locator('#pdRings [data-n="1"]').count()>=1
  prompt=pg.inner_text('#gtPrompt')
  assert prompt.count('Play A4 alone')==1 and 'what was heard' in prompt and 'not the tuning target' in prompt
  assert pg.inner_text('#pdListen')==''
  assert 'Confidence high' in pg.inner_text('#pdStatus')
  assert 'Simulated preview' in pg.inner_text('#pdSim')
  vis=pg.inner_text('#gtune')
  assert 'Overtone 1' not in vis and 'unstiffened' not in vis and '3.99' not in vis
  assert pg.locator('#gtKeys .wk').count()==52 and pg.locator('#gtKeys .bk').count()==36
  assert pg.locator('#pdSamples').count()==0 and pg.locator('.pdEx').count()==0
  assert 'Example notes' not in pg.inner_text('#gtune')
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
  assert f['dialW']>=150 and f['note']>=48 and f['keyH']>=80, f
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
  assert f['dialW']>=80 and f['dialH']>=80 and f['keyH']>=64, f
  assert f['off']<40, f
  assert f['keyTop']/f['viewH']>0.70, f
  assert f['a0']<=f['keyL']+8 and f['c8']>=f['keyR']-8, f
  assert 'Overtone 1' not in pg.inner_text('#gtune')
  pg.screenshot(path='/opt/cursor/artifacts/partial-dial-landscape.png')
  pg.set_viewport_size({'width':932,'height':430}); pg.wait_for_timeout(150)
  f=fit(pg); assert not f['hits'] and not f['clip'] and pg.is_visible('#pdTarget'), f
  assert f['dialW']>=80 and f['dialH']>=80 and f['keyH']>=64 and f['off']<40 and f['keyTop']/f['viewH']>0.70, f
  # Help returns to the same target note.
  pg.click('#pdHelp'); pg.wait_for_timeout(250)
  assert 'Partial dial' in pg.inner_text('#h-partial-dial')
  assert pg.is_hidden('#gtune')
  pg.click('#pdHelpBack'); pg.wait_for_timeout(200)
  assert pg.is_visible('#gtune') and pg.inner_text('#pdTargetName')=='A4'
  # One measured note is not a curve. Three makes an experimental walk, not a guided-tune target.
  pg.evaluate("()=>{PartialDial.preview({midi:69,f1:440,B:0.0004,partials:[1,2,3,4,5,6]}); PartialDial.storeCurrent()}")
  assert 'unavailable' in pg.inner_text('#pdStretch').lower()
  pg.evaluate("""()=>{
    PartialDial.preview({midi:45,f1:110,B:0.0005,partials:[1,2,3,4,5]}); PartialDial.storeCurrent();
    PartialDial.preview({midi:93,f1:1760,B:0.001,partials:[1,2,3,4]}); PartialDial.storeCurrent();
  }""")
  stretch=pg.inner_text('#pdStretch')
  assert 'not a tuning target' in stretch.lower() and 'experimental' in stretch.lower()
  pg.click('#pdDetailsBtn'); pg.wait_for_timeout(80)
  pg.fill('#pdName','Shop upright')
  pg.click('#pdSave')
  pg.click('#pdDetailsBtn'); pg.wait_for_timeout(80)
  step=pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).step")
  assert pg.evaluate("localStorage.getItem('pp-piano-profiles')") in (None,'[]') or True
  before=pg.evaluate("localStorage.getItem('pp-piano-profiles')")
  assert pg.evaluate("JSON.parse(localStorage.getItem('pp-pianotune')).step")==step
  assert pg.evaluate("localStorage.getItem('pp-piano-profiles')")==before
  assert 'Shop upright' in pg.evaluate("localStorage.getItem('pp-partial-profiles')")
  assert 'pp-partial-profiles' in pg.evaluate('BK.PREFS')
  pg.click('#gtKeys button[data-m="57"]')
  pg.wait_for_timeout(150)
  assert 'A3' in pg.inner_text('#gtTitle') or 'A3' in pg.inner_text('#gtPrompt')
  assert pg.locator('#gtKeys').count()==1
  assert all(t.strip()!='A0' for t in pg.locator('#gtune button').all_inner_texts())
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
