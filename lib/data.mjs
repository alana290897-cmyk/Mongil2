import {getStore} from '@netlify/blobs';
import {seed,types} from './seed.mjs';

export const allowedTypes = types;
const getDb=()=>getStore({name:'mongil-atlas-data',consistency:'strong'});
export const isType=t=>types.includes(t);
export function cleanRecord(data,type){
  if(!isType(type)||!data||typeof data!=='object'||Array.isArray(data))throw new Error('Loại dữ liệu không hợp lệ');
  const raw=JSON.stringify(data);if(raw.length>26000)throw new Error('Một bản ghi tối đa 26 KB');
  const output={};
  for(const [key,val] of Object.entries(data)){
    if(!/^[a-zA-Z][\w]{0,39}$/.test(key)||['__proto__','constructor','prototype'].includes(key))continue;
    if(typeof val==='string')output[key]=val.slice(0,key==='skills'||key==='description'||key==='summary'||key==='content'?12000:2500);
    else if(typeof val==='boolean')output[key]=val;
    else if(typeof val==='number'&&Number.isFinite(val))output[key]=val;
    else if(Array.isArray(val))output[key]=val.filter(x=>typeof x==='string').slice(0,30).map(x=>x.slice(0,120));
  }
  const id=String(output.id||'');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}$/.test(id))throw new Error('ID bản ghi không hợp lệ');
  if(!String(output.name||output.title||'').trim())throw new Error('Phải nhập tên hoặc tiêu đề');
  if(type==='teams'&&(!Array.isArray(output.characterIds)||output.characterIds.length!==3||new Set(output.characterIds).size!==3))throw new Error('Đội hình phải gồm đúng ba nhân vật khác nhau');
  if(type==='builds'&&(!output.characterId||typeof output.characterId!=='string'))throw new Error('Build phải chọn nhân vật');
  if(type==='builds'&&(output.gearIds?.length>4||output.monsterlingIds?.length>3))throw new Error('Quá số lượng trang bị hoặc Monsterling');
  if(type==='sources'){
    if(!['rss','atom','json','html'].includes(output.type)||!isType(output.target)||output.target==='sources')throw new Error('Loại nguồn hoặc danh mục đích không hợp lệ');
    try{const u=new URL(output.url);if(u.protocol!=='https:')throw new Error();}catch{throw new Error('Nguồn yêu cầu URL HTTPS hợp lệ');}
  }
  return output;
}
export async function getCollection(type){
  if(!isType(type))throw new Error('Danh mục không hợp lệ');
  const stored=await getDb().get(`collection-${type}`,{type:'json'});
  return Array.isArray(stored)?stored:structuredClone(seed[type]);
}
export async function saveCollection(type,arr){
  if(!isType(type)||!Array.isArray(arr))throw new Error('Dữ liệu không hợp lệ');
  if(arr.length>5000)throw new Error('Tối đa 5000 bản ghi mỗi danh mục');
  await getDb().setJSON(`collection-${type}`,arr);
}
export async function getAll(includeDrafts=false){
  const results=await Promise.all(types.map(t=>getCollection(t)));
  const out={};for(let i=0;i<types.length;i++)out[types[i]]=includeDrafts?results[i]:results[i].filter(x=>x.published!==false);
  // Không tiết lộ cấu hình nguồn cho khách chưa đăng nhập
  if(!includeDrafts)delete out.sources;
  return out;
}
export async function upsertRecord(type,input){
  const record=cleanRecord(input,type);
  if(type==='builds'||type==='teams'){
    const chars=await getCollection('characters'),known=new Set(chars.map(x=>x.id));
    if(type==='builds'&&!known.has(record.characterId))throw new Error('Nhân vật của build không tồn tại');
    if(type==='teams'&&record.characterIds.some(id=>!known.has(id)))throw new Error('Đội hình chứa nhân vật không tồn tại');
  }
  const arr=await getCollection(type);
  const idx=arr.findIndex(x=>x.id===record.id);
  const now=new Date().toISOString();
  if(idx>=0)arr[idx]={...arr[idx],...record,updatedAt:now};
  else arr.unshift({...record,createdAt:now,updatedAt:now});
  await saveCollection(type,arr);return record.id;
}
export async function removeRecord(type,id){
  if(!isType(type)||typeof id!=='string')throw new Error('Bản ghi không hợp lệ');
  const arr=await getCollection(type);const filtered=arr.filter(x=>x.id!==id);
  if(filtered.length===arr.length)throw new Error('Không tìm thấy bản ghi');
  await saveCollection(type,filtered);return true;
}
export async function importAll(data,replace=false){
  if(!data||typeof data!=='object')throw new Error('Tệp JSON không hợp lệ');
  let count=0;
  for(const type of types){
    if(!Array.isArray(data[type]))continue;
    const existing=replace?[]:await getCollection(type);
    const map=new Map(existing.map(x=>[x.id,x]));
    for(const item of data[type].slice(0,5000)){
      const clean=cleanRecord(item,type);
      map.set(clean.id,{...(map.get(clean.id)||{}),...clean});count++;
    }
    await saveCollection(type,[...map.values()]);
  }
  return count;
}
