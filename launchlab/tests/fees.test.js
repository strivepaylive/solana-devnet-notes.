import test from 'node:test';
import assert from 'node:assert/strict';
import {platformFeeEstimate, formatFeePpm, MOMENTUM_PLATFORM_TRADE_FEE,verifyMomentumPlatformState} from '../src/fees.js';
test('Raydium fee of 20,000 ppm equals two percent',()=>{
 assert.equal(formatFeePpm(MOMENTUM_PLATFORM_TRADE_FEE),'2.00%');
 assert.equal(platformFeeEstimate('1000000000'),'20000000');
});
test('a fee claim requires wallet and exact on-chain rate match',()=>{
 assert.equal(verifyMomentumPlatformState({platformFeeRate:'20000',platformClaimWallet:'A',platformAdminWallet:'A',expectedAdminWallet:'A'}).ok,true);
 assert.equal(verifyMomentumPlatformState({platformFeeRate:'10000',platformClaimWallet:'A',platformAdminWallet:'A',expectedAdminWallet:'A'}).ok,false);
});
