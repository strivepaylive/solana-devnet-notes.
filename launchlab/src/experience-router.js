// Distinct entry experiences. This router never changes the chain used by transactions.
const gateway=document.getElementById('momentumGateway');
const chooser=document.getElementById('momentumChoose');
const workspace=document.getElementById('momentumWorkspace');
const mentor=document.getElementById('mentor');
const mainOnly=['launch','trade'];
const devOnly=['launch','trade'];
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
 document.querySelectorAll('#launch,#trade').forEach(section=>{section.hidden=isMain});
 document.getElementById('devnetFaucetLink')?.toggleAttribute('hidden',isMain);
 document.querySelectorAll('#createForm button[type="submit"],#tradeForm button[type="submit"]').forEach(button=>{button.disabled=isMain;button.title=isMain?'Only Devnet transactions are supported':''});
 document.querySelectorAll('a[href="#launch"],a[href="#trade"]').forEach(a=>{a.hidden=isMain});
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
// A display toggle cannot silently enable real-money transactions.
for(const [id,mode] of [['environmentMainnet','mainnet'],['environmentDevnet','devnet']]){
 document.getElementById(id)?.addEventListener('click',()=>{location.hash='#/'+mode});
}
// Defense in depth: a disabled button alone is insufficient for blocking transaction submission.
for(const id of ['createForm','tradeForm']){
 document.getElementById(id)?.addEventListener('submit',event=>{
  if(activeEnvironment!=='devnet'){
   event.preventDefault();event.stopImmediatePropagation();
   document.getElementById('environmentStatus').textContent='Transactions are available in Devnet only.';
  }
 },true);
}
window.addEventListener('hashchange',route);
route();
