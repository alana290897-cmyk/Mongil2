import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {XMLParser} from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import {getCollection,saveCollection,allowedTypes} from './data.mjs';

const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54);
const h=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,16);
const unsafeIP=ip=>/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.0\.|198\.18\.|::1$|fe80:|fc|fd)/i.test(ip);
async function assertSafe(u){
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal'))throw Error('Chỉ cho phép nguồn HTTPS công khai');
  const resolved=await lookup(u.hostname,{all:true});
  if(!resolved.length||resolved.some(x=>unsafeIP(x.address)))throw Error('Máy chủ nguồn không được phép');
}
async function fetchSource(url){
  let current=new URL(url);
  for(let i=0;i<4;i++){
    await assertSafe(current);
    const res=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(11000),headers:{'user-agent':'MongilAtlas/1.0 (+community-catalog; contact site owner)','accept':'application/rss+xml,application/atom+xml,application/json,text/html,*/*'}});
    if([301,302,303,307,308].includes(res.status)){
      if(!res.headers.get('location'))throw Error('Chuyển hướng không hợp lệ');
      current=new URL(res.headers.get('location'),current);continue;
    }
    if(!res.ok)throw Error(`Nguồn HTTP ${res.status}`);
    const size=Number(res.headers.get('content-length')||0);if(size>2_000_000)throw Error('Nguồn quá lớn');
    const text=(await res.text());if(text.length>2_000_000)throw Error('Nguồn quá lớn');
    return {text,url:current.toString(),contentType:res.headers.get('content-type')||''};
  }
  throw Error('Nguồn chuyển hướng quá nhiều lần');
}
const one=x=>Array.isArray(x)?x[0]:x;
const val=x=>typeof x==='string'?x:typeof x==='object'?x?.['#text']||x?.['@_href']||'':'';
function parseXML(text){
  const data=new XMLParser({ignoreAttributes:false}).parse(text);
  const channel=data.rss?.channel;
  if(channel){return [].concat(channel.item||[]).map(x=>({title:val(x.title),summary:val(x.description)||val(x['content:encoded']),url:val(x.link),date:val(x.pubDate)}));}
  const entries=data.feed?.entry;
  return [].concat(entries||[]).map(x=>({title:val(x.title),summary:val(x.summary)||val(x.content),url:val(one(x.link))||one([].concat(x.link||[]).filter(y=>y?.['@_rel']==='alternate'))?.['@_href']||'',date:val(x.updated)||val(x.published)}));
}
function parseHTML(text,base,selector){
  const $=cheerio.load(text);const seen=new Set();const out=[];
  const sel=selector||'a[href*="/view/"]';
  $(sel).slice(0,100).each((_,el)=>{
    const node=$(el);const title=node.text().replace(/\s+/g,' ').trim().slice(0,300);
    let url='';try{url=new URL(node.attr('href')||'',base).toString()}catch{return}
    if(!title||title.length<9||!url.startsWith('https://')||seen.has(url))return;
    seen.add(url);out.push({title,url,summary:'Tin được phát hiện từ trang nguồn. Mở liên kết để xác minh thông tin.',date:''});
  });return out;
}
function parseJSON(text){
  const data=JSON.parse(text);const rows=Array.isArray(data)?data:Array.isArray(data.items)?data.items:Array.isArray(data.data)?data.data:Array.isArray(data.results)?data.results:[];
  return rows.map(x=>({name:String(x.name||x.title||'').slice(0,300),title:String(x.title||x.name||'').slice(0,300),summary:String(x.summary||x.description||'').slice(0,1500),url:String(x.url||x.link||'').slice(0,1500),date:String(x.date||x.pubDate||'').slice(0,50),image:String(x.image||x.imageUrl||'').slice(0,2000),element:String(x.element||'').slice(0,100),role:String(x.role||'').slice(0,100),skills:String(x.skills||'').slice(0,10000),set2:String(x.set2||'').slice(0,2000),set4:String(x.set4||'').slice(0,2000),link:String(x.linkEffect||x.linkSkill||'').slice(0,2000),rank:String(x.rankEffect||'').slice(0,2000)})).filter(x=>x.name);
}
export async function discover(source){
  const {text,url}=await fetchSource(source.url);
  let list;
  if(source.type==='json')list=parseJSON(text);
  else if(source.type==='html')list=parseHTML(text,url,source.selector);
  else list=parseXML(text);
  return list.filter(x=>x.title||x.name).slice(0,Math.min(50,Math.max(1,Number(source.limit)||20))).map(x=>{
    const title=(x.title||x.name).replace(/<[^>]+>/g,'').trim();
    let link='';try{link=new URL(x.url||url,url).toString()}catch{link=url}
    const id=`ext-${h(link===''+url?title:link+'|'+source.target+'|'+title)}`;
    let date='';if(x.date){const ts=Date.parse(x.date);if(Number.isFinite(ts))date=new Date(ts).toISOString().slice(0,10);}
    const common={id,published:!!source.autoPublish,external:true,source:source.url,sourceName:source.sourceName||source.name,url:link,image:x.image||'',importedAt:new Date().toISOString()};
    if(['characters','equipment','monsterlings'].includes(source.target)){
      const entityId=`${source.target.slice(0,3)}-${slug(title)}`;
      return {...common,id:entityId,name:title,...(source.target==='characters'?{element:x.element||'Chưa cập nhật',role:x.role||'Chưa cập nhật',skills:x.skills||''}:source.target==='equipment'?{set2:x.set2||'',set4:x.set4||''}:{link:x.link||'',rank:x.rank||''})};
    }
    return {...common,title,summary:x.summary||'',date};
  });
}
export async function syncOne(source,{dryRun=false}={}){
  if(!source||!allowedTypes.includes(source.target)||source.target==='sources')throw Error('Nguồn không hợp lệ');
  const found=await discover(source);
  if(dryRun)return {found,added:0,updated:0};
  const all=await getCollection(source.target);const map=new Map(all.map((item,i)=>[item.id,i]));const nameMap=new Map(all.filter(x=>x.name).map((item,i)=>[item.name.toLowerCase(),item.id]));
  let added=0,updated=0;
  for(const item of found){
    const existingId=map.has(item.id)?item.id:nameMap.get((item.name||'').toLowerCase());
    if(existingId){
      if(source.allowUpdate){const ix=all.findIndex(x=>x.id===existingId);if(ix>=0){const nonempty=Object.fromEntries(Object.entries(item).filter(([k,v])=>!['id','published'].includes(k)&&v!==''));all[ix]={...all[ix],...nonempty,id:existingId};updated++;}}
    }else{all.push(item);added++;map.set(item.id,all.length-1);}
  }
  if(added||updated)await saveCollection(source.target,all);
  return {found:found.length,added,updated};
}
export async function syncAll(){
  const sources=await getCollection('sources');const results=[];
  for(const source of sources.filter(s=>s.enabled).slice(0,10)){
    try{const outcome=await syncOne(source);source.lastSync=new Date().toISOString();source.lastError='';results.push({name:source.name,...outcome});}
    catch(e){source.lastError=String(e.message||e).slice(0,400);results.push({name:source.name,error:source.lastError});}
  }
  await saveCollection('sources',sources);return results;
}
