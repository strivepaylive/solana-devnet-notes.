import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/worker.js';

const mint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const wallet='So11111111111111111111111111111111111111112';
const fakeDB={
  prepare(query){
    return {bind(...args){
      return {
        async first(){return query.includes('COUNT(*)')?{n:0}:null;},
        async run(){return {meta:{changes:1}};}
      };
    }};
  }
};
const ctx={waitUntil(){}};
const req=(token='token-with-enough-length')=>new Request('https://momentum.example/api/auth/challenge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet,mint,intent:'boost',turnstileToken:token})});

test('public runtime config does not disclose secret and disables requests when unconfigured',async()=>{
 const response=await app.fetch(new Request('https://momentum.example/api/config'),{},ctx);
 const body=await response.json();
 assert.equal(body.boostEnabled,false);assert.equal(body.programId,null);assert.equal(body.promotionsPaid,false);
 assert.equal(JSON.stringify(body).includes('SECRET'),false);
});
test('wallet challenge fails closed without Turnstile secret',async()=>{
 const response=await app.fetch(req(),{DB:fakeDB},ctx);
 assert.equal(response.status,503);
 assert.match((await response.json()).error,/Unable to complete|configuration/i);
});
test('Turnstile hostname mismatch is rejected before challenge storage',async()=>{
 const orig=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,hostname:'attacker.example'}),{headers:{'content-type':'application/json'}});
 try{
  const response=await app.fetch(req(),{DB:fakeDB,TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'secret'},ctx);
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/CAPTCHA hostname mismatch/);
 }finally{globalThis.fetch=orig;}
});
test('verified Turnstile response creates a short-lived wallet challenge',async()=>{
 const orig=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,hostname:'momentum.example'}),{headers:{'content-type':'application/json'}});
 try{
  const response=await app.fetch(req(),{DB:fakeDB,TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'secret'},ctx);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.match(body.message,/Momentum boost authorization/);
  assert.match(body.message,/Domain: momentum.example/);
  assert.ok(body.expiresAt>Math.floor(Date.now()/1000));
  assert.ok(!body.message.includes('secret'));
 }finally{globalThis.fetch=orig;}
});

test('read-only beta health works before D1 is configured',async()=>{
 const res=await app.fetch(new Request('https://momentum.example/api/health'),{},ctx);
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.ok,true);
 assert.equal(body.databaseConfigured,false);
});
test('unconfigured beta returns honest empty promotions without server failure',async()=>{
 const res=await app.fetch(new Request('https://momentum.example/api/boosts'),{},ctx);
 assert.equal(res.status,200);
 const body=await res.json();
 assert.deepEqual(body.boosts,[]);
 assert.match(body.disclaimer,/D1/);
});
test('unconfigured beta cannot accept promotion or wallet-signed requests',async()=>{
 const res=await app.fetch(req(),{},ctx);
 assert.equal(res.status,503);
 assert.match((await res.json()).error,/database/i);
});
