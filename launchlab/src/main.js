import {
 connect, disconnect, connectedAddress, verifyConfig, createToken, inspectPool, tradeToken,
 getMomentumPlatform, createMomentumPlatform, proveWalletControl, connection
} from './chain.js';
import {validateLaunch, isPublicKey, toAtomic, QUOTES} from './validation.js';
import {PublicKey} from '@solana/web3.js';
import {loadMainnetPools, loadNews, loadRisk, observeDevnetLaunches,formatMoney} from './live.js';

const el=id=>document.getElementById(id);
const $all=selector=>Array.from(document.querySelectorAll(selector));
const app={busy:false,mode:'mainnet',mainnet:[],devnet:[],risks:new Map(),metadata:new Map(),selected:null,
  loaded:false,seen:new Set(),scanCache:new Map(),news:[],timer:null,sub:null,
  audio:false,profile:null,uploadReady:false,turnstileId:null,sitekey:'',tourIndex:-1,avatarURL:null};
const sym=s=>String(s??'').slice(0,6)+'…'+String(s??'').slice(-4);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl=(value,hosts=null)=>{
 try{
   const u=new URL(String(value||'').trim());
   if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))return null;
   if(hosts&&!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;
   return u.toString();
 }catch{return null}
};
function toast(text){
 const node=el('toast');node.textContent=text;node.classList.add('show');
 if(node._hide)clearTimeout(node._hide);
 node._hide=setTimeout(()=>node.classList.remove('show'),4400);
}
function message(text,type=''){
 const status=el('status');
 // Status panel is created lazily to keep the beginner launch form clean.
 if(status){status.textContent=text;status.className='status '+type;}
 toast(text.split('\n')[0].slice(0,150));
}
function hint(id,lines){el(id).textContent=Array.isArray(lines)?lines.join('\n'):lines}
function busy(value){
 app.busy=value;
 for(const id of ['walletBtn','createBtn','verifyConfigBtn','inspectBtn','tradeBtn','createPlatformBtn']) {
   const node=el(id);if(node)node.disabled=value || (id==='createPlatformBtn'&&!canOperator());
 }
}
function fail(error){message('Operation stopped: '+(error?.message||String(error)),'error')}
function soundWarning(){
 if(!app.audio)return;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  const ctx=new Context(),now=ctx.currentTime;
  for(let i=0;i<2;i++){
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(i?410:540,now+i*.19);
    osc.frequency.exponentialRampToValueAtTime(i?340:440,now+i*.19+.12);
    gain.gain.setValueAtTime(.0001,now+i*.19);
    gain.gain.exponentialRampToValueAtTime(.08,now+i*.19+.02);
    gain.gain.exponentialRampToValueAtTime(.0001,now+i*.19+.18);
    osc.connect(gain).connect(ctx.destination);osc.start(now+i*.19);osc.stop(now+i*.19+.19);
  }
  setTimeout(()=>ctx.close().catch(()=>{}),1500);
 }catch{}
}
function screenBadge(status){
 const isWarn=status==='warning',review=status==='review';
 const cls=isWarn?'warn':review?'review':'unknown';
 const text=isWarn?'⚠ Elevated risk':review?'◇ Needs review':'◎ Unverified';
 return '<span class="risk-badge '+cls+'">'+text+'</span>';
}
function avatarSymbol(value){
 const str=String(value||'?');
 return str.replace(/[^a-z0-9]/gi,'').slice(0,1).toUpperCase()||'✦';
}
function currentItems(){return app.mode==='devnet'?app.devnet:app.mainnet}
function renderRadar(){
 const node=el('feedList');node.replaceChildren();
 const items=currentItems().slice(0,48);
 if(!items.length){
  const empty=document.createElement('div');empty.className='feed-empty';
  empty.textContent=app.mode==='devnet'
   ?'Watching devnet LaunchLab account changes. No new pool changes have been observed during this session. For existing devnet pools, paste a mint in Safety Lab.'
   :'No verified response from the new-pools source yet. There are no fictional example tokens here.';
  node.appendChild(empty);return;
 }
 for(const item of items){
  const row=document.createElement('button');
  row.type='button';row.className='token-row'+(app.selected?.mint===item.mint?' active':'');
  const av=document.createElement('span');av.className='token-avatar';av.textContent=avatarSymbol(item.symbol);
  const info=document.createElement('span');info.className='token-row-info';
  const name=document.createElement('strong');name.textContent=(item.name||'Unknown token').slice(0,70);
  const meta=document.createElement('small');
  const age=item.createdAt?Math.max(0,Math.round((Date.now()-Date.parse(item.createdAt))/60000)):null;
  meta.textContent=(item.symbol||'?')+' · '+sym(item.mint)+(age!==null?' · '+age+'m':'');
  info.append(name,meta);
  const stat=document.createElement('span');stat.className='token-values';
  const top=document.createElement('strong');
  top.textContent=item.network==='devnet'?(item.progress!==null?item.progress.toFixed(1)+'% curve':'Curve unknown'):formatMoney(item.liquidityUsd);
  const bottom=document.createElement('small');
  const risk=app.risks.get(item.network+'|'+item.mint);
  bottom.textContent=risk?.status==='warning'?'⚠ ELEVATED RISK':risk?.status==='review'?'◇ NEEDS REVIEW':'◎ UNVERIFIED';
  stat.append(top,bottom);
  row.append(av,info,stat);
  row.addEventListener('click',()=>selectToken(item));
  node.append(row);
 }
}
function scoreResponse(risk){
 return risk?.status==='warning'?'warning':risk?.status==='review'?'review':'unverified';
}
function renderDetail(item){
 const node=el('tokenDetail');
 const risk=app.risks.get(item.network+'|'+item.mint);
 const rows=[];
 if(item.network==='mainnet'){
   rows.push(['Liquidity',formatMoney(item.liquidityUsd)],['Market cap',formatMoney(item.marketCapUsd)],['FDV (not market cap)',formatMoney(item.fdvUsd)],['24h volume',formatMoney(item.volume24hUsd)],['Pool launched',item.createdAt?new Date(item.createdAt).toLocaleString():'Unknown']);
 }else{
   rows.push(['Bonding curve',item.progress!==null?item.progress.toFixed(2)+'% (funding approximation)':'Not available'],
    ['Curve quote raised',item.fundingAtomic||'Unknown atomic units'],['Target quote',item.targetAtomic||'Unknown atomic units'],
    ['Pool status code',item.status||'Unknown'],['Last observed slot',item.slot||'Unknown']);
 }
 if(risk)rows.push(['Mint authority',risk.mintAuthority?'ACTIVE':'Revoked or unknown'],['Freeze authority',risk.freezeAuthority?'ACTIVE':'Revoked or unknown']);
 const infoLines=risk?.signals?.length?risk.signals.map(s=>'<li>'+esc(s.message)+'</li>').join(''):'<li>Risk scan not completed. Do not assume this token is safe.</li>';
 const mintHref='https://solscan.io/token/'+encodeURIComponent(item.mint)+(item.network==='devnet'?'?cluster=devnet':'');
 const socials=app.metadata.get(item.mint);
 const socialLinks=socials ? [
  ...(socials.websites||[]).map((url,i)=>({url,label:i?'Website '+(i+1):'Website'})),
  ...(socials.x?[{url:socials.x,label:'X / Twitter'}]:[]),
  ...(socials.telegram?[{url:socials.telegram,label:'Telegram'}]:[])
 ].filter(x=>validUrl(x.url)):[];
 const socialHtml=item.network==='mainnet'
  ?'<h4 style="margin:20px 0 7px">Project links · unverified claims</h4>'+
    (socialLinks.length
      ?'<div class="social-chips">'+socialLinks.map(x=>'<a target="_blank" rel="noopener noreferrer" href="'+esc(x.url)+'">'+esc(x.label)+' ↗</a>').join('')+'</div>'
      :'<p>No project social links retrieved. Never take missing details as a green light.</p>')+
    (socials?.description?'<p>'+esc(socials.description)+'</p>':'')+
    (socials?.providerVerified?'<p><small>GeckoTerminal records this token’s info as provider-verified; this does not establish token safety or owner identity.</small></p>':'')
  :'';
 const disclaimer=item.network==='devnet'
  ?'Funding progress is an approximation from Raydium pool reserve values, not an exact quoted trade. Market cap is not computed for devnet.'
  :'This is a newly indexed liquidity pool, not necessarily a newly minted token. Missing or null market-cap data are not substituted with FDV.';
 node.innerHTML='<div class="card-eyebrow">LIVE TOKEN REPORT · '+esc(item.network.toUpperCase())+'</div>'+
  '<div class="token-header"><div class="token-avatar">'+esc(avatarSymbol(item.symbol))+'</div><div><h3>'+esc(item.name||'Unknown token')+'</h3><span class="detail-meta">'+esc(item.symbol||'?')+' · '+esc(sym(item.mint))+'</span></div></div>'+
  screenBadge(scoreResponse(risk))+
  '<div class="detail-stats">'+rows.map(([k,v])=>'<div><small>'+esc(k)+'</small><b>'+esc(v)+'</b></div>').join('')+'</div>'+
  '<div class="detail-meta">Mint: '+esc(item.mint)+'<br>Pool: '+esc(item.pool||'Not available')+'</div>'+
  '<h4 style="margin:18px 0 8px">Security signals</h4><ul class="detail-list">'+infoLines+'</ul>'+socialHtml+
  '<div class="detail-foot">'+esc(disclaimer)+'<br><a target="_blank" rel="noopener noreferrer" class="mini-link" href="'+mintHref+'">Inspect on Solscan ↗</a></div>';
}
async function selectToken(item){
 app.selected=item;renderRadar();renderDetail(item);
 const key=item.network+'|'+item.mint;
 if(!app.risks.has(key)){
  app.risks.set(key,{status:'unverified',signals:[{severity:'unknown',message:'Checking on-chain signals…'}]});
  renderDetail(item);
  await scanMint(item.mint,item.network);
 }
 if(item.network==='mainnet'&&!app.metadata.has(item.mint))fetchTokenSocials(item.mint);
}
async function fetchTokenSocials(mint){
 try{
  const response=await fetch('/api/info?mint='+encodeURIComponent(mint));
  if(!response.ok)throw Error('Unverified');
  const data=await response.json();
  app.metadata.set(mint,data.metadata||{});
 }catch{app.metadata.set(mint,{});}
 if(app.selected?.mint===mint)renderDetail(app.selected);
}
async function scanMint(mint,network,notifyNew=false){
 const key=network+'|'+mint;
 try{
  const result=await loadRisk(mint,network==='devnet'?'devnet':'mainnet');
  const prev=app.risks.get(key);
  app.risks.set(key,result);
  renderRadar();
  if(app.selected?.mint===mint&&app.selected?.network===network)renderDetail(app.selected);
  if(notifyNew && result.status==='warning'&&prev?.status!=='warning')soundWarning();
  return result;
 }catch{
  const result={status:'unverified',signals:[{severity:'unknown',message:'On-chain risk API unavailable. No safety conclusions can be drawn.'}]};
  app.risks.set(key,result);renderRadar();
  if(app.selected?.mint===mint&&app.selected?.network===network)renderDetail(app.selected);
  return result;
 }
}
let refreshing=false;
async function refreshPools(){
 if(refreshing)return;refreshing=true;
 el('liveStatus').textContent='Loading latest Solana mainnet pools…';
 try{
  const data=await loadMainnetPools();
  const list=data.pools.map(x=>({...x,network:'mainnet'}));
  const newKeys=list.filter(x=>!app.seen.has(x.mint)).map(x=>x.mint);
  const first=!app.loaded;
  app.mainnet=list;app.loaded=true;
  for(const item of list)app.seen.add(item.mint);
  el('liveStatus').textContent='Mainnet pools · indexed source with ~60s cache · not all minted tokens';
  el('feedTime').textContent='Checked '+new Date(data.checkedAt).toLocaleTimeString();
  if(app.mode==='mainnet')renderRadar();
  const candidates=first?list.slice(0,5):list.filter(x=>newKeys.includes(x.mint)).slice(0,5);
  await Promise.all(candidates.map(x=>scanMint(x.mint,'mainnet',!first)));
 }catch(error){
  el('liveStatus').textContent='New-pool feed currently unavailable: '+(error?.message||'Provider error');
  if(app.mode==='mainnet')renderRadar();
 }finally{refreshing=false}
}
function initDevnet(){
 app.sub=observeDevnetLaunches(async item=>{
  app.devnet=[item,...app.devnet.filter(x=>x.pool!==item.pool)].slice(0,48);
  if(app.mode==='devnet')renderRadar();
  await scanMint(item.mint,'devnet',true);
 },text=>{
  if(app.mode==='devnet')el('liveStatus').textContent=text;
 });
}
el('mainnetTab').addEventListener('click',()=>{
 app.mode='mainnet';el('mainnetTab').classList.add('active');el('devnetTab').classList.remove('active');
 el('liveStatus').textContent='Mainnet newly indexed pools · roughly 60s source cache';renderRadar();
});
el('devnetTab').addEventListener('click',()=>{
 app.mode='devnet';el('devnetTab').classList.add('active');el('mainnetTab').classList.remove('active');
 el('liveStatus').textContent='Streaming Raydium LaunchLab devnet pool changes when RPC permits';renderRadar();
});
el('refreshPools').addEventListener('click',refreshPools);
async function refreshNews(){
 const node=el('newsGrid');
 try{
  const articles=await loadNews();
  node.replaceChildren();
  if(!articles.length){
   const e=document.createElement('div');e.className='feed-empty';e.textContent='No matching recent headlines were available from the news index.';node.append(e);return;
  }
  for(const a of articles.slice(0,12)){
   const href=validUrl(a.url);if(!href)continue;
   const card=document.createElement('a');card.className='news-card';card.href=href;card.target='_blank';card.rel='noopener noreferrer';
   const tag=document.createElement('span');tag.className='news-tag';tag.textContent=String(a.category||'Industry').toUpperCase()+' · GLOBAL';
   const heading=document.createElement('h3');heading.textContent=a.title;
   const foot=document.createElement('small');foot.textContent=a.domain+' · '+new Date(a.publishedAt).toLocaleString();
   card.append(tag,heading,foot);node.append(card);
  }
 }catch(error){
  node.innerHTML='<div class="feed-empty">News source unavailable. Momentum never substitutes made-up headlines for real reporting.</div>';
 }
}
el('refreshNews').addEventListener('click',refreshNews);

