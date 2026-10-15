/** Research-only strict gate. This module cannot transmit transactions. */
import {getQuoteTemplate,validateMeteoraTemplate,METEORA_DBC_PROGRAM} from './mainnet-plan.js';
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function checkDevnetLaunch(input={}){
  const failures=[]; const fail=x=>failures.push(x);
  if(input.network!=='devnet')fail('Devnet is required until independent review.');
  for(const key of ['wallet','config','mint'])if(!BASE58.test(String(input[key]||'')))fail('Invalid public '+key+' address.');
  let policy;
  try{policy=validateMeteoraTemplate(getQuoteTemplate(String(input.quote||'')));}
  catch{fail('Only SOL/USDC quote assets are supported.');}
  if(policy&&!policy.approvedForResearch)fail(...policy.violations);
  if(input.dbcProgramOwner!==METEORA_DBC_PROGRAM)fail('Invalid Meteora configuration owner.');
  if(input.dbcProgramExecutable!==true)fail('DBC program must be executable.');
  if(input.configExists!==true)fail('DBC config must exist and decode.');
  if(input.quoteMintMatches!==true)fail('Quote mint must match selected token.');
  if(input.lpLockVerified!==true)fail('100% permanent liquidity lock is not verified.');
  if(input.mintAuthoritySafe!==true)fail('Mint authority unverified.');
  if(input.freezeAuthoritySafe!==true)fail('Freeze authority unverified.');
  if(input.feeRecipientVerified!==true)fail('Fee recipient or partner authority unverified.');
  if(input.transactionSimulationPassed!==true)fail('Fresh exact transaction simulation required.');
  return {preflightPassed:failures.length===0,transactionSendingEnabled:false,failures,message:'Research-only gate; no funds or token launches authorized.'};
}
