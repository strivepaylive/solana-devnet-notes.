import {availableWallets,connectWallet,onWalletChange} from './wallets.js';
const $ = id=>document.getElementById(id);
const state={tokens:[],global:[],boosts:[],wallet:null,view:'discover',offline:false,search:'',turnstile:{boost:null,report:null},captchaIds:{boost:null,report:null},captchaReady:false};
const short=s=>typeof s==='string'?s.slice(0,5)+'…'+s.slice(-4):'—';
const money=x=>!Number.isFinite(Number(x))?'—':Number(x)>=1e6?'$'+(Number(x)/1e6).toFixed(2)+'m':Number(x)>=1000?'$'+(Number(x)/1000).toFixed(1)+'k':'$'+Number(x).toLocaleString('en-US',{maximumFractionDigits:4});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const address=s=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
const $api=async(path,options={})=>{const r=await fetch('/api'+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});let data;try{data=await r.json()}catch{throw Error('Service unavailable — deploy the Cloudflare Worker first')}if(!r.ok)throw Error(data.error||'Request failed');return data;};
let toastTimeout;function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),5000)}
function itemRow(t){return `<tr><td><div class="asset-cell"><span class="token-avatar">${escape((t.symbol||'?').slice(0,1).toUpperCase())}</span><div><b>${escape(t.name||'Unknown')}</b><small>${escape(t.symbol)} · ${escape(short(t.mint))}</small></div></div></td><td>${money(t.price)}</td><td class="value-muted">${money(t.volume24h)}</td><td class="value-muted">${money(t.liquidityUsd)}</td><td><span class="activity-pill">↗ ${escape(t.activity?.score??0)}/100</span></td><td><span class="status status-neutral">Identity unverified</span></td><td><button class="scan-action" data-mint="${escape(t.mint)}">Scan ↗</button></td></tr>`;}
function renderFeed(){let items=state.tokens;const q=state.search.toLowerCase();if(q)items=items.filter(t=>[t.name,t.symbol,t.mint].some(x=>String(x||'').toLowerCase().includes(q)));$('tokenRows').innerHTML=items.length?items.map(itemRow).join(''):`<tr><td colspan="7" class="empty">${state.offline?'Live feed is temporarily unavailable. Please refresh.':'No matching assets in the latest feed. Try another search or refresh.'}</td></tr>`;$('resultCount').textContent=`${items.length} tokens in current feed · activity is not verified organic traction`;}
function safeExternal(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='dexscreener.com'?u.href:null}catch{return null}}
function renderGlobal(){const q=state.search.toLowerCase();const list=state.global.filter(t=>[t.name,t.symbol,t.mint,t.chain].some(v=>String(v||'').toLowerCase().includes(q)));
  $('globalRows').innerHTML=list.length?list.map(t=>`<tr><td><div class="asset-cell"><span class="token-avatar">${escape((t.symbol||'?')[0])}</span><div><b>${escape(t.name)}</b><small>${escape(t.symbol)} · ${escape(short(t.mint))}</small></div></div></td><td><span class="status status-neutral">${escape(t.chain)}</span></td><td>${money(t.volume24h)}</td><td>${money(t.liquidityUsd)}</td><td><span class="activity-pill">${escape(t.activity?.score||0)}/100</span></td><td>${safeExternal(t.dexUrl)?`<a class="scan-action" href="${escape(safeExternal(t.dexUrl))}" rel="noopener noreferrer" target="_blank">Chart ↗</a>`:'—'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No current profiles matched. Global watch samples only the latest public profiles.</td></tr>';
}
async function loadGlobal(){try{const data=await $api('/global');state.global=data.tokens||[];renderGlobal()}catch(e){$('globalRows').innerHTML=`<tr><td colspan="6" class="empty">${escape(e.message)}</td></tr>`}}
function renderBoosts(){let items=state.boosts;const q=state.search.toLowerCase();if(q)items=items.filter(t=>[t.name,t.symbol,t.mint].some(x=>String(x||'').toLowerCase().includes(q)));$('boostRows').innerHTML=items.length?items.map(t=>`<tr><td><div class="asset-cell"><span class="token-avatar">${escape((t.symbol||'?')[0])}</span><div><b>${escape(t.name||'Unknown')}</b><small>${escape(t.symbol||'')}</small></div></div></td><td class="value-muted">${escape(short(t.mint))}</td><td><span class="status status-good">Promoted, NOT verified</span></td><td>${new Date(t.expires_at*1000).toLocaleDateString()}</td><td><button class="scan-action" data-mint="${escape(t.mint)}">Scan ↗</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No active launch promotions. Create the first eligible boost.</td></tr>';}
async function loadFeed(force=false){$('feedStatus').textContent='Loading market data…';$('refreshBtn').disabled=true;try{const data=await $api('/feed'+(force?'?refresh='+Math.floor(Date.now()/90000):''));state.tokens=data.tokens||[];
    if(state.feedSeen){
      const high=state.tokens.find(t=>Number(t.activity?.score)>=85 && !state.feedSeen.has(t.mint));
      if(high)addNotification('trend','High market activity',`${high.symbol||short(high.mint)} appeared in Momentum’s latest public feed with activity score ${high.activity.score}/100. This does not establish organic traction.`,{id:'trend-'+high.mint});
    }
    state.feedSeen=new Set(state.tokens.map(t=>t.mint));state.offline=false;$('feedStatus').textContent=`Live feed · ${new Date(data.observedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;renderFeed();}catch(e){state.offline=true;$('feedStatus').textContent='Live service unavailable';renderFeed();toast(e.message)}finally{$('refreshBtn').disabled=false;}}
async function loadBoosts(){try{const data=await $api('/boosts');state.boosts=data.boosts||[];}catch{state.boosts=[]}renderBoosts();}
function setView(view){state.view=view;for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===view);$('radarView').hidden=view!=='discover';$('globalView').hidden=view!=='global';$('boostsView').hidden=view!=='boosts';$('scanView').hidden=view!=='scan';$('searchInput').disabled=view==='scan';if(view==='boosts')loadBoosts();if(view==='global')loadGlobal();}
async function scan(mint){if(!address(mint)){toast('Please enter a valid base58 Solana mint address.');return}setView('scan');$('scanMint').value=mint;$('scanResult').innerHTML='<div class="scan-card">Inspecting on-chain and market data…</div>';$('newsResult').innerHTML='';try{const data=await $api('/scan?mint='+encodeURIComponent(mint));const id=data.identity||{},boost=data.boostEligibility||{},mi=data.mintInfo||{};
if(id.status==='blocked'||id.status==='review')addNotification('warning',id.status==='blocked'?'Potential token impersonation':'Token identity review',`${data.symbol||short(mint)} · ${id.reason||'Identity check needs review'}`,{id:'identity-'+mint});
if(data.lineage?.history?.status==='review')addNotification('warning','Repeat-launch pattern detected',`An observed transaction payer has a matching previous launch for ${data.symbol||short(mint)}. This is not proof of developer identity or fraud.`,{id:'lineage-'+mint});const badge= id.status==='blocked'?'status-bad':id.status==='review'?'status-review':'status-neutral';const phrase=id.status==='blocked'?'Protected-brand clone':id.status==='review'?'Identity needs review':'Identity not verified';$('scanResult').innerHTML=`<div class="scan-card"><div class="scan-header"><div><h3>${escape(data.name||'Unknown / new mint')} <span style="color:#8ed6b0">${escape(data.symbol||'')}</span></h3><small style="color:#8aa39b">${escape(short(mint))} · Solana</small></div><span class="status ${badge}">${phrase}</span></div><p>${escape(id.reason||'No identity evidence')}</p><div class="scan-grid"><div class="scan-stat"><small>Liquidity observed</small><b>${money(data.liquidityUsd)}</b></div><div class="scan-stat"><small>Mint authority</small><b>${mi.known?(mi.mintAuthority===null?'Revoked':'Active'):'Unknown'}</b></div><div class="scan-stat"><small>Freeze authority</small><b>${mi.known?(mi.freezeAuthority===null?'Revoked':'Active'):'Unknown'}</b></div><div class="scan-stat"><small>Launch boost</small><b>${escape(boost.status||'Review')}</b></div><div class="scan-stat"><small>Activity proxy</small><b>${escape(data.activity?.score||0)} / 100</b></div><div class="scan-stat"><small>Security data</small><b>${data.security?.available?'GoPlus signal present':'Unavailable'}</b></div></div><p style="color:#a6b9b0;font-size:12px">${escape(boost.reason||'')} — Neither market activity nor promotion proves safety, real-world identity or locked liquidity.</p><div class="scan-footer"><button id="reportThis" data-mint="${escape(mint)}">Report impersonation ↗</button>${safeExternal(data.dexUrl)?`<a href="${escape(safeExternal(data.dexUrl))}" rel="noopener noreferrer" target="_blank" style="color:#9df8cf">DEX source ↗</a>`:''}<button id="copyMint" data-mint="${escape(mint)}">Copy mint ↗</button></div></div>`;
if(data.name?.length>=4){$('newsResult').innerHTML='<p class="news-subtle">Checking 24-hour news keyword mentions…</p>';try{const news=await $api('/news?query='+encodeURIComponent(data.name));$('newsResult').innerHTML=`<div class="news-panel"><h3>News watch <span class="status status-neutral">Keyword only</span></h3><p>Articles may concern unrelated projects with the same name. Never use news mentions as identity proof.</p>${news.articles?.length?news.articles.map(a=>`<a href="${escape(a.url)}" target="_blank" rel="noopener noreferrer">${escape(a.title)} <span>↗ ${escape(a.domain)}</span></a>`).join(''):'<div class="news-subtle">No reliable keyword results returned in the last 24 hours.</div>'}</div>`;}catch{$('newsResult').innerHTML='';}}
}catch(e){$('scanResult').innerHTML=`<div class="scan-card"><p>${escape(e.message)}</p></div>`}}
let pendingWalletConnection=null;
function walletUpdate(){
  $('connectBtn').textContent=state.wallet?`${short(state.wallet.address)} ▾`:'Connect wallet ↗';
  $('boostWallet').textContent=state.wallet?`${state.wallet.name} · ${state.wallet.address}`:'No wallet connected';
  const pane=$('connectedWalletDetails');
  if(state.wallet){pane.hidden=false;pane.innerHTML=`<strong>${escape(state.wallet.name)} connected</strong><p>${escape(state.wallet.address)}</p><button id="walletDisconnect" type="button">Disconnect wallet</button>`;}
  else {pane.hidden=true;pane.replaceChildren();}
}
function showWalletChooser(){
  const entries=availableWallets();
  $('walletChoices').innerHTML=entries.length?entries.map((w,i)=>`<button class="wallet-option" data-wallet-index="${i}" type="button"><span class="wallet-avatar">${escape(w.name[0])}</span><span><b>${escape(w.name)}</b><small>Detected · Solana message signing</small></span><span class="wallet-option-arrow">↗</span></button>`).join(''):'<div class="notification-empty">No compatible wallet was detected in this browser. Install Phantom, Solflare, Backpack or another Wallet Standard wallet, then reload. On iPhone, open Momentum in your wallet app’s in-app browser if needed.</div>';
  $('walletHint').textContent='Choose a detected wallet. Wallet approvals happen inside your wallet app.';
  if(!$('walletDialog').open)$('walletDialog').showModal();
}
function getWallet(){
  if(state.wallet)return Promise.resolve(state.wallet);
  showWalletChooser();
  if(!pendingWalletConnection)pendingWalletConnection=new Promise((resolve,reject)=>{state.walletResolve=resolve;state.walletReject=reject;});
  return pendingWalletConnection;
}
async function selectWallet(index){
  const entry=availableWallets()[index];if(!entry)return;
  $('walletHint').textContent=`Connecting to ${entry.name}…`;
  try{
    const connected=await connectWallet(entry);
    if(state.wallet?.cleanup)state.wallet.cleanup();
    state.wallet=connected;walletUpdate();$('walletDialog').close();
    state.walletResolve?.(connected);pendingWalletConnection=null;state.walletResolve=null;state.walletReject=null;
    toast(`${entry.name} connected. No funds requested.`);
    addNotification('wallet', 'Wallet connected', `${entry.name} connected as ${short(connected.address)}. Wallet signatures still require separate approval.`,{sound:false});
  }catch(err){$('walletHint').textContent=err?.message||'Connection cancelled';toast('Wallet connection unsuccessful: '+$('walletHint').textContent);}
}
async function disconnectWallet(){
  try{await state.wallet?.disconnect?.()}catch{}state.wallet?.cleanup?.();state.wallet=null;walletUpdate();$('walletDialog').close();
  if(state.walletReject){state.walletReject(Error('Wallet connection cancelled'));pendingWalletConnection=null;state.walletReject=null;state.walletResolve=null;}
  addNotification('wallet','Wallet disconnected','You can reconnect any supported wallet.',{sound:false});
}

async function signedPost(intent,mint,other={}){const captcha=state.turnstile[intent];if(!captcha)throw Error('Complete the human verification before submitting.');const wallet=state.wallet||await getWallet();let claim;try{claim=await $api('/auth/challenge',{method:'POST',body:JSON.stringify({wallet:wallet.address,mint,intent,turnstileToken:captcha})});}finally{state.turnstile[intent]=null;if(window.turnstile&&state.captchaIds[intent]!=null)window.turnstile.reset(state.captchaIds[intent]);}const bytes=await wallet.signMessage(new TextEncoder().encode(claim.message));let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);const signature=btoa(binary);return await $api(intent==='boost'?'/boost':'/report',{method:'POST',body:JSON.stringify({wallet:wallet.address,mint,nonce:claim.nonce,signature,...other})});}
async function setupCaptcha(){
  try{
    const config=await $api('/config');
    if(!config.boostEnabled){
      $('boostSubmit').disabled=true;
      $('boostCaptcha').textContent='Administrator must configure Cloudflare Turnstile before submissions can open.';
      $('reportCaptcha').textContent='Not configured';return;
    }
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
    script.onload=()=>{
      window.momentumRenderCaptcha=(intent)=>{
        if(state.captchaIds[intent]!==null)return;
        const target=intent==='boost'?'boostCaptcha':'reportCaptcha';
        $(target).textContent='';
        state.captchaIds[intent]=window.turnstile.render('#'+target,{sitekey:config.siteKey,theme:'dark',callback:(token)=>{state.turnstile[intent]=token;},'expired-callback':()=>{state.turnstile[intent]=null;},'error-callback':()=>{state.turnstile[intent]=null;}});
      };
      window.momentumRenderCaptcha('boost');
      state.captchaReady=true;
    };
    script.onerror=()=>{ $('boostCaptcha').textContent='CAPTCHA service unavailable. Please try again.';};
    document.head.appendChild(script);
  }catch(e){$('boostSubmit').disabled=true;$('boostCaptcha').textContent='CAPTCHA configuration unavailable: '+e.message;}
}
const NOTICE_KEY='momentum:notifications:v1';
const SOUND_KEY='momentum:sounds:v1';
let notices=[];let soundsEnabled=false;let audioContext=null;
try{const saved=JSON.parse(localStorage.getItem(NOTICE_KEY)||'[]');if(Array.isArray(saved))notices=saved.slice(0,70).filter(x=>x&&typeof x.title==='string');soundsEnabled=localStorage.getItem(SOUND_KEY)==='yes';}catch{}
function saveNotices(){try{localStorage.setItem(NOTICE_KEY,JSON.stringify(notices.slice(0,70)))}catch{}}
function playMomentumSound(){
  if(!soundsEnabled||document.hidden)return;
  try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioContext ||=new AC();if(audioContext.state==='suspended')return;
    const now=audioContext.currentTime;
    for(const [i,frequency] of [660,880].entries()){
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;
      oscillator.connect(gain);gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0.0001,now+i*.11);gain.gain.exponentialRampToValueAtTime(.045,now+.012+i*.11);gain.gain.exponentialRampToValueAtTime(.0001,now+.23+i*.11);
      oscillator.start(now+i*.11);oscillator.stop(now+.26+i*.11);
    }
  }catch{}
}
function renderNotices(){
  const unread=notices.filter(n=>!n.read).length;
  $('notificationCount').hidden=unread===0;$('notificationCount').textContent=unread>99?'99+':String(unread);
  $('notificationsSound').textContent=soundsEnabled?'♫ Sounds on':'♫ Sounds off';$('notificationsSound').setAttribute('aria-pressed',String(soundsEnabled));
  $('notificationList').innerHTML=notices.length?notices.slice(0,40).map(n=>`<div class="notification-entry ${n.read?'':'unread'}"><span class="notification-glyph ${n.type==='warning'?'warning':''}">${n.type==='warning'?'!':n.type==='boost'?'↗':n.type==='trend'?'⌁':n.type==='wallet'?'◇':'✓'}</span><div class="notification-entry-main"><strong>${escape(n.title)}</strong><p>${escape(n.message)}</p><time>${new Date(n.time).toLocaleString()}</time></div></div>`).join(''):'<div class="notification-empty">No alerts yet. Wallet connections, launch-boost decisions and scan warnings will appear here.</div>';
}
function addNotification(type,title,message,options={}){
  const id=options.id||crypto.randomUUID();
  if(notices.some(n=>n.id===id))return;
  notices.unshift({id,type,title,message,time:Date.now(),read:false});notices=notices.slice(0,70);saveNotices();renderNotices();
  if(options.sound!==false)playMomentumSound();
  if(document.hidden && typeof Notification!=='undefined' && Notification.permission==='granted'){
    try{new Notification(`Momentum · ${title}`,{body:message,tag:id,icon:'/icon.svg'});}catch{}
  }
}
$('notificationBell').addEventListener('click',()=>{const panel=$('notificationPanel');panel.hidden=!panel.hidden;$('notificationBell').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)renderNotices();});
$('closeNotifications').addEventListener('click',()=>{$('notificationPanel').hidden=true;$('notificationBell').setAttribute('aria-expanded','false')});
$('notificationsRead').addEventListener('click',()=>{notices.forEach(n=>n.read=true);saveNotices();renderNotices()});
$('notificationsSound').addEventListener('click',async()=>{soundsEnabled=!soundsEnabled;if(soundsEnabled){try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){audioContext||=new AC();await audioContext.resume();}}catch{}}try{localStorage.setItem(SOUND_KEY,soundsEnabled?'yes':'no')}catch{}renderNotices();if(soundsEnabled){playMomentumSound();toast('Momentum notification sounds enabled.')}else toast('Notification sounds disabled.')});
$('notificationsDesktop').addEventListener('click',async()=>{
  if(!('Notification' in window)){toast('System browser alerts are not supported in this browser. In-app alerts still work.');return;}
  if(Notification.permission==='granted'){toast('Browser alerts already enabled.');return;}
  const allowed=await Notification.requestPermission();
  toast(allowed==='granted'?'Browser alerts enabled while Momentum is open.':'Browser permission not granted. In-app alerts remain available.');
});
renderNotices();

$('year').textContent=new Date().getFullYear();
setupCaptcha();
for(const btn of document.querySelectorAll('[data-view]'))btn.addEventListener('click',()=>setView(btn.dataset.view));
$('refreshBtn').addEventListener('click',()=>loadFeed(true));
$('searchInput').addEventListener('input',e=>{state.search=e.target.value.trim();if(state.view==='boosts')renderBoosts();else if(state.view==='global')renderGlobal();else renderFeed()});
$('tokenRows').addEventListener('click',e=>{const btn=e.target.closest('[data-mint]');if(btn)scan(btn.dataset.mint)});
$('boostRows').addEventListener('click',e=>{const btn=e.target.closest('[data-mint]');if(btn)scan(btn.dataset.mint)});
$('scanForm').addEventListener('submit',e=>{e.preventDefault();scan($('scanMint').value.trim())});
$('scanResult').addEventListener('click',e=>{if(e.target.id==='reportThis'){ $('reportMint').value=e.target.dataset.mint;$('reportDialog').showModal();if(window.momentumRenderCaptcha)window.momentumRenderCaptcha('report')}if(e.target.id==='copyMint')navigator.clipboard.writeText(e.target.dataset.mint).then(()=>toast('Mint copied'))});
$('connectBtn').addEventListener('click',()=>showWalletChooser());
$('closeWalletDialog').addEventListener('click',()=>$('walletDialog').close());
$('walletDialog').addEventListener('close',()=>{if(state.walletReject){state.walletReject(Error('Wallet selection cancelled'));pendingWalletConnection=null;state.walletResolve=null;state.walletReject=null;}});
$('walletChoices').addEventListener('click',e=>{const button=e.target.closest('[data-wallet-index]');if(button)selectWallet(Number(button.dataset.walletIndex));});
$('connectedWalletDetails').addEventListener('click',e=>{if(e.target.id==='walletDisconnect')disconnectWallet()});
onWalletChange(()=>{if($('walletDialog').open)showWalletChooser()});
window.addEventListener('momentum:wallet-lost',()=>{state.wallet?.cleanup?.();state.wallet=null;walletUpdate();addNotification('warning','Wallet changed','Previously connected account is no longer available. Connect a wallet again.');});
walletUpdate();
$('boostForm').addEventListener('submit',async e=>{e.preventDefault();const mint=$('boostMint').value.trim();if(!address(mint)){toast('Enter a valid Solana mint.');return}const btn=$('boostSubmit');btn.disabled=true;$('boostMessage').textContent='Requesting wallet signature…';try{const b=await signedPost('boost',mint);$('boostMessage').textContent=b.status==='active'?'Boost live for 24 hours. Promotion is NOT a safety endorsement.':`Submission ${b.status}: ${b.reason}`;addNotification(b.status==='active'?'boost':'warning',b.status==='active'?'Boost activated':`Boost ${b.status}`,`${short(mint)}: ${b.reason||'Momentum launch submission processed.'}`,{id:'boost-'+mint+'-'+b.status});await loadBoosts();}catch(e){$('boostMessage').textContent=e.message}finally{btn.disabled=false}});
$('closeDialog').addEventListener('click',()=>$('reportDialog').close());
$('reportForm').addEventListener('submit',async e=>{e.preventDefault();const mint=$('reportMint').value.trim();$('reportMessage').textContent='Waiting for wallet signature…';try{const result=await signedPost('report',mint,{evidenceUrl:$('reportUrl').value.trim(),details:$('reportDetail').value.trim()});$('reportMessage').textContent=result.notice;toast('Report received for review.');addNotification('report','Report submitted',`Your report for ${short(mint)} was queued for evidence review.`,{id:'report-'+mint});}catch(err){$('reportMessage').textContent=err.message}});
loadFeed();setInterval(()=>{if(!document.hidden&&state.view==='discover')loadFeed()},120000);

// Public, fail-closed readiness indicator. No transaction signing or spending is enabled.
(async function loadLaunchReadiness(){
  try{
    const readiness=await $api('/launch-readiness');
    $('launchReadinessBadge').textContent=readiness.tradingEnabled?'Trading configuration requires review':'Trading disabled · read-only beta';
    $('curveReadiness').textContent=readiness.features?.bondingCurve==='not-implemented'?'Not deployed':'Review required';
    $('graduationReadiness').textContent=readiness.features?.graduation==='not-implemented'?'Not deployed':'Review required';
    $('lockReadiness').textContent=readiness.features?.liquidityLock==='not-implemented'?'Not deployed':'Review required';
    $('launchReadinessDetail').textContent=readiness.warning||'No Momentum mainnet financial contracts have been verified.';
  }catch{
    $('launchReadinessBadge').textContent='Cannot verify — trading unavailable';
    $('launchReadinessDetail').textContent='Momentum readiness API is unreachable. Treat trading and launch contracts as unavailable.';
  }
})();

// Currency-specific creator funding preview: NO wallet signing, transfers or collection.
$('launchQuoteForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const asset=$('launchQuoteAsset').value,funding=$('launchFunding').value.trim();
  $('launchQuoteResult').textContent='Validating quote asset and calculating fee preview…';
  try{
    const {preview:p}=await $api('/launch-quote?'+new URLSearchParams({quote:asset,funding}));
    $('launchQuoteResult').innerHTML=`<strong>${escape(p.quoteAsset)} pair · 2% one-time launch fee</strong><p>Creator budget: ${escape(p.fundingGross)} ${escape(p.quoteAsset)}<br>Momentum proposed fee: <strong>${escape(p.proposedPlatformCreationFee)} ${escape(p.quoteAsset)}</strong><br>Initial creator purchase: ${escape(p.creatorPurchaseBudgetNet)} ${escape(p.quoteAsset)}</p><p>Meteora built-in creation fee: ${escape(p.nativeMeteoraPoolCreationFee)}.<br>Keeper migration threshold: ${escape(p.graduationKeeperMinimum)}.</p><p><b>No fee is being collected.</b> A wallet-signed, audited atomic transaction and full network-cost simulation are required before mainnet launch.</p>`;
  }catch(err){$('launchQuoteResult').textContent='Cannot quote launch: '+err.message+'. No payment or transaction was created.';}
});
$('launchQuoteAsset').addEventListener('change',()=>{
  $('launchFunding').value=$('launchQuoteAsset').value==='USDC'?'100':'0.1';
  $('launchQuoteResult').textContent='Quote currency changed. Select Preview fees & pairing for updated numbers.';
});

// Mainnet program/cost checks are informational ONLY, not a pool-creation pathway.
$('estimateLaunchBtn').addEventListener('click',async()=>{
  const btn=$('estimateLaunchBtn');btn.disabled=true;$('launchCostResult').textContent='Reading Solana mainnet account rent…';
  try{
    const data=await $api('/launch-cost'),cost=data.estimate;
    if(!cost)throw Error('Rent quote unavailable');
    $('launchCostResult').innerHTML=`<strong>Verified rent components (live RPC)</strong><p>Mint (82 bytes): ${escape(cost.rentComponents[0].sol)} SOL<br>Basic token account (165 bytes): ${escape(cost.rentComponents[1].sol)} SOL<br>Subtotal for just these two: <strong>${escape(cost.subtotalForTheseTwoAccounts.sol)} SOL</strong></p><p>This is <b>not the launch cost</b>. Pool/vault rent, metadata, priority fees and graduation are excluded. Proposed Momentum creation fee: 2% of creator-funded first purchase, separate from SOL network costs.</p>`;
  }catch(e){$('launchCostResult').textContent='Unable to verify live rent: '+e.message+'. No estimated total will be substituted.'}
  finally{btn.disabled=false;}
});
$('checkDbcBtn').addEventListener('click',async()=>{
  const btn=$('checkDbcBtn');btn.disabled=true;$('dbcProgramResult').textContent='Reading program account from Solana mainnet…';
  try{
    const data=await $api('/dbc-program');
    $('dbcProgramResult').textContent=(data.executable?'Executable DBC program account found.':'Unable to verify an executable program account.')+' Address: '+data.programId+'. This only checks account existence, NOT contract audit, upgrade authority or pool locks. Momentum launches stay disabled.';
  }catch(e){$('dbcProgramResult').textContent='Program identity check unavailable: '+e.message+'. Do not interact with unverified addresses.'}
  finally{btn.disabled=false;}
});


// PUBLIC SOLANA ACCOUNT BUBBLE MAP. It never claims private beneficial-owner relationships.
$('bubbleForm').addEventListener('submit',async e=>{
  e.preventDefault();const mint=$('bubbleMint').value.trim();const view=$('bubbleChart');
  if(!address(mint)){view.textContent='Enter a valid Solana mint address.';return;}
  view.textContent='Reading token accounts from Solana…';
  try{
    const data=await $api('/bubbles?mint='+encodeURIComponent(mint));
    const nodes=(data.accounts||[]).slice(0,20);
    if(!nodes.length){view.textContent='No largest-account data found.';return;}
    const owners=new Map(),p=[];
    nodes.forEach((b,i)=>{
      const x=82+(i%5)*140, y=55+Math.floor(i/5)*87;
      const r=Math.min(36,Math.max(10,10+Math.sqrt(Math.max(0,b.sharePercent))*4));
      p.push({x,y,r,...b});
      if(b.owner){if(!owners.has(b.owner))owners.set(b.owner,[]);owners.get(b.owner).push({x,y});}
    });
    const lines=[...owners.values()].flatMap(g=>g.length<2?[]:g.slice(1).map(v=>`<line x1="${g[0].x}" y1="${g[0].y}" x2="${v.x}" y2="${v.y}" stroke="#C6DFE6" stroke-opacity=".52" stroke-dasharray="4 4" stroke-width="1.5"/>`)).join('');
    const circles=p.map((n,i)=>`<a href="https://solscan.io/account/${encodeURIComponent(n.account)}" target="_blank" rel="noopener noreferrer" aria-label="Inspect token account ${escape(n.account)}"><circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${['#0A7A74','#56A1A0','#345C76','#297B93','#6086AB'][i%5]}" stroke="#C7F3E8" stroke-opacity=".3" stroke-width="1.2"/><text x="${n.x}" y="${n.y+3}" text-anchor="middle" font-size="12" fill="white" font-weight="650">${n.sharePercent}%</text><title>${escape(n.account)} · ${n.sharePercent}% of supply${n.owner?' · owner '+escape(n.owner):''}</title></a>`).join('');
    view.innerHTML=`<div class="bubble-summary"><b>${nodes.length} largest token accounts</b><span>Combined share: ${escape(data.topAccountsSharePercent)}% of reported supply</span></div><svg viewBox="0 0 730 385" width="100%" role="img" aria-label="Largest Solana token accounts sized by percent of supply">${lines}${circles}</svg><p>Dashed connections represent only token accounts with the exact same on-chain owner where RPC information is available.</p>`;
    $('bubbleWarning').textContent=data.disclaimer+' '+data.ownerEvidence+'.';
  }catch(err){view.textContent='Unable to load on-chain distribution: '+err.message;}
});

// Read-only fee-policy explorer. Does not register a partner config or charge a wallet.
const feePresets={balanced:{creator:5000,holders:3000,burn:2000},creator:{creator:10000,holders:0,burn:0},holders:{creator:3000,holders:7000,burn:0},burn:{creator:3000,holders:0,burn:7000}};
async function renderFeePlan(){
  $('creatorShareLabel').textContent=$('creatorShare').value+'%';
  const shares=feePresets[$('rewardsPreset').value]||feePresets.balanced;
  const p=new URLSearchParams({creatorShare:String(Number($('creatorShare').value)*100),creator:String(shares.creator),holders:String(shares.holders),burn:String(shares.burn)});
  try{
    const {feePolicy:f}=await $api('/tokenomics?'+p);
    const rows=[['Meteora protocol',f.protocolFeeEffectivePercent],['Momentum partner fee',f.partnerFeeEffectivePercent],['Creator direct (proposed)',f.creatorFeeEffectivePercent],['Holder incentives (not live)',f.proposedHolderRewardsEffectivePercent],['Buyback/burn (not live)',f.proposedBuybackBurnEffectivePercent]];
    $('feeBreakdown').innerHTML=rows.map(([name,pct])=>`<div class="fee-line"><span>${escape(name)}</span><div class="fee-line-track"><i style="width:${Math.min(100,pct/2*100)}%"></i></div><strong>${pct.toFixed(2)}%</strong></div>`).join('')+'<div class="fee-total">Total bonding-curve trading fee <b>2.00%</b></div>';
  }catch(err){$('feeBreakdown').textContent='Fee preview unavailable: '+err.message;}
}
$('creatorShare').addEventListener('input',renderFeePlan);$('rewardsPreset').addEventListener('change',renderFeePlan);renderFeePlan();