let imageFile=null;
el('tokenImage').addEventListener('change',()=>{
 const file=el('tokenImage').files?.[0];if(!file)return;
 if(file.size>1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){
  el('tokenImage').value='';toast('Upload PNG, JPEG or WebP under 1 MB.');return;
 }
 imageFile=file;
 if(app.avatarURL)URL.revokeObjectURL(app.avatarURL);
 app.avatarURL=URL.createObjectURL(file);
 el('imagePreview').style.backgroundImage='url("'+app.avatarURL+'")';
 el('imagePreview').textContent='';
 el('previewCoinIcon').style.backgroundImage='url("'+app.avatarURL+'")';
 el('previewCoinIcon').textContent='';
});
for(const id of ['tokenName','tokenTicker','tokenDescription']){
 el(id).addEventListener('input',()=>{
  el('previewName').textContent=el('tokenName').value||'Your token name';
  el('previewTicker').textContent='$'+(el('tokenTicker').value||'TICKER').toUpperCase();
  el('previewDescription').textContent=el('tokenDescription').value||'Your story starts here.';
 });
}
function readSocial(){
 const fields=[
  ['Website','tokenWebsite',null],
  ['X','tokenX',['x.com','twitter.com']],
  ['Telegram','tokenTelegram',['t.me','telegram.me']]
 ];
 const result={};
 for(const [name,id,hosts] of fields){
  const value=el(id).value.trim();
  if(!value)continue;
  const u=validUrl(value,hosts);
  if(!u)throw Error(name+' needs a valid public HTTPS link.'+(hosts?' Accepted: '+hosts.join(', '):''));
  result[id]=u;
 }
 return result;
}
function readCreate(){
 const raw={name:el('tokenName').value,symbol:el('tokenTicker').value,quote:el('launchQuote').value,
  metadataUrl:el('metadataUrl').value.trim(),configId:el('configId').value.trim()};
 const validation=validateLaunch({...raw,metadataUrl:raw.metadataUrl||'https://example.com/temporary.json'});
 const errors=validation.errors.filter(x=>!x.includes('metadata'));
 if(errors.length)throw Error(errors.join(' '));
 const socials=readSocial();
 return {...raw,name:validation.name,symbol:validation.symbol,description:el('tokenDescription').value.trim(),socials};
}
function checkedFeeNote(text){el('feeStatus').textContent=text}
function canOperator(){
 const expected=import.meta.env.VITE_MOMENTUM_OPERATOR_WALLET||'';
 return !!expected && connectedAddress()===expected;
}
async function inspectFee(){
 try{
  const state=await getMomentumPlatform();
  if(state.ok){
   checkedFeeNote('Verified on Solana devnet\nPlatform: '+state.platformId+'\nClaim wallet: '+state.claimWallet+'\nTrading fee: 2.00% (Raydium LaunchLab curve only)\nFee claim proof: verified account read');
  }else checkedFeeNote(state.message||'No verified operator config. Momentum does not collect a 2% fee here.');
 }catch{checkedFeeNote('Platform verification unavailable; no Momentum fee is asserted.')}
 busy(app.busy);
}
el('walletBtn').addEventListener('click',async()=>{
 if(app.busy)return;busy(true);
 try{
  if(connectedAddress()){
   await disconnect();el('walletBtn').innerHTML='Connect wallet <span>↗</span>';
   el('profileAddress').textContent='Wallet disconnected';
   el('receiveAddress').textContent='Connect a wallet to display a public address.';
   el('walletBalance').textContent='No wallet connected.';
   toast('Wallet disconnected.');
  }else{
   const address=await connect();
   el('walletBtn').textContent=sym(address)+' · Disconnect';
   el('profileAddress').textContent=address;
   loadProfile(address);
   refreshDevnetBalance(address);
   toast('Wallet connected. No funds transferred.');
  }
  await inspectFee();
 }catch(error){fail(error)}finally{busy(false)}
});
function checkPreviewConfig(config){
 hint('configPreview',[
  'Verified official Raydium devnet program: '+config.programId,
  'Configuration: '+config.configId,'Quote mint: '+config.quoteMint,
  'Quote decimals: '+config.decimals,config.platformNote
 ]);
}
async function checkedConfig(quote,configId){
 const config=await verifyConfig(quote,configId);
 checkPreviewConfig(config);return config;
}
el('verifyConfigBtn').addEventListener('click',async()=>{
 if(app.busy)return;busy(true);
 try{await checkedConfig(el('launchQuote').value,el('configId').value.trim());toast('Raydium configuration decoded successfully.');}
 catch(error){fail(error)}finally{busy(false)}
});
el('launchQuote').addEventListener('change',()=>{
 hint('configPreview','Quote changed. Verify the new Raydium configuration before creating a token.');
});
async function prepareMetadata(values){
 if(values.metadataUrl){
  if(!validUrl(values.metadataUrl))throw Error('Advanced metadata must be a public HTTPS JSON URL.');
  return values.metadataUrl;
 }
 if(!imageFile)throw Error('Choose a token image or paste your previously published metadata JSON URL under Advanced.');
 if(!app.uploadReady)throw Error('Automatic metadata publishing is not configured yet. Expand Advanced and enter a published metadata JSON URL. Nothing was charged.');
 const token=window.turnstile?.getResponse?.(app.turnstileId);
 if(!token)throw Error('Complete the anti-bot check before publishing token metadata.');
 const base64=await new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(Error('Cannot read token image'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(imageFile);
 });
 const response=await fetch('/api/metadata',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
  name:values.name,symbol:values.symbol,description:values.description,socials:values.socials,
  imageBase64:base64,imageType:imageFile.type,turnstileToken:token
 })});
 const payload=await response.json().catch(()=>({}));
 window.turnstile?.reset?.(app.turnstileId);
 if(!response.ok||!payload.metadataUrl)throw Error(payload.error||'Metadata publisher unavailable.');
 return payload.metadataUrl;
}
async function configureMetadataPublisher(){
 try{
  const r=await fetch('/api/config');if(!r.ok)return;
  const c=await r.json();
  if(!c.metadataUploadReady||!c.turnstileSiteKey)return;
  app.uploadReady=true;app.sitekey=c.turnstileSiteKey;
  const host=document.createElement('div');host.id='launchCaptcha';
  el('createBtn').parentElement.before(host);
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;script.defer=true;
  script.onload=()=>{if(window.turnstile)app.turnstileId=window.turnstile.render(host,{sitekey:app.sitekey,theme:'dark'})};
  document.head.appendChild(script);
  toast('Protected image publishing is available.');
 }catch{}
}
el('createForm').addEventListener('submit',async event=>{
 event.preventDefault();if(app.busy)return;busy(true);
 try{
  const values=readCreate();
  if(!connectedAddress())throw Error('Connect a Solana devnet wallet before launching.');
  message('Preparing your token and checking on-chain configuration…');
  await checkedConfig(values.quote,values.configId);
  values.metadataUrl=await prepareMetadata(values);
  const platform=await getMomentumPlatform();
  if(!platform.ok)toast('2% Momentum platform fee has NOT been enabled; launch uses default Raydium config.');
  const created=await createToken(values);
  const url='https://explorer.solana.com/address/'+encodeURIComponent(created.mint)+'?cluster=devnet';
  const anchor=document.createElement('a');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
  anchor.textContent='View your token on Solana devnet ↗';
  const preview=el('configPreview');preview.textContent='Devnet launch submitted: '+created.mint+'\nPool: '+(created.pool||'Verify directly on-chain');
  preview.append(document.createElement('br'),anchor);
  el('tradeMint').value=created.mint;
  el('tradeQuote').value=values.quote;
  message('Devnet launch request completed. Verify the transaction and mint on-chain.','ok');
 }catch(error){fail(error)}
 finally{busy(false)}
});

