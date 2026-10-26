import {syncAll} from '../../lib/feed.mjs';
// Netlify cron runs in UTC; 03:00 UTC is 10:00 in Viet Nam.
export default async function handler(){
  try{const results=await syncAll();console.log('Daily source sync',JSON.stringify(results));return new Response(JSON.stringify({ok:true,results}));}
  catch(e){console.error('Scheduled sync failed',e);return new Response('Sync failed',{status:500});}
}
