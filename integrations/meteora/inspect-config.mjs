/** Read-only decoder of an existing DBC pool config. Never sign or transfer. */
import {Connection,PublicKey} from '@solana/web3.js';
import {DynamicBondingCurveClient} from '@meteora-ag/dynamic-bonding-curve-sdk';
const network=process.env.NETWORK==='mainnet'?'mainnet':'devnet';
const programId='dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
const rpc=network==='mainnet'?'https://api.mainnet-beta.solana.com':'https://api.devnet.solana.com';
const address=process.env.PUBLIC_CONFIG;
if(!address){console.log('Set PUBLIC_CONFIG to a deployed DBC config address to inspect. Defaults to devnet.');process.exit(0)}
const conn=new Connection(rpc,'confirmed'), key=new PublicKey(address);
const account=await conn.getAccountInfo(key);
if(!account || account.owner.toBase58()!==programId)throw Error('Account is missing or NOT owned by the official DBC program.');
const client=new DynamicBondingCurveClient(conn,'confirmed');
const state=await client.state.getPoolConfig(key);
if(!state)throw Error('DBC config was not decoded; no safety conclusion can be made.');
console.log('Read-only Meteora DBC config state:',state);
console.log('Before use, independently verify frozen fee params, fee claimer, authority, graduation, locked LP, and creator permission restrictions.');
