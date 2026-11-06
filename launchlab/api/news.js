/**
 * Global crypto-relevant news from recent GDELT article search.
 * The feed is a monitored-index result and not an X / Twitter stream.
 */
const WORDS=/(?:bitcoin|ethereum|solana|cryptocurrenc|crypto\b|blockchain|stablecoin|defi\b|tokeniz|digital.asset|on.chain|web3|sec\b|spot.etf)/i;
const THEMES=[
 ['Security',/(?:hack|exploit|attack|drain|breach|phish|theft|stolen|vulnerab|rug.pull)/i],
 ['Regulation',/(?:regulat|law\b|court\b|sec\b|lawsuit|ban\b|policy|legislat|sanction|compliance|licens)/i],
 ['Markets',/(?:etf\b|funds?\b|exchange\b|liquidat|trading|invest|price|bitcoin|ethereum|stablecoin)/i],
 ['Infrastructure',/(?:network|protocol|solana|ethereum|upgrade|layer.?2|wallet|blockchain|validators?)/i],
 ];
const SOURCE_RE=/(?:coindesk\.com|decrypt\.co|cointelegraph\.com|theblock\.co|reuters\.com|bloomberg\.com|ft\.com|cnbc\.com|apnews\.com|wsj\.com|forbes\.com|bbc\.com)/i;
export function parseArticles(data,now=Date.now()){
  const results=[],seen=new Set();
  for(const x of Array.isArray(data.articles)?data.articles:[]){
    const title=String(x.title||'').replace(/\s+/g,' ').trim().slice(0,220);
    if(title.length<20 || !WORDS.test(title)) continue;
    let url;try{url=new URL(String(x.url||''));}catch{continue}
    if(url.protocol!=='https:'||!SOURCE_RE.test(url.hostname))continue;
    const raw=String(x.seendate||'');
    let when=Date.parse(raw);
    if(/^\d{14}$/.test(raw))when=Date.UTC(+raw.slice(0,4),+raw.slice(4,6)-1,+raw.slice(6,8),+raw.slice(8,10),+raw.slice(10,12),+raw.slice(12,14));
    if(!Number.isFinite(when)||when>now+300000||now-when>48*3600000) continue;
    const key=url.hostname+url.pathname.toLowerCase();
    if(seen.has(key))continue;seen.add(key);
    const category=THEMES.find(([,rx])=>rx.test(title))?.[0]||'Industry';
    results.push({id:key,title,url:url.href,domain:url.hostname,
      publishedAt:new Date(when).toISOString(),category,source:'GDELT article index'});
  }
  return results.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,24);
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','public, s-maxage=90, stale-while-revalidate=180');
  const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query','(bitcoin OR ethereum OR solana OR cryptocurrency OR stablecoin OR blockchain OR "crypto exchange")');
  url.searchParams.set('mode','artlist');
  url.searchParams.set('format','json');
  url.searchParams.set('sort','datedesc');
  url.searchParams.set('timespan','24h');
  url.searchParams.set('maxrecords','100');
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    let response;try{response=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});}finally{clearTimeout(timer)}
    if(!response.ok)throw Error('News index HTTP '+response.status);
    const articles=parseArticles(await response.json());
    return res.status(200).json({articles,source:'GDELT global news index; curated publisher filter',checkedAt:new Date().toISOString(),
      caveat:'Headlines are externally reported, not independently verified by Momentum. No X/Twitter firehose or trading recommendations.'});
  }catch(error){
    return res.status(503).json({error:'Crypto news temporarily unavailable',detail:String(error.message||'provider error').slice(0,120),articles:[]});
  }
}
