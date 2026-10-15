import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/worker.js';
import {METEORA_DBC_PROGRAM, recommendedTemplate,validateMeteoraTemplate,makeRentPreview,getIntegrationPlan} from '../src/mainnet-plan.js';
const GET = p=> new Request('https://momentum.example/api/'+p);
test('fixed official DBC ID, 2% proportional creator fee and zero native DBC fixed SOL surcharge',()=>{
 assert.equal(METEORA_DBC_PROGRAM,'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
 assert.equal(recommendedTemplate.poolCreationPlatformFeeLamports,0);
 assert.equal(recommendedTemplate.launchPlatformFeeBps,200);
 assert.equal(validateMeteoraTemplate(recommendedTemplate).approvedForResearch,true);
 assert.equal(getIntegrationPlan().canAcceptFunds,false);
});
test('no unlocked LP or wrong official program may pass even as draft',()=>{
 const clone=JSON.parse(JSON.stringify(recommendedTemplate));clone.programId='evil';clone.graduatedLp.partnerPermanentLockedBps=7500;clone.graduatedLp.partnerUnlockedBps=2500;
 const result=validateMeteoraTemplate(clone);
 assert.equal(result.approvedForResearch,false);assert.ok(result.violations.some(v=>v.includes('program')));assert.ok(result.violations.some(v=>v.includes('100%')));
});
test('rent preview is incomplete and bills neither the launch fee nor transactions',()=>{
 const prev=makeRentPreview(1461600,2039280);assert.equal(prev.totalLaunchCost,null);assert.equal(prev.partnerPoolCreationFeeLamports,0);assert.equal(prev.subtotalForTheseTwoAccounts.sol,0.00350088);
 assert.throws(()=>makeRentPreview(-1,100));
});
test('public integration plan is read-only and no DB is needed',async()=>{
 const res=await app.fetch(GET('mainnet-plan'),{},{});assert.equal(res.status,200);const b=await res.json();assert.equal(b.plan.canLaunchTokens,false);assert.equal(b.validation.canSendTransactions,false);
});
test('rent estimation consults Solana RPC in bytes (not hardcoded full cost)',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async(_url,opts)=>{const {method,params}=JSON.parse(opts.body);assert.equal(method,'getMinimumBalanceForRentExemption');return new Response(JSON.stringify({jsonrpc:'2.0',result:params[0]===82?1461600:2039280}),{status:200})};
 try{const r=await app.fetch(GET('launch-cost'),{},{});assert.equal(r.status,200);const b=await r.json();assert.equal(b.estimate.totalLaunchCost,null);assert.equal(b.tradingEnabled,false);}
 finally{globalThis.fetch=previous;}
});
test('program account check cannot enable trading and rejects unavailable RPC',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({result:{value:{executable:true,owner:'BPFLoaderUpgradeab1e11111111111111111111111'}}}),{status:200});
 try{const r=await app.fetch(GET('dbc-program'),{},{});const b=await r.json();assert.equal(b.executable,true);assert.equal(b.tradingEnabled,false);}
 finally{globalThis.fetch=previous;}
});
