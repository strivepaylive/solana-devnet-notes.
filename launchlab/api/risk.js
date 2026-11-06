import { Connection, PublicKey } from '@solana/web3.js';
import {
 TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
 unpackMint, getTransferFeeConfig, getPermanentDelegate,
} from '@solana/spl-token';
import {scoreMintRisk} from '../src/risk-score.js';

const RPC={mainnet:'https://api.mainnet-beta.solana.com',devnet:'https://api.devnet.solana.com'};
const LIMIT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');
  const mintString=String(req.query?.mint||'').trim();
  const network=String(req.query?.network||'mainnet');
  if(!LIMIT.test(mintString)||!Object.hasOwn(RPC,network))return res.status(400).json({error:'Invalid mint or network.'});
  try{
    const connection=new Connection(RPC[network],{commitment:'confirmed',disableRetryOnRateLimit:true});
    const mintKey=new PublicKey(mintString);
    const account=await connection.getAccountInfo(mintKey,'confirmed');
    if(!account) return res.status(200).json({mint:mintString,network,status:'unverified',
      signals:[{severity:'unknown',message:'Mint account unavailable on this network.'}],checkedAt:new Date().toISOString()});
    if(!account.owner.equals(TOKEN_PROGRAM_ID)&&!account.owner.equals(TOKEN_2022_PROGRAM_ID))
      return res.status(200).json({mint:mintString,network,status:'warning',
        signals:[{severity:'high',message:'Address is not owned by either standard SPL token program.'}],checkedAt:new Date().toISOString()});
    const mint=unpackMint(mintKey,account,account.owner);
    let concentrationBps=null;
    try{
      const list=await connection.getTokenLargestAccounts(mintKey,'confirmed');
      const supply=BigInt(mint.supply.toString());
      if(supply>0n){
        let summed=0n;
        for(const t of (list.value||[]).slice(0,10))summed+=BigInt(t.amount||'0');
        concentrationBps=Number(summed*10000n/supply);
      }
    }catch{} // unknown stays unknown; never turn a provider outage into a green label.
    const program2022=account.owner.equals(TOKEN_2022_PROGRAM_ID);
    const assessment=scoreMintRisk({
      mintAuthority:mint.mintAuthority?.toBase58()||null,
      freezeAuthority:mint.freezeAuthority?.toBase58()||null,
      token2022:program2022,
      transferFee:program2022?!!getTransferFeeConfig(mint):false,
      permanentDelegate:program2022?!!getPermanentDelegate(mint):false,
      concentrationBps,
      supply:mint.supply.toString()
    });
    return res.status(200).json({
      mint:mintString,network,checkedAt:new Date().toISOString(),
      ...assessment,
      decimals:mint.decimals,tokenProgram:account.owner.toBase58(),
      supplyAtomic:mint.supply.toString(),concentrationBps,
      mintAuthority:mint.mintAuthority?.toBase58()||null,
      freezeAuthority:mint.freezeAuthority?.toBase58()||null,
      limitations:['Top 10 token accounts can include liquidity pool vaults and do not identify related beneficial owners.','Liquidity locks, deployer history, blacklist/transfer hooks and metadata identity have not been independently verified.','Risk signals are not a guarantee against scams or price losses.']
    });
  }catch(e){
    return res.status(503).json({error:'On-chain risk check unavailable',detail:String(e.message||'RPC outage').slice(0,140),
      status:'unverified',checkedAt:new Date().toISOString()});
  }
}
