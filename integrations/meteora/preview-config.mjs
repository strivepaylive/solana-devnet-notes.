/**
 * DEVNET-ONLY, non-transmitting Meteora DBC builder research.
 * This demonstrates the supported official SDK API, creates NO account,
 * sends NO transactions, signs NO user wallet, collects NO SOL, and is NOT
 * part of the deployed Worker. Review pinned dependencies before installation.
 *
 * npm install && npm run preview
 * Do not paste any seed phrases or private keys here.
 */
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  DynamicBondingCurveClient, buildCurveWithMarketCap,
  TokenType,TokenDecimal,TokenAuthorityOption,
  BaseFeeMode,CollectFeeMode,MigrationOption,MigrationFeeOption,ActivationType
} from '@meteora-ag/dynamic-bonding-curve-sdk';

const DBC='dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
const DEVNET='https://api.devnet.solana.com';
const WRAPPED_SOL='So11111111111111111111111111111111111111112';
const OFFICIAL_USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const quoteAsset=process.env.QUOTE_ASSET||'SOL';
if(!['SOL','USDC'].includes(quoteAsset))throw Error('QUOTE_ASSET must be SOL or USDC');
const quoteMint=quoteAsset==='USDC'?OFFICIAL_USDC:WRAPPED_SOL;
const quoteDecimals=quoteAsset==='USDC'?TokenDecimal.SIX:TokenDecimal.NINE;
if(process.env.NETWORK && process.env.NETWORK!=='devnet')throw Error('Preview locked to devnet');
const payerText=process.env.PUBLIC_PAYER;
const claimerText=process.env.PUBLIC_FEE_CLAIMER;
if(!payerText || !claimerText) {
  console.log('Set PUBLIC_PAYER and PUBLIC_FEE_CLAIMER to PUBLIC devnet wallet addresses. No private keys or seed phrases.');
  process.exit(0);
}
const payer=new PublicKey(payerText),feeClaimer=new PublicKey(claimerText);
const connection=new Connection(DEVNET,'confirmed');
const client=new DynamicBondingCurveClient(connection,'confirmed');
const programInfo=await connection.getAccountInfo(new PublicKey(DBC));
if(!programInfo?.executable)throw Error('Official DBC devnet program not verified. Stop.');
const config=Keypair.generate(); // ephemeral for build preview. NOT persisted, cannot launch from this preview.
const proposed=buildCurveWithMarketCap({
  token:{tokenType:TokenType.SPLToken,tokenBaseDecimal:TokenDecimal.SIX,tokenQuoteDecimal:quoteDecimals,tokenAuthorityOption:TokenAuthorityOption.Immutable,totalTokenSupply:1_000_000_000,leftover:0},
  fee:{
    baseFeeParams:{baseFeeMode:BaseFeeMode.FeeSchedulerLinear,feeSchedulerParam:{startingFeeBps:200,endingFeeBps:200,numberOfPeriod:0,totalDuration:0}},
    dynamicFeeEnabled:false,collectFeeMode:CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage:50,poolCreationFee:0,enableFirstSwapWithMinFee:false
  },
  migration:{migrationOption:MigrationOption.MET_DAMM_V2,migrationFeeOption:MigrationFeeOption.FixedBps200,migrationFee:{feePercentage:0,creatorFeePercentage:0}},
  liquidityDistribution:{partnerLiquidityPercentage:0,partnerPermanentLockedLiquidityPercentage:50,creatorLiquidityPercentage:0,creatorPermanentLockedLiquidityPercentage:50},
  lockedVesting:{totalLockedVestingAmount:0,numberOfVestingPeriod:0,cliffUnlockAmount:0,totalVestingDuration:0,cliffDurationFromMigrationTime:0},
  activationType:ActivationType.Timestamp,
  initialMarketCap:20,migrationMarketCap:600
});
const tx=await client.partner.createConfig({
  config:config.publicKey,feeClaimer,leftoverReceiver:feeClaimer,
  payer,quoteMint:new PublicKey(quoteMint),...proposed
});
console.log(JSON.stringify({
  mode:'DEVNET UNSIGNED PREVIEW ONLY',transmitted:false,
  programId:DBC,quoteAsset,quoteMint,quoteDecimals:quoteAsset==='USDC'?6:9,oneTimePlatformFeeBps:200,feeCollectionEnabled:false,oneTimePartnerConfigPlaceholder:config.publicKey.toBase58(),
  payer:payer.toBase58(),feeClaimer:feeClaimer.toBase58(),
  instructions:tx.instructions.map(x=>({programId:x.programId.toBase58(),keys:x.keys.length})),
  feeBps:200,dynamicFee:false,postGraduationFeeBps:200,lpPermanentLockPercent:100,
  note:'Meteora poolCreationFee is a FIXED SOL amount, not a 2% fee. A 2% launch charge requires an independently reviewed, wallet-signed atomic fee + launch transaction. Verify configured migrationQuoteThreshold meets Meteora keeper minimum: 10 SOL or 750 USDC. This preview transmits nothing.'
},null,2));
