import {
  Connection, clusterApiUrl, PublicKey, Keypair
} from '@solana/web3.js';
import {NATIVE_MINT,TOKEN_PROGRAM_ID,getMint} from '@solana/spl-token';
import {
  Raydium, TxVersion, DEVNET_PROGRAM_ID, DEV_API_URLS,
  LaunchpadConfig, PlatformConfig,
  getPdaLaunchpadConfigId, getPdaLaunchpadPoolId, getPdaPlatformId
} from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import {Buffer} from 'buffer';
import {QUOTES,DEVNET_USDC,isPublicKey,requireDevnetNetwork,toAtomic} from './validation.js';
import {MOMENTUM_PLATFORM_TRADE_FEE,verifyMomentumPlatformState} from './fees.js';

globalThis.Buffer ||= Buffer;
const endpoint=clusterApiUrl('devnet');
requireDevnetNetwork(endpoint);
export const connection=new Connection(endpoint,'confirmed');
const programId=DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM;
const quoteMints={SOL:NATIVE_MINT,USDC:new PublicKey(DEVNET_USDC)};
const operatorAddress=import.meta.env.VITE_MOMENTUM_OPERATOR_WALLET||'';
let wallet=null,sdk=null;
const operator=()=>isPublicKey(operatorAddress)?new PublicKey(operatorAddress):null;

function assertProgram(){
 if(!(programId instanceof PublicKey))throw Error('This SDK has no expected Raydium devnet LaunchLab program.');
}
function quoteMint(quote){
 const mint=quoteMints[quote];if(!mint)throw Error('Quote must be SOL or devnet USDC.');
 return mint;
}
function chooseProvider(){
 return [
  globalThis.phantom?.solana,globalThis.solflare,globalThis.backpack,globalThis.solana
 ].find(p=>p&&typeof p.connect==='function'&&typeof p.signAllTransactions==='function')||null;
}
export async function connect(){
 const provider=chooseProvider();
 if(!provider)throw Error('Wallet with transaction signing not detected. Open this site in Phantom, Solflare or another compatible Solana wallet browser.');
 const result=await provider.connect();
 const publicKey=result?.publicKey||provider.publicKey;
 if(!publicKey||!isPublicKey(publicKey.toBase58()))throw Error('Wallet returned an invalid Solana public key.');
 wallet={provider,publicKey};sdk=null;
 return publicKey.toBase58();
}
export async function disconnect(){
 await wallet?.provider?.disconnect?.();wallet=null;sdk=null;
}
export function connectedAddress(){return wallet?.publicKey?.toBase58()||null;}

