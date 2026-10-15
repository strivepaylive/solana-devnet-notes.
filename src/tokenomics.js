/**
 * Momentum fee POLICY and arithmetic preview. It does not collect, custody,
 * claim or distribute any SOL or tokens. Never display its output as audited.
 */
export const MOMENTUM_TRADING_FEE_BPS = 200;
export const DBC_PROTOCOL_SHARE_BPS = 2000; // 20% of the gross pre-graduation fee
export const DEFAULT_CREATOR_FEE_SHARE_BPS = 5000; // 50% of non-protocol fee
export const DAMM_V2_200BPS_FEE_OPTION = 3;
export const GRADUATION_PROTOCOL_LIQUIDITY_FEE_BPS = 20; // 0.2% of migrated assets, not a SOL transaction fee
export const HOLDER_BURN_AUTOMATION_LIVE = false;

const safeBps = n => Number.isSafeInteger(n) && n >= 0 && n <= 10000;
const bpsDecimal = bps => Number((bps / 100).toFixed(4));

export function validateDistribution(d = {}) {
  const reasons = [];
  for (const field of ['creatorBps','holderBps','buybackBurnBps']) {
    if (!safeBps(d[field])) reasons.push(`${field} must be integer basis points from 0 to 10000`);
  }
  if (!reasons.length && d.creatorBps + d.holderBps + d.buybackBurnBps !== 10000) reasons.push('Creator allocations must total 10000 bps');
  return {valid:!reasons.length,reasons};
}

/** Examples use integer bps to avoid conflating the fee percentage with creator share percentage. */
export function makeFeePreview({creatorFeeShareBps = DEFAULT_CREATOR_FEE_SHARE_BPS,
  distribution = {creatorBps:5000,holderBps:3000,buybackBurnBps:2000}} = {}) {
  const valid = validateDistribution(distribution);
  if (!safeBps(creatorFeeShareBps) || !valid.valid) throw new Error(`Invalid fee policy: ${valid.reasons.join('; ')}`);
  const gross = MOMENTUM_TRADING_FEE_BPS;
  const protocol = gross * DBC_PROTOCOL_SHARE_BPS / 10000;
  const available = gross - protocol;
  const creatorPool = available * creatorFeeShareBps / 10000;
  const partnerPool = available - creatorPool;
  const creator = creatorPool * distribution.creatorBps / 10000;
  const holders = creatorPool * distribution.holderBps / 10000;
  const buybackBurn = creatorPool * distribution.buybackBurnBps / 10000;
  return {
    phase:'bonding-curve',
    grossTradingFeeBps:gross,
    grossTradingFeePercent:bpsDecimal(gross),
    protocolFeeEffectivePercent:bpsDecimal(protocol),
    partnerFeeEffectivePercent:bpsDecimal(partnerPool),
    creatorFeeEffectivePercent:bpsDecimal(creator),
    proposedHolderRewardsEffectivePercent:bpsDecimal(holders),
    proposedBuybackBurnEffectivePercent:bpsDecimal(buybackBurn),
    creatorFeeShareBps, distribution,
    meteoraNativeSplit:'Protocol share and partner/creator share are configurable by DBC. Creator-to-holders/burn allocations are NOT automated by this preview.',
    holderRewardsStatus:'not-built',buybackAndBurnStatus:'not-built',
    postGraduation:'DAMM v2 fee option 3 specifies a 2% pool trading fee, but fee claim rights and partner revenue do not automatically follow the DBC 80/20 split.',
    graduation:'Separate one-time migration: 0.2% of base and quote liquidity goes to the protocol; rent, transactions, optional creator migration fees and pool setup are additional.',
    collectsFunds:false,canExecute:false
  };
}
export const DEFAULT_FEE_PREVIEW = makeFeePreview();
