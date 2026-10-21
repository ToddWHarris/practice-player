# v23 Custom Clips: built-in playlist, Save Custom Clip from A-B, frame-exact MP3 slice (valid, duration ~B-A, tags),
# original untouched, hidden from Library, speed/pitch copied, Save In (move), orphan returns, delete with confirm, playlist features
import os,subprocess,time,base64,hashlib,re
from playwright.sync_api import sync_playwright
D='/tmp/pp-clips';os.makedirs(D,exist_ok=True);os.makedirs('/workspace/shots',exist_ok=True)
SRC=f'{D}/Polka.mp3'
if not os.path.exists(SRC):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i',"aevalsrc='sin(440*2*PI*t)*0.5+(random(0)-0.5)*0.5*mod(floor(t),2)':d=30:s=44100",'-c:a','libmp3lame','-q:a','4','-metadata','title=Wooden Heart Polka','-metadata','artist=The Band','-metadata','album=Polka Hits',SRC],check=True)
SHA=hashlib.sha256(open(SRC,'rb').read()).hexdigest()
STUB="""window.__sh=[];navigator.canShare=d=>!!(d&&d.files);navigator.share=async d=>{__sh.push((d.files||[]).map(f=>[f.name,f.type,f.size]))};"""
errs=[];dlg=[];ans={'acc':True,'prompt':'1'}
def probe(f):return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2);pg=ctx.new_page();pg.add_init_script(STUB);pg.on('pageerror',lambda e:errs.append(str(e)))
  def ond(d):
    dlg.append((d.type,d.message))
    if d.type=='prompt':d.accept(ans['prompt'])
    elif ans['acc']:d.accept()
    else:d.dismiss()
  pg.on('dialog',ond);cdp=ctx.new_cdp_session(pg);ev=pg.evaluate
  def touch(t,x,y):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
  def swipe(sel,st=80,dist=280):
    pg.locator(sel).scroll_into_view_if_needed();pg.wait_for_timeout(100)
    bb=pg.locator(sel).bounding_box();y=bb['y']+bb['height']/2;x=bb['x']+bb['width']/2;touch('touchStart',x+st,y)
    for k in range(1,11):touch('touchMove',x+st-dist*k/10,y);time.sleep(0.016)
    touch('touchEnd',x+st-dist,y);pg.wait_for_timeout(450)
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  # built-in playlist exists on first run, first, no rename/delete
  assert ev('S.pls[0].id')=='clips' and ev('S.pls[0].name')=='Custom Clips' and ev('S.pls[0].builtin')
  pg.click('nav button[data-t=pls]');row=pg.locator('#plList li').first;assert 'Custom Clips' in row.inner_text() and row.locator('button:has-text("Rename")').count()==0 and row.locator('button:has-text("Delete")').count()==0
  # upgrade path: playlists saved without it get it back, first, plus orphan recovery
  ev("DB.set('playlists',[{id:'p1',name:'Mix',ids:[]}])");pg.wait_for_timeout(200);pg.reload();pg.wait_for_timeout(900);assert ev('S.pls.map(p=>p.id)')==['clips','favs','p1'],ev('S.pls.map(p=>p.id)')
  pg.click('nav button[data-t=set]');pg.set_input_files('#inFiles',SRC);pg.wait_for_timeout(1500);src=ev('S.songs[0].id')
  pg.click('nav button[data-t=lib]');pg.locator('#tree li.lrow .n').first.click();pg.wait_for_function('!audio.paused&&audio.duration>29',timeout=8000)
  # per-song speed/pitch on the source, to be copied
  ev(f"S.pr['{src}']={{speed:0.75,pitch:0,enabled:true}};savePR('{src}')")
  # button disabled with no A-B, enabled with A-B, in popup and editor
  pg.click('nav button[data-t=lib]');ev('S.A=null;S.B=null;renderMarks();openPR()');assert pg.is_disabled('#prClip') and pg.is_visible('#prClipHint');pg.click('#prCancel')
  ev('S.A=5.3;S.B=12.8;renderMarks();openPR()');assert not pg.is_disabled('#prClip')
  pg.screenshot(path='/workspace/shots/v23-save-clip-popup.png');pg.click('#prCancel')
  ev('edOpen()');pg.wait_for_timeout(200);assert pg.is_visible('#edClip') and not pg.is_disabled('#edClip');pg.screenshot(path='/workspace/shots/v23-save-clip-editor.png')
  pg.click('#edClip');assert pg.is_visible('#clipModal');nm=pg.input_value('#clipName');assert nm=='Wooden Heart Polka clip 0:05.3-0:12.8',nm
  pg.click('#clipCancel');assert not pg.is_visible('#clipModal') and ev('S.songs.length')==1,'cancel makes nothing'
  pg.click('#edClip');pg.fill('#clipName','Chorus');pg.click('#clipSave');pg.wait_for_function('S.songs.length===2',timeout=8000);pg.click('#edDone')
  c=ev("S.songs.find(s=>s.clip)");cid=c['id'];assert c['name']=='Chorus' and c['src']==src and c['path']=='Custom Clips/Chorus.mp3'
  assert ev("clipsPl().ids")==[cid];assert ev(f"S.pr['{cid}'].speed")==0.75 and ev(f"DB.get('pr:{cid}').then(v=>v&&v.speed)")==0.75,'speed copied'
  # clip bytes: valid mp3, duration ~ B-A within one frame, tags, comment
  b64=ev(f"DB.blob('{cid}').then(b=>b.arrayBuffer()).then(a=>{{let s='';const u=new Uint8Array(a);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}})")
  open(f'{D}/clip.mp3','wb').write(base64.b64decode(b64));frame=1152/44100
  inf=ev(f"DB.blob('{cid}').then(b=>b.arrayBuffer()).then(a=>MP3Clip.info(new Uint8Array(a)))");assert abs(inf['duration']-7.5)<=0.001 and inf['gapless'],inf
  pd=probe(f'{D}/clip.mp3');assert 7.5<=pd<=7.75,pd
  # v25 gapless: decoded length is exactly B-A (within 1 ms)
  ns=len(subprocess.run(['ffmpeg','-v','error','-i',f'{D}/clip.mp3','-ac','1','-f','s16le','-'],capture_output=True).stdout)//2;assert abs(ns/44100-7.5)<=0.001,ns
  er=subprocess.run(['ffmpeg','-v','error','-i',f'{D}/clip.mp3','-f','null','-'],capture_output=True,text=True).stderr;assert 'Invalid' not in er and 'Error' not in er,er
  tags=subprocess.run(['ffprobe','-v','error','-show_entries','format_tags','-of','default=nw=1',f'{D}/clip.mp3'],capture_output=True,text=True).stdout
  assert 'title=Chorus' in tags and 'artist=The Band' in tags and 'album=Polka Hits' in tags and 'Wooden Heart Polka' in tags,tags
  # original untouched (bytes and record)
  b64o=ev(f"DB.blob('{src}').then(b=>b.arrayBuffer()).then(a=>{{let s='';const u=new Uint8Array(a);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}})")
  assert hashlib.sha256(base64.b64decode(b64o)).hexdigest()==SHA,'original bytes unchanged';assert ev(f"!S.songs.find(s=>s.id==='{src}').clip")
  # hidden from Library folders and counts
  pg.click('nav button[data-t=lib]');ev("S.cwd=[];renderLib()");t=pg.inner_text('#tree');assert 'Chorus' not in t and 'Custom Clips' not in t,t
  # second clip for the screenshot
  ev("S.A=20;S.B=26;renderMarks()");ev("makeClip(S.songs.find(s=>!s.clip).id,20,26,'Ending')");pg.wait_for_function('S.songs.length===3')
  # reload: clip and playlist persist
  pg.reload();pg.wait_for_timeout(1000);assert len(ev('clipsPl().ids'))==2
  pg.click('nav button[data-t=pls]');ev("S.openPl='clips';renderPls()");pg.wait_for_timeout(200)
  rowsel='#plDetail li.prow:has(.n:text-is("Chorus"))'
  # play from Custom Clips; A-B loop and shuffle/repeat work on a clip
  pg.locator(rowsel+' .n').click();pg.wait_for_function("document.getElementById('now').textContent.includes('Chorus')&&!audio.paused",timeout=8000)
  assert ev('S.Q.ctx.id')=='clips' and abs(ev('audio.duration')-7.5)<0.2,ev('audio.duration')
  assert ev('audio.playbackRate')==0.75,'clip has its own speed'
  pg.click('nav button[data-t=lib]');ev("audio.currentTime=1;S.A=1;S.B=2;renderMarks()");pg.click('#abBox summary');pg.click('#abOn');pg.wait_for_function('S.waiting',timeout=8000);pg.click('#abOn')
  pg.click('#shuf');assert ev('S.shuffle');pg.click('#shuf')
  ev("document.getElementById('abBox').open=false");pg.click('nav button[data-t=pls]');ev("S.openPl='clips';renderPls()");pg.wait_for_timeout(200)
  pg.locator('#plDetail').scroll_into_view_if_needed();pg.screenshot(path='/workspace/shots/v23-custom-clips.png')
  # swipe: Save In, Send, Delete ; Send shares the clip mp3
  swipe(rowsel);assert pg.locator(rowsel+'.open .padd').inner_text()=='Save In' and pg.locator(rowsel+' .prm').inner_text()=='Delete'
  pg.screenshot(path='/workspace/shots/v23-clip-swipe.png')
  pg.tap(rowsel+' .psend');pg.wait_for_timeout(300)
  if not ev('__sh.length'):swipe(rowsel);pg.tap(rowsel+' .psend');pg.wait_for_timeout(300)
  assert ev('__sh[__sh.length-1]')[0][:2]==['Chorus.mp3','audio/mpeg'],ev('__sh')
  # drag reorder works in Custom Clips
  ev("plMoveTo(clipsPl(),0,1);renderPls()");pg.wait_for_timeout(300);assert pg.locator('#plDetail li.prow .n').first.inner_text()=='Ending' and ev("S.Q.list[S.Q.qi]")==cid,'reorder keeps playing clip'
  pg.reload();pg.wait_for_timeout(900);assert ev("clipsPl().ids[1]")==cid,'order persisted';pg.click('nav button[data-t=pls]');ev("S.openPl='clips';renderPls()");pg.wait_for_timeout(200)
  # Save In moves to Mix (v26: Favorites adds a playlist row, so bring the list into view)
  ev("document.getElementById('plDetail').scrollIntoView({block:'start'})");pg.wait_for_timeout(200)
  swipe(rowsel);pg.tap(rowsel+' .padd');pg.wait_for_timeout(300);assert any('Move this clip' in m for t,m in dlg)
  assert cid not in ev('clipsPl().ids') and cid in ev("S.pls.find(p=>p.id==='p1').ids"),'moved'
  assert ev(f"!!S.songs.find(s=>s.id==='{cid}')") and ev(f"DB.blob('{cid}').then(b=>!!b)"),'file kept'
  # in Mix: Add to list / Send / Remove; Remove only takes it off, and since it is in no playlist it returns to Custom Clips
  ev("S.openPl='p1';renderPls()");pg.wait_for_timeout(200);mrow='#plDetail li.prow:has(.n:text-is("Chorus"))'
  swipe(mrow);assert pg.locator(mrow+' .padd').inner_text()=='Add to list' and pg.locator(mrow+' .prm').inner_text()=='Remove'
  n0=len(dlg);pg.tap(mrow+' .prm');pg.wait_for_timeout(300);assert not any(t=='confirm' for t,m in dlg[n0:]),'no confirm for playlist remove'
  assert cid not in ev("S.pls.find(p=>p.id==='p1').ids") and cid in ev('clipsPl().ids') and ev(f"!!S.songs.find(s=>s.id==='{cid}')"),'orphan back in Custom Clips'
  # delete for good: confirm text, dismiss keeps it, accept erases; original stays
  ev("S.openPl='clips';renderPls()");pg.wait_for_timeout(200);ans['acc']=False;swipe(rowsel);pg.tap(rowsel+' .prm');pg.wait_for_timeout(300)
  msg=[m for t,m in dlg if t=='confirm'][-1];assert 'deletes the clip file' in msg and 'original song is not changed' in msg,msg
  assert ev(f"!!S.songs.find(s=>s.id==='{cid}')"),'dismiss keeps'
  ans['acc']=True;swipe(rowsel);pg.tap(rowsel+' .prm');pg.wait_for_timeout(600)
  assert ev(f"!S.songs.find(s=>s.id==='{cid}')") and ev(f"DB.blob('{cid}').then(b=>!b)") and ev(f"DB.get('pr:{cid}').then(v=>!v)") and cid not in ev('clipsPl().ids'),'deleted'
  assert ev(f"!!S.songs.find(s=>s.id==='{src}')") and ev(f"DB.blob('{src}').then(b=>b&&b.size)")==os.path.getsize(SRC),'original kept'
  # built-in survives a delete attempt and is never in the Add to list chooser
  ev("addToPl(S.songs.find(s=>!s.clip).id)");assert 'Custom Clips' not in [m for t,m in dlg if t=='prompt'][-1]
  # help + notes
  pg.click('nav button[data-t=help]');h=pg.inner_text('#helpBody');assert 'Save Custom Clip' in h and 'Save In' in h
  assert any('Custom Clip' in n for n in ev('RELEASE_NOTES[23]'))
  b.close()
assert not errs,errs;print('clips ok')
