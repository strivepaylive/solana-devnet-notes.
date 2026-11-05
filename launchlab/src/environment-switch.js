// Display-only network selector. Never alters the actual chain SDK or authorizes real trades.
const dev=document.getElementById('environmentDevnet');
const main=document.getElementById('environmentMainnet');
const status=document.getElementById('environmentStatus');
function show(mode){
 const isMain=mode==='mainnet';
 dev.classList.toggle('active',!isMain);main.classList.toggle('active',isMain);
 dev.setAttribute('aria-pressed',String(!isMain));main.setAttribute('aria-pressed',String(isMain));
 status.textContent=isMain?'Mainnet trading is not enabled. The launch and trading tools remain devnet-only.':'Testing mode · no real funds';
 document.documentElement.dataset.requestedNetwork=mode;
 // Mainnet is informational only; never silently route transactions to devnet.
 document.querySelectorAll('#createForm button[type="submit"],#tradeForm button[type="submit"]').forEach(button=>{button.disabled=isMain;button.title=isMain?'Mainnet is not yet enabled. Switch to Devnet to test.':''});
}
dev?.addEventListener('click',()=>show('devnet'));
main?.addEventListener('click',()=>show('mainnet'));
show('devnet');
