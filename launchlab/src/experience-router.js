// Distinct entry experiences. This router never changes the chain used by transactions.
const gateway=document.getElementById('momentumGateway');
const chooser=document.getElementById('momentumChoose');
const workspace=document.getElementById('momentumWorkspace');
const mentor=document.getElementById('mentor');
let activeEnvironment=null;
function setEnvironment(mode){
 activeEnvironment=mode;
 document.body.dataset.experience=mode;
 document.documentElement.dataset.requestedNetwork=mode;
 const isMain=mode==='mainnet';
 const status=document.getElementById('environmentStatus');
 if(status)status.textContent=isMain?'Mainnet discovery · Trading is not enabled':'Devnet testing · Test SOL has no monetary value';
 for(const id of ['environmentMainnet','environmentDevnet']){
  const button=document.getElementById(id);if(!button)continue;
  const active=(id==='environmentMainnet')===isMain;
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 }
 document.querySelectorAll('#launch,#trade,#wallet').forEach(section=>{section.hidden=isMain});
 const walletButton=document.getElementById('walletBtn');
 if(walletButton){walletButton.hidden=isMain;walletButton.setAttribute('aria-hidden',String(isMain));}
 document.getElementById('walletAccessButton')?.toggleAttribute('hidden',isMain);
 document.getElementById('walletGateConnect')?.toggleAttribute('hidden',isMain);
 // Market feeds must not cross environments. The SDK remains Devnet-only.
 document.getElementById('mainnetTab')?.toggleAttribute('hidden',!isMain);
 document.getElementById('devnetTab')?.toggleAttribute('hidden',isMain);
 const feedHeading=document.querySelector('#discover .section-title p');
 if(feedHeading)feedHeading.textContent=isMain?'Live indexed Solana mainnet pools. Market discovery only; transactions are disabled.':'Raydium Devnet activity. Test tokens and test SOL have no monetary value.';
 document.getElementById('devnetFaucetLink')?.toggleAttribute('hidden',isMain);
 document.querySelectorAll('#createForm button[type="submit"],#tradeForm button[type="submit"]').forEach(button=>{button.disabled=isMain;button.title=isMain?'Only Devnet transactions are supported':''});
 document.querySelectorAll('a[href="#launch"],a[href="#trade"],a[href="#wallet"]').forEach(a=>{a.hidden=isMain});
 document.getElementById(isMain?'mainnetTab':'devnetTab')?.click();
}
function route(){
 const hash=location.hash.split('?')[0];
 let mode;
 if(hash==='#/mainnet')mode='mainnet';
 else if(hash==='#/devnet')mode='devnet';
 else if(hash==='#/explore')mode='choose';
 else if(hash===''||hash==='#/')mode='landing';
 else mode=activeEnvironment||'landing';
 gateway.hidden=mode!=='landing';chooser.hidden=mode!=='choose';workspace.hidden=mode!=='mainnet'&&mode!=='devnet';
 if(mentor)mentor.hidden=workspace.hidden;
 document.body.dataset.experience=mode;
 if(mode==='mainnet'||mode==='devnet')setEnvironment(mode);
 if(hash.startsWith('#/'))window.scrollTo({top:0,behavior:'instant'});
}
// Workspace badges are non-interactive. Switch networks only through the chooser.
// Defense in depth: a disabled button alone is insufficient for blocking transaction submission.
for(const id of ['createForm','tradeForm']){
 document.getElementById(id)?.addEventListener('submit',event=>{
  if(activeEnvironment!=='devnet'){
   event.preventDefault();event.stopImmediatePropagation();
   const s=document.getElementById('environmentStatus');if(s)s.textContent='Transactions are available in Devnet only.';
  }
 },true);
}
// Prevent changing the feed to the wrong network using programmatic clicks or keyboard input.
for(const [id,expected] of [['mainnetTab','mainnet'],['devnetTab','devnet']]){
 document.getElementById(id)?.addEventListener('click',event=>{
  if(activeEnvironment!==expected){event.preventDefault();event.stopImmediatePropagation();}
 },true);
}
window.addEventListener('hashchange',route);
route();
