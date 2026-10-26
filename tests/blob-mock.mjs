// Used ONLY in API unit tests; Netlify uses the real @netlify/blobs dependency in production.
const db=new Map();
export function getStore(opts){const name=typeof opts==='string'?opts:opts.name;if(!db.has(name))db.set(name,new Map());const store=db.get(name);return {
  async get(key,opt={}){let x=store.get(key);return x===undefined?null:opt.type==='json'?structuredClone(x):typeof x==='string'?x:JSON.stringify(x)},
  async setJSON(key,val){store.set(key,structuredClone(val))},
  async set(key,val){store.set(key,val)},
  async delete(key){store.delete(key)},
  async list(){return {blobs:[...store.keys()].map(key=>({key}))}}
}}
export function reset(){db.clear()}
