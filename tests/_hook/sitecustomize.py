# Test helper: loaded via PYTHONPATH=tests/_hook. Marks the first-name prompt as already answered in every page,
# so older tests are not blocked by the v21 first-launch prompt, and snoozes the v23 backup reminder banner
# (it would shift the Library layout). tests/backup.py turns the banner back on. tests/name.py runs without this hook.
try:
  from playwright.sync_api._generated import Browser,BrowserContext
  JS="try{localStorage.setItem('pp-nameAsked','1');localStorage.setItem('pp-backupSnooze','99999999999999')}catch(e){}"
  _nc=Browser.new_context;_np=Browser.new_page;_cnp=BrowserContext.new_page
  def nc(self,*a,**k):
    c=_nc(self,*a,**k);c.add_init_script(JS);return c
  def np(self,*a,**k):
    pg=_np(self,*a,**k);pg.add_init_script(JS);return pg
  Browser.new_context=nc;Browser.new_page=np
except Exception:pass
