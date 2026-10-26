"""Local browser smoke test with a mock API. Does not assert production Netlify backend."""
import json, subprocess, threading, urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
seed_json=subprocess.check_output(['node','--input-type=module','-e','import {seed} from "./lib/seed.mjs"; console.log(JSON.stringify(seed))'],cwd=ROOT,text=True)
DB=json.loads(seed_json)
AUTH={'admin':False}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'public'),**kwargs)
    def log_message(self,*args):pass
    def respond(self,obj,status=200):
        raw=json.dumps(obj).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path.startswith('/api/'):
            op=self.path.rsplit('/',1)[-1]
            if op=='data':self.respond({'data':DB,'admin':AUTH['admin']})
            elif op=='session':self.respond({'admin':AUTH['admin'],'defaultCredential':True})
            else:self.respond({'error':'unsupported'},404)
        else:super().do_GET()
    def do_POST(self):
        size=int(self.headers.get('Content-Length','0'));body=json.loads(self.rfile.read(size) or b'{}')
        op=self.path.rsplit('/',1)[-1]
        if op=='login':AUTH['admin']=body.get('username')=='admin' and body.get('password')=='admin';self.respond({'admin':True,'defaultCredential':True} if AUTH['admin'] else {'error':'wrong'},200 if AUTH['admin'] else 401)
        elif op=='record':
            arr=DB[body['type']];x=body.get('record')
            if body['action']=='save':
                arr[:]=[y for y in arr if y['id']!=x['id']]+[x];self.respond({'ok':True})
            else:arr[:]=[y for y in arr if y['id']!=body['id']];self.respond({'ok':True})
        elif op=='logout':AUTH['admin']=False;self.respond({'ok':True})
        elif op=='password':self.respond({'ok':True})
        else:self.respond({'ok':True})

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    address=f'http://127.0.0.1:{server.server_port}/'
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--no-proxy-server','--proxy-server=direct://','--proxy-bypass-list=*'])
        page=browser.new_page(viewport={'width':1380,'height':900},device_scale_factor=1)
        errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
        page.goto(address,wait_until='domcontentloaded');page.locator('.stats').wait_for(timeout=10000)
        assert '29' in page.locator('.stats').inner_text(),page.locator('.stats').inner_text()
        page.screenshot(path=str(ROOT/'tests'/'home-smoke.png'),full_page=True)
        page.get_by_role('button',name='Đăng nhập').click();page.locator('#login-form').wait_for()
        page.locator('#login-form button').click();page.locator('.adminlayout').wait_for(timeout=10000)
        page.get_by_role('button',name='+ Thêm mới').click();page.locator('#editor-form').wait_for()
        page.locator('#editor-form [name="name"]').fill('Test Character')
        page.locator('#editor-form [name="element"]').fill('Hỏa')
        page.locator('#editor-form button[type=submit]').click();page.locator('.adminlayout').wait_for()
        assert any(x['name']=='Test Character' for x in DB['characters'])
        # Add an example build with a real character, equipment and monsterling image picker.
        page.get_by_role('button',name='Build nhân vật',exact=False).last.click();page.get_by_role('button',name='+ Thêm mới').click()
        page.locator('#editor-form [name="title"]').fill('Build Chloe DPS')
        page.locator('#editor-form [name="characterId"]').select_option('char-chloe')
        page.locator('[data-pick-key="gearIds"] .pick').first.click()
        page.locator('[data-pick-key="monsterlingIds"] .pick').first.click()
        page.locator('#editor-form button[type=submit]').click();page.locator('.adminlayout').wait_for()
        assert any(x['title']=='Build Chloe DPS' for x in DB['builds']),DB['builds']
        page.screenshot(path=str(ROOT/'tests'/'admin-smoke.png'),full_page=True)
        assert not errs,errs
        browser.close()
    server.shutdown()
    print('PASS browser smoke: home, login, create character, create build with selections, no JS exceptions')
if __name__=='__main__':main()
