# v29 Storage popup: total, Songs / Custom Clips / Removed lines from IndexedDB blob sizes, folders sorted by size
# with subfolders indented under parents, device estimate, readable sizes, scrollable sheet.
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
  pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
  KB=1024
  songs=[('Band/Live/a.mp3',3000),('Band/Live/b.mp3',2500),('Band/Studio/c.mp3',1200),('Band/d.mp3',300),('Solo/e.mp3',9000),('Jazz/Trio/f.mp3',800),('Jazz/g.mp3',700),('top.mp3',150),('Band/gone.mp3',400)]
  ev("""async L=>{let i=0;for(const [path,kb] of L){const blob=new Blob([new Uint8Array(kb*1024)],{type:'audio/mpeg'});const r={id:'x'+(i++),path,name:path.split('/').pop(),size:1,type:'audio/mpeg',added:1};
     if(path.includes('gone')){r.removed=true;r.removedAt=1;r.removedGroup='Band'}await DB.putSong(r,blob)}
    const cb=new Blob([new Uint8Array(512*1024)]);await DB.putSong({id:'clip-1',path:'Custom Clips/c1.mp3',name:'c1',size:1,type:'audio/mpeg',added:1,clip:true},cb);
    S.songs=await DB.allSongs();ensureClipsPl();renderAll()}""",songs)
  pg.click('nav button[data-t=set]');pg.click('#stOpen');pg.wait_for_selector('#stBody .stFolders');pg.wait_for_timeout(200)
  assert ev("stSize(12.4*1048576)")=='12.4 MB' and ev("stSize(1536)")=='1.5 KB' and ev("stSize(500)")=='500 bytes' and ev("stSize(3*1073741824)")=='3.0 GB'
  tot=sum(k for _,k in songs)+512
  assert pg.inner_text('.stTotal')=='Total: '+ev(f"stSize({tot*KB})"),pg.inner_text('.stTotal')
  live=sum(k for p_,k in songs if 'gone' not in p_)
  t=lambda sel:pg.inner_text(sel).replace('\n',' ')
  assert ev(f"stSize({live*KB})") in t('.stSongs') and '8 songs' in t('.stSongs'),t('.stSongs')
  assert '512 KB' in t('.stClips') and '1 clip' in t('.stClips') and '400 KB' in t('.stRem') and '1 song' in t('.stRem'),(t('.stClips'),t('.stRem'))
  rows=ev("[...document.querySelectorAll('.stFolders li.stF:not(.stTop)')].map(l=>[l.dataset.path,+l.dataset.depth,l.querySelector('.sz').textContent,l.querySelector('small').textContent])")
  print(rows)
  assert [r[0] for r in rows]==['Solo','Band','Band/Live','Band/Studio','Jazz','Jazz/Trio'],rows
  assert [r[1] for r in rows]==[0,0,1,1,0,1] and rows[1][3]=='4 songs' and rows[2][2]==ev(f"stSize({5500*KB})")
  assert ev("parseFloat(getComputedStyle(document.querySelector('.stFolders li[data-depth=\"1\"]')).paddingLeft)")>ev("parseFloat(getComputedStyle(document.querySelector('.stFolders li[data-depth=\"0\"]')).paddingLeft)"),'indent'
  assert 'Top level' in t('.stTop') and '150 KB' in t('.stTop')
  assert pg.locator('.stDev').count()==1 and 'Used by this app' in t('.stUsed') and 'App storage limit (approximate)' in t('.stQuota')
  assert "iPhone doesn't share its free space with web apps. For that, open Settings > General > iPhone Storage." in t('.stNote')
  assert ev("getComputedStyle(document.querySelector('#stModal .sheet')).overflowY")=='auto'
  pg.screenshot(path='/workspace/shots/v29-storage.png')
  pg.click('#stClose');assert not pg.is_visible('#stModal')
  # no estimate API: the estimate lines are hidden
  ev("Object.defineProperty(navigator,'storage',{configurable:true,get:()=>undefined})");pg.click('#stOpen');pg.wait_for_selector('#stBody .stFolders')
  assert pg.locator('.stDev').count()==0 and pg.locator('.stNote').count()==0 and pg.locator('.stTotal').count()==1;pg.click('#stClose')
  assert not errs,errs;b.close()
print('storage ok')
