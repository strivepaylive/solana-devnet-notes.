/**
 * Momentum integration research and NON-CUSTODIAL launch planning.
 * This is not a swap builder, deployed partner config, smart contract, or authorization
 * to collect funds. Live trading remains blocked by launch-safety.js.
 */
export const METEORA_DBC_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
import {QUOTE_ASSETS,LAUNCH_PLATFORM_FEE_BPS,quoteAsset} from './launch-quote.js';
export const WRAPPED_SOL = QUOTE_ASSETS.SOL.quoteMint;
export const OFFICIAL_USDC = QUOTE_ASSETS.USDC.quoteMint;
export const SOLANA_MAINNET = 'https://api.mainnet-beta.solana.com';
export const NETWORK_BASE_FEE_LAMPORTS = 5000; // base per signature, not full transaction fee
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const OFFICIAL_DBC_DOCS = 'https://docs.meteora.ag/developer-guides/dbc/';

/** Recommendation, not proof that a pool was created with these terms. */
export const recommendedTemplate = Object.freeze({
  network: 'mainnet-beta',
  protocol: 'meteora-dbc',
  programId: METEORA_DBC_PROGRAM,
  quoteMint: WRAPPED_SOL,
  quoteAsset: 'SOL',
  tokenQuoteDecimals: 9,
  launchPlatformFeeBps: LAUNCH_PLATFORM_FEE_BPS,
  requiresFundedInitialPurchase: true,
  poolCreationPlatformFeeLamports: 0, // Meteora NATIVE fixed SOL creation fee, not Momentum's % fee
  bondingCurveFixedFeeBps: 200,
  bondingCurveDynamicFeeEnabled: false,
  creatorTradingFeePercentage: 50,
  graduatedPoolTradingFeeBps: 200,
  graduatedPoolFeeOption: 3,
  partnerFeeClaimerAddress: 'SET_TO_YOUR_VERIFIED_MOMENTUM_PUBLIC_WALLET',
  tokenProgram: 'spl-token',
  tokenSupply: '1000000000',
  tokenDecimals: 6,
  tokenMintAuthorityAfterLaunch: 'revoked',
  tokenFreezeAuthorityAfterLaunch: 'revoked',
  tokenMetadata: 'immutable',
  graduatedDex: 'meteora-damm-v2',
  graduatedLp: {
    partnerPermanentLockedBps: 5000,
    creatorPermanentLockedBps: 5000,
    partnerUnlockedBps: 0,
    creatorUnlockedBps: 0,
    partnerVestingBps: 0,
    creatorVestingBps: 0
  },
  creatorReserveWithdrawals: false,
  adminReserveWithdrawals: false,
  riskDisclaimer: 'This proposed template is NOT on-chain evidence. The partner config, lock accounts, mint authorities and migration must be verified independently.'
});

export function validateMeteoraTemplate(config = {}) {
  const violations = [];
  const deny = text => violations.push(text);
  if (config.programId !== METEORA_DBC_PROGRAM) deny('DBC program ID is not the verified official address');
  let quote;try{quote=quoteAsset(config.quoteAsset);}catch{deny('Only SOL or USDC quotes are supported');}
  if (quote && (config.quoteMint !== quote.quoteMint || config.tokenQuoteDecimals !== quote.decimals)) deny('Quote mint/decimals mismatch for selected SOL or USDC');
  if (config.launchPlatformFeeBps !== LAUNCH_PLATFORM_FEE_BPS || config.requiresFundedInitialPurchase !== true) deny('The draft requires a one-time 2% launch fee on a positive creator funding amount');
  if (config.graduatedDex !== 'meteora-damm-v2') deny('Graduation must use Meteora DAMM v2');
  if (config.tokenProgram !== 'spl-token') deny('Token-2022 requires a separate extension review');
  if (config.tokenMintAuthorityAfterLaunch !== 'revoked') deny('Mint authority must be revoked');
  if (config.tokenFreezeAuthorityAfterLaunch !== 'revoked') deny('Freeze authority must be revoked');
  if (config.tokenMetadata !== 'immutable') deny('Token metadata must be immutable');
  if (config.creatorReserveWithdrawals !== false || config.adminReserveWithdrawals !== false) deny('Creator and platform withdrawals of curve reserve cannot be permitted');
  if (config.poolCreationPlatformFeeLamports !== 0) deny('Meteora native fixed-SOL creation fee must be zero; Momentum one-time 2% funding-based fee is separate');
  if (config.bondingCurveFixedFeeBps !== 200 || config.bondingCurveDynamicFeeEnabled !== false) deny('Beta bonding curve must charge fixed 200 bps with dynamic fee disabled');
  if (!Number.isInteger(config.creatorTradingFeePercentage) || config.creatorTradingFeePercentage<0 || config.creatorTradingFeePercentage>100) deny('Creator trading fee share must be between 0 and 100 percent');
  if (config.graduatedPoolTradingFeeBps !== 200 || config.graduatedPoolFeeOption !== 3) deny('Graduated DAMM v2 trading fee must be configured explicitly to 200 bps');
  const a = config.graduatedLp || {};
  const fields = ['partnerPermanentLockedBps','creatorPermanentLockedBps','partnerUnlockedBps','creatorUnlockedBps','partnerVestingBps','creatorVestingBps'];
  const valid = fields.every(k=>Number.isInteger(a[k]) && a[k]>=0 && a[k]<=10000);
  if (!valid) deny('Liquidity split values must be integer basis points between 0 and 10,000');
  else {
    if (fields.reduce((n,k)=>n+a[k],0)!==10000) deny('Graduated LP allocations must add to 100%');
    if (a.partnerPermanentLockedBps+a.creatorPermanentLockedBps!==10000) deny('Momentum strict beta policy requires 100% permanent LP lock');
    if (a.partnerUnlockedBps||a.creatorUnlockedBps||a.partnerVestingBps||a.creatorVestingBps) deny('No unlocked or vesting LP allocations are permitted in the strict beta policy');
  }
  return {approvedForResearch:violations.length===0,violations,canSendTransactions:false,notice:'Off-chain proposal check only. Does not verify on-chain pool config or enable live trading.'};
}

