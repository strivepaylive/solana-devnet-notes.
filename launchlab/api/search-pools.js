// Search indexed Solana pools of any age; unlike the new-pools feed this has no 24h filter.
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const query=String(req.query.q||'').trim();
 if(query.length<2||query.length>100)return res.status(400).json({error:'Enter 2–100 characters'});
 res.setHeader('Cache-Control','public, s-maxage=20, stale-while-revalidate=60');
 try{
  const url='https://api.geckoterminal.com/api/v2/search/pools?query='+encodeURIComponent(query)+'&network=solana&include=base_token,quote_token&page=1';
  const response=await fetch(url,{headers:{accept:'application/json;version=20230203'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return res.status(502).json({error:'Search provider unavailable'});
  const data=await response.json();const included=new Map((data.included||[]).map(t=>[t.id,t]));
  const pools=(data.data||[]).slice(0,25).map(p=>{
   const a=p.attributes||{},base=included.get(p.relationships?.base_token?.data?.id),quote=included.get(p.relationships?.quote_token?.data?.id);
   const baseAddress=String(base?.attributes?.address||''),quoteAddress=String(quote?.attributes?.address||'');
   const stable=new Set(['So11111111111111111111111111111111111111112','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']);
   const token=stable.has(baseAddress)?quote:base;
   const mint=String(token?.attributes?.address||'');const pool=String(a.address||'');
   if(!BASE58.test(mint)||!BASE58.test(pool))return null;
   let imageUrl=null;try{const u=new URL(token?.attributes?.image_url||token?.attributes?.logo_url||'');if(u.protocol==='https:')imageUrl=u.toString()}catch{}
   return {mint,pool,name:String(token?.attributes?.name||'Unknown token').slice(0,80),symbol:String(token?.attributes?.symbol||'?').slice(0,20),imageUrl,
    createdAt:a.pool_created_at||null,liquidityUsd:numeric(a.reserve_in_usd),marketCapUsd:numeric(a.market_cap_usd),fdvUsd:numeric(a.fdv_usd),volume24hUsd:numeric(a.volume_usd?.h24),priceUsd:numeric(a.base_token_price_usd),network:'mainnet',source:'GeckoTerminal indexed pool search'};
  }).filter(Boolean);
  return res.status(200).json({pools,query,source:'GeckoTerminal indexed pool search'});
 }catch{return res.status(502).json({error:'Indexed pool search temporarily unavailable'})}
}
