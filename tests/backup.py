# v23 Backup: zip (STORE) with folders, clips, backup.json; share or download; last date; reminder banner;
# wipe + restore matches; duplicates skipped; split into parts; fallback download
import os,subprocess,base64,zipfile,json,hashlib
from playwright.sync_api import sync_playwright
D='/tmp/pp-bk';os.makedirs(D,exist_ok=True)
for n,fq in [('A',330),('B',440),('C',550)]:
  f=f'{D}/{n}.mp3'
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',f'sine={fq}:duration=12','-c:a','libmp3lame','-b:a','96k','-metadata',f'title=Song {n}',f],check=True)
STUB="""try{localStorage.removeItem('pp-backupSnooze')}catch(e){}window.__bk=null;window.__mode='share';navigator.canShare=d=>!!(d&&d.files)&&__mode==='share';navigator.share=async d=>{__bk=d.files};
window.__dl=[];const _ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){__dl.push(this.download);return}return _ck.call(this)};"""
errs=[];dlg=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844});pg=ctx.new_page();pg.add_init_script(STUB);pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.on('dialog',lambda d:(dlg.append(d.message),d.accept()));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  pg.click('nav button[data-t=set]');assert 'Last backup: never' in pg.inner_text('#bkLast')
  pg.set_input_files('#inFiles',[f'{D}/{n}.mp3' for n in 'ABC']);pg.wait_for_timeout(1500)
  ev("""async()=>{const P={'Song A':'Band/Live/A.mp3','Song B':'Band/B.mp3','Song C':'Solo/C.mp3'};for(const s of S.songs){const m=await getMeta(s);s.path=P[m.title];if(m.title==='Song C'){s.removed=true;s.removedAt=5;s.removedGroup='Solo'}await DB.putMeta(s)}
   const A=S.songs.find(s=>s.path==='Band/Live/A.mp3').id,B=S.songs.find(s=>s.path==='Band/B.mp3').id,C=S.songs.find(s=>s.path==='Solo/C.mp3').id;
   S.pls.push({id:'p1',name:'Mix',ids:[B,A,C]});await savePls();S.pr[A]={speed:0.8,pitch:-1,enabled:true};await savePR(A);
   await makeClip(B,2,5,'Bridge');localStorage.setItem('accent','#ec4899');localStorage.setItem('pp-pre','7');renderAll()}""")
  # reminder banner after import
  pg.click('nav button[data-t=lib]');assert pg.is_visible('#bkBanner') and 'added new songs' in pg.inner_text('#bkBanner')
  pg.click('#bkBannerLater');assert not pg.is_visible('#bkBanner');ev("localStorage.removeItem('pp-backupSnooze');bkRender()");pg.click('#bkBannerGo');assert ev("document.querySelector('nav button.on').dataset.t")=='set'
  snap=lambda:ev("""({songs:S.songs.map(s=>[s.id,s.path,!!s.removed,s.removedGroup||null,!!s.clip,s.size]).sort(),pls:S.pls.map(p=>[p.id,p.name,p.ids]),pr:S.pr,
    sizes:null})""")
  before=snap()
  def blobs():return ev("Promise.all(S.songs.map(s=>DB.blob(s.id).then(b=>b.arrayBuffer()).then(a=>[s.id,a.byteLength]))).then(r=>r.sort())")
  bsz=blobs()
  # back up
  pg.click('#bkMake');pg.wait_for_selector('#bkReady:not([hidden])',timeout=15000);assert 'ready' in pg.inner_text('#bkMsg')
  pg.click('#bkSave');pg.wait_for_function('__bk&&__bk.length',timeout=5000);pg.wait_for_timeout(200)
  assert 'never' not in pg.inner_text('#bkLast') and ev("+localStorage.getItem('pp-lastBackup')>0")
  def save_files():
    out=[]
    for i,(nm,b64) in enumerate(ev("Promise.all(__bk.map(f=>f.arrayBuffer().then(a=>{let s='';const u=new Uint8Array(a);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return[f.name,btoa(s)]})))")):
      path=f'{D}/{nm}';open(path,'wb').write(base64.b64decode(b64));out.append(path)
    return out
  files=save_files();import datetime;day=datetime.date.today().isoformat()
  assert [os.path.basename(f) for f in files]==[f'PracticePlayer-backup-{day}.zip'],files
  z=zipfile.ZipFile(files[0]);assert z.testzip() is None;names=z.namelist()
  assert 'backup.json' in names and 'music/Band/Live/A.mp3' in names and 'music/Band/B.mp3' in names and 'music/Solo/C.mp3' in names and 'music/Custom Clips/Bridge.mp3' in names,names
  assert all(i.compress_type==zipfile.ZIP_STORED for i in z.infolist())
  assert hashlib.sha256(z.read('music/Band/Live/A.mp3')).hexdigest()==hashlib.sha256(open(f'{D}/A.mp3','rb').read()).hexdigest(),'song bytes intact'
  meta=json.loads(z.read('backup.json'));assert meta['format']==1 and meta['prefs']['accent']=='#ec4899' and len(meta['playlists'])==3 and any(s.get('removed') for s in meta['songs'])
  assert not pg.is_visible('#bkBanner')
  # wipe everything (like deleting the app) and restore
  ev("async()=>{(await DB.open()).close();await new Promise(r=>{const q=indexedDB.deleteDatabase('practice-player');q.onsuccess=q.onerror=q.onblocked=r});localStorage.clear()}")
  pg.reload();pg.wait_for_timeout(1000);assert ev('S.songs.length')==0 and ev('S.pls.length')==2
  pg.click('nav button[data-t=set]');pg.set_input_files('#bkIn',files);pg.wait_for_function("document.getElementById('bkStatus').textContent.startsWith('Restored')",timeout=15000)
  assert 'Restored 4 songs' in pg.inner_text('#bkStatus'),pg.inner_text('#bkStatus')
  after=snap();assert after['songs']==before['songs'],(after['songs'],before['songs']);assert after['pls']==before['pls'],(after['pls'],before['pls']);assert after['pr']==before['pr'],after['pr']
  assert blobs()==bsz,'all files back'
  assert ev("localStorage.getItem('accent')")=='#ec4899' and ev("localStorage.getItem('pp-pre')")=='7' and ev("getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()")=='#ec4899'
  pg.reload();pg.wait_for_timeout(900);assert snap()['pls']==before['pls'],'persisted after reload'
  pg.click('nav button[data-t=lib]');ev("S.cwd=[];renderLib()");assert 'Removed (1)' in pg.inner_text('#tree') and 'Bridge' not in pg.inner_text('#tree')
  # restored clip plays from Custom Clips
  pg.click('nav button[data-t=pls]');ev("S.openPl='clips';renderPls()");pg.locator('#plDetail li.prow .n').first.click();pg.wait_for_function("!audio.paused&&document.getElementById('now').textContent.includes('Bridge')",timeout=8000)
  # restoring again skips duplicates
  pg.click('nav button[data-t=set]');pg.set_input_files('#bkIn',files);pg.wait_for_function("document.getElementById('bkStatus').textContent.startsWith('Restored')",timeout=15000)
  assert 'Restored 0 songs' in pg.inner_text('#bkStatus') and '4 already in the app were skipped' in pg.inner_text('#bkStatus') and ev('S.songs.length')==4 and snap()['pls']==before['pls']
  # split into parts
  ev("BK.PART_MB=0.15;__bk=null");pg.click('#bkMake');pg.wait_for_selector('#bkReady:not([hidden])',timeout=15000);msg=pg.inner_text('#bkMsg');assert 'split into' in msg,msg
  # v28: one part at a time. Part N is built, shared alone, dropped, then part N+1 is built.
  n=ev('BK.plan.n');assert n>=3,n;assert 'Part 1 of %d'%n in msg,msg;parts=[]
  for i in range(n):
    pg.wait_for_function(f"!document.getElementById('bkReady').hidden&&document.getElementById('bkSave').textContent==='Save part {i+1} of {n}'",timeout=15000)
    assert ev('BK.file.name').endswith(f'-part{i+1}.zip') and ev('BK.i')==i
    ev('__bk=null');pg.click('#bkSave');pg.wait_for_function('__bk&&__bk.length===1');parts+=save_files()
  pg.wait_for_function(f"document.getElementById('bkStatus').textContent.includes('All {n} parts')",timeout=10000)
  assert ev('BK.file===null&&BK.plan===null'),'parts dropped after sharing'
  assert all(f'-part{i+1}.zip' in parts[i] for i in range(n)),parts
  import zipfile
  allf=[x for pth in parts for x in zipfile.ZipFile(pth).namelist() if x.startswith('music/')];meta1=json.loads(zipfile.ZipFile(parts[0]).read('backup.json'))
  assert sorted(allf)==sorted(x for g in meta1['partFiles'] for x in g) and len(allf)==len(set(allf))==4 and meta1['parts']==n
  assert all(zipfile.ZipFile(pth).testzip() is None for pth in parts),'crc ok'
  assert ev("S.songs.every(s=>typeof s.crc==='number')"),'crc cached on songs'
  # a second backup reuses the cached crc and gives identical zips
  ev("BK.PART_MB=200;__bk=null");pg.click('#bkMake');pg.wait_for_selector('#bkReady:not([hidden])',timeout=15000);pg.click('#bkSave');pg.wait_for_function('__bk&&__bk.length===1')
  one=save_files()[0];assert zipfile.ZipFile(one).testzip() is None and 'crc' not in json.loads(zipfile.ZipFile(one).read('backup.json'))['songs'][0]
  ev("BK.PART_MB=0.15")
  ev("async()=>{(await DB.open()).close();await new Promise(r=>{const q=indexedDB.deleteDatabase('practice-player');q.onsuccess=q.onerror=q.onblocked=r});localStorage.clear()}");pg.reload();pg.wait_for_timeout(1000)
  pg.click('nav button[data-t=set]');pg.set_input_files('#bkIn',parts[1:2]);pg.wait_for_function("document.getElementById('bkStatus').textContent.startsWith('Restore failed')",timeout=10000);assert 'part 1' in pg.inner_text('#bkStatus')
  pg.set_input_files('#bkIn',parts[:1]);pg.wait_for_function("document.getElementById('bkStatus').textContent.startsWith('Restored')",timeout=15000);assert 'pick all parts' in pg.inner_text('#bkStatus'),pg.inner_text('#bkStatus')
  pg.set_input_files('#bkIn',parts);pg.wait_for_function("document.getElementById('bkStatus').textContent.includes('skipped')||S.songs.length===4",timeout=15000);pg.wait_for_timeout(500)
  assert snap()['songs']==before['songs'] and snap()['pls']==before['pls']
  # fallback: no file sharing -> downloads; 30-day reminder
  ev("__mode='none';BK.PART_MB=200");pg.click('#bkMake');pg.wait_for_selector('#bkReady:not([hidden])',timeout=15000);pg.click('#bkSave');pg.wait_for_timeout(900);assert ev('__dl')==[f'PracticePlayer-backup-{day}.zip'],ev('__dl')
  ev("localStorage.setItem('pp-lastBackup',String(Date.now()-31*864e5));bkRender()");pg.click('nav button[data-t=lib]');assert pg.is_visible('#bkBanner') and '30 days' in pg.inner_text('#bkBanner')
  pg.screenshot(path='/workspace/shots/v23-backup-reminder.png')
  pg.click('nav button[data-t=set]');pg.locator('#bkMake').scroll_into_view_if_needed();pg.screenshot(path='/workspace/shots/v23-backup-settings.png')
  pg.click('nav button[data-t=help]');h=pg.inner_text('#helpBody');assert 'Deleting the app from your Home Screen erases its songs and playlists. Back up first.' in h
  assert any('Backup' in n for n in ev('RELEASE_NOTES[23]'))
  b.close()
assert not errs,errs;print('backup ok')
