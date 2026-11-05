/**
 * GeckoTerminal public Solana NEW POOLS feed.
 * This is mainnet liquidity pool discovery, not all token mints/launches.
 * The upstream service documents 60-second API caching.
 * Edge caching prevents one upstream request per website visitor.
 */
const UPSTREAM = 'https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1&include=base_token,quote_token';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const STABLE = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCER3w8JJ7a2tTQfPezL8B1nGHjucyK8E'
]);
export function parsePools(payload, now=Date.now()) {
  const included = new Map((payload.included || []).map(x=>[x.id,x]));
  const seen = new Set();
  const items = [];
  for (const p of payload.data || []) {
    const attrs=p.attributes||{};
    const base=included.get(p.relationships?.base_token?.data?.id);
    const quote=included.get(p.relationships?.quote_token?.data?.id);
    const baseAddress=String(base?.attributes?.address||'');
    const quoteAddress=String(quote?.attributes?.address||'');
    const mint=STABLE.has(baseAddress)?quoteAddress:baseAddress;
    if (!BASE58.test(mint) || STABLE.has(mint) || seen.has(mint)) continue;
    const created=Date.parse(attrs.pool_created_at||'');
    if (!Number.isFinite(created) || created>now+120000 || now-created>86400000) continue;
    const pool=String(attrs.address||'');
    if (!BASE58.test(pool)) continue;
    seen.add(mint);
    const token=STABLE.has(baseAddress)?quote:base;
    const candidateImage=token?.attributes?.image_url||token?.attributes?.logo_url||null;
    let imageUrl=null;
    try {const u=new URL(String(candidateImage||''));if(u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.'))imageUrl=u.toString()}catch{}
    const numeric = value => value!==null && value!==undefined && value!=='' && Number.isFinite(Number(value)) ? Number(value) : null;
    items.push({
      mint, pool, imageUrl, createdAt:new Date(created).toISOString(),
      name:String(token?.attributes?.name||'Unlabeled token').slice(0,80),
      symbol:String(token?.attributes?.symbol||'?').slice(0,20),
      dex:String(p.relationships?.dex?.data?.id||attrs.dex_name||'DEX').slice(0,80),
      fdvUsd:numeric(attrs.fdv_usd),marketCapUsd:numeric(attrs.market_cap_usd),
      liquidityUsd:numeric(attrs.reserve_in_usd),
      priceUsd:numeric(attrs.base_token_price_usd),
      volume24hUsd:numeric(attrs.volume_usd?.h24),
      buys24h:numeric(attrs.transactions?.h24?.buys),
      sells24h:numeric(attrs.transactions?.h24?.sells),
      source:'GeckoTerminal new pools',network:'mainnet-beta'
    });
    if (items.length>=25) break;
  }
  return items.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
export default async function handler(req,res) {
  if (req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=90');
  try {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let response;
    try {
      response=await fetch(UPSTREAM,{headers:{accept:'application/json;version=20230203'},signal:controller.signal});
    }finally{clearTimeout(timer)}
    if(!response.ok) throw Error('Market source HTTP '+response.status);
    const data=await response.json();
    const pools=parsePools(data);
    return res.status(200).json({
      pools,checkedAt:new Date().toISOString(),
      source:'GeckoTerminal public new pools API',
      caveat:'Pools appear on Solana mainnet, not necessarily at token mint time. Upstream data has ~60-second caching; this feed is not all launches. Unknown risks must not be interpreted as safe.'
    });
  }catch(error){
    return res.status(503).json({error:'New-pool provider unavailable',detail:String(error.message||'network failure').slice(0,120),pools:[]});
  }
}
