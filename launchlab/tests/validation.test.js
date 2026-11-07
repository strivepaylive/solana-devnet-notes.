import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLaunch, toAtomic, safeMetadataUrl, requireDevnetNetwork} from '../src/validation.js';

test('valid launch input', () => {
  assert.equal(validateLaunch({name:'Momentum Test', symbol:'MOMO',quote:'SOL',metadataUrl:'https://example.com/metadata.json'}).ok,true);
});
test('blocks invalid ticker and data URL metadata', () => {
  const result=validateLaunch({name:'T',symbol:'bad ticker',quote:'BTC',metadataUrl:'data:application/json,{}'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.length >= 3);
  assert.equal(safeMetadataUrl('http://example.com/x'),false);
});
test('token decimal conversion is exact and nonzero', () => {
  assert.equal(toAtomic('1.000000001',9),'1000000001');
  assert.equal(toAtomic('0.01',6),'10000');
  assert.throws(()=>toAtomic('0.0000000001',9));
  assert.throws(()=>toAtomic('0',9));
  assert.throws(()=>toAtomic('-1',9));
  assert.throws(()=>toAtomic('1e9',9));
  assert.throws(()=>toAtomic('18446744073709551616',0));
});
test('mainnet and third-party RPC endpoints are blocked', () => {
  assert.equal(requireDevnetNetwork('https://api.devnet.solana.com'),true);
  assert.throws(()=>requireDevnetNetwork('https://api.mainnet-beta.solana.com'));
  assert.throws(()=>requireDevnetNetwork('https://example.com'));
});
