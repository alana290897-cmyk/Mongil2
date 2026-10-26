import {createHmac,createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {getAll,getCollection,saveCollection,upsertRecord,removeRecord,importAll,cleanRecord,isType} from '../../lib/data.mjs';
import {syncAll,discover,syncOne} from '../../lib/feed.mjs';

const USER=process.env.ADMIN_USERNAME||'admin';
const DEFAULT_PASSWORD=process.env.ADMIN_PASSWORD||'admin';
const SECRET=process.env.SESSION_SECRET||createHash('sha256').update(`mongil-atlas|${DEFAULT_PASSWORD}|${process.env.NETLIFY_SITE_ID||'local'}`).digest('hex');
const secure=process.env.NODE_ENV!=='development';
const basicHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const ok=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...basicHeaders,...headers}});
const err=(message,status=400)=>ok({error:message},status);
const hash=s=>createHash('sha256').update(s).digest('hex');
const makeHash=(password,salt=randomBytes(16).toString('hex'))=>`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
function verify(password,credential){
  const [salt,key]=String(credential).split(':');if(!salt||!key)return false;
  const a=Buffer.from(key,'hex'),b=scryptSync(password,salt,64);return a.length===b.length&&timingSafeEqual(a,b);
}
const credentialStore=()=>getStore({name:'mongil-atlas-security',consistency:'strong'});
const getCredential=async()=>await credentialStore().get('admin',{type:'json'});
async function checkPassword(password){const current=await getCredential();return current?verify(password,current.hash):verify(password,makeHash(DEFAULT_PASSWORD,'atlas-default-login'));}
function sign(payload){return createHmac('sha256',SECRET).update(payload).digest('base64url');}
function sessionCookie(version='initial'){
  const timestamp=Date.now(),exp=timestamp+7*86400000;
  const msg=`${timestamp}.${exp}.${version}`;
  return `atlas_session=${msg}.${sign(msg)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${secure?'; Secure':''}`;
}
async function isLogged(req){
  const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('atlas_session='))?.slice(14);
  if(!token)return false;
  const bits=token.split('.');if(bits.length!==4)return false;
  const payload=bits.slice(0,3).join('.');const sig=sign(payload);
  const a=Buffer.from(sig),b=Buffer.from(bits[3]);
  if(a.length!==b.length||!timingSafeEqual(a,b)||Date.now()>Number(bits[1])||Date.now()<Number(bits[0]))return false;
  const current=await getCredential();return bits[2]===(current?.version||'initial');
}
async function parseBody(req){
  const text=await req.text();if(text.length>1_200_000)throw Error('Dữ liệu gửi quá lớn');
  try{return JSON.parse(text||'{}')}catch{throw Error('JSON không hợp lệ')}
}
function sameSite(req){
  const origin=req.headers.get('origin');
  if(!origin)return true;
  try{return new URL(origin).host===new URL(req.url).host;}catch{return false;}
}
async function rateLimit(req,valid){
  const ip=(req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const store=credentialStore(),key=`attempt-${hash(ip).slice(0,20)}`;
  const now=Date.now(),saved=await store.get(key,{type:'json'})||{count:0,until:0};
  if(saved.until>now)return false;
  if(valid){await store.setJSON(key,{count:0,until:0});return true;}
  const count=(saved.until&&saved.until<now?0:saved.count||0)+1;
  await store.setJSON(key,{count,until:count>=5?now+15*60000:0});return true;
}
export default async function handler(req){
  try{
    const path=new URL(req.url).pathname.split('/').filter(Boolean).pop()||'data';
    const method=req.method.toUpperCase();
    if(method==='OPTIONS')return err('Không hỗ trợ CORS',405);
    if(method==='GET'&&path==='health')return ok({online:true,backend:'Netlify Functions + Blobs',serverTime:new Date().toISOString()});
    if(method==='GET'&&path==='session'){
      const admin=await isLogged(req);return ok({admin,username:admin?USER:null,defaultCredential:admin&&!await getCredential()&&DEFAULT_PASSWORD==='admin'});
    }
    if(method==='GET'&&path==='data'){
      const admin=await isLogged(req);return ok({data:await getAll(admin),admin});
    }
    if(method==='POST'&&!sameSite(req))return err('Yêu cầu khác nguồn bị từ chối',403);
    if(method==='POST'&&path==='login'){
      const body=await parseBody(req);
      const user=String(body.username||'').slice(0,80),password=String(body.password||'').slice(0,300);
      // Kiểm tra khóa trước khi xác thực
      const ip=(req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
      const record=await credentialStore().get(`attempt-${hash(ip).slice(0,20)}`,{type:'json'});
      if(record?.until>Date.now())return err('Đăng nhập bị khóa 15 phút do nhiều lần sai',429);
      const match=user===USER&&await checkPassword(password);
      await rateLimit(req,match);
      if(!match)return err('Sai tài khoản hoặc mật khẩu',401);
      const cred=await getCredential();return ok({admin:true,username:USER,defaultCredential:!cred&&DEFAULT_PASSWORD==='admin'},200,{'Set-Cookie':sessionCookie(cred?.version||'initial')});
    }
    if(method==='POST'&&path==='logout')return ok({ok:true},200,{'Set-Cookie':`atlas_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure?'; Secure':''}`});
    if(!await isLogged(req))return err('Yêu cầu đăng nhập quản trị',401);
    if(method==='POST'&&path==='password'){
      const body=await parseBody(req);
      if(!await checkPassword(String(body.oldPassword||'')))return err('Mật khẩu hiện tại không đúng',403);
      const pass=String(body.newPassword||'');
      if(pass.length<10||pass.length>128) return err('Mật khẩu mới cần ít nhất 10 ký tự',400);
      const version=randomBytes(12).toString('hex');
      await credentialStore().setJSON('admin',{hash:makeHash(pass),version,changedAt:new Date().toISOString()});
      return ok({ok:true},200,{'Set-Cookie':sessionCookie(version)});
    }
    if(method==='POST'&&path==='record'){
      const body=await parseBody(req);const type=body.type;
      if(!isType(type))return err('Danh mục không hợp lệ');
      if(body.action==='delete'){
        if(type==='characters'&&(!body.id||typeof body.id!=='string'))return err('ID không hợp lệ');
        await removeRecord(type,body.id);return ok({ok:true});
      }
      if(body.action!=='save')return err('Hành động không hợp lệ');
      const id=await upsertRecord(type,body.record);return ok({ok:true,id});
    }
    if(method==='POST'&&path==='preview'){
      const body=await parseBody(req);
      const sources=await getCollection('sources');
      const source=body.id?sources.find(x=>x.id===body.id):cleanRecord(body.source,'sources');
      if(!source)return err('Không tìm thấy nguồn');
      return ok({items:await discover(source)});
    }
    if(method==='POST'&&path==='sync'){
      const body=await parseBody(req);
      if(body.id){const sources=await getCollection('sources');const src=sources.find(x=>x.id===body.id);
        if(!src)return err('Không tìm thấy nguồn');
        try{const result=await syncOne(src);src.lastSync=new Date().toISOString();src.lastError='';await saveCollection('sources',sources);return ok({results:[{name:src.name,...result}]});}
        catch(e){src.lastError=String(e.message||e);await saveCollection('sources',sources);throw e;}
      }
      return ok({results:await syncAll()});
    }
    if(method==='GET'&&path==='export')return ok({version:1,exportedAt:new Date().toISOString(),data:await getAll(true)});
    if(method==='POST'&&path==='import'){
      const body=await parseBody(req);const count=await importAll(body.data,!!body.replace);return ok({ok:true,count});
    }
    return err('Đường dẫn không tồn tại',404);
  }catch(e){
    console.error('API error',e);
    if(/Blobs|credentials|siteID|NETLIFY/i.test(String(e.message||'')))return err('Không thể truy cập kho dữ liệu Netlify. Cần triển khai bằng Git/Netlify CLI và kiểm tra cấu hình.',503);
    return err(String(e.message||'Lỗi máy chủ').slice(0,300),400);
  }
}
