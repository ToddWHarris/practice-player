# v28 Backup memory: parts are built one at a time; the JS heap peak (performance.memory) stays flat as the library grows.
# Songs are made straight in IndexedDB (2 MB of random bytes each). PART_MB=10 so 20 MB -> 2 parts, 120 MB -> 12 parts.
from playwright.sync_api import sync_playwright
STUB="""window.__n=0;window.__names=[];navigator.canShare=d=>!!(d&&d.files);navigator.share=async d=>{__n++;__names.push(d.files.map(f=>f.name+':'+f.size).join(','))};"""
res={}
with sync_playwright() as p:
  for N in (10,60):
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--enable-precise-memory-info','--js-flags=--expose-gc'])
    ctx=b.new_context(viewport={'width':390,'height':844});pg=ctx.new_page();pg.add_init_script(STUB);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));ev=pg.evaluate
    pg.goto('http://localhost:8765/');pg.wait_for_timeout(900)
    ev("""async n=>{for(let i=0;i<n;i++){const parts=[];for(let k=0;k<32;k++){const u=new Uint8Array(65536);crypto.getRandomValues(u);parts.push(u)}
      const blob=new Blob(parts,{type:'audio/mpeg'});const id='m'+i;await DB.putSong({id,path:'Big/s'+String(i).padStart(3,'0')+'.mp3',name:'s'+i,size:blob.size,type:'audio/mpeg',added:Date.now()},blob)}
      S.songs=await DB.allSongs();renderAll()}""",N)
    ev("gc();window.__peak=0;window.__base=performance.memory.usedJSHeapSize;window.__iv=setInterval(()=>{__peak=Math.max(__peak,performance.memory.usedJSHeapSize)},5)")
    pg.click('nav button[data-t=set]');ev("BK.PART_MB=10");pg.click('#bkMake')
    n=None
    for i in range(400):
      pg.wait_for_function("!document.getElementById('bkReady').hidden||document.getElementById('bkStatus').textContent.startsWith('Backup saved')",timeout=60000)
      if ev("document.getElementById('bkStatus').textContent.startsWith('Backup saved')"):break
      n=ev('BK.plan.n');k=ev('BK.i');assert ev("!!BK.file"),'one part ready';ev("__peak=Math.max(__peak,performance.memory.usedJSHeapSize)")
      pg.click('#bkSave');pg.wait_for_function(f"__n==={k+1}",timeout=20000)
    ev("clearInterval(__iv)");peak=ev("__peak-__base");names=ev("__names")
    assert len(names)==n==(N*2+9)//10 and all(len(x.split(','))==1 for x in names),(n,names[:3])
    assert all(int(x.split(':')[1])<12*1048576 for x in names),'part size'
    res[N]=(n,peak);assert not errs,errs;b.close()
for N,(n,peak) in res.items():print(f'{N*2} MB library, {n} parts: JS heap peak above baseline {peak/1048576:.1f} MB')
assert res[60][1]<res[10][1]+8*1048576,'heap must not grow with library size'
print('bkmem ok')
