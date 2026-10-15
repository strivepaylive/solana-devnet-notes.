/** Lightweight public RPC token-account distribution visualisation.
 * Token accounts are NOT always unique holders and do not imply relationships.
 */
export function prepareBubbleMap(mint, largestAccounts, rawSupply, parsedAccounts = []) {
  if (!Array.isArray(largestAccounts) || largestAccounts.length === 0) throw Error('No token-account distribution is available');
  if (!/^\d+$/.test(String(rawSupply)) || BigInt(rawSupply) <= 0n) throw Error('Invalid on-chain token supply');
  const supply = BigInt(rawSupply);
  const entries = largestAccounts.slice(0,20).map((item,i) => {
    if(!item || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(item.address || '') || !/^\d+$/.test(String(item.amount))) throw Error('Invalid token-account result');
    const accountOwner=parsedAccounts[i]?.data?.parsed?.type === 'account' ? parsedAccounts[i]?.data?.parsed?.info?.owner : null;
    const shareBps = Number(BigInt(item.amount)*10000n/supply);
    return {account:item.address,owner:/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(accountOwner||'')?accountOwner:null,sharePercent:+(shareBps/100).toFixed(2),rawAmount:String(item.amount)};
  });
  return {
    chain:'solana',mint,accounts:entries,topAccountsSharePercent:+entries.reduce((x,e)=>x+e.sharePercent,0).toFixed(2),
    ownerEvidence:'same on-chain token account owner only; transfers, coordinated wallets and exchange custody are not analyzed',
    disclaimer:'Bubble sizes represent top token accounts, NOT unique beneficial owners. Public RPC data does not prove developer links, wash trading or criminal activity.',
    source:'Solana getTokenLargestAccounts + getTokenSupply; account owners where available',
    relationshipsVerified:false,commercialBubblemapsAPI:false
  };
}
