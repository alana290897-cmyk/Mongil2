import {pathToFileURL} from 'node:url';
import {resolve as res} from 'node:path';
export async function resolve(specifier,context,nextResolve){
 if(specifier==='@netlify/blobs')return {url:pathToFileURL(res('tests/blob-mock.mjs')).href,shortCircuit:true};
 if(specifier==='cheerio'||specifier==='fast-xml-parser')return {url:pathToFileURL(res('tests/feed-stub.mjs')).href,shortCircuit:true};
 return nextResolve(specifier,context);
}
