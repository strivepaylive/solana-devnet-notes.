import {evaluateIdentity,evaluateLaunch,isSolanaAddress} from './guard.js';
import {traceLaunchPayer,examineRepeatLaunch} from './lineage.js';
import {getLaunchReadiness,TRANSACTION_ROUTES} from './launch-safety.js';
import {DEFAULT_FEE_PREVIEW, makeFeePreview} from './tokenomics.js';
import {prepareBubbleMap} from './bubbles.js';
import {METEORA_DBC_PROGRAM, getIntegrationPlan, getQuoteTemplate, makeRentPreview, recommendedTemplate, validateMeteoraTemplate} from './mainnet-plan.js';
import {previewLaunchContribution} from './launch-quote.js';
const DEX='https://api.dexscreener.com';
const RPC='https://api.mainnet-beta.solana.com';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'};
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function error(text,status=400){return response({error:text},status)}
async function fetchJSON(url,init={},timeout=7000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const resp=await fetch(url,{...init,signal:controller.signal,headers:{accept:'application/json',...(init.headers||{})}});if(!resp.ok)throw Error(`Upstream ${resp.status}`);return await resp.json()}finally{clearTimeout(timer)}}
async function registry(env){if(!env.DB)return [];const data=await env.DB.prepare('SELECT mint,chain,name,symbol,source_url FROM canonical_tokens').all();return data.results||[]}
function safeNum(x){const n=Number(x);return Number.isFinite(n)&&n>=0?n:0}
function strongestPair(pairs,mint){return (pairs||[]).filter(p=>p?.chainId==='solana'&&p?.baseToken?.address===mint).sort((a,b)=>safeNum(b.liquidity?.usd)-safeNum(a.liquidity?.usd))[0]||null}
function tokenOf(p,mint){return p?.baseToken?.address===mint?p?.baseToken:p?.quoteToken?.address===mint?p?.quoteToken:null}
function pairSummary(p,mint){const t=tokenOf(p,mint);return {mint,chain:'solana',name:t?.name||'',symbol:t?.symbol||'',price:safeNum(p?.priceUsd),liquidityUsd:safeNum(p?.liquidity?.usd),volume1h:safeNum(p?.volume?.h1),volume24h:safeNum(p?.volume?.h24),buys1h:safeNum(p?.txns?.h1?.buys),sells1h:safeNum(p?.txns?.h1?.sells),change1h:Number(p?.priceChange?.h1)||0,createdAt:p?.pairCreatedAt||null,dexUrl:p?.url||null};}
async function pairsFor(mint){return fetchJSON(`${DEX}/token-pairs/v1/solana/${mint}`)}
async function inspectMint(mint,env){try{const resp=await fetchJSON(env.SOLANA_RPC_URL||RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[mint,{encoding:'jsonParsed',commitment:'confirmed'}]})},6500);const account=resp?.result?.value;const info=account?.data?.parsed?.info;const type=account?.data?.parsed?.type;
if(!account||type!=='mint'||!info||!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFhWyjzkQJ1D1aGkqKF'].includes(account.owner))return {known:false,mintAuthority:null,freezeAuthority:null,hasExtensions:false,reason:'Solana mint account could not be verified'};
return {known:true,mintAuthority:info.mintAuthority??null,freezeAuthority:info.freezeAuthority??null,hasExtensions:Boolean(info.extensions?.length),reason:''};}catch{return {known:false,mintAuthority:null,freezeAuthority:null,hasExtensions:false,reason:'Solana RPC unavailable'}}}
async function goPlus(mint){try{const data=await fetchJSON(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${mint}`,{},5500);const row=data?.result?.[mint]||data?.result?.[mint.toLowerCase()]||null;return {available:!!row, flags:row?Object.fromEntries(['is_mintable','is_freezable','is_honeypot','is_blacklisted'].filter(k=>row[k]!==undefined).map(k=>[k,row[k]])):null};}catch{return {available:false,flags:null}}}
function indicators(p){const h=safeNum(p.volume1h),liq=safeNum(p.liquidityUsd),tx=safeNum(p.buys1h)+safeNum(p.sells1h);const n=Math.min(100,Math.round(Math.min(36,Math.log10(h+1)*7)+Math.min(30,tx/8)+Math.min(22,Math.log10(liq+1)*4)+Math.min(12,safeNum(p.change1h)/9)));return {score:n,kind:'Market activity proxy, NOT verified organic interest',trades1h:tx};}
async function solanaRPC(method,params,env){
  const data=await fetchJSON(env.SOLANA_RPC_URL||RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})},7000);
  if(data.error)throw Error('RPC '+(data.error.message||'error'));
  return data.result;
}
async function developerHistory(mint,sum,env){
  if(!env.DB)return {source:'Solana RPC mint-initialization transaction',coverage:'History tracking is disabled until a D1 database is configured.',payer:null,signature:null,attribution:'unknown',originStatus:'not-configured',originReason:'Configure D1 for creator-history observation',history:{status:'unknown',pastLaunches:0,matchingBrandCount:0,quietMatchingCount:0,evidence:[],message:'No historical wallet matches available until D1 is configured.'}};
  const now=Math.floor(Date.now()/1000);
  let old=await env.DB.prepare('SELECT * FROM origin_observations WHERE mint=?').bind(mint).first();
  let traced;
  if(old?.origin_status==='observed')traced={status:'observed',payer:old.launch_payer,signature:old.evidence_signature,confidence:'transaction-payer-only',reason:'Cached on-chain mint initialization evidence'};
  else if(old && old.observed_at>now-21600)traced={status:old.origin_status,reason:'Historical scan incomplete or unavailable'};
  else try{traced=await traceLaunchPayer(mint,(method,params)=>solanaRPC(method,params,env))}catch{traced={status:'unavailable',reason:'RPC could not confirm the earliest mint transaction'}};
  await env.DB.prepare(`INSERT INTO origin_observations(mint,launch_payer,evidence_signature,origin_status,name,symbol,last_liquidity_usd,last_volume_24h,pair_created_at,observed_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mint) DO UPDATE SET launch_payer=excluded.launch_payer,evidence_signature=excluded.evidence_signature,origin_status=excluded.origin_status,name=excluded.name,symbol=excluded.symbol,last_liquidity_usd=excluded.last_liquidity_usd,last_volume_24h=excluded.last_volume_24h,pair_created_at=excluded.pair_created_at,observed_at=excluded.observed_at`)
    .bind(mint,traced.payer||null,traced.signature||null,traced.status,String(sum.name||'').slice(0,80),String(sum.symbol||'').slice(0,30),safeNum(sum.liquidityUsd),safeNum(sum.volume24h),sum.createdAt||null,now).run();
  let history={status:'unknown',pastLaunches:0,matchingBrandCount:0,quietMatchingCount:0,evidence:[],message:'No attributable launch payer found in bounded public RPC history.'};
  if(traced.status==='observed'&&traced.payer){
    const rows=await env.DB.prepare('SELECT mint,name,symbol,last_liquidity_usd,last_volume_24h,pair_created_at FROM origin_observations WHERE launch_payer=? AND mint<>? ORDER BY observed_at DESC LIMIT 50').bind(traced.payer,mint).all();
    history=examineRepeatLaunch(sum,rows.results||[]);
  }
  return {source:'Solana RPC mint-initialization transaction',coverage:'Previously scanned tokens only. No global creator history or verified developer identity.',payer:traced.payer||null,signature:traced.signature||null,attribution:traced.confidence||'unknown',originStatus:traced.status,originReason:traced.reason,history};
}
async function scan(mint,env){if(!isSolanaAddress(mint))throw Error('Invalid Solana mint address');const [pairs,mintInfo,canonical,security]=await Promise.all([pairsFor(mint).catch(()=>[]),inspectMint(mint,env),registry(env),goPlus(mint)]);const pair=strongestPair(pairs,mint);const sum=pairSummary(pair,mint);const official=canonical.find(x=>x.mint===mint);
if(!sum.name&&official){sum.name=official.name;sum.symbol=official.symbol;}
const identity=evaluateIdentity(sum,canonical);const lineage=await developerHistory(mint,sum,env);const guard=evaluateLaunch(identity,{liquidityUsd:sum.liquidityUsd,hasPool:!!pair,mintAuthorityKnown:mintInfo.known,mintAuthority:mintInfo.mintAuthority,freezeAuthority:mintInfo.freezeAuthority,hasExtensions:mintInfo.hasExtensions});
if(lineage.history.status==='review'&&guard.status==='active'){guard.status='review';guard.reason='Repeated token branding tied to the same observed mint-transaction payer; requires human review';}
// GoPlus responses vary; only present its flags as additional advisory data, never assume unreturned fields are clean.
if(security.flags?.is_honeypot==='1'||security.flags?.is_blacklisted==='1'){guard.status='review';guard.reason='Additional security provider warning';}
return {...sum,identity,lineage,boostEligibility:guard,mintInfo,security,activity:indicators(sum),canonicalSource:official?.source_url||null,disclaimer:'Not a security certification, rug guarantee, liquidity lock confirmation or verification of organic interest.'};}
async function latestFeed(env){const [profiles,boosts,canonical,activeBoosts]=await Promise.all([fetchJSON(`${DEX}/token-profiles/latest/v1`).catch(()=>[]),fetchJSON(`${DEX}/token-boosts/latest/v1`).catch(()=>[]),registry(env),env.DB?env.DB.prepare("SELECT mint FROM boosts WHERE status='active' AND expires_at>? ORDER BY created_at DESC LIMIT 24").bind(Math.floor(Date.now()/1000)).all():Promise.resolve({results:[]})]);
const candidates=new Map();for(const p of Array.isArray(profiles)?profiles:[])if(p.chainId==='solana'&&isSolanaAddress(p.tokenAddress))candidates.set(p.tokenAddress,{mint:p.tokenAddress,source:'DEX profile'});
for(const b of Array.isArray(boosts)?boosts:[])if(b.chainId==='solana'&&isSolanaAddress(b.tokenAddress))candidates.set(b.tokenAddress,{mint:b.tokenAddress,source:'DEX paid boost'});
for(const b of activeBoosts.results||[])if(isSolanaAddress(b.mint))candidates.set(b.mint,{mint:b.mint,source:'Momentum promotion'});
const selected=[...candidates.values()].slice(0,30);if(!selected.length)return {tokens:[],observedAt:Date.now(),source:'DEX Screener latest profiles + boosts',note:'No data available; never substitute fictional token data.'};
let pairs=[];try{pairs=await fetchJSON(`${DEX}/tokens/v1/solana/${selected.map(x=>x.mint).join(',')}`)}catch{pairs=[]};
const tokens=selected.map(x=>{const pair=strongestPair(pairs,x.mint);if(!pair)return null;const sum=pairSummary(pair,x.mint);const identity=evaluateIdentity(sum,canonical);if(identity.status!=='unverified')return null;return {...sum,activity:indicators(sum),promotionSource:x.source,identityStatus:'not independently verified'};}).filter(Boolean).sort((a,b)=>b.activity.score-a.activity.score);
return {tokens,observedAt:Date.now(),source:'DEX Screener latest profiles + boosts',note:'Trending market activity may be inorganic. Tokens under brand review are excluded.'};}
// Global watch samples four networks. It is not an exhaustive index of every blockchain.
async function globalWatch(){
  const profiles=await fetchJSON(`${DEX}/token-profiles/latest/v1`).catch(()=>[]);
  const chains=['solana','ethereum','base','bsc'];
  const byChain=Object.fromEntries(chains.map(c=>[c,[]]));
  for(const p of Array.isArray(profiles)?profiles:[]){
    if(!byChain[p.chainId]||byChain[p.chainId].length>=10||typeof p.tokenAddress!=='string')continue;
    if((p.chainId==='solana'&&!isSolanaAddress(p.tokenAddress))||(p.chainId!=='solana'&&!/^0x[a-fA-F0-9]{40}$/.test(p.tokenAddress)))continue;
    if(!byChain[p.chainId].some(x=>x.toLowerCase()===p.tokenAddress.toLowerCase()))byChain[p.chainId].push(p.tokenAddress);
  }
  const data=await Promise.all(chains.map(async chain=>{
    const mints=byChain[chain];if(!mints.length)return [];
    let pairs=[];try{pairs=await fetchJSON(`${DEX}/tokens/v1/${chain}/${mints.join(',')}`)}catch{}
    return mints.map(mint=>{
      const ps=(Array.isArray(pairs)?pairs:[]).filter(p=>p.chainId===chain&&[p.baseToken?.address?.toLowerCase(),p.quoteToken?.address?.toLowerCase()].includes(mint.toLowerCase()));
      const best=ps.sort((a,b)=>safeNum(b.liquidity?.usd)-safeNum(a.liquidity?.usd))[0];
      if(!best)return null;
      const t=best.baseToken?.address?.toLowerCase()===mint.toLowerCase()?best.baseToken:best.quoteToken;
      const liquidityUsd=safeNum(best.liquidity?.usd),volume1h=safeNum(best.volume?.h1),buys1h=safeNum(best.txns?.h1?.buys),sells1h=safeNum(best.txns?.h1?.sells);
      return {mint,chain,name:t.name,symbol:t.symbol,liquidityUsd,volume24h:safeNum(best.volume?.h24),price:safeNum(best.priceUsd),activity:indicators({liquidityUsd,volume1h,buys1h,sells1h,change1h:best.priceChange?.h1}),dexUrl:best.url};
    }).filter(Boolean);
  }));
  return {tokens:data.flat().sort((a,b)=>b.activity.score-a.activity.score),networks:chains,observedAt:Date.now(),source:'DEX Screener latest profiles; not an exhaustive or independently organic ranking'};
}
async function newsMentions(query){
  const cleaned=String(query||'').replace(/[^a-zA-Z0-9 ]/g,'').trim().slice(0,65);
  if(cleaned.length<4)return {articles:[],reason:'Name too short for reliable keyword search'};
  // GDELT article search is a keyword match, NOT a mint/brand identity check.
  const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  u.searchParams.set('query',`"${cleaned}"`);u.searchParams.set('mode','artlist');u.searchParams.set('format','json');u.searchParams.set('maxrecords','8');u.searchParams.set('timespan','24h');
  const data=await fetchJSON(u.toString(),{},6000).catch(()=>({}));
  const articles=(Array.isArray(data.articles)?data.articles:[]).filter(a=>/^https:\/\//.test(a.url||'')).map(a=>({title:String(a.title||'').slice(0,150),url:a.url,domain:a.domain||'',date:a.seendate||''}));
  return {articles,source:'GDELT public news search',disclaimer:'Keyword matches only; not confirmation articles refer to this token mint or endorsement.'};
}
function base58Decode(str){const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';const bytes=[0];for(const c of str){const v=alphabet.indexOf(c);if(v<0)throw Error('Invalid base58');let carry=v;for(let j=0;j<bytes.length;j++){carry+=bytes[j]*58;bytes[j]=carry&255;carry>>=8;}while(carry){bytes.push(carry&255);carry>>=8;}}for(const c of str){if(c!=='1')break;bytes.push(0);}return Uint8Array.from(bytes.reverse());}
async function verifyWallet(wallet,message,signature){try{const pub=base58Decode(wallet),sig=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));if(pub.length!==32||sig.length!==64)return false;const key=await crypto.subtle.importKey('raw',pub,{name:'Ed25519'},false,['verify']);return await crypto.subtle.verify('Ed25519',key,sig,new TextEncoder().encode(message));}catch{return false}}
async function jsonBody(req){const len=Number(req.headers.get('content-length')||'0');if(len>5000)throw Error('Request is too large');const text=await req.text();if(text.length>5000)throw Error('Request is too large');try{return JSON.parse(text)}catch{throw Error('Invalid JSON body')}}
function isURL(s){try{const u=new URL(s);return u.protocol==='https:'&&u.hostname.length>=4&&!u.username&&!u.password&&s.length<500;}catch{return false}}
async function verifyTurnstile(token,env,req){
  if(!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY)throw Error('Turnstile is not configured. Add the site key and secret before enabling submissions.');
  if(typeof token!=='string'||token.length<10||token.length>2048)throw Error('Complete the CAPTCHA challenge to continue');
  const form=new FormData();form.set('secret',env.TURNSTILE_SECRET_KEY);form.set('response',token);
  const ip=req.headers.get('CF-Connecting-IP');if(ip)form.set('remoteip',ip);
  const r=await fetchJSON('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form},7000);
  if(!r.success)throw Error('CAPTCHA verification failed or expired. Please retry.');
  const expected=new URL(req.url).hostname;
  if(!r.hostname || r.hostname!==expected)throw Error('CAPTCHA hostname mismatch');
  return true;
}
async function challenge(req,env,url){const b=await jsonBody(req);if(!isSolanaAddress(b.wallet)||!isSolanaAddress(b.mint)||!['boost','report'].includes(b.intent))return error('Invalid wallet, mint or intent');
await verifyTurnstile(b.turnstileToken,env,req);
const since=Math.floor(Date.now()/1000)-600;
const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM challenges WHERE wallet=? AND expires_at>?').bind(b.wallet,since).first();
if(Number(count?.n||0)>=8)return error('Too many requests from this wallet. Try again later.',429);
const nonce=crypto.randomUUID(),expiry=Math.floor(Date.now()/1000)+300;const message=`Momentum ${b.intent} authorization\nDomain: ${url.host}\nWallet: ${b.wallet}\nMint: ${b.mint}\nNonce: ${nonce}\nExpires: ${expiry}`;
await env.DB.prepare('INSERT INTO challenges(nonce,wallet,mint,intent,message,expires_at) VALUES(?,?,?,?,?,?)').bind(nonce,b.wallet,b.mint,b.intent,message,expiry).run();return response({nonce,message,expiresAt:expiry});}
async function authorize(b,env,intent){if(!isSolanaAddress(b.wallet)||!isSolanaAddress(b.mint)||!/^[-a-f0-9]{36}$/.test(b.nonce||'')||typeof b.signature!=='string'||b.signature.length>200)throw Error('Invalid authorization');const row=await env.DB.prepare('SELECT * FROM challenges WHERE nonce=?').bind(b.nonce).first();if(!row||row.used_at||row.intent!==intent||row.wallet!==b.wallet||row.mint!==b.mint||row.expires_at<=Date.now()/1000)throw Error('Challenge expired or invalid');if(!await verifyWallet(b.wallet,row.message,b.signature))throw Error('Wallet signature was not verified');const used=await env.DB.prepare('UPDATE challenges SET used_at=? WHERE nonce=? AND used_at IS NULL AND expires_at>?').bind(Math.floor(Date.now()/1000),b.nonce,Math.floor(Date.now()/1000)).run();if(!used.meta?.changes)throw Error('Challenge already used');}
async function newBoost(req,env){const b=await jsonBody(req);await authorize(b,env,'boost');const now=Math.floor(Date.now()/1000);const recent=await env.DB.prepare('SELECT id FROM boosts WHERE wallet=? AND created_at>? LIMIT 1').bind(b.wallet,now-86400).first();if(recent)return error('One free boost request per wallet every 24 hours',429);const duplicate=await env.DB.prepare("SELECT id FROM boosts WHERE mint=? AND expires_at>? AND status IN ('active','review') LIMIT 1").bind(b.mint,now).first();if(duplicate)return error('An active or pending boost request already exists for this mint',409);
const scanned=await scan(b.mint,env);const state=scanned.boostEligibility;await env.DB.prepare('INSERT INTO boosts(id,mint,wallet,name,symbol,status,reason,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.mint,b.wallet,scanned.name.slice(0,80),scanned.symbol.slice(0,30),state.status,state.reason,now,now+86400).run();return response({status:state.status,reason:state.reason,identity:scanned.identity,expiresAt:now+86400},state.status==='blocked'?403:201)}
async function report(req,env){const b=await jsonBody(req);await authorize(b,env,'report');if(typeof b.details!=='string'||b.details.length<15||b.details.length>600||!isURL(b.evidenceUrl))return error('Provide an HTTPS evidence URL and 15–600 character explanation');try{await env.DB.prepare('INSERT INTO reports(id,mint,wallet,evidence_url,details,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),b.mint,b.wallet,b.evidenceUrl,b.details,Math.floor(Date.now()/1000)).run();return response({received:true,notice:'Report queued for evidence review; reports alone do not cause automatic removal.'},201);}catch{return error('Report already submitted or unavailable',409)}}
async function currentBoosts(env){if(!env.DB)return response({boosts:[],disclaimer:'Promotion is not endorsement. Boost requests are disabled until D1 and Turnstile are configured.'});const rows=await env.DB.prepare("SELECT mint,name,symbol,created_at,expires_at,status FROM boosts WHERE status='active' AND expires_at>? ORDER BY created_at DESC LIMIT 40").bind(Math.floor(Date.now()/1000)).all();return response({boosts:rows.results||[],disclaimer:'Promotion is not endorsement or proof of safety.'});}
export default {
  async fetch(req,env,ctx){const url=new URL(req.url),path=url.pathname;try{if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);if(TRANSACTION_ROUTES.has(path))return response({error:'Live Solana trading is disabled. No bonding-curve or graduation program has been deployed. Do not send funds.',readiness:'/api/launch-readiness'},503);if(req.method==='GET'&&path==='/api/launch-readiness')return response(getLaunchReadiness());if(req.method==='GET'&&path==='/api/mainnet-plan'){
      try{const template=getQuoteTemplate(url.searchParams.get('quote')||'SOL');return response({plan:getIntegrationPlan(),template,validation:validateMeteoraTemplate(template)});}
      catch{return error('Quote must be SOL or USDC',400)}
    }
  if(req.method==='GET'&&path==='/api/launch-quote'){
      try{return response({preview:previewLaunchContribution({asset:url.searchParams.get('quote')||'SOL',funding:url.searchParams.get('funding')||'0'}),tradingEnabled:false});}
      catch(e){return error(e.message||'Invalid quote preview request',400)}
    }
  if(req.method==='GET'&&path==='/api/tokenomics'){
    try {
      const custom=url.searchParams.has('creatorShare')||url.searchParams.has('creator')||url.searchParams.has('holders')||url.searchParams.has('burn');
      const feePolicy=custom?makeFeePreview({
        creatorFeeShareBps:Number(url.searchParams.get('creatorShare')??5000),
        distribution:{creatorBps:Number(url.searchParams.get('creator')??5000),holderBps:Number(url.searchParams.get('holders')??3000),buybackBurnBps:Number(url.searchParams.get('burn')??2000)}
      }):DEFAULT_FEE_PREVIEW;
      return response({feePolicy,safety:'Not an on-chain config, fee claim, reward payout or burn instruction.'});
    } catch{return error('Fee shares must be 0–10000 bps and creator allocations must total 10000 bps',400)}
  }
  if(req.method==='GET'&&path==='/api/bubbles'){
    const mint=url.searchParams.get('mint')||'';
    if(!isSolanaAddress(mint))return error('Enter a valid Solana mint',400);
    try{
      const [largest,supply]=await Promise.all([
        solanaRPC('getTokenLargestAccounts',[mint,{commitment:'confirmed'}],env),
        solanaRPC('getTokenSupply',[mint,{commitment:'confirmed'}],env)
      ]);
      const listed=(largest?.value||[]).slice(0,20);
      // Accounts can be owned by exchanges, programs, or individuals. Do not guess clusters.
      let parsed=[];
      try{const ownership=await solanaRPC('getMultipleAccounts',[listed.map(x=>x.address),{encoding:'jsonParsed',commitment:'confirmed'}],env);parsed=ownership?.value||[];}
      catch{parsed=[];}
      const result=prepareBubbleMap(mint,listed,supply?.value?.amount,parsed);
      return response(result);
    }catch{return response({error:'Distribution data unavailable; no guesses were substituted.'},503)}
  }
  if(req.method==='GET'&&path==='/api/launch-cost'){
    try{
      const [mint,tokenAccount]=await Promise.all([solanaRPC('getMinimumBalanceForRentExemption',[82],env),solanaRPC('getMinimumBalanceForRentExemption',[165],env)]);
      return response({network:'solana-mainnet-beta',estimate:makeRentPreview(mint,tokenAccount),tradingEnabled:false,source:'Solana getMinimumBalanceForRentExemption RPC'});
    }catch{return response({network:'solana-mainnet-beta',estimate:null,tradingEnabled:false,error:'Live Solana rent data unavailable. Do not use a guessed amount for transactions.'},503)}
  }
  if(req.method==='GET'&&path==='/api/dbc-program'){
    try {
      const result=await solanaRPC('getAccountInfo',[METEORA_DBC_PROGRAM,{encoding:'base64',commitment:'finalized'}],env);
      return response({programId:METEORA_DBC_PROGRAM,accountFound:!!result?.value,executable:result?.value?.executable===true,owner:result?.value?.owner||null,verification:'RPC executable-account check ONLY, not a smart contract audit or authority/config check',tradingEnabled:false});
    }catch{return response({programId:METEORA_DBC_PROGRAM,accountFound:false,executable:false,error:'RPC unavailable. Live contract identity cannot be checked.',tradingEnabled:false},503)}
  }
  if(req.method==='GET'&&path==='/api/config')return response({siteKey:env.TURNSTILE_SITE_KEY||null,boostEnabled:!!(env.DB&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY),network:'solana',promotionsPaid:false,programId:null,programStatus:'not deployed',tradingEnabled:false});
  if(req.method==='GET'&&path==='/api/health')return response({ok:true,version:'0.1.0',status:'beta',databaseConfigured:!!env.DB});
  if(req.method==='GET'&&path==='/api/feed'){const key=new Request(url.origin+'/api/feed');const cached=await caches.default.match(key);if(cached)return cached;const body=await latestFeed(env);const out=response(body);out.headers.set('cache-control','public, max-age=90');ctx.waitUntil(caches.default.put(key,out.clone()));return out;}
  if(req.method==='GET'&&path==='/api/global'){const key=new Request(url.origin+'/api/global');const cached=await caches.default.match(key);if(cached)return cached;const out=response(await globalWatch());out.headers.set('cache-control','public, max-age=180');ctx.waitUntil(caches.default.put(key,out.clone()));return out;}
  if(req.method==='GET'&&path==='/api/news')return response(await newsMentions(url.searchParams.get('query')));
  if(req.method==='GET'&&path==='/api/boosts')return await currentBoosts(env);
  if(req.method==='GET'&&path==='/api/scan'){const mint=url.searchParams.get('mint')||'';if(!isSolanaAddress(mint))return error('Enter a valid Solana mint');const key=new Request(url.origin+'/api/scan?mint='+mint);const cached=await caches.default.match(key);if(cached)return cached;const out=response(await scan(mint,env));out.headers.set('cache-control','public, max-age=180');ctx.waitUntil(caches.default.put(key,out.clone()));return out;}
  if(req.method==='POST'&&path==='/api/auth/challenge'){if(!env.DB)return error('Boost and report submissions are disabled until the D1 database is configured.',503);return await challenge(req,env,url);}
  if(req.method==='POST'&&path==='/api/boost'){if(!env.DB)return error('Boost submissions are disabled until the D1 database is configured.',503);return await newBoost(req,env);}
  if(req.method==='POST'&&path==='/api/report'){if(!env.DB)return error('Reports are disabled until the D1 database is configured.',503);return await report(req,env);}
  return error('Not found',404);
  }catch(e){const msg=e?.message||'Temporary service error';if(/expired|Invalid|already|Provide|Request is|CAPTCHA|Too many|Complete the/.test(msg))return error(msg,/Too many/.test(msg)?429:400);console.log('Worker error:',msg);return error('Unable to complete request. Check network or server configuration.',503)}} ,
  async scheduled(event,env,ctx){if(!env.DB)return;ctx.waitUntil((async()=>{try{const data=await latestFeed(env);const now=Math.floor(Date.now()/1000);for(const t of data.tokens.slice(0,20))await env.DB.prepare('INSERT INTO trends(chain,mint,name,symbol,score,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(chain,mint) DO UPDATE SET score=excluded.score,created_at=excluded.created_at').bind('solana',t.mint,t.name,t.symbol,t.activity.score,now).run();await env.DB.prepare('DELETE FROM challenges WHERE expires_at<?').bind(now-86400).run();}catch(e){console.log('scheduled scan:',String(e))}})());}
};
