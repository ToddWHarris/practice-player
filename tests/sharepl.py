# v24 Share playlist (.pplay) and Import playlist: export, wipe, import round trip, fresh profile, reuse by name+size and by hash,
# name conflict "(2)", per-song settings only when missing, size warning, two-tap share, MIME fallback, download fallback
import os,subprocess,base64,zipfile,json,hashlib,time,shutil
from playwright.sync_api import sync_playwright
D='/tmp/pp-spl';os.makedirs(D,exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
for n,fq in [('A',330),('B',440),('C',550)]:
  f=f'{D}/{n}.mp3'
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={fq}:duration=10','-c:a','libmp3lame','-b:a','96k','-metadata',f'title=Polka {n}','-metadata','artist=The Band',f],check=True)
shutil.copy(f'{D}/A.mp3',f'{D}/Renamed copy.mp3')
H=lambda f:hashlib.sha256(open(f,'rb').read()).hexdigest()
STUB="""window.__sh=[];window.__mode='share';navigator.canShare=d=>{if(!(d&&d.files))return false;if(__mode==='none')return false;if(__mode==='octet')return d.files.every(f=>f.type==='application/octet-stream');return true};
navigator.share=async d=>{__sh.push(d.files)};window.__dl=[];const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){__dl.push(this.download);return}return _ck.call(this)};"""
errs=[];dlg=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  def newpg():
    c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=c.new_page();pg.add_init_script(STUB);pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog',lambda d:(dlg.append(d.message),d.accept()));pg.goto('http://localhost:8765/');pg.wait_for_timeout(900);return c,pg
  ctx,pg=newpg();ev=pg.evaluate;cdp=ctx.new_cdp_session(pg)
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(sel,st=80,dist=200):
    bb=pg.locator(sel).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;touch('touchStart',x+st,y)
    for k in range(1,11):touch('touchMove',x+st-dist*k/10,y);time.sleep(0.016)
    touch('touchEnd',x+st-dist,y);pg.wait_for_timeout(450)
  pg.click('nav button[data-t=set]');assert pg.locator('#set #plIn').count()==1 and pg.locator('#pls #plIn2').count()==1
  pg.set_input_files('#inFiles',[f'{D}/{n}.mp3' for n in 'ABC']);pg.wait_for_timeout(1500)
  ids=ev("Object.fromEntries(S.songs.map(s=>[s.name,s.id]))")
  ev(f"""async()=>{{await makeClip('{ids['B']}',1,4,'Bridge');const c=S.songs.find(s=>s.clip).id;S.pls.push({{id:'p1',name:'Polkas',ids:['{ids['C']}',c,'{ids['A']}']}});await DB.set('playlists',S.pls);
    S.pr['{ids['A']}']={{speed:0.8,pitch:-2,enabled:true}};await savePR('{ids['A']}');renderAll()}}""")
  order=ev("S.pls.find(p=>p.id==='p1').ids.map(id=>byId(id).name)");assert order==['C','Bridge','A'],order
  # swipe the playlist row -> Share -> sheet with size; two taps
  pg.click('nav button[data-t=pls]');row='#plList li.plrow:has(.n:text-is("Polkas (3)"))';swipe(row);assert pg.locator(row+'.open .padd').inner_text()=='Share'
  pg.screenshot(path='/workspace/shots/v24-playlist-swipe.png');pg.tap(row+' .padd');pg.wait_for_timeout(200)
  assert pg.is_visible('#plsModal') and pg.inner_text('#plsInfo').startswith('3 songs, ') and not pg.is_visible('#plsWarn') and pg.inner_text('#plsGo')=='Prepare'
  pg.click('#plsGo');pg.wait_for_function("document.getElementById('plsGo').textContent==='Share'",timeout=10000);assert ev('__sh.length')==0,'nothing shared until second tap'
  pg.screenshot(path='/workspace/shots/v24-share-sheet.png');pg.click('#plsGo');pg.wait_for_timeout(300)
  f0=ev("__sh[0].map(f=>[f.name,f.type,f.size])");assert f0[0][0]=='Polkas.pplay' and f0[0][1]=='application/zip',f0
  def grab(expr):
    b64=ev(f"({expr}).arrayBuffer().then(a=>{{let s='';const u=new Uint8Array(a);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}})");return base64.b64decode(b64)
  PP=f'{D}/Polkas.pplay';open(PP,'wb').write(grab('__sh[0][0]'))
  z=zipfile.ZipFile(PP);assert z.testzip() is None and all(i.compress_type==0 for i in z.infolist())
  meta=json.loads(z.read('playlist.json'));assert meta['name']=='Polkas' and [s['name'] for s in meta['songs']]==['C','Bridge','A']
  sA=[s for s in meta['songs'] if s['name']=='A'][0];assert sA['pr']=={'speed':0.8,'pitch':-2,'enabled':True} and sA['tags']['title']=='Polka A' and sA['tags']['artist']=='The Band'
  assert hashlib.sha256(z.read(sA['file'])).hexdigest()==H(f'{D}/A.mp3') and sA['sha256']==H(f'{D}/A.mp3')
  # size warning over the limit
  ev("PLS.WARN_MB=0.05");ev("openPlShare('p1')");assert pg.is_visible('#plsWarn') and 'AirDrop or Save to Files works best' in pg.inner_text('#plsWarn')
  pg.screenshot(path='/workspace/shots/v24-size-warning.png');pg.click('#plsCancel')
  # iOS rejects application/zip -> octet-stream, name still .pplay; no file sharing -> download
  ev("__mode='octet';PLS.WARN_MB=20;openPlShare('p1')");pg.click('#plsGo');pg.wait_for_function("document.getElementById('plsGo').textContent==='Share'");pg.click('#plsGo');pg.wait_for_timeout(300)
  assert ev("[__sh[__sh.length-1][0].name,__sh[__sh.length-1][0].type]")==['Polkas.pplay','application/octet-stream']
  ev("__mode='none';openPlShare('p1')");pg.click('#plsGo');pg.wait_for_function("document.getElementById('plsGo').textContent==='Share'");pg.click('#plsGo');pg.wait_for_timeout(300);assert ev('__dl')==['Polkas.pplay']
  # unsafe names are cleaned, extension kept
  assert ev("safeName('AC/DC: \"Best\"?')+'.pplay'")=='AC-DC- -Best--.pplay'
  # export, wipe, import (same device)
  ev("async()=>{(await DB.open()).close();await new Promise(r=>{const q=indexedDB.deleteDatabase('practice-player');q.onsuccess=q.onerror=q.onblocked=r})}");pg.reload();pg.wait_for_timeout(1000);assert ev('S.songs.length')==0
  pg.click('nav button[data-t=pls]');pg.set_input_files('#plIn2',PP);pg.wait_for_function("S.pls.some(p=>p.name==='Polkas')",timeout=10000);pg.wait_for_timeout(300)
  def check(pg,name='Polkas'):
    ev=pg.evaluate;pl=ev(f"S.pls.find(p=>p.name==='{name}')");got=[ev(f"byId('{i}').name") for i in pl['ids']];assert got==['C','Bridge','A'],got
    paths=[ev(f"byId('{i}').path") for i in pl['ids']];assert all(x.startswith('Shared/Polkas/') for x in paths),paths
    for i,n in zip(pl['ids'],['C','Bridge','A']):
      raw=base64.b64decode(ev(f"DB.blob('{i}').then(b=>b.arrayBuffer()).then(a=>{{let s='';const u=new Uint8Array(a);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}})"))
      if n!='Bridge':assert hashlib.sha256(raw).hexdigest()==H(f'{D}/{n}.mp3'),n
    aid=pl['ids'][2];assert ev(f"S.pr['{aid}']")=={'speed':0.8,'pitch':-2,'enabled':True}
    return pl
  pl=check(pg);assert ev("document.querySelector('nav button.on').dataset.t")=='pls' and ev('S.openPl')==pl['id']
  pg.click('nav button[data-t=lib]');ev("S.cwd=[];renderLib()");assert 'Shared' in pg.inner_text('#tree');ev("S.cwd=['Shared','Polkas'];renderLib()");assert pg.locator('#tree li.lrow').count()==3
  pg.screenshot(path='/workspace/shots/v24-imported-shared.png')
  # play it
  pg.click('nav button[data-t=pls]');ev(f"S.openPl='{pl['id']}';renderPls()");pg.locator('#plDetail li.prow .n').first.click();pg.wait_for_function('!audio.paused',timeout=8000)
  # import again: name conflict -> Polkas (2), all reused (no new songs)
  n0=ev('S.songs.length');pg.set_input_files('#plIn2',PP);pg.wait_for_function("S.pls.some(p=>p.name==='Polkas (2)')",timeout=10000);pg.wait_for_timeout(300)
  assert ev('S.songs.length')==n0 and 'reused' in dlg[-1];p2=ev("S.pls.find(p=>p.name==='Polkas (2)').ids");assert p2==pl['ids']
  pg.set_input_files('#plIn2',PP);pg.wait_for_function("S.pls.some(p=>p.name==='Polkas (3)')",timeout=10000)
  # fresh profile: reuse by hash (same bytes, other name) and keep the song's own settings
  ctx2,pg2=newpg();ev2=pg2.evaluate;pg2.click('nav button[data-t=set]');pg2.set_input_files('#inFiles',f'{D}/Renamed copy.mp3');pg2.wait_for_timeout(1200)
  rid=ev2("S.songs[0].id");ev2(f"S.pr['{rid}']={{speed:1.25,pitch:0,enabled:true}};savePR('{rid}')")
  pg2.set_input_files('#plIn',PP);pg2.wait_for_function("S.pls.some(p=>p.name==='Polkas')",timeout=10000);pg2.wait_for_timeout(300)
  ids2=ev2("S.pls.find(p=>p.name==='Polkas').ids");assert ids2[2]==rid,'reused by hash';assert ev2('S.songs.length')==3
  assert ev2(f"S.pr['{rid}'].speed")==1.25,'own settings kept';assert ev2(f"S.pr['{ids2[0]}']")==None
  # not a playlist file
  open(f'{D}/bad.pplay','wb').write(b'nope');n1=len(dlg);pg2.set_input_files('#plIn',f'{D}/bad.pplay');pg2.wait_for_timeout(800);assert 'Could not import' in dlg[-1]
  pg.click('nav button[data-t=help]');h=pg.inner_text('#helpBody');assert 'Tapping the file will not open this app on iPhone' in h and 'Mail may show it as a plain attachment' in h
  assert any('Share a playlist' in n for n in ev('RELEASE_NOTES[24]'))
  b.close()
assert not errs,errs;print('sharepl ok')