async function getSdk(){
 if(!wallet)throw Error('Connect your devnet wallet first.');
 if(sdk)return sdk;
 const provider=wallet.provider;
 sdk=await Raydium.load({
  connection,owner:wallet.publicKey,
  signAllTransactions:async transactions=>provider.signAllTransactions(transactions),
  cluster:'devnet',disableFeatureCheck:true,disableLoadToken:false,blockhashCommitment:'confirmed',
  urlConfigs:{
   ...DEV_API_URLS,BASE_HOST:'https://api-v3-devnet.raydium.io',
   OWNER_BASE_HOST:'https://owner-v1-devnet.raydium.io',
   SWAP_HOST:'https://transaction-v1-devnet.raydium.io',
   CPMM_LOCK:'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position'
  }
 });
 return sdk;
}
async function verifyProgram(){
 assertProgram();
 const account=await connection.getAccountInfo(programId);
 if(!account?.executable)throw Error('Official Raydium devnet LaunchLab program could not be verified as executable.');
}
export async function verifyConfig(quote,address=''){
 await verifyProgram();
 const mint=quoteMint(quote);
 if(quote==='USDC'&&!address.trim())throw Error('Devnet USDC requires a Raydium on-chain launch configuration address.');
 const key=address.trim()?new PublicKey(address.trim()):getPdaLaunchpadConfigId(programId,mint,0,0).publicKey;
 const account=await connection.getAccountInfo(key);
 if(!account||!account.owner.equals(programId))throw Error('Launch config does not exist or has the wrong program owner.');
 const info=LaunchpadConfig.decode(account.data);
 if(!info.mintB.equals(mint))throw Error('On-chain LaunchLab quote mint differs from your selection.');
 const token=await getMint(connection,mint);
 if(token.decimals!==QUOTES[quote].decimals)throw Error('On-chain quote decimals differ from expected.');
 return {
  configId:key.toBase58(),quote,quoteMint:mint.toBase58(),decimals:token.decimals,info,
  programId:programId.toBase58(),
  platformNote:'Momentum 2% fee requires an operator-owned, verified platform config; if missing, Raydium default applies.'
 };
}
export async function getMomentumPlatform(){
 const expected=operator();
 if(!expected)return {ok:false,message:'Operator public wallet is not configured. No Momentum platform fee is active.'};
 await verifyProgram();
 const key=getPdaPlatformId(programId,expected).publicKey;
 const account=await connection.getAccountInfo(key);
 if(!account||!account.owner.equals(programId))return {ok:false,message:'Operator PlatformConfig has not been found on devnet. No Momentum 2% fee is active.',platformId:key.toBase58()};
 const info=PlatformConfig.decode(account.data);
 const check=verifyMomentumPlatformState({
  platformFeeRate:info.feeRate?.toString(),
  platformClaimWallet:info.platformClaimFeeWallet?.toBase58?.(),
  platformAdminWallet:expected.toBase58(),
  expectedAdminWallet:expected.toBase58()
 });
 if(!check.ok)return {ok:false,message:check.message,platformId:key.toBase58()};
 return {
  ok:true,platformId:key.toBase58(),claimWallet:info.platformClaimFeeWallet.toBase58(),
  feePpm:info.feeRate.toString(),burnScale:info.burnScale.toString(),
  message:'2% Raydium LaunchLab platform trading fee verified on devnet'
 };
}
export async function createMomentumPlatform(cpmmConfigString){
 if(!wallet||!operator()||!wallet.publicKey.equals(operator()))throw Error('Connected wallet must match the preconfigured Momentum operator public key.');
 if(!isPublicKey(cpmmConfigString))throw Error('Official devnet Raydium CPMM config ID is required.');
 await verifyProgram();
 const cpmmConfig=new PublicKey(cpmmConfigString);
 const cpmm=await connection.getAccountInfo(cpmmConfig);
 if(!cpmm||!cpmm.owner.equals(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM))
  throw Error('CPMM config is not owned by the official Raydium devnet CPMM program.');
 const existing=await getMomentumPlatform();
 if(existing.ok)throw Error('Verified Momentum operator config already exists. Avoid recreating.');
 const platformId=getPdaPlatformId(programId,wallet.publicKey).publicKey;
 if(await connection.getAccountInfo(platformId))
  throw Error('An operator platform config already exists but its fee/recipient differs. Fix it through an audited owner update flow, not a new creation.');
 const raydium=await getSdk();
 const {execute}=await raydium.launchpad.createPlatformConfig({
  programId,platformAdmin:wallet.publicKey,platformClaimFeeWallet:wallet.publicKey,
  platformLockNftWallet:wallet.publicKey,platformVestingWallet:PublicKey.default,
  cpConfigId:cpmmConfig,transferFeeExtensionAuth:wallet.publicKey,
  creatorFeeRate:new BN(0),feeRate:new BN(MOMENTUM_PLATFORM_TRADE_FEE.toString()),
  migrateCpLockNftScale:{
   platformScale:new BN(0),
   creatorScale:new BN(0),
   burnScale:new BN(1000000)
  },
  name:'Momentum',web:location.origin,img:new URL('./logo.svg',location.href).toString(),
  txVersion:TxVersion.V0
 });
 const receipt=await execute({sendAndConfirm:true});
 const check=await getMomentumPlatform();
 if(!check.ok)throw Error('Submitted devnet platform config but its account could not yet be verified. Check on-chain result before using it.');
 return {platformId:check.platformId,receipt,verified:true};
}
export async function createToken(input){
 const raydium=await getSdk();
 const config=await verifyConfig(input.quote,input.configId||'');
 const platform=await getMomentumPlatform().catch(()=>({ok:false}));
 const pair=Keypair.generate();
 const extras=platform.ok?{platformId:new PublicKey(platform.platformId)}:{};
 const {extInfo,execute}=await raydium.launchpad.createLaunchpad({
  programId,mintA:pair.publicKey,
  name:input.name,symbol:input.symbol,uri:input.metadataUrl,decimals:6,
  mintBDecimals:config.decimals,mintBProgram:TOKEN_PROGRAM_ID,
  configId:new PublicKey(config.configId),configInfo:config.info,
  migrateType:'cpmm',txVersion:TxVersion.V0,slippage:new BN(100),
  buyAmount:new BN(1000),createOnly:true,extraSigners:[pair],...extras
 });
 // All Solana spending is approved by the connected wallet. No secret phrase enters Momentum.
 const submission=await execute({sequentially:true,sendAndConfirm:true});
 return {mint:pair.publicKey.toBase58(),pool:extInfo?.poolId?.toBase58?.()||null,submission,platformUsed:platform.ok?'Momentum operator config':'Raydium default'};
}
export async function inspectPool(mintAddress,quote){
 await verifyProgram();
 if(!isPublicKey(mintAddress))throw Error('Invalid Solana mint public key.');
 const mint=new PublicKey(mintAddress);
 const pool=getPdaLaunchpadPoolId(programId,mint,quoteMint(quote)).publicKey;
 const raydium=await getSdk();
 const info=await raydium.launchpad.getRpcPoolInfo({poolId:pool});
 if(!info.mintB.equals(quoteMint(quote)))throw Error('On-chain pool quote mint differs from selected asset.');
 const mintAccount=await getMint(connection,mint);
 if(mintAccount.decimals>12)throw Error('Token precision is unsupported in this devnet workspace.');
 const platform=await getMomentumPlatform().catch(()=>({ok:false}));
 return {
  mint,pool,info,decimals:mintAccount.decimals,
  platform:info.platformId.toBase58(),
  momentumFeeVerified:!!(platform.ok&&info.platformId.toBase58()===platform.platformId),
  status:String(info.status?.toString?.()??'unknown')
 };
}
export async function tradeToken({mintAddress,quote,side,amount}){
 const raydium=await getSdk();
 const pool=await inspectPool(mintAddress,quote);
 const decimals=side==='buy'?QUOTES[quote].decimals:pool.decimals;
 const atomic=new BN(toAtomic(amount,decimals));
 const params={
  programId,mintA:pool.mint,mintAProgram:TOKEN_PROGRAM_ID,
  mintB:quoteMint(quote),mintBProgram:TOKEN_PROGRAM_ID,
  poolInfo:pool.info,configInfo:pool.info.configInfo,
  txVersion:TxVersion.V0,slippage:new BN(100)
 };
 const built=side==='buy'
  ?await raydium.launchpad.buyToken({...params,buyAmount:atomic})
  :side==='sell'
   ?await raydium.launchpad.sellToken({...params,sellAmount:atomic})
   :(()=>{throw Error('Unsupported trade direction.');})();
 return {pool:pool.pool.toBase58(),submission:await built.execute({sendAndConfirm:true})};
}

