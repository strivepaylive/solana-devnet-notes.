// Production configuration is deliberately separate from the existing devnet SDK.
export const SOLANA_MAINNET_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const SOLANA_MAINNET_USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const MAINNET_ASSETS=Object.freeze({SOL:Object.freeze({symbol:'SOL',decimals:9}),USDC:Object.freeze({symbol:'USDC',decimals:6,mint:SOLANA_MAINNET_USDC})});
export function validateMainnetRpc(endpoint){
 try{const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||!url.hostname.includes('.'))return false;
 const host=url.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='127.0.0.1'||host==='0.0.0.0'||host==='::1'||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('172.16.'))return false;
 return true;}catch{return false}
}
export function assertMainnetIdentity({genesisHash,rpcEndpoint}){
 if(!validateMainnetRpc(rpcEndpoint))throw Error('A secure production RPC endpoint is required.');
 if(genesisHash!==SOLANA_MAINNET_GENESIS)throw Error('RPC is not verified Solana mainnet-beta.');
 return true;
}
export function verifyQuoteGuard({inputAtomic,estimatedOutputAtomic,minOutputAtomic,feeAtomic,networkFeeAtomic,slippageBps,quoteAgeMs}){
 for(const n of [inputAtomic,estimatedOutputAtomic,minOutputAtomic,feeAtomic,networkFeeAtomic])if(!/^\d+$/.test(String(n)))throw Error('Quote contains an invalid atomic amount.');
 const input=BigInt(inputAtomic),output=BigInt(estimatedOutputAtomic),minimum=BigInt(minOutputAtomic),fee=BigInt(feeAtomic),network=BigInt(networkFeeAtomic);
 if(input<=0n||output<=0n||minimum<=0n||minimum>output||fee<0n||network<0n)throw Error('Invalid quote amounts.');
 if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>1000)throw Error('Slippage exceeds permitted bounds.');
 if(!Number.isFinite(quoteAgeMs)||quoteAgeMs<0||quoteAgeMs>15000)throw Error('Quote expired; request a new price.');
 if(minimum*10000n<output*BigInt(10000-slippageBps))throw Error('Minimum output violates slippage limit.');
 return Object.freeze({valid:true,totalInputAtomic:(input+fee+network).toString()});
}
