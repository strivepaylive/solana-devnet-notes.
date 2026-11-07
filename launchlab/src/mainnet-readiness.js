// Production release gating: fail closed. Never use browser flags as authorization.
export const MAINNET_REQUIREMENTS=Object.freeze([
 'mainnetRpcVerified','walletProviderAudited','signingAndRecoveryTested',
 'launchProgramVerified','transactionSimulationEnabled','feeAndSlippageVerified',
 'depositWithdrawalVerified','indexerAndReconciliationReady',
 'abuseAndRateLimitsReady','securityReviewPassed','incidentResponseReady',
 'legalComplianceReviewed'
]);
export function evaluateMainnetReadiness(evidence={}){
 const missing=MAINNET_REQUIREMENTS.filter(key=>evidence[key]!==true);
 return Object.freeze({ready:missing.length===0,missing});
}
export function assertMainnetReady(evidence={}){
 const result=evaluateMainnetReadiness(evidence);
 if(!result.ready)throw new Error('Mainnet disabled: missing verified production controls: '+result.missing.join(', '));
 return true;
}
