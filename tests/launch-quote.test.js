import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {QUOTE_ASSETS,previewLaunchContribution} from '../src/launch-quote.js';
import {getQuoteTemplate,validateMeteoraTemplate} from '../src/mainnet-plan.js';
const get=q=>new Request('https://momentum.example/api/'+q);
test('canonical SOL and USDC quote mints and quote decimals are fixed',()=>{
 assert.equal(QUOTE_ASSETS.SOL.decimals,9);
 assert.equal(QUOTE_ASSETS.USDC.quoteMint,'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
 assert.equal(QUOTE_ASSETS.USDC.decimals,6);
 for(const a of ['SOL','USDC'])assert.equal(validateMeteoraTemplate(getQuoteTemplate(a)).approvedForResearch,true);
});
test('2% charged once on declared creator launch funding and DOES NOT collect money',()=>{
 const sol=previewLaunchContribution({asset:'SOL',funding:'1'});
 assert.equal(sol.proposedPlatformCreationFee,'0.02');assert.equal(sol.creatorPurchaseBudgetNet,'0.98');
 assert.equal(sol.tradingFeeBps,200);assert.equal(sol.launchFeeBps,200);assert.equal(sol.platformFeeEnforced,false);
 const usdc=previewLaunchContribution({asset:'USDC',funding:'100'});
 assert.equal(usdc.proposedPlatformCreationFee,'2');assert.equal(usdc.creatorPurchaseBudgetNet,'98');
 assert.equal(usdc.quoteDecimals,6);assert.equal(usdc.graduationKeeperMinimum,'750 USDC');
});
test('fee rounding exact to smallest unit, never silently accepts zero funding or extra decimals',()=>{
 assert.equal(previewLaunchContribution({asset:'SOL',funding:'0.000000051'}).feeBaseUnits,'2');
 for(const [asset,funding] of [['SOL','0'],['USDC','0.0000001'],['SOL','-1'],['USD','1'],['USDC','0.000001'],['SOL','123abc']]) assert.throws(()=>previewLaunchContribution({asset,funding}));
});
test('wrong USDC mint/decimals or incorrect percentage are rejected',()=>{
 const wrong=getQuoteTemplate('USDC');wrong.quoteMint=QUOTE_ASSETS.SOL.quoteMint;
 assert.equal(validateMeteoraTemplate(wrong).approvedForResearch,false);
 const wrongFee=getQuoteTemplate('USDC');wrongFee.launchPlatformFeeBps=201;
 assert.equal(validateMeteoraTemplate(wrongFee).approvedForResearch,false);
});
test('read only quote API supports SOL and USDC without DB or sending funds',async()=>{
 const yes=await worker.fetch(get('launch-quote?quote=USDC&funding=25'),{},{});
 assert.equal(yes.status,200);const data=await yes.json();assert.equal(data.preview.proposedPlatformCreationFee,'0.5');assert.equal(data.tradingEnabled,false);
 const no=await worker.fetch(get('launch-quote?quote=USDC&funding=0'),{},{});assert.equal(no.status,400);
 const plan=await worker.fetch(get('mainnet-plan?quote=USDC'),{},{});const info=await plan.json();assert.equal(info.template.quoteMint,QUOTE_ASSETS.USDC.quoteMint);assert.equal(info.validation.approvedForResearch,true);
});
