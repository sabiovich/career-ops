import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPersonalAccess} from '../../src/lib/access-guard.mjs';
test('private deployment requires password, local development remains available',()=>{
 assert.equal(checkPersonalAccess({enabled:true,host:'my-app.example.com'}).status,503);
 assert.equal(checkPersonalAccess({enabled:true,host:'localhost:3000'}).ok,true);
});
test('password protects both read and write paths',()=>{
 assert.equal(checkPersonalAccess({enabled:true,password:'example-test-password',authorization:null}).status,401);
 assert.equal(checkPersonalAccess({enabled:true,password:'example-test-password',authorization:'Basic '+Buffer.from('career-ops:wrong').toString('base64')}).status,401);
 assert.equal(checkPersonalAccess({enabled:true,password:'example-test-password',authorization:'Basic '+Buffer.from('career-ops:example-test-password').toString('base64')}).ok,true);
});
test('existing local-first mode unaffected',()=>assert.equal(checkPersonalAccess({enabled:false}).ok,true));