// Local proof of key control, not server-verified authentication or a persistent verified badge.
export async function proveWalletControl(){
 if(!wallet)throw Error('Connect wallet before signing.');
 if(typeof wallet.provider.signMessage!=='function')throw Error('Wallet has no message-signing feature.');
 const random=new Uint8Array(16);crypto.getRandomValues(random);
 const challenge='Momentum devnet local profile proof\nWallet: '+wallet.publicKey.toBase58()+
 '\nOrigin: '+location.origin+'\nNonce: '+Array.from(random,b=>b.toString(16).padStart(2,'0')).join('')+
 '\nThis signature does not authorize a payment.';
 const bytes=new TextEncoder().encode(challenge);
 const reply=await wallet.provider.signMessage(bytes,'utf8');
 const signature=reply?.signature;
 if(!(signature instanceof Uint8Array)||signature.length!==64)throw Error('Wallet returned an invalid message signature.');
 try{
  const publicKey=await crypto.subtle.importKey('raw',wallet.publicKey.toBytes(),{name:'Ed25519'},false,['verify']);
  const verified=await crypto.subtle.verify('Ed25519',publicKey,signature,bytes);
  if(!verified)throw Error('Signature did not match the connected wallet.');
  return {verified:true,address:wallet.publicKey.toBase58()};
 }catch(error){throw Error('Local signature verification could not be completed: '+String(error.message||error))}
}
