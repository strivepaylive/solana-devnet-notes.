import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/worker.js';
import {getLaunchReadiness,validateLaunchDraft,WRAPPED_SOL_MINT} from '../src/launch-safety.js';

const planned = () => ({
  chain:'solana', quoteMint:WRAPPED_SOL_MINT, tokenProgram:'spl-token',tokenDecimals:6,tokenSupply:1000000000,
  mintAuthorityRevoked:true,freezeAuthorityRevoked:true,mutableMetadata:false,
  buyFeeBps:100,sellFeeBps:100,graduationQuoteLamports:10000000000,
  slippageCheckOnChain:true,migrationAtomicity:true,migrationRecipient:'program-lock-escrow',
  lpAllocation:{creatorLockedBps:0,partnerLockedBps:10000,creatorUnlockedBps:0,partnerUnlockedBps:0},
  creatorCanWithdrawReserve:false,adminCanWithdrawReserve:false,upgradeAuthorityControlled:true
});

test('even passing draft policies do NOT enable mainnet trading',()=>{
  assert.equal(validateLaunchDraft(planned()).passesDraftPolicy,true);
  const ready=getLaunchReadiness();
  assert.equal(ready.tradingEnabled,false);
  assert.equal(ready.acceptsUserFunds,false);
  assert.equal(ready.programId,null);
  assert.equal(ready.features.bondingCurve,'not-implemented');
});
test('unlocked LP allocation is rejected',()=>{
  const p=planned();p.lpAllocation.creatorUnlockedBps=2500;p.lpAllocation.partnerLockedBps=7500;
  assert.equal(validateLaunchDraft(p).passesDraftPolicy,false);
  assert.ok(validateLaunchDraft(p).violations.some(s=>s.includes('100%')));
});
test('mint authority and fee bypass are rejected',()=>{
  const p=planned();p.mintAuthorityRevoked=false;p.buyFeeBps=300;
  assert.ok(validateLaunchDraft(p).violations.some(s=>s.includes('Mint authority')));
  assert.ok(validateLaunchDraft(p).violations.some(s=>s.includes('2%')));
});
test('graduation and reserve safety cannot be switched off',()=>{
  const p=planned();p.migrationAtomicity=false;p.creatorCanWithdrawReserve=true;
  assert.ok(validateLaunchDraft(p).violations.some(s=>s.includes('exactly-once')));
  assert.ok(validateLaunchDraft(p).violations.some(s=>s.includes('withdraw')));
});
test('readiness endpoint explicitly shows unimplemented trading',async()=>{
  const response=await app.fetch(new Request('https://momentum.example/api/launch-readiness'),{},{});
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.tradingEnabled,false);assert.equal(body.features.graduation,'not-implemented');
});
test('transaction endpoints fail closed without DB or any external dependencies',async()=>{
  for(const path of ['/api/launch','/api/trade','/api/buy','/api/sell','/api/graduate','/api/migrate','/api/liquidity','/api/withdraw']){
    const response=await app.fetch(new Request(`https://momentum.example${path}`,{method:'POST',body:'{}'}),{},{});
    assert.equal(response.status,503,path);
    const body=await response.json();assert.match(body.error,/disabled/);
  }
});
