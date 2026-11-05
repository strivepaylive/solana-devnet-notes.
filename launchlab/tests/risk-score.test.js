import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreMintRisk} from '../src/risk-score.js';
import {parsePools} from '../api/pools.js';
import {parseArticles} from '../api/news.js';
test('active mint and freeze authorities produce warning not safe',()=>{
 const r=scoreMintRisk({mintAuthority:'owner',freezeAuthority:'owner',concentrationBps:null});
 assert.equal(r.status,'warning');assert.ok(r.signals.some(x=>x.message.includes('additional')));
});
test('no active authorities still remains unverified',()=>{
 assert.equal(scoreMintRisk({mintAuthority:null,freezeAuthority:null,concentrationBps:1500}).status,'unverified');
});
test('token2022 permanent delegate warns',()=>{
 assert.equal(scoreMintRisk({permanentDelegate:true,token2022:true}).status,'warning');
});
test('new pools parser excludes malformed or old data and duplicate mints',()=>{
 const now=Date.parse('2026-11-05T10:00:00Z');
 const a={id:'pool1',attributes:{address:'9'.repeat(32),pool_created_at:'2026-11-05T09:59:00Z',reserve_in_usd:'3000',fdv_usd:'8000'},relationships:{base_token:{data:{id:'base'}},quote_token:{data:{id:'quote'}}}};
 const payload={data:[a,a],included:[{id:'base',attributes:{address:'8'.repeat(32),symbol:'NEW',name:'New token'}},{id:'quote',attributes:{address:'So11111111111111111111111111111111111111112',symbol:'SOL'}}]};
 const parsed=parsePools(payload,now);
 assert.equal(parsed.length,1);
 assert.equal(parsed[0].mint,'8'.repeat(32));
 assert.equal(parsed[0].liquidityUsd,3000);
});
test('news parser filters unrelated/old publisher headlines and sanitizes URL',()=>{
 const now=Date.parse('2026-11-05T10:00:00Z');
 const r=parseArticles({articles:[
  {title:'Solana network upgrade boosts crypto blockchain infrastructure',url:'https://www.coindesk.com/tech/a',seendate:'20261105092000'},
  {title:'A worldwide sports game happened today with no crypto',url:'https://example.com/a',seendate:'20261105090000'},
  {title:'Bitcoin historical headline from months ago',url:'https://www.coindesk.com/a',seendate:'20260105090000'},
 ]},now);
 assert.equal(r.length,1);
 assert.equal(r[0].category,'Infrastructure');
});
