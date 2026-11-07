import test from 'node:test';
import assert from 'node:assert/strict';
import {mapTokenMetadata} from '../api/info.js';
test('sanitizes X/Telegram handles and rejects javascript website URLs',()=>{
 const metadata=mapTokenMetadata({
  twitter_handle:'momentum_sol',telegram_handle:'officialsignal',
  websites:['javascript:alert(1)','https://momentum.example'],
  name:'Safe',description:'Info is a claim'
 });
 assert.equal(metadata.x,'https://x.com/momentum_sol');
 assert.equal(metadata.websites.length,1);
 assert.equal(metadata.telegram,'https://t.me/officialsignal');
});
test('provider info never means safe',()=>{
 const info=mapTokenMetadata({gt_verified:true,websites:[]});
 assert.equal(info.providerVerified,true);
 assert.equal(Object.hasOwn(info,'safe'),false);
});
