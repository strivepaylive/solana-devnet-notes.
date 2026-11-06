/**
 * Deterministic on-chain risk label logic.
 * "No detected critical signals" is NEVER equivalent to safe/verified.
 */
export function scoreMintRisk(item={}){
 const signals=[];
 const add=(severity,message)=>signals.push({severity,message});
 if(item.mintAuthority) add('high','Mint authority is active: additional tokens may be minted.');
 else add('info','Mint authority revoked (one risk reduced).');
 if(item.freezeAuthority) add('high','Freeze authority is active: token accounts may be frozen.');
 else add('info','Freeze authority revoked (one risk reduced).');
 if(item.token2022) add('unknown','Token-2022 extension risk requires further review.');
 if(item.transferFee) add('high','Token has a programmable transfer fee.');
 if(item.permanentDelegate) add('high','Permanent delegate can control token balances.');
 if(item.concentrationBps===null || item.concentrationBps===undefined)
   add('unknown','Top-token-account concentration not available.');
 else {
   const n=Math.max(0,Math.min(100,item.concentrationBps/100));
   add(n>=80?'caution':'info','Top 10 token accounts hold '+n.toFixed(1)+'% of minted supply (includes possible pool vaults).');
 }
 add('unknown','Liquidity lock, creator identity and MEV/sandwich exposure are not verified.');
 const status=signals.some(x=>x.severity==='high')?'warning'
   : signals.some(x=>x.severity==='caution')?'review':'unverified';
 return {status,signals,disclaimer:'Risk screening only; never a safety certification.'};
}
