import {connect, disconnect, connectedAddress, verifyConfig, createToken, inspectPool, tradeToken} from './chain.js';
import {validateLaunch, isPublicKey, toAtomic, QUOTES} from './validation.js';
const el = id => document.getElementById(id);
let busy = false;
function message(text, level = '') {
  el('status').textContent = text;
  el('status').className = 'status ' + level;
}
function details(container, lines) {
  el(container).textContent = lines.join('\n');
}
function setBusy(next) {
  busy = next;
  for (const id of ['walletBtn','createBtn','verifyConfigBtn','inspectBtn','tradeBtn']) el(id).disabled = next;
}
function fail(error) {
  const messageText = error?.message || String(error);
  message('Operation stopped: ' + messageText, 'error');
}
function addressPreview(value) {return value ? value.slice(0,5) + '…' + value.slice(-5) : '—';}
el('walletBtn').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    if (connectedAddress()) {
      await disconnect();
      el('walletBtn').textContent = 'Connect wallet';
      message('Wallet disconnected.', 'ok');
    } else {
      const address = await connect();
      el('walletBtn').textContent = addressPreview(address) + ' · disconnect';
      message('Connected: ' + address + '\nOnly devnet transactions are available.', 'ok');
    }
  } catch (error) {fail(error)}
  finally {setBusy(false)}
});
function readCreate() {
  const raw = {name: el('tokenName').value, symbol: el('tokenTicker').value,
    metadataUrl: el('metadataUrl').value, quote: el('launchQuote').value,
    configId: el('configId').value.trim()};
  const validation = validateLaunch(raw);
  if (!validation.ok) throw Error(validation.errors.join(' '));
  return {...raw, name:validation.name, symbol:validation.symbol, metadataUrl:validation.metadataUrl};
}
async function checkedConfig(quote, configId) {
  const config = await verifyConfig(quote, configId);
  details('configPreview', [
    'Verified Raydium devnet program: ' + config.programId,
    'Config account: ' + config.configId,
    'Quote mint: ' + config.quoteMint,
    'Quote decimals: ' + config.decimals,
    config.platformNote
  ]);
  return config;
}
el('verifyConfigBtn').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    message('Checking program owner, config account, quote mint and decimals on devnet…');
    await checkedConfig(el('launchQuote').value, el('configId').value.trim());
    message('Raydium devnet configuration was found. No token has been created.', 'ok');
  } catch (error) {fail(error)}
  finally {setBusy(false)}
});
el('launchQuote').addEventListener('change', () => {
  el('configPreview').textContent = 'Quote changed. Re-verify the on-chain config before creating a token.';
});
el('createForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  try {
    const values = readCreate();
    if (!connectedAddress()) throw Error('Connect a wallet first.');
    message('Verifying configuration, then preparing a devnet token creation transaction…');
    await checkedConfig(values.quote, values.configId);
    const response = await createToken(values);
    const explorer = 'https://explorer.solana.com/address/' + encodeURIComponent(response.mint) + '?cluster=devnet';
    el('results').replaceChildren();
    const a = document.createElement('a');
    a.href = explorer; a.rel = 'noopener noreferrer'; a.target = '_blank';
    a.textContent = 'View new mint: ' + response.mint;
    el('results').append(a);
    el('tradeMint').value = response.mint;
    el('tradeQuote').value = values.quote;
    message('Devnet token creation submitted and confirmed by the SDK.\nMint: ' + response.mint + '\nPool: ' + (response.pool || 'Verify on-chain'), 'ok');
  } catch (error) {fail(error)}
  finally {setBusy(false)}
});
async function checkedPool() {
  const mint = el('tradeMint').value.trim();
  if (!isPublicKey(mint)) throw Error('Enter a valid Solana mint public key.');
  if (!connectedAddress()) throw Error('Connect your wallet to inspect Raydium LaunchLab pools.');
  const pool = await inspectPool(mint, el('tradeQuote').value);
  details('poolPreview', [
    'On-chain Raydium devnet pool: ' + pool.pool.toBase58(),
    'Token decimals: ' + pool.decimals,
    'Pool status code: ' + pool.status,
    'Platform config: ' + pool.platform,
    'Momentum 2% fee config not established'
  ]);
  return pool;
}
el('inspectBtn').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    message('Reading Raydium devnet pool from Solana RPC…');
    await checkedPool();
    message('Pool discovered. Read its details carefully before placing a devnet order.', 'ok');
  } catch (error) {fail(error)}
  finally {setBusy(false)}
});
function updateAmountHint() {
  const quote=el('tradeQuote').value, side=el('tradeSide').value;
  el('amountHint').textContent = side === 'buy'
    ? 'Enter ' + quote + ' to spend. Preview values and minimum received units in your wallet before approval.'
    : 'Enter tokens to sell. Decimals are read from the token mint on devnet.';
}
el('tradeQuote').addEventListener('change', updateAmountHint);
el('tradeSide').addEventListener('change', updateAmountHint);
el('tradeForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  try {
    const mintAddress=el('tradeMint').value.trim();
    const quote=el('tradeQuote').value, side=el('tradeSide').value;
    if (!connectedAddress()) throw Error('Connect a wallet first.');
    const pool=await checkedPool();
    const amount=el('tradeAmount').value.trim();
    const units=toAtomic(amount,side==='buy'?QUOTES[quote].decimals:pool.decimals);
    const label=side==='buy'?'spending':'selling';
    message('Preparing devnet ' + side + ' for ' + label + ' ' + amount + ' ' +
      (side==='buy'?quote:'tokens') + ' (' + units + ' atomic units).\nApprove only after reviewing wallet transaction details.');
    const result=await tradeToken({mintAddress, quote, side, amount});
    message('Devnet ' + side + ' submitted and confirmed by Raydium SDK.\nPool: ' + result.pool, 'ok');
  } catch (error) {fail(error)}
  finally {setBusy(false)}
});
