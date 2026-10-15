import {normalized,isSolanaAddress} from './guard.js';

// This is launch-TRANSACTION payer attribution, not a claim of beneficial ownership.
// Factory/relayer wallets often pay for unrelated developers; treat it as weak evidence.
const PROGRAMS = new Set(['spl-token','spl-token-2022']);
export function extractMintLaunchPayer(transaction,mint){
  const msg=transaction?.transaction?.message;
  if(transaction?.meta?.err || !msg?.instructions || !Array.isArray(msg.accountKeys))return null;
  const instructions=[...msg.instructions,...(transaction.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
  const initialized=instructions.some(ix => PROGRAMS.has(ix.program) && ['initializeMint','initializeMint2'].includes(ix.parsed?.type) && ix.parsed?.info?.mint===mint);
  if(!initialized)return null;
  // Account 0 is fee payer for Solana transactions. It need not be the project developer.
  const payer=msg.accountKeys[0]?.pubkey ?? msg.accountKeys[0];
  return isSolanaAddress(payer)?payer:null;
}

export function examineRepeatLaunch(current,previous){
  const matches=(previous||[]).filter(p=>p.mint!==current.mint);
  const name=normalized(current.name),symbol=normalized(current.symbol);
  const sharedBrand=matches.filter(p=>(name.length>=5&&normalized(p.name)===name)||(symbol.length>=3&&normalized(p.symbol)===symbol));
  // A "quiet" token is just an observation about its market data, not proof of a rug.
  const quiet=sharedBrand.filter(p=>Number(p.last_liquidity_usd)<1000&&Number(p.last_volume_24h)<250 && p.pair_created_at && p.pair_created_at<Date.now()-48*3600*1000);
  return {status:sharedBrand.length?'review':'unknown',pastLaunches:matches.length,matchingBrandCount:sharedBrand.length,quietMatchingCount:quiet.length,evidence:sharedBrand.slice(0,5).map(p=>({mint:p.mint,name:p.name,symbol:p.symbol,liquidityUsd:Number(p.last_liquidity_usd),volume24h:Number(p.last_volume_24h)})),message:sharedBrand.length?'Previously observed token(s) share branding and a mint-initialization transaction payer. This is not proof of the same developer or misconduct.':'No branding collision in Momentum’s limited observed history.'};
}

export async function traceLaunchPayer(mint,rpc){
  const history=await rpc('getSignaturesForAddress',[mint,{limit:150,commitment:'confirmed'}]);
  if(!Array.isArray(history)||!history.length)return {status:'unavailable',reason:'No signature history available'};
  if(history.length===150)return {status:'incomplete',reason:'Address has 150+ transactions; earliest launch transaction not covered by free bounded scan'};
  const candidate=[...history].reverse().find(x=>!x.err && x.signature);
  if(!candidate)return {status:'unavailable',reason:'No successful mint history transaction found'};
  const tx=await rpc('getTransaction',[candidate.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]);
  const payer=extractMintLaunchPayer(tx,mint);
  if(!payer)return {status:'unavailable',reason:'Earliest available transaction did not contain a recognizable SPL mint initialization'};
  return {status:'observed',payer,signature:candidate.signature,confidence:'transaction-payer-only',reason:'Fee payer on earliest observed SPL mint-initialization transaction; not verified developer ownership'};
}
