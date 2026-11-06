import test from 'node:test';
import assert from 'node:assert/strict';
import {MAINNET_REQUIREMENTS,evaluateMainnetReadiness,assertMainnetReady} from '../src/mainnet-readiness.js';
test('mainnet fails closed with no evidence',()=>{assert.equal(evaluateMainnetReadiness().ready,false);assert.throws(()=>assertMainnetReady(),/Mainnet disabled/);});
test('all production controls must be explicitly verified',()=>{const evidence=Object.fromEntries(MAINNET_REQUIREMENTS.map(k=>[k,true]));assert.equal(evaluateMainnetReadiness(evidence).ready,true);assert.equal(assertMainnetReady(evidence),true);evidence.securityReviewPassed=false;assert.equal(evaluateMainnetReadiness(evidence).ready,false);});
test('truthy strings never count as verification',()=>{const evidence=Object.fromEntries(MAINNET_REQUIREMENTS.map(k=>[k,'true']));assert.equal(evaluateMainnetReadiness(evidence).ready,false);});