const sol = amount => +(amount/LAMPORTS_PER_SOL).toFixed(9);
export function makeRentPreview(mintLamports,tokenLamports) {
  if (![mintLamports,tokenLamports].every(x=>Number.isSafeInteger(x)&&x>=0)) throw Error('Unreliable RPC rent response');
  return {
    rentComponents: [
      {name:'Basic SPL token mint',bytes:82,lamports:mintLamports,sol:sol(mintLamports)},
      {name:'Basic SPL token account (each)',bytes:165,lamports:tokenLamports,sol:sol(tokenLamports)}
    ],
    subtotalForTheseTwoAccounts:{lamports:mintLamports+tokenLamports,sol:sol(mintLamports+tokenLamports)},
    networkBaseFeePerSignatureLamports:NETWORK_BASE_FEE_LAMPORTS,
    networkBaseFeePerSignatureSol:sol(NETWORK_BASE_FEE_LAMPORTS),
    partnerPoolCreationFeeLamports:0,
    totalLaunchCost:null,
    excluded:['DBC config creation if required','DBC virtual pool and vault rent','Token metadata storage','Additional token accounts','Graduation and pool initialization','Priority transaction fees','Initial voluntary token buys','Protocol trading and migration fees'],
    disclaimer:'This is NOT a full launch quote. Actual payment must come from an exact, fresh wallet transaction simulation. Never charge this subtotal as a platform fee.'
  };
}
export function getQuoteTemplate(asset='SOL'){
 const quote=quoteAsset(asset);
 return {...recommendedTemplate,quoteMint:quote.quoteMint,quoteAsset:quote.symbol,tokenQuoteDecimals:quote.decimals};
}
export function getIntegrationPlan(){return {
  status:'integration-in-development',
  canLaunchTokens:false,
  canAcceptFunds:false,
  protocol:'Meteora Dynamic Bonding Curve',
  programId:METEORA_DBC_PROGRAM,
  reference:OFFICIAL_DBC_DOCS,
  partnerCreationFeeRecommendation:'One-time 2% of positive creator-funded launch budget, separate from 2% trading fee. Requires an audited atomic wallet-signed transfer plus pool creation, not a native DBC percentage setting.',
  nativePoolCreationFee:'0 SOL proposed; the optional built-in Meteora creation fee is FIXED SOL only, not percentage-based',
  permittedQuoteAssets:['SOL','USDC'],
  quoteGraduationKeeperConditions:{SOL:'Official mainnet keeper currently requires 10 SOL migration quote threshold',USDC:'Official mainnet keeper currently requires 750 USDC migration quote threshold'},
  tradingFeeProposal:'Fixed 200bps pre-graduation, no dynamic add-on; DAMM v2 200bps after graduation; protocol and creator/partner claim rights differ by phase',
  creatorAndPartnerLp:'All LP permanently locked. Proposed partner 50% and creator 50% locked fee-bearing positions; no withdrawable LP',
  holderRewardsAndBuyback:'Not deployed: these require secure audited distribution/buyback automation, not merely an off-chain allocation preference',
  graduationFee:'0.2% of both token and quote liquidity goes to Meteora protocol, separate from rent and any optional migration fee',
  graduatedDex:'DAMM v2',
  strictLpLockTargetPercent:100,
  minimumRecommendedSafetyWork:['Pin and review official Meteora SDK and live program ID','Create the one-time partner config on devnet then mainnet and verify its authority','Run wallet-signed create-pool flow on devnet and verify pool mint and creator','Prove 100% migrated LP is permanently locked and no reserve-drain path exists','Exact transaction simulation and user-visible fees before signing','Test slippage bounds, double graduation, failed RPC, replay, front-running and upgrade controls','Have independent third-party review of launch integration before handling significant public funds'],
  important:'Meteora provides the financial protocol. This repository does not yet contain the audited wallet transaction builder or pool graduation integration. Do not request SOL deposits or claim LP is locked.'
};}
