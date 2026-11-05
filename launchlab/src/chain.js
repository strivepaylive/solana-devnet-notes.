import {
  Connection, clusterApiUrl, PublicKey, Keypair
} from '@solana/web3.js';
import {NATIVE_MINT, TOKEN_PROGRAM_ID, getMint} from '@solana/spl-token';
import {
  Raydium, TxVersion, DEVNET_PROGRAM_ID, DEV_API_URLS,
  LaunchpadConfig, getPdaLaunchpadConfigId, getPdaLaunchpadPoolId
} from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import {Buffer} from 'buffer';
import {QUOTES, DEVNET_USDC, isPublicKey, requireDevnetNetwork, toAtomic} from './validation.js';

globalThis.Buffer ||= Buffer;
const endpoint = clusterApiUrl('devnet');
requireDevnetNetwork(endpoint);
export const connection = new Connection(endpoint, 'confirmed');
const programId = DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM;
const quoteMints = {
  SOL: NATIVE_MINT,
  USDC: new PublicKey(DEVNET_USDC)
};
let wallet = null;
let sdk = null;

function assertProgram() {
  if (!(programId instanceof PublicKey)) throw Error('Raydium devnet LaunchLab program ID unavailable in this SDK version.');
}
function quoteMint(quote) {
  const mint = quoteMints[quote];
  if (!mint) throw Error('Quote must be SOL or devnet USDC.');
  return mint;
}
function chooseProvider() {
  const candidates = [
    globalThis.phantom?.solana,
    globalThis.solflare,
    globalThis.backpack,
    globalThis.solana
  ];
  return candidates.find(p => p && typeof p.connect === 'function' && typeof p.signAllTransactions === 'function') || null;
}
export async function connect() {
  const provider = chooseProvider();
  if (!provider) throw Error('A wallet with signAllTransactions is required. Open this page in Phantom, Solflare or another compatible wallet browser.');
  const result = await provider.connect();
  const publicKey = result?.publicKey || provider.publicKey;
  if (!publicKey || !isPublicKey(publicKey.toBase58())) throw Error('Wallet returned an invalid public key.');
  wallet = { provider, publicKey };
  sdk = null;
  return publicKey.toBase58();
}
export async function disconnect() {
  await wallet?.provider?.disconnect?.();
  wallet = null;
  sdk = null;
}
export function connectedAddress() { return wallet?.publicKey?.toBase58() || null; }

async function getSdk() {
  if (!wallet) throw Error('Connect your Solana devnet wallet first.');
  if (sdk) return sdk;
  const provider = wallet.provider;
  sdk = await Raydium.load({
    connection,
    owner: wallet.publicKey,
    signAllTransactions: async transactions => provider.signAllTransactions(transactions),
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: false,
    blockhashCommitment: 'confirmed',
    urlConfigs: {
      ...DEV_API_URLS,
      BASE_HOST: 'https://api-v3-devnet.raydium.io',
      OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
      SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
      CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position'
    }
  });
  return sdk;
}
async function verifyProgram() {
  assertProgram();
  const account = await connection.getAccountInfo(programId);
  if (!account?.executable) throw Error('Expected Raydium devnet LaunchLab program is not executable at this address.');
}
export async function verifyConfig(quote, address = '') {
  await verifyProgram();
  const mint = quoteMint(quote);
  if (quote === 'USDC' && !address.trim()) throw Error('Devnet USDC requires a Raydium configuration account. SOL can use the default derived config.');
  const key = address.trim()
    ? new PublicKey(address.trim())
    : getPdaLaunchpadConfigId(programId, mint, 0, 0).publicKey;
  const account = await connection.getAccountInfo(key);
  if (!account || !account.owner.equals(programId)) throw Error('Launch configuration missing or not owned by the official Raydium devnet program.');
  const info = LaunchpadConfig.decode(account.data);
  if (!info.mintB.equals(mint)) throw Error('On-chain launch config quote mint does not match the selected asset.');
  const token = await getMint(connection, mint);
  if (token.decimals !== QUOTES[quote].decimals) throw Error('On-chain quote precision differs from the expected asset.');
  return {
    configId: key.toBase58(), quote, quoteMint: mint.toBase58(),
    decimals: token.decimals,
    platformNote: 'Default Raydium platform; Momentum 2% fees are NOT configured or collected.',
    programId: programId.toBase58(), info
  };
}
export async function createToken(input) {
  const raydium = await getSdk();
  const config = await verifyConfig(input.quote, input.configId || '');
  const pair = Keypair.generate();
  const {extInfo, execute} = await raydium.launchpad.createLaunchpad({
    programId,
    mintA: pair.publicKey,
    name: input.name,
    symbol: input.symbol,
    uri: input.metadataUrl,
    decimals: 6,
    mintBDecimals: config.decimals,
    mintBProgram: TOKEN_PROGRAM_ID,
    configId: new PublicKey(config.configId),
    configInfo: config.info,
    migrateType: 'cpmm',
    txVersion: TxVersion.V0,
    slippage: new BN(100),
    buyAmount: new BN(1000),
    createOnly: true,
    extraSigners: [pair]
  });
  // Raydium SDK handles mint's one-time extra signer. Transaction approval stays in wallet.
  const submission = await execute({sequentially: true, sendAndConfirm: true});
  return {
    mint: pair.publicKey.toBase58(),
    pool: extInfo?.poolId?.toBase58?.() || null,
    submission
  };
}

export async function inspectPool(mintAddress, quote) {
  await verifyProgram();
  if (!isPublicKey(mintAddress)) throw Error('Invalid Solana mint address.');
  const mint = new PublicKey(mintAddress);
  const pool = getPdaLaunchpadPoolId(programId, mint, quoteMint(quote)).publicKey;
  const raydium = await getSdk();
  const info = await raydium.launchpad.getRpcPoolInfo({poolId: pool});
  if (!info.mintB.equals(quoteMint(quote))) throw Error('Pool quote mint mismatch.');
  const mintAccount = await getMint(connection, mint);
  if (mintAccount.decimals > 12) throw Error('Unsupported token decimal precision.');
  return {
    mint, pool, info, decimals: mintAccount.decimals,
    platform: info.platformId.toBase58(),
    status: String(info.status?.toString?.() ?? 'unknown')
  };
}
export async function tradeToken({mintAddress, quote, side, amount}) {
  const raydium = await getSdk();
  const pool = await inspectPool(mintAddress, quote);
  const inputDecimals = side === 'buy' ? QUOTES[quote].decimals : pool.decimals;
  const atomic = new BN(toAtomic(amount, inputDecimals));
  const params = {
    programId, mintA: pool.mint, mintAProgram: TOKEN_PROGRAM_ID,
    mintB: quoteMint(quote), mintBProgram: TOKEN_PROGRAM_ID,
    poolInfo: pool.info, configInfo: pool.info.configInfo,
    txVersion: TxVersion.V0, slippage: new BN(100)
  };
  const built = side === 'buy'
    ? await raydium.launchpad.buyToken({...params, buyAmount: atomic})
    : side === 'sell'
      ? await raydium.launchpad.sellToken({...params, sellAmount: atomic})
      : (() => {throw Error('Unknown trading direction');})();
  return {pool: pool.pool.toBase58(), submission: await built.execute({sendAndConfirm: true})};
}
