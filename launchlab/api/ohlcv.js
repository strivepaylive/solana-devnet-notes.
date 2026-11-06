// Server-side proxy for public GeckoTerminal OHLCV candles. No wallet or private data.
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const intervals={'1':['minute','1'],'5':['minute','5'],'15':['minute','15'],'60':['hour','1'],'240':['hour','4'],'1D':['day','1']};
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=45, stale-while-revalidate=90');
 if(req.method!=='GET'){res.status(405).json({error:'Method not allowed'});return}
 const pool=String(req.query.pool||''),interval=String(req.query.interval||'15');
 if(!BASE58.test(pool)||!intervals[interval]){res.status(400).json({error:'Invalid pool or interval'});return}
 const [unit,aggregate]=intervals[interval];
 const url='https://api.geckoterminal.com/api/v2/networks/solana/pools/'+encodeURIComponent(pool)+'/ohlcv/'+unit+'?aggregate='+aggregate+'&limit=90&currency=usd';
 try{
  const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(8500)});
  if(!response.ok){res.status(502).json({error:'Upstream chart unavailable'});return}
  const data=await response.json();const rows=data?.data?.attributes?.ohlcv_list;
  if(!Array.isArray(rows)){res.status(502).json({error:'No chart data'});return}
  const candles=rows.filter(x=>Array.isArray(x)&&x.length>=6&&x.slice(0,5).every(v=>Number.isFinite(Number(v)))).slice(0,90).reverse();
  res.status(200).json({pool,interval,candles,source:'GeckoTerminal'});
 }catch{res.status(502).json({error:'Chart data temporarily unavailable'})}
}