async function checkedPool(){
 const mint=el('tradeMint').value.trim();
 if(!isPublicKey(mint))throw Error('Enter a valid Solana mint.');
 if(!connectedAddress())throw Error('Connect your wallet first.');
 const pool=await inspectPool(mint,el('tradeQuote').value);
 hint('poolPreview',['Raydium devnet pool: '+pool.pool.toBase58(),'Token precision: '+pool.decimals,
   'Pool status: '+pool.status,'Platform: '+pool.platform,
   'Momentum platform fee verified: '+(pool.momentumFeeVerified?'YES: 2%':'NO / unverified'),
   'Never assume a safe liquidity lock without independent migration verification.']);
 return pool;
}
el('inspectBtn').addEventListener('click',async()=>{
 if(app.busy)return;busy(true);
 try{await checkedPool();toast('On-chain pool data inspected.');}catch(error){fail(error)}
 finally{busy(false)}
});
function updateAmountHint(){
 el('amountHint').textContent=el('tradeSide').value==='buy'
  ?'Spend '+el('tradeQuote').value+' on devnet. Verify minimum received and fees in your wallet.'
  :'Specify token amount. Mint precision will be read on-chain.';
}
el('tradeSide').addEventListener('change',updateAmountHint);
el('tradeQuote').addEventListener('change',updateAmountHint);
el('tradeForm').addEventListener('submit',async e=>{
 e.preventDefault();if(app.busy)return;busy(true);
 try{
  const quote=el('tradeQuote').value,side=el('tradeSide').value,amount=el('tradeAmount').value.trim();
  const mintAddress=el('tradeMint').value.trim();
  const pool=await checkedPool();
  const units=toAtomic(amount,side==='buy'?QUOTES[quote].decimals:pool.decimals);
  if(!confirm('Approve a '+side+' with '+amount+' '+(side==='buy'?quote:'tokens')+' ('+units+' atomic units) on Solana DEVNET? Review the actual wallet transaction details before signing.'))return;
  const response=await tradeToken({mintAddress,quote,side,amount});
  toast('Devnet '+side+' request sent. Pool: '+sym(response.pool));
 }catch(error){fail(error)}
 finally{busy(false)}
});
el('scanForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const mint=el('scanMint').value.trim(),network=el('scanNetwork').value;
 if(!isPublicKey(mint)){toast('Enter a valid Solana mint address.');return}
 hint('scanResults','Checking authorities and concentration on '+network+'…');
 const result=await scanMint(mint,network);
 hint('scanResults',
  [result.status==='warning'?'⚠ ELEVATED RISK':result.status==='review'?'◇ NEEDS REVIEW':'◎ UNVERIFIED',
   'Mint: '+mint,...(result.signals||[]).map(x=>'• '+x.message),
   'Data may be delayed. Never use this scan as a guarantee of safety.']);
});
el('soundToggle').addEventListener('change',event=>{
 app.audio=!!event.target.checked;
 try{localStorage.setItem('momentum-warnings-enabled',String(app.audio))}catch{}
 if(app.audio){soundWarning();toast('Risk alert sounds enabled (sound tested).')}else toast('Warning sounds muted; visual labels remain.');
});
async function refreshDevnetBalance(address){
 el('receiveAddress').textContent=address;
 el('walletBalance').textContent='Checking public Solana devnet balance…';
 try{
  const lamports=await connection.getBalance(new PublicKey(address),'confirmed');
  if(connectedAddress()===address)
   el('walletBalance').textContent='Devnet SOL: '+(lamports/1000000000).toFixed(5)+' (test-network balance)';
 }catch{
  if(connectedAddress()===address)el('walletBalance').textContent='Balance unavailable; address still belongs to the connected wallet.';
 }
}
el('copyWalletAddress').addEventListener('click',async()=>{
 const address=connectedAddress();if(!address){toast('Connect your wallet first.');return}
 try{await navigator.clipboard.writeText(address);toast('Public address copied. Always confirm the sending network.')}
 catch{toast('Copy failed; select your wallet address manually.')}
});
function readProfile(address){
 try{
  const raw=localStorage.getItem('momentum-profile-'+address);
  const data=raw?JSON.parse(raw):null;
  return data&&typeof data.name==='string'?data:null;
 }catch{return null}
}
function loadProfile(address){
 const profile=readProfile(address);
 const name=profile?.name||'Explorer #'+address.slice(-4);
 el('profileName').textContent=name;
 el('profileDisplayName').value=profile?.name||'';
 el('profileAvatar').textContent=address.slice(0,1).toUpperCase();
 const n=address.charCodeAt(0)%360;
 el('profileAvatar').style.background='linear-gradient(130deg,hsl('+n+' 90% 80%),hsl('+((n+70)%360)+' 76% 70%))';
 el('profileAddress').textContent=address;
}
el('saveProfile').addEventListener('click',()=>{
 const address=connectedAddress();
 if(!address){toast('Connect wallet to save your local profile.');return}
 const name=el('profileDisplayName').value.trim();
 if(!/^[\p{L}\p{N} _.-]{2,24}$/u.test(name)){toast('Choose 2–24 letters, numbers, spaces, _ . or -');return}
 try{
  localStorage.setItem('momentum-profile-'+address,JSON.stringify({name,updatedAt:Date.now()}));
  loadProfile(address);toast('Profile saved on this browser only. It is not a public on-chain identity.');
 }catch{toast('Local browser storage not available.')}
});
el('signProfile').addEventListener('click',async()=>{
 const address=connectedAddress();
 if(!address){toast('Connect your wallet first.');return}
 try{
  const proof=await proveWalletControl();
  if(proof.verified)toast('✓ Wallet control proven locally. Public account verification needs a secured backend.');
 }catch(error){fail(error)}
});
el('createPlatformBtn').addEventListener('click',async()=>{
 if(!canOperator()){toast('Only the configured Momentum operator wallet may create the fee config.');return}
 const cpmmId=el('cpmmConfig').value.trim();
 if(!isPublicKey(cpmmId)){toast('Enter a valid devnet CPMM config public key.');return}
 if(!confirm('Create a Raydium LaunchLab devnet PlatformConfig with a 2% per-trade platform fee, paid to this connected operator wallet, and 100% LP burn scale? Review fees and addresses in your wallet.'))return;
 busy(true);
 try{
  const result=await createMomentumPlatform(cpmmId);
  toast('Devnet platform configuration submitted: '+sym(result.platformId));
  await inspectFee();
 }catch(error){fail(error)}
 finally{busy(false)}
});

