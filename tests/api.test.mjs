import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {reset} from './blob-mock.mjs';
process.env.SESSION_SECRET='testing-not-for-real-deploy-1234567890';
const {default:handler}=await import('../netlify/functions/api.mjs');
beforeEach(reset);
const req=(path,body,cookie)=>new Request('https://atlas.example/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Origin':'https://atlas.example'}:{}),...(cookie?{cookie}: {})},body:body?JSON.stringify(body):undefined});
const call=async(path,body,cookie)=>{const res=await handler(req(path,body,cookie));return {res,data:await res.json()}};
async function login(){const r=await call('login',{username:'admin',password:'admin'});assert.equal(r.res.status,200);return r.res.headers.get('set-cookie').split(';')[0];}
test('Public content is read-only, seeds load and sources are private',async()=>{
 const {data}=await call('data');assert.equal(data.data.characters.length,29);assert.equal(data.data.news.length,3);assert.equal('sources' in data.data,false);
 const denied=await call('record',{action:'delete',type:'characters',id:'char-chloe'});assert.equal(denied.res.status,401);
});
test('Admin login, CRUD, published and draft visibility',async()=>{
 const cookie=await login();
 const saved=await call('record',{action:'save',type:'characters',record:{id:'char-test',name:'Nhân vật Test',element:'Hỏa',published:true}},cookie);assert.equal(saved.res.status,200,JSON.stringify(saved.data));
 let out=await call('data');assert.equal(out.data.data.characters.length,30);
 await call('record',{action:'save',type:'characters',record:{id:'char-test',name:'Nhân vật Test',published:false}},cookie);
 out=await call('data');assert.equal(out.data.data.characters.length,29);
 out=await call('data',null,cookie);assert.equal(out.data.data.characters.length,30);
 const del=await call('record',{action:'delete',type:'characters',id:'char-test'},cookie);assert.equal(del.res.status,200);
 out=await call('data',null,cookie);assert.equal(out.data.data.characters.length,29);
});
test('Admin password can be changed and previous sessions invalidated',async()=>{
 const cookie=await login();
 const r=await call('password',{oldPassword:'admin',newPassword:'VeryStrongPass2026!'},cookie);assert.equal(r.res.status,200,r.data.error);
 const old=await call('data',null,cookie);assert.equal(old.data.admin,false);
 const denied=await call('login',{username:'admin',password:'admin'});assert.equal(denied.res.status,401);
 const good=await call('login',{username:'admin',password:'VeryStrongPass2026!'});assert.equal(good.res.status,200);
});
test('Server checks team shape and build target',async()=>{
 const cookie=await login();
 let r=await call('record',{action:'save',type:'teams',record:{id:'team-x',title:'Team invalid',characterIds:['char-chloe']}},cookie);assert.equal(r.res.status,400);
 r=await call('record',{action:'save',type:'builds',record:{id:'build-x',title:'Build Test',characterId:'char-chloe',gearIds:['gear-sirius'],monsterlingIds:['mon-amon']}},cookie);assert.equal(r.res.status,200,r.data.error);
});
test('Export requires admin and does not include credentials',async()=>{
 const denied=await call('export');assert.equal(denied.res.status,401);
 const cookie=await login();const out=await call('export',null,cookie);assert.ok(out.data.data.sources);assert.ok(!('password' in out.data));
});
