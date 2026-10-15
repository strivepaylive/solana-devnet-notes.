/**
 * Momentum non-custodial launch readiness policy.
 * IMPORTANT: these are off-chain PRE-FLIGHT controls, NOT a Solana program.
 * Never use this module as evidence that funds are locked or swaps are safe.
 * This release intentionally implements no transaction-signing/building endpoints.
 */
export const MAINNET_TRADING_ENABLED = false;
export const MAINNET_PROGRAM_ID = null;
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
export const MIN_LP_LOCK_BPS = 10000; // stricter than a 75% lock; NOT a 75% rug reduction claim
export const MAX_TRADE_FEE_BPS = 200;

function whole(x, min, max) { return Number.isSafeInteger(x) && x >= min && x <= max; }

/** Proposed launch template policy; needs equivalent immutable ON-CHAIN enforcement. */
export function validateLaunchDraft(config = {}) {
  const violations = [];
  const bad = (message) => violations.push(message);
  if (config.chain !== 'solana') bad('Only Solana launches are in scope');
  if (config.quoteMint !== WRAPPED_SOL_MINT) bad('Only wrapped SOL quote mint is permitted by the beta policy');
  if (config.tokenProgram !== 'spl-token') bad('Token-2022 extensions and arbitrary transfer hooks need separate review');
  if (!whole(config.tokenDecimals, 0, 9)) bad('Token decimals must be a supported integer');
  if (!whole(config.tokenSupply, 1, Number.MAX_SAFE_INTEGER)) bad('Supply must be a positive fixed safe integer');
  if (config.mintAuthorityRevoked !== true) bad('Mint authority must be provably revoked before public trading');
  if (config.freezeAuthorityRevoked !== true) bad('Freeze authority must be provably revoked before public trading');
  if (config.mutableMetadata !== false) bad('Metadata must be immutable under strict beta policy');
  if (!whole(config.buyFeeBps, 0, MAX_TRADE_FEE_BPS) || !whole(config.sellFeeBps, 0, MAX_TRADE_FEE_BPS)) bad('Trading fees must be explicit and at most 2% per side');
  if (!whole(config.graduationQuoteLamports, 1, Number.MAX_SAFE_INTEGER)) bad('Graduation target must be an immutable positive integer of lamports');
  if (config.slippageCheckOnChain !== true) bad('Every swap must enforce minOut or maxIn and deadline on-chain');
  if (config.migrationAtomicity !== true) bad('Graduation must guarantee exactly-once migration and reserve conservation on-chain');
  if (config.migrationRecipient !== 'program-lock-escrow') bad('Graduated liquidity must route to verified program-controlled lock escrow');
  const allocation = config.lpAllocation || {};
  const entries = ['creatorLockedBps','partnerLockedBps','creatorUnlockedBps','partnerUnlockedBps'];
  if (entries.some(key=>!whole(allocation[key],0,10000))) bad('LP split must have four integer basis-point fields');
  else {
    const total = entries.reduce((s,key)=>s+allocation[key],0);
    if(total!==10000) bad('LP allocations must add to 100%');
    if(allocation.creatorLockedBps+allocation.partnerLockedBps<MIN_LP_LOCK_BPS) bad('100% of graduated LP ownership must be locked under strict beta policy');
  }
  if (config.creatorCanWithdrawReserve !== false || config.adminCanWithdrawReserve !== false) bad('Neither creator nor operator can withdraw curve reserves');
  if (config.upgradeAuthorityControlled !== true) bad('Program upgrade authority must be transparently controlled and reviewed');
  return {passesDraftPolicy:violations.length===0,violations,notice:'Policy validation is off-chain only. This does not enable trading or attest to any deployed protocol.'};
}

export function getLaunchReadiness() {
  return {
    network:'solana-mainnet-beta',
    mode:'read-only-beta',
    acceptsUserFunds:false,
    tradingEnabled:MAINNET_TRADING_ENABLED,
    programId:MAINNET_PROGRAM_ID,
    features:{
      tokenDiscovery:'implemented',
      identityScreening:'implemented-advisory',
      freePromotions:'implemented-subject-to-config',
      bondingCurve:'not-implemented',
      buySell:'disabled',
      graduation:'not-implemented',
      liquidityLock:'not-implemented',
      migration:'not-implemented',
      mevProtection:'not-implemented',
      mainnetAudit:'not-completed'
    },
    safetyRequirements:[
      'Integrate and verify an existing audited Solana bonding-curve protocol on devnet',
      'Enforce swap minOut/maxIn, fees, reserve and authorization invariants at the program level',
      'Verify immutable graduation threshold and exactly-once DEX migration',
      'Verify on-chain LP lock escrow ownership and no unauthorized reserve withdrawal path',
      'Review upgrade authority, timelocks, external integrations, incident response and audit results',
      'Run adversarial and property-based tests, then an independently reviewed capped launch'
    ],
    warning:'No Momentum bonding-curve or graduation contract has been deployed. Never deposit SOL into a purported Momentum launch pool.'
  };
}

export const TRANSACTION_ROUTES = new Set(['/api/launch','/api/trade','/api/buy','/api/sell','/api/graduate','/api/graduation','/api/migrate','/api/liquidity','/api/withdraw','/api/lock']);
