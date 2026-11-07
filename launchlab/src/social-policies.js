// Pure policy functions. Caller MUST supply fresh, server-verified balances and activity.
const DECIMALS=6n;
function parseUsdMicro(value){
 if(typeof value!=='string'||!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value))throw Error('USD value must be an exact decimal string with at most six places.');
 const [whole,fraction='']=value.split('.');
 return BigInt(whole)*10n**DECIMALS+BigInt(fraction.padEnd(6,'0'));
}
function checkAttestation(a,now,maxAgeMs){
 if(!a||a.source!=='server-verified'||typeof a.checkedAt!=='number'||!Number.isFinite(now)||now<a.checkedAt||now-a.checkedAt>maxAgeMs)throw Error('Fresh server-verified on-chain evidence is required.');
 if(typeof a.wallet!=='string'||a.wallet.length<32)throw Error('Verified wallet identity is required.');
}
export function evaluateCalloutEligibility({evidence,now=Date.now(),mint}){
 checkAttestation(evidence,now,60000);
 if(typeof mint!=='string'||mint.length<32||mint!==evidence.mint)throw Error('Selected token must match verified mint.');
 const holding=parseUsdMicro(evidence.holdingUsd);
 return Object.freeze({eligible:holding>=2000000n,shortfallUsdMicro:(holding>=2000000n?0n:2000000n-holding).toString()});
}
export function evaluateCommunityEligibility({evidence,now=Date.now()}){
 checkAttestation(evidence,now,60000);
 const assets=parseUsdMicro(evidence.assetsUsd);
 return Object.freeze({eligible:assets>=100000000n&&(evidence.verifiedTrade===true||evidence.verifiedLaunch===true),balanceEligible:assets>=100000000n,activityEligible:evidence.verifiedTrade===true||evidence.verifiedLaunch===true});
}
export function evaluateMessagePermission({senderId,recipientId,recipientPolicy,recipientFollowsSender=false,mutualFollow=false,blockedSenderIds=[],senderBlockedRecipient=false}){
 if(!senderId||!recipientId||senderId===recipientId)return Object.freeze({allowed:false,reason:'invalid_participants'});
 if(blockedSenderIds.includes(senderId)||senderBlockedRecipient)return Object.freeze({allowed:false,reason:'blocked'});
 const allowed=recipientPolicy==='everyone'||(recipientPolicy==='following'&&recipientFollowsSender===true)||(recipientPolicy==='mutual'&&mutualFollow===true);
 return Object.freeze({allowed,reason:allowed?'allowed':'inbox_restricted'});
}