// NOVA onboarding assistant — speech only follows an explicit user button click.
const steps=[
 {anchor:'#top',text:"Welcome to Momentum! I'm Nova, your guide. Discover fresh pools, learn about their risks, then launch your own idea on Solana devnet."},
 {anchor:'#discover',text:"Here are live feeds. Mainnet pools use a public market index; devnet LaunchLab activity uses a Solana account stream when available."},
 {anchor:'#signals',text:"This is our safety lab. Warning labels mean risk signals were found. Unverified does not mean safe. Switch on sound if you'd like alerts."},
 {anchor:'#launch',text:"Launching starts with your token's name, ticker, image and story. Add social links so people can investigate your project."},
 {anchor:'#trade',text:"When you're ready, try a wallet-signed trade using test-network funds. Real-money trading isn't enabled yet."},
 {anchor:'#profile',text:"Your wallet is your key. Make a personal profile, but never share a recovery phrase or approve an unfamiliar transaction."}
];
function showTour(index){
 $all('.tour-target').forEach(node=>node.classList.remove('tour-target'));
 app.tourIndex=Math.min(index,steps.length-1);
 const step=steps[app.tourIndex];el('mentorBubble').hidden=false;el('mentorText').textContent=step.text;
 el('mentorNext').textContent=app.tourIndex===steps.length-1?'Finish ✓':'Next →';
 const node=document.querySelector(step.anchor);
 if(node&&app.tourIndex>0){node.classList.add('tour-target');node.scrollIntoView({behavior:'smooth',block:'start'});}
}
function speak(){
 if(!('speechSynthesis'in window)){toast('Audio guidance is not supported by this browser.');return}
 const text=el('mentorText').textContent;
 speechSynthesis.cancel();
 const utterance=new SpeechSynthesisUtterance(text);
 utterance.rate=.95;utterance.pitch=1.06;utterance.volume=.9;
 speechSynthesis.speak(utterance);
}
el('mentorOrb').addEventListener('click',()=>{if(el('mentorBubble').hidden)showTour(0);else el('mentorBubble').hidden=true});
el('startTour').addEventListener('click',()=>showTour(0));
el('mentorNext').addEventListener('click',()=>{
 if(app.tourIndex>=steps.length-1){el('mentorBubble').hidden=true;$all('.tour-target').forEach(x=>x.classList.remove('tour-target'));return}
 showTour(app.tourIndex+1);
});
el('mentorSpeak').addEventListener('click',speak);
el('mentorClose').addEventListener('click',()=>{
 el('mentorBubble').hidden=true;$all('.tour-target').forEach(x=>x.classList.remove('tour-target'));
 if('speechSynthesis'in window)speechSynthesis.cancel();
});
window.addEventListener('pagehide',()=>{
 if(app.sub)app.sub();
 if(app.avatarURL)URL.revokeObjectURL(app.avatarURL);
});
try{app.audio=localStorage.getItem('momentum-warnings-enabled')==='true';el('soundToggle').checked=app.audio;}catch{}
initDevnet();
refreshPools();
refreshNews();
configureMetadataPublisher();
inspectFee();
setInterval(refreshPools,45000);
setInterval(refreshNews,5*60000);
