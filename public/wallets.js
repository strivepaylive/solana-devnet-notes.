// Momentum wallet interoperability. Uses the public Wallet Standard registration
// protocol (https://github.com/wallet-standard/wallet-standard), with a legacy
// injected-provider fallback. No wallet custody and no private keys handled.
const registered = new Set();
const listeners = new Set();
const notify = () => { for (const cb of listeners) { try { cb(); } catch (error) { console.warn('Wallet discovery listener', error); } } };
const register = (...wallets) => {let updated = false; for (const wallet of wallets) { if (wallet && !registered.has(wallet)) { registered.add(wallet); updated = true; } } if (updated) notify(); return () => { for (const wallet of wallets) registered.delete(wallet); notify(); };};
if (typeof window !== 'undefined') {
  window.addEventListener('wallet-standard:register-wallet', event => {
    try { if (typeof event.detail === 'function') event.detail(Object.freeze({register})); } catch (error) { console.warn('Wallet registration rejected', error); }
  });
  // Standard event needs a register callback in detail; a bare event is invalid.
  const ready = new Event('wallet-standard:app-ready');
  Object.defineProperty(ready, 'detail', {value: Object.freeze({register})});
  window.dispatchEvent(ready);
}
const isAddress = str => typeof str === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str);
const injected = () => [
  ['Phantom', window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null)],
  ['Solflare', window.solflare || (window.solana?.isSolflare ? window.solana : null)],
  ['Backpack', window.backpack || (window.solana?.isBackpack ? window.solana : null)],
  ['Glow', window.glowSolana || window.glow?.solana],
  ['Brave Wallet', window.braveSolana],
  ['OKX Wallet', window.okxwallet?.solana],
  ['Exodus', window.exodus?.solana],
  ['Trust Wallet', window.trustwallet?.solana],
].filter(([,provider])=>typeof provider?.connect === 'function' && typeof provider?.signMessage === 'function');
export function onWalletChange(callback) {listeners.add(callback); return () => listeners.delete(callback);}
export function availableWallets() {
  const list = []; const names = new Set();
  for (const wallet of registered) {
    if (!wallet?.chains?.some?.(chain => typeof chain === 'string' && chain.startsWith('solana:'))) continue;
    if (typeof wallet.features?.['standard:connect']?.connect !== 'function') continue;
    if (typeof wallet.features?.['solana:signMessage']?.signMessage !== 'function') continue;
    const name = String(wallet.name || 'Solana wallet');
    list.push({kind:'standard',name,icon:wallet.icon||null,wallet,id:`standard-${name}`});
    names.add(name.toLowerCase());
  }
  for (const [name,provider] of injected()) {
    if (!names.has(name.toLowerCase())) list.push({kind:'legacy',name,provider,id:`legacy-${name}`});
  }
  return list.sort((a,b)=>a.name.localeCompare(b.name));
}
export async function connectWallet(entry) {
  if (entry.kind === 'standard') {
    const {accounts} = await entry.wallet.features['standard:connect'].connect();
    const account = accounts?.find?.(a => isAddress(a.address) && a.features?.includes('solana:signMessage') && a.chains?.some(c=>c.startsWith('solana:')));
    if (!account) throw Error(`${entry.name} has no usable Solana account with message signing.`);
    const connection = {
      name:entry.name,address:account.address,
      async signMessage(message) {
        const result=await entry.wallet.features['solana:signMessage'].signMessage({account,message});
        if (!result?.[0]?.signature || !(result[0].signature instanceof Uint8Array)) throw Error('Wallet did not return a valid signature');
        return result[0].signature;
      },
      async disconnect(){await entry.wallet.features['standard:disconnect']?.disconnect?.();}
    };
    const handler=entry.wallet.features['standard:events']?.on?.('change',ev=>{
      if (ev.accounts && !ev.accounts.some(a=>a.address===account.address)) window.dispatchEvent(new Event('momentum:wallet-lost'));
    });
    connection.cleanup=()=>{if(typeof handler==='function')handler();};
    return connection;
  }
  const {provider}=entry;
  const result=await provider.connect();
  const address=result?.publicKey?.toBase58?.() || provider.publicKey?.toBase58?.() || result?.publicKey?.toString?.();
  if (!isAddress(address)) throw Error('Wallet returned an invalid Solana address');
  return {
    name:entry.name,address,
    async signMessage(message){
      const result=await provider.signMessage(message,'utf8');
      if (!(result?.signature instanceof Uint8Array)) throw Error('Wallet did not return a signature');
      return result.signature;
    },
    async disconnect(){await provider.disconnect?.();}
  };
}
