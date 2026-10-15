/**
 * Non-transacting creator-launch budget preview.
 * Momentum charges a PROPOSED 2% of the creator's expressly authorized
 * upfront initial-purchase budget. This is separate from DBC trading fees.
 * Meteora's NATIVE creation fee is fixed SOL, not a percentage; this draft
 * must never be represented as already enforceable by Meteora DBC.
 */
export const LAUNCH_PLATFORM_FEE_BPS = 200;
export const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const WSOL_MAINNET_MINT = 'So11111111111111111111111111111111111111112';
export const QUOTE_ASSETS = Object.freeze({
  SOL:Object.freeze({symbol:'SOL',quoteMint:WSOL_MAINNET_MINT,decimals:9,keeperThreshold:'10 SOL'}),
  USDC:Object.freeze({symbol:'USDC',quoteMint:USDC_MAINNET_MINT,decimals:6,keeperThreshold:'750 USDC'})
});
export function quoteAsset(code){
  if(typeof code!=='string'||!Object.hasOwn(QUOTE_ASSETS,code))throw Error('Quote asset must be SOL or USDC');
  return QUOTE_ASSETS[code];
}
function parseBaseUnits(value,decimals){
  if(typeof value!=='string'||value.length>40||!/^(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(value))throw Error('Funding must be a positive decimal string');
  const [whole,fraction='']=value.split('.');
  if(fraction.length>decimals)throw Error(`Funding supports at most ${decimals} decimal places`);
  const units=BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction.padEnd(decimals,'0'))||'0');
  if(units<=0n)throw Error('Positive creator funding is required to apply a 2% launch fee');
  if(units>10n**21n)throw Error('Amount exceeds preview policy');
  return units;
}
function formatUnits(amount,decimals){
  const x=(amount/(10n**BigInt(decimals))).toString();
  const frac=(amount%(10n**BigInt(decimals))).toString().padStart(decimals,'0').replace(/0+$/,'');
  return frac?`${x}.${frac}`:x;
}
export function previewLaunchContribution({asset='SOL',funding}={}){
  const q=quoteAsset(asset);
  const gross=parseBaseUnits(funding,q.decimals);
  // Round launch fee UP by one base unit at most, avoiding under-collection
  const fee=(gross*BigInt(LAUNCH_PLATFORM_FEE_BPS)+9999n)/10000n;
  if(fee>=gross)throw Error('Funding too small after rounding the platform fee');
  const remainder=gross-fee;
  return {
    quoteAsset:q.symbol,quoteMint:q.quoteMint,quoteDecimals:q.decimals,
    fundingGross:formatUnits(gross,q.decimals),
    proposedPlatformCreationFee:formatUnits(fee,q.decimals),
    creatorPurchaseBudgetNet:formatUnits(remainder,q.decimals),
    grossBaseUnits:gross.toString(),feeBaseUnits:fee.toString(),purchaseBudgetBaseUnits:remainder.toString(),
    launchFeeBps:LAUNCH_PLATFORM_FEE_BPS,tradingFeeBps:200,
    chargeMode:'2% of explicitly declared creator-funded launch budget, charged ONCE per launch',
    nativeMeteoraPoolCreationFee:'0 SOL in proposed config (separate native fixed-fee setting)',
    graduationKeeperMinimum:q.keeperThreshold,
    platformFeeEnforced:false,transactionPrepared:false,collectingFunds:false,
    nextRequirement:'An audited, wallet-signed atomic fee-and-create/initial-buy transaction; verified on-chain treasury and config. Never prepay to a website address.',
    important:'For SOL-quoted and USDC-quoted launches, all Solana rent and network fees still require SOL. Launch funding is NOT the total SOL wallet requirement.'
  };
}
