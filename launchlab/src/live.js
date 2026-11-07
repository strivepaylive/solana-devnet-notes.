import {connection} from './chain.js';
import {LaunchpadPool, DEVNET_PROGRAM_ID} from '@raydium-io/raydium-sdk-v2';
import {PublicKey} from '@solana/web3.js';
const LIMIT=48;
const urls={mainnet:'/api/pools',news:'/api/news'};
export function formatMoney(value){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return 'Not confirmed';
  const n=Number(value);
  return '$'+(Math.abs(n)>1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>1e3?(n/1e3).toFixed(1)+'K':n.toLocaleString('en-US',{maximumFractionDigits:6}));
}
export function progressOfPool(info){
  if(!info)return null;
  const real=Number(info.realB?.toString?.()||0),target=Number(info.totalFundRaisingB?.toString?.()||0);
  if(!Number.isFinite(real)||!Number.isFinite(target)||target<=0)return null;
  return Math.max(0,Math.min(100,real*100/target));
}
export async function loadMainnetPools(){
  const response=await fetch(urls.mainnet,{headers:{accept:'application/json'}});
  if(!response.ok)throw Error('Public pool feed unavailable ('+response.status+').');
  const data=await response.json();
  if(!Array.isArray(data.pools))throw Error('Invalid pool provider response.');
  return data;
}
export async function loadNews(){
  const response=await fetch(urls.news,{headers:{accept:'application/json'}});
  if(!response.ok)throw Error('Curated crypto news is currently unavailable.');
  const data=await response.json();
  return Array.isArray(data.articles)?data.articles:[];
}
export async function loadRisk(mint,network='mainnet'){
  const response=await fetch('/api/risk?mint='+encodeURIComponent(mint)+'&network='+encodeURIComponent(network),{headers:{accept:'application/json'}});
  if(!response.ok)throw Error('On-chain screening unavailable; keep this token unverified.');
  return await response.json();
}
// A devnet on-program account-change subscription can surface launches as soon as RPC sends them.
// It does NOT discover all SPL token mints, other DEX launches, or mainnet activity.
export function observeDevnetLaunches(onItem,onState){
  let subscription=null,active=true,retry=null,lastSlot=0;
  const programId=DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM;
  const fingerprints=new Set();
  async function subscribe(){
    try{
      subscription=connection.onProgramAccountChange(
        programId,({accountId,accountInfo},context)=>{
          if(!active || context.slot<lastSlot-3)return;
          lastSlot=Math.max(lastSlot,context.slot);
          let info;try{info=LaunchpadPool.decode(accountInfo.data)}catch{return}
          if(!info.mintA||!info.mintB)return;
          const pool=accountId.toBase58();
          if(fingerprints.has(pool))return;
          fingerprints.add(pool);if(fingerprints.size>500)fingerprints.clear();
          const mint=info.mintA.toBase58();
          onItem({
            mint,pool,symbol:mint.slice(0,4)+'…',name:'Devnet LaunchLab pool',
            creator:info.creator?.toBase58?.()||null,
            platform:info.platformId?.toBase58?.()||null,
            config:info.configId?.toBase58?.()||null,
            quoteMint:info.mintB.toBase58(),progress:progressOfPool(info),
            fundingAtomic:info.realB?.toString?.()||null,
            targetAtomic:info.totalFundRaisingB?.toString?.()||null,
            status:info.status?.toString?.()||'unknown',
            slot:context.slot,createdAt:new Date().toISOString(),
            network:'devnet',source:'Raydium LaunchLab RPC program subscription'
          });
          onState('Streaming Raydium LaunchLab devnet pool changes at confirmed commitment');
        },
        'confirmed',
        [{dataSize:LaunchpadPool.span}]
      );
      onState('Subscribing to live Raydium devnet program changes…');
    }catch(error){
      onState('RPC streaming unavailable; reconnecting later: '+String(error.message||error));
      retry=setTimeout(()=>{if(active)subscribe()},15000);
    }
  }
  subscribe();
  return ()=>{
    active=false;
    if(retry)clearTimeout(retry);
    if(subscription!==null)connection.removeProgramAccountChangeListener(subscription).catch(()=>{});
  };
}
