// Refresh public pool price snapshots. Near-live polling, not tick-by-tick trades.
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const pool=String(req.query.pool||'');if(!BASE58.test(pool))return res.status(400).json({error:'Invalid pool'});
 res.setHeader('Cache-Control','public, s-maxage=10, stale-while-revalidate=15');
 try{
  const response=await fetch('https://api.geckoterminal.com/api/v2/networks/solana/pools/'+encodeURIComponent(pool),{headers:{accept:'application/json;version=20230203'},signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('Provider unavailable');
  const a=(await response.json())?.data?.attributes||{};
  const n=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  return res.status(200).json({priceUsd:n(a.base_token_price_usd),change5m:n(a.price_change_percentage?.m5),volume24hUsd:n(a.volume_usd?.h24),checkedAt:new Date().toISOString(),source:'GeckoTerminal pool snapshot'});
 }catch{return res.status(502).json({error:'Live pool snapshot unavailable'})}
}
