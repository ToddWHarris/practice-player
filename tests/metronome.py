# v30 Metronome: tempo words parsing, tap tempo, clamp, saved beats save/recall/delete, beat flash, stop on leave/song play.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  cases={'one twenty':120,'120':120,'ninety':90,'one hundred twenty':120,'one twenty five':125,'sixty six':66,'set it to eighty':80,'two hundred':200}
  for k,v in cases.items():assert ev("t=>MetroParse.cmd(t)",k)=={'bpm':v},(k,ev("t=>MetroParse.cmd(t)",k))
  assert ev("MetroParse.cmd('start')")=={'cmd':'start'} and ev("MetroParse.cmd('ok stop')")=={'cmd':'stop'} and ev("MetroParse.cmd('hello')") is None
  assert ev("[MetroParse.clamp(10),MetroParse.clamp(999),MetroParse.clamp(88.4)]")==[30,300,88]
  # tap tempo: 500 ms gaps -> 120, then a 3 s pause resets, 1000 ms gaps -> 60
  assert ev("(()=>{const t=MetroParse.tapper();let r=[];for(const x of [0,500,1000,1500,2000])r.push(t(x));r.push(t(5000));r.push(t(6000));r.push(t(7000));return r})()")==[None,120,120,120,120,None,60,60]
  pg.click('nav button[data-t=met]');pg.wait_for_timeout(200)
  assert pg.is_visible('#mGo') and pg.is_hidden('#player')
  pg.fill('#mBpmIn','500');pg.press('#mBpmIn','Enter');assert pg.inner_text('#mBpm')=='300'
  pg.fill('#mBpmIn','96');pg.press('#mBpmIn','Enter');assert pg.inner_text('#mBpm')=='96'
  pg.click('#mPlus');pg.click('#mPlus');pg.click('#mMinus');assert pg.inner_text('#mBpm')=='97'
  pg.select_option('#mSig','6/8');assert ev("document.querySelectorAll('#mDots .mDot').length")==6
  # save / recall / delete
  for name in ['Waltz','Ballad']:
    pg.once('dialog',lambda d,n=name:d.accept(n))
    if name=='Waltz':pg.select_option('#mSig','3/4');pg.fill('#mBpmIn','84');pg.press('#mBpmIn','Enter')
    else:pg.select_option('#mSig','4/4');pg.fill('#mBpmIn','66');pg.press('#mBpmIn','Enter')
    pg.click('#mSave')
  assert ev("JSON.parse(localStorage.getItem('pp-beats'))")==[{'name':'Ballad','bpm':66,'sig':'4/4'},{'name':'Waltz','bpm':84,'sig':'3/4'}]
  pg.select_option('#mBeats','1');assert pg.inner_text('#mBpm')=='84' and pg.input_value('#mSig')=='3/4'
  assert 'pp-beats' in ev("BK.PREFS")
  # voice handler (recognizer results go through Metro.heard)
  ev("Metro.heard('one twenty')");assert pg.inner_text('#mBpm')=='120'
  # start: flash on beat one with accent class
  pg.click('#mGo');pg.wait_for_function("document.getElementById('mDisp').classList.contains('f1')",timeout=3000)
  pg.screenshot(path='/workspace/shots/v30-flash.png')
  pg.wait_for_function("document.getElementById('mDisp').classList.contains('fn')",timeout=3000)
  assert ev("Metro.M.on") and pg.inner_text('#mGo')=='Stop'
  pg.click('#mGo');assert not ev("Metro.M.on")
  ev("document.getElementById('mBeats').size=3");pg.screenshot(path='/workspace/shots/v30-saved-beats.png');ev("document.getElementById('mBeats').size=0")
  # leaving the tab stops it
  pg.click('#mGo');pg.wait_for_timeout(200);pg.click('nav button[data-t=lib]');assert not ev("Metro.M.on") and pg.is_visible('#player')
  # a song playing stops it
  pg.click('nav button[data-t=met]');pg.click('#mGo');ev("au.dispatchEvent(new Event('play'))");assert not ev("Metro.M.on")
  # persists across reload
  pg.reload();pg.wait_for_timeout(900);assert ev("Metro.M.bpm")==120 and ev("Metro.beats().length")==2
  assert not errs,errs
  print('METRONOME OK')
