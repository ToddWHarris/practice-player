# v33 Level tab: labels, RMS display, peak reset, calibration save/reload/reset, mic lifecycle, backup key.
from playwright.sync_api import sync_playwright
import math,os
os.makedirs('/opt/cursor/artifacts',exist_ok=True)
errs=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,permissions=['microphone'])
  pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.add_init_script("""(()=>{const o=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async function(c){const s=await o(c);window.__stopped=window.__stopped||0;window.__tracks=window.__tracks||[];
    s.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{window.__stopped++;stop()};window.__tracks.push(t)});return s}})()""")
  pg.goto('http://127.0.0.1:8765/');pg.wait_for_timeout(700)
  tabs=pg.locator('nav button').all_inner_texts()
  assert tabs==['Library','Playlists','Metronome','Tuner','Level','Settings','Help'],tabs
  pg.set_viewport_size({'width':320,'height':700})
  nav=pg.locator('#tabs').bounding_box()
  for i in range(7):
    btn=pg.locator('nav button').nth(i)
    btn.evaluate("el=>el.scrollIntoView({inline:'nearest',block:'nearest'})")
    bb=btn.bounding_box()
    assert bb and bb['width']>=24 and bb['x']>=nav['x']-1 and bb['x']+bb['width']<=nav['x']+nav['width']+2, (i,bb,nav)
  pg.set_viewport_size({'width':390,'height':844})
  pg.click('nav button[data-t=lvl]');pg.wait_for_timeout(200)
  assert pg.is_hidden('#player') and pg.is_hidden('#card')
  assert pg.inner_text('#lvKind')=='Not calibrated'
  assert pg.inner_text('#lvUnit')=='dBFS'
  assert pg.inner_text('#lvGo')=='Start'
  assert 'not a sound pressure' in pg.inner_text('#lvNotice').lower()
  assert 'dB SPL' not in pg.inner_text('#lvUnit')
  # Known sine through the same feed path the mic loop uses. Long dt settles the smoother.
  amp=0.1
  expect=20*math.log10(amp/math.sqrt(2))
  ev("""amp=>{const n=4800,b=new Float32Array(n);for(let i=0;i<n;i++)b[i]=amp*Math.sin(2*Math.PI*i/48);Meter.L.on=true;Meter.feed(b,10)}""",amp)
  got=float(pg.inner_text('#lvNum'))
  assert abs(got-expect)<0.15,(got,expect)
  assert pg.inner_text('#lvKind')=='Not calibrated' and pg.inner_text('#lvUnit')=='dBFS'
  assert 'dBFS' in pg.inner_text('#lvPeak')
  # Quieter frame must not drop the peak. Reset peak follows the current RMS.
  ev("""()=>{const n=4800,b=new Float32Array(n);for(let i=0;i<n;i++)b[i]=0.01*Math.sin(2*Math.PI*i/48);Meter.feed(b,10)}""")
  quiet=float(pg.inner_text('#lvNum'))
  peak=float(pg.inner_text('#lvPeak').split(':')[1].split('dBFS')[0])
  assert peak>quiet+5,(peak,quiet)
  pg.click('#lvPeakReset')
  peak2=float(pg.inner_text('#lvPeak').split(':')[1].split('dBFS')[0])
  assert abs(peak2-quiet)<0.2,(peak2,quiet)
  # Silence
  ev("()=>{Meter.feed(new Float32Array(2048),10)}")
  assert pg.inner_text('#lvNum')=='Silence'
  # Digital clipping is a status, not a color scale
  ev("""()=>{const b=new Float32Array(2048);b.fill(0);b[0]=1;Meter.L.on=true;Meter.feed(b,0.01)}""")
  assert 'Digital clipping' in pg.inner_text('#lvStatus')
  # Calibration from the settled -23 dBFS-class reading
  ev("""amp=>{const n=4800,b=new Float32Array(n);for(let i=0;i<n;i++)b[i]=amp*Math.sin(2*Math.PI*i/48);Meter.L.on=true;Meter.L.dev={deviceId:'mic-a',label:'Test mic',sampleRate:48000,agc:false,ns:false,ec:false};Meter.feed(b,10)}""",amp)
  pg.fill('#lvRef','70');pg.click('#lvCalSave')
  assert pg.inner_text('#lvKind')=='Estimated'
  assert pg.inner_text('#lvUnit')=='dB SPL est.'
  assert abs(float(pg.inner_text('#lvNum'))-70)<0.2
  notice=pg.inner_text('#lvNotice').lower()
  assert 'approximate' in notice and 'not a safety meter' in notice and 'not a-weighted' in notice
  assert ev("localStorage.getItem('pp-meter')")
  raw=ev("JSON.parse(localStorage.getItem('pp-meter'))")
  assert raw['deviceId']=='mic-a' and abs(raw['refSpl']-70)<1e-6 and 'offset' in raw
  pg.reload();pg.wait_for_timeout(700);pg.click('nav button[data-t=lvl]')
  assert pg.inner_text('#lvKind')=='Estimated' and pg.inner_text('#lvUnit')=='dB SPL est.'
  pg.click('#lvCalReset')
  assert pg.inner_text('#lvKind')=='Not calibrated' and pg.inner_text('#lvUnit')=='dBFS'
  assert ev("localStorage.getItem('pp-meter')") is None
  # Empty reference is refused. Silence is refused.
  ev("()=>{Meter.L.on=true;Meter.feed(new Float32Array(2048),10)}")
  pg.fill('#lvRef','65');pg.click('#lvCalSave')
  assert pg.inner_text('#lvKind')=='Not calibrated'
  assert 'silence' in pg.inner_text('#lvStatus').lower()
  # Mic lifecycle: start, leave tab, hide, song play, tuner takes the mic
  ev('Meter.stop()')
  pg.click('#lvGo');pg.wait_for_timeout(400)
  assert ev('Meter.L.on') is True and ev('window.__tracks.length')>=1 and pg.inner_text('#lvGo')=='Stop'
  assert 'Browser reports' in pg.inner_text('#lvProc')
  stopped=ev('window.__stopped')
  pg.click('nav button[data-t=lib]');pg.wait_for_timeout(200)
  assert ev('Meter.L.on') is False and ev('window.__stopped')>stopped
  pg.click('nav button[data-t=lvl]');pg.click('#lvGo');pg.wait_for_timeout(300)
  ev("""()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))}""")
  pg.wait_for_timeout(150)
  assert ev('Meter.L.on') is False
  ev("""()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})}""")
  pg.click('#lvGo');pg.wait_for_timeout(300)
  ev("au.dispatchEvent(new Event('play'))");pg.wait_for_timeout(150)
  assert ev('Meter.L.on') is False
  pg.click('#lvGo');pg.wait_for_timeout(250)
  pg.click('nav button[data-t=tun]');pg.click('#tuGo');pg.wait_for_timeout(400)
  assert ev('Meter.L.on') is False and ev('Tuner.T.on') is True
  pg.click('nav button[data-t=lvl]');pg.click('#lvGo');pg.wait_for_timeout(300)
  assert ev('Meter.L.on') is True and ev('Tuner.T.on') is False
  pg.click('#lvGo')
  # Backup pref list keeps old names and adds pp-meter
  prefs=ev('BK.PREFS')
  for k in ['accent','pp-pre','pp-post','pp-name','pp-beats','pp-met','pp-tuner','pp-tuner-profiles','pp-meter','pp-pianotune','pp-piano-profiles']:
    assert k in prefs,k
  # Screenshot of an uncalibrated live RMS reading
  pg.fill('#lvRef','')
  ev("""amp=>{const n=4800,b=new Float32Array(n);for(let i=0;i<n;i++)b[i]=amp*Math.sin(2*Math.PI*i/48);Meter.L.on=true;Meter.L.err='';Meter.feed(b,10)}""",amp)
  pg.screenshot(path='/opt/cursor/artifacts/v33-level-meter.png')
  b.close()
assert not errs,errs
print('METER OK')
