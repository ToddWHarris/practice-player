# v29 Backup flow: next part prebuilt while the share sheet is open (never more than 2 parts), big "Save next part (2 of N)"
# button in place, progress bar, note, cancelled share keeps the part, Cancel backup, UI stays put across visibility
# changes, and a reload mid-backup comes back to Settings with Continue backup.
from playwright.sync_api import sync_playwright
STUB="""window.__n=0;window.__names=[];window.__mode='ok';window.__pend=null;navigator.canShare=d=>!!(d&&d.files);
navigator.share=d=>new Promise((res,rej)=>{__names.push(d.files.map(f=>f.name).join(','));window.__pend={res:()=>{__n++;res()},rej:()=>rej(new DOMException('cancel','AbortError'))}});"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page();pg.add_init_script(STUB);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  ev("""async()=>{for(let i=0;i<10;i++){const parts=[];for(let k=0;k<16;k++){const u=new Uint8Array(65536);crypto.getRandomValues(u);parts.push(u)}
    const blob=new Blob(parts,{type:'audio/mpeg'});await DB.putSong({id:'m'+i,path:'Big/s'+i+'.mp3',name:'s'+i,size:blob.size,type:'audio/mpeg',added:Date.now()},blob)}S.songs=await DB.allSongs();renderAll()}""")
  pg.click('nav button[data-t=set]');ev("BK.PART_MB=2");pg.click('#bkMake')
  ready=lambda:pg.wait_for_function("!document.getElementById('bkSave').disabled&&!!BK.file",timeout=20000)
  ready();n=ev('BK.plan.n');assert n==5,n
  assert pg.inner_text('#bkProgTxt')=='Part 1 of 5' and pg.inner_text('#bkSave')=='Save part 1 of 5' and pg.is_visible('#bkCancel')
  assert 'iPhone needs one tap per part. Files remembers the last folder you used.' in pg.inner_text('#bkNote')
  w=ev("[document.getElementById('bkSave').offsetWidth,document.getElementById('bkSave').parentNode.offsetWidth]");assert w[0]==w[1],w
  # tap: share sheet opens, next part starts building at once
  pg.click('#bkSave');pg.wait_for_function('__pend');pg.wait_for_function("BK.nextI===1&&BK.next",timeout=5000)
  pg.wait_for_function("BK.next.then(f=>window.__nf=f.name)",timeout=10000);pg.wait_for_timeout(300);assert ev('__nf').endswith('-part2.zip')
  assert ev("[BK.file,BK.next].filter(Boolean).length")<=2
  # leaving and coming back does not move or reset the backup UI
  ev("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))")
  assert ev("document.querySelector('nav button.on').dataset.t")=='set' and pg.is_visible('#bkReady')
  # cancelled share keeps part 1
  ev("__pend.rej();__pend=null");pg.wait_for_timeout(200);assert ev('BK.i')==0 and ev('BK.file.name').endswith('-part1.zip') and pg.inner_text('#bkSave')=='Save part 1 of 5' and 'try again' in pg.inner_text('#bkStatus')
  pg.click('#bkSave');pg.wait_for_function('__pend');assert ev('__names')[-1].endswith('-part1.zip')
  # share done: part 2 is ready right away (prebuilt), big button in place
  ev("__pend.res();__pend=null");ready();assert ev('BK.i')==1 and pg.inner_text('#bkSave')=='Save next part (2 of 5)' and pg.inner_text('#bkProgTxt')=='Part 2 of 5'
  assert ev("document.getElementById('bkBarFill').style.width")=='20%'
  pg.locator('#bkReady').scroll_into_view_if_needed();pg.screenshot(path='/workspace/shots/v29-backup.png')
  for i in range(1,4):
    pg.click('#bkSave');pg.wait_for_function('__pend');ev("__pend.res();__pend=null");ready();assert pg.inner_text('#bkSave')==f'Save next part ({i+2} of 5)'
  # reload in the middle (as if iOS dropped the page): back in Settings with Continue backup at part 5
  pg.reload();pg.wait_for_timeout(1200)
  assert ev("document.querySelector('nav button.on').dataset.t")=='set' and pg.inner_text('#bkSave')=='Continue backup (part 5 of 5)',pg.inner_text('#bkSave')
  ev('BK.PART_MB=2');pg.click('#bkSave');ready();assert ev('BK.i')==4 and ev('BK.file.name').endswith('-part5.zip')
  pg.click('#bkSave');pg.wait_for_function('__pend');ev("__pend.res();__pend=null")
  pg.wait_for_function("document.getElementById('bkStatus').textContent.includes('All 5 parts')",timeout=10000);assert ev('BK.plan===null&&BK.file===null&&BK.next===null') and not pg.is_visible('#bkReady')
  assert ev("sessionStorage.getItem('pp-bkRun')") is None
  # Cancel backup
  pg.click('#bkMake');ready();pg.click('#bkSave');pg.wait_for_function('__pend');pg.click('#bkCancel')
  assert not pg.is_visible('#bkReady') and ev('BK.plan===null&&BK.file===null&&BK.next===null') and 'cancelled' in pg.inner_text('#bkStatus')
  ev("__pend.res()");pg.wait_for_timeout(300);assert not pg.is_visible('#bkReady'),'late share result ignored after cancel'
  assert not errs,errs;b.close()
print('bkflow ok')
