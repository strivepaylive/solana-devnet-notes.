// Public metadata is a claim from a market-data source, not an independent ownership verification.
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const safeUrl=(value,hosts)=>{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password)return null;
  if(hosts&&!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;
  return u.toString();
 }catch{return null}
};
export function mapTokenMetadata(attrs={}){
 const sites=(Array.isArray(attrs.websites)?attrs.websites:[])
   .filter(x=>typeof x==='string').map(x=>safeUrl(x)).filter(Boolean).slice(0,2);
 const xHandle=String(attrs.twitter_handle||'').replace(/^@/,'');
 const tgHandle=String(attrs.telegram_handle||'').replace(/^@/,'');
 const x=/^[A-Za-z0-9_]{1,15}$/.test(xHandle)?'https://x.com/'+xHandle:null;
 const telegram=/^[A-Za-z0-9_]{5,32}$/.test(tgHandle)?'https://t.me/'+tgHandle:safeUrl(tgHandle,['t.me','telegram.me']);
 return {
  name:String(attrs.name||'').slice(0,70),symbol:String(attrs.symbol||'').slice(0,20),
  description:String(attrs.description||'').replace(/[\u0000-\u001F]/g,' ').slice(0,1100),
  image:safeUrl(String(attrs.image_url||'')),
  websites:sites,x,telegram,
  providerVerified:attrs.gt_verified===true,
  coinGeckoId:attrs.coingecko_coin_id?String(attrs.coingecko_coin_id).slice(0,80):null
 };
}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const mint=String(req.query?.mint||'');
 if(!BASE58.test(mint))return res.status(400).json({error:'Invalid Solana mint.'});
 res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
 const url='https://api.geckoterminal.com/api/v2/networks/solana/tokens/'+encodeURIComponent(mint)+'/info';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  let response;try{response=await fetch(url,{headers:{accept:'application/json;version=20230203'},signal:controller.signal});}finally{clearTimeout(timer)}
  if(!response.ok)throw Error('Metadata provider unavailable.');
  const data=await response.json();
  return res.status(200).json({mint,metadata:mapTokenMetadata(data.data?.attributes),
   source:'GeckoTerminal token info',caveat:'Social links and descriptions are provider-supplied project claims; they are not proof of control or safety.'});
 }catch{
  return res.status(503).json({error:'Token social metadata unavailable; social identity remains unverified.'});
 }
}
