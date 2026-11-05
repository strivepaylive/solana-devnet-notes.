export const FEE_DENOMINATOR=1000000n;
export const MOMENTUM_PLATFORM_TRADE_FEE=20000n;
export function formatFeePpm(value) {
  const amount=BigInt(value);
  if(amount<0n||amount>FEE_DENOMINATOR)throw Error('Invalid protocol fee');
  return (Number(amount)*100/Number(FEE_DENOMINATOR)).toFixed(2)+'%';
}
export function platformFeeEstimate(amountAtomic,feePpm=MOMENTUM_PLATFORM_TRADE_FEE){
  if(BigInt(amountAtomic)<0n)throw Error('Negative amount');
  if(BigInt(feePpm)<0n||BigInt(feePpm)>FEE_DENOMINATOR)throw Error('Invalid fee rate');
  return (BigInt(amountAtomic)*BigInt(feePpm)/FEE_DENOMINATOR).toString();
}
export function verifyMomentumPlatformState({platformFeeRate,platformClaimWallet,platformAdminWallet,expectedAdminWallet}){
  const ok=String(platformFeeRate)===String(MOMENTUM_PLATFORM_TRADE_FEE)
    && String(platformClaimWallet)===String(expectedAdminWallet)
    && String(platformAdminWallet)===String(expectedAdminWallet);
  return {ok,message:ok?'On-chain 2% platform trade fee and operator wallet match':'Missing or unexpected on-chain Momentum platform configuration; no 2% platform fee may be claimed.'};
}
