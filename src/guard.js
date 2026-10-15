// Isolation of impersonation rules enables testing and independent audits.
// The canonical registry MUST be operator-curated after independent proof.
const substitutions = { '0':'o','1':'l','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i','|':'l','і':'i','о':'o','а':'a','е':'e','р':'p','с':'c','х':'x','у':'y','ј':'j','ν':'v','α':'a' };
export function normalized(input) {
  return String(input || '').normalize('NFKC').toLowerCase()
    .replace(/./gu, char => substitutions[char] || char)
    .replace(/[^a-z0-9]/g,'');
}
export function editDistance(a,b) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length,b.length);
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    let corner=prev[0];prev[0]=i;
    for(let j=1;j<=b.length;j++) {
      const old=prev[j];
      prev[j]=Math.min(prev[j]+1,prev[j-1]+1,corner+(a[i-1]===b[j-1]?0:1));
      corner=old;
    }
  }
  return prev[b.length];
}
// Do NOT assert ownership/legitimacy based on the name or symbol alone.
export function evaluateIdentity(candidate, registry) {
  const name=normalized(candidate.name),symbol=normalized(candidate.symbol);
  if(!name||!symbol) return {status:'review', reason:'Incomplete token metadata'};
  for(const item of registry) {
    if(item.chain !== candidate.chain || item.mint === candidate.mint) continue;
    const n=normalized(item.name),s=normalized(item.symbol);
    if(symbol===s && name===n) return {status:'blocked',reason:`Exact protected-brand impersonation: ${item.name} (${item.symbol})`,officialMint:item.mint};
    if(symbol===s) return {status:'review',reason:`Symbol conflicts with protected asset ${item.symbol}`,officialMint:item.mint};
    // The name can be common vocabulary; possible collisions are review, not permanent bans.
    if(name===n || (name.length>=6 && n.length>=6 && editDistance(name,n)<=1))
      return {status:'review',reason:`Possible lookalike of ${item.name}`,officialMint:item.mint};
    if(s.length>=4 && symbol.length>=4 && editDistance(symbol,s)===1)
      return {status:'review',reason:`Potential ticker lookalike of ${item.symbol}`,officialMint:item.mint};
  }
  return {status:'unverified',reason:'No known protected-brand match; identity not verified'};
}
export function evaluateLaunch(identity,{liquidityUsd=0,hasPool=false,mintAuthorityKnown=false,mintAuthority=null,freezeAuthority=null,hasExtensions=false}) {
  if(identity.status==='blocked') return {status:'blocked',reason:identity.reason};
  if(identity.status==='review') return {status:'review',reason:identity.reason};
  if(!hasPool) return {status:'review',reason:'No verified market pool yet'};
  if(liquidityUsd<10000) return {status:'review',reason:'Liquidity under $10,000 beta promotion threshold'};
  if(!mintAuthorityKnown) return {status:'review',reason:'On-chain mint inspection unavailable'};
  if(mintAuthority!==null) return {status:'review',reason:'Mint authority is still active'};
  if(freezeAuthority!==null) return {status:'review',reason:'Freeze authority is still active'};
  if(hasExtensions) return {status:'review',reason:'Token-2022 extensions require review'};
  return {status:'active',reason:'Promoted listing only; ownership and liquidity lock NOT verified'};
}
export function isSolanaAddress(s) {return typeof s==='string'&&s.length>=32&&s.length<=44&&/^[1-9A-HJ-NP-Za-km-z]+$/.test(s);}
