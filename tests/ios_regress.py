# Regression: on iOS the first load after tapping a playlist song can fail (blob read error or
# play() blocked). Tapping the big Play button then rebuilt an 'All songs' queue, so Next/Prev
# followed library/folder order. Usage: python3 tests/ios_regress.py [base_url]
import sys,os,subprocess
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
T='/tmp/pp-e2e';files=[f'{T}/{d}/{d}{i}.mp3' for d in 'AB' for i in range(4)]
for f in files:
  os.makedirs(os.path.dirname(f),exist_ok=True)
  if not os.path.exists(f):subprocess.run(['ffmpeg','-loglevel','error','-y','-f','lavfi','-i','sine=400:duration=2',f],check=True)
errs=[];fails=[]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(**{k:v for k,v in p.devices['iPhone 13'].items() if k!='default_browser_type'});pg=ctx.new_page()
  pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept('Mix'))
  pg.goto(URL);pg.wait_for_timeout(1000)
  pg.set_input_files('#inFiles',files);pg.wait_for_timeout(1500)
  pg.evaluate("""async()=>{const ids=S.songs.map(s=>s.id).sort();const order=[5,1,7,3,0,6,2,4].map(i=>ids[i]);S.pls=[{id:'p1',name:'Mix',ids:order}];await savePls();renderAll()}""")
  order=pg.evaluate("S.pls.filter(p=>!p.builtin)[0].ids.map(id=>byId(id).name)")
  for mode in ['blobfail','blocked','normal']:
    pg.evaluate("""m=>{window._ob=window._ob||DB.blob.bind(DB);window._op=window._op||HTMLMediaElement.prototype.play;au.pause();au.removeAttribute('src');au.load();S.Q=null;
      if(m==='blobfail'){let n=0;DB.blob=id=>n++?_ob(id):Promise.reject(new Error('WebKitBlobResource'))}else DB.blob=_ob;
      if(m==='blocked'){let n=0;au.play=function(){return n++?_op.call(this):Promise.reject(new DOMException('x','NotAllowedError'))}}else au.play=_op.bind(au)}""",mode)
    pg.tap('nav button[data-t=pls]');pg.tap('#plList li:not(.builtinPl) .n');pg.tap('#plDetail li:nth-child(3) .n');pg.wait_for_timeout(500)
    pg.tap('#play');pg.wait_for_timeout(600)
    frm=pg.inner_text('#from');pg.tap('#next');pg.wait_for_timeout(500);n1=pg.inner_text('#now').split(' (')[0]
    pg.tap('#prev');pg.wait_for_timeout(500);n0=pg.inner_text('#now').split(' (')[0]
    ok=frm=='Playing from: Mix' and n1==order[3] and n0==order[2]
    print(mode,'from=',frm,'next=',n1,'prev=',n0,'expected',order[3],order[2],'OK' if ok else 'FAIL')
    if not ok:fails.append(mode)
  b.close()
print('errors',errs);sys.exit(1 if fails or errs else 0)
