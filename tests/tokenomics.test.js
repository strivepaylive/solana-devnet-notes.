import test from 'node:test';import assert from 'node:assert/strict';
import app from '../src/worker.js';
import {makeFeePreview,validateDistribution,DEFAULT_FEE_PREVIEW} from '../src/tokenomics.js';
import {prepareBubbleMap} from '../src/bubbles.js';
const GET=p=>new Request('https://momentum.example/api/'+p);
test('2 percent trading fee apportioned with documented protocol share and no fictional rewards',()=>{
  const x=DEFAULT_FEE_PREVIEW;
  assert.equal(x.grossTradingFeeBps,200);assert.equal(x.protocolFeeEffectivePercent,0.4);
  assert.equal(x.partnerFeeEffectivePercent,0.8);assert.equal(x.creatorFeeEffectivePercent,0.4);
  assert.equal(x.proposedHolderRewardsEffectivePercent,0.24);assert.equal(x.proposedBuybackBurnEffectivePercent,0.16);
  assert.equal(x.collectsFunds,false);assert.equal(x.canExecute,false);
  assert.equal(x.protocolFeeEffectivePercent+x.partnerFeeEffectivePercent+x.creatorFeeEffectivePercent+x.proposedHolderRewardsEffectivePercent+x.proposedBuybackBurnEffectivePercent,2);
});
test('fee allocation rejects totals other than 100% and percentages out of bounds',()=>{
  assert.equal(validateDistribution({creatorBps:7000,holderBps:2500,buybackBurnBps:500}).valid,true);
  assert.throws(()=>makeFeePreview({creatorFeeShareBps:11000}));
  assert.throws(()=>makeFeePreview({distribution:{creatorBps:9000,holderBps:9000,buybackBurnBps:9000}}));
});
test('tokenomics API is available without DB and without letting funds move',async()=>{
  const res=await app.fetch(GET('tokenomics'),{},{});assert.equal(res.status,200);const d=await res.json();assert.equal(d.feePolicy.grossTradingFeePercent,2);assert.equal(d.feePolicy.holderRewardsStatus,'not-built');
});
test('bubble map differentiates token accounts and public owners',()=>{
  const addr='11111111111111111111111111111111';const own='So11111111111111111111111111111111111111112';
  const x=prepareBubbleMap(own,[{address:addr,amount:'1000'}],'10000',[{data:{parsed:{type:'account',info:{owner:own}}}}]);
  assert.equal(x.topAccountsSharePercent,10);assert.equal(x.accounts[0].owner,own);assert.equal(x.relationshipsVerified,false);
  assert.throws(()=>prepareBubbleMap(own,[{address:addr,amount:'1000'}],'0'));
});
test('bubble API reads public Solana RPC and refuses invented data',async()=>{
  const mint='So11111111111111111111111111111111111111112';const a='11111111111111111111111111111111';
  const prior=globalThis.fetch;
  globalThis.fetch=async(_url,opts)=>{
    const {method}=JSON.parse(opts.body);
    const result=method==='getTokenLargestAccounts'?{value:[{address:a,amount:'250'}]}:method==='getTokenSupply'?{value:{amount:'1000'}}:{value:[]};
    return new Response(JSON.stringify({result}),{status:200});
  };
  try{const r=await app.fetch(GET('bubbles?mint='+mint),{},{});assert.equal(r.status,200);assert.equal((await r.json()).topAccountsSharePercent,25);}finally{globalThis.fetch=prior;}
});
