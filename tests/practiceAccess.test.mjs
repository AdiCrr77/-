import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../scripts/worker.mjs';
import {parseAllowedNumbers,maskPhoneNumbers,bridgeAccessEnvironment} from '../scripts/practice-access.mjs';
const owner='15555550123';
const colleague='15555550124';
const unknown='15555550125';
const event=(phone,overrides={})=>({senderId:phone+'@s.whatsapp.net',chatId:phone+'@s.whatsapp.net',messageId:'SYNTHETIC-'+phone.slice(-4),body:'1',...overrides});
function worker(allowed){
 const requests=[];
 const processEvent=createWorker({site:'https://synthetic.convex.site',token:'synthetic',bridge:'http://synthetic-bridge',cacheDir:'/tmp/unused-synthetic-cache',selfNumber:owner,allowedNumbers:parseAllowedNumbers(allowed),fetchImpl:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({ready:false,messages:[]})};}});
 return {processEvent,requests};
}
test('allowed number is processed with its own identity and same practice endpoint',async()=>{
 const {processEvent,requests}=worker(colleague);
 await processEvent(event(colleague));await processEvent(event(owner));
 assert.equal(requests.length,2);assert.ok(requests.every(r=>r.url.endsWith('/practice/prepare')));
 assert.equal(requests[0].body.phone,colleague);assert.equal(requests[1].body.phone,owner);
});
test('unlisted number is ignored without a backend or send call',async()=>{
 const {processEvent,requests}=worker(colleague);await processEvent(event(unknown));assert.equal(requests.length,0);
});
test('groups are ignored even for an allowed sender or absent group flag',async()=>{
 const {processEvent,requests}=worker(colleague);
 await processEvent(event(colleague,{isGroup:true}));
 await processEvent(event(colleague,{chatId:'synthetic-group@g.us'}));assert.equal(requests.length,0);
});
test('empty or missing allowed list processes self only',async()=>{
 for(const value of ['',undefined]){
  const {processEvent,requests}=worker(value);await processEvent(event(colleague));await processEvent(event(owner));
  assert.equal(requests.length,1);assert.equal(requests[0].body.phone,owner);
 }
});
test('outgoing owner messages to colleagues cannot score on their behalf',async()=>{
 const {processEvent,requests}=worker(colleague);await processEvent(event(colleague,{fromOwner:true}));assert.equal(requests.length,0);
});
test('allowlist parsing rejects invalid values without printing them',()=>{
 for(const value of ['+'+colleague,colleague+' '+unknown,'*',colleague+','])assert.throws(()=>parseAllowedNumbers(value),error=>!error.message.includes(colleague));
 assert.deepEqual([...parseAllowedNumbers(colleague+','+owner)],[colleague,owner]);
});
test('bridge settings deny groups and strangers while enabling allowed DMs and owner self chat',()=>{
 const empty=bridgeAccessEnvironment(new Set(),undefined);assert.equal(empty.WHATSAPP_MODE,'self-chat');assert.equal(empty.WHATSAPP_GROUP_POLICY,'disabled');
 const allowed=bridgeAccessEnvironment(new Set([colleague]),owner);assert.equal(allowed.WHATSAPP_MODE,'bot');assert.equal(allowed.WHATSAPP_ALLOWED_USERS,owner+','+colleague);assert.equal(allowed.WHATSAPP_DM_POLICY,'allowlist');assert.equal(allowed.WHATSAPP_GROUP_POLICY,'disabled');assert.equal(allowed.WHATSAPP_FORWARD_OWNER_MESSAGES,'true');
});
test('logs mask phone numbers and JIDs to the final four digits only',()=>{
 for(const text of [colleague,colleague+'@s.whatsapp.net','+'+colleague,'1 (555) 555-0124']){
  const masked=maskPhoneNumbers(text);assert.ok(masked.includes('****0124'));assert.ok(!masked.includes(colleague));
 }
 assert.equal(maskPhoneNumbers('Heard: 2 fillers, 1 long pause.'),'Heard: 2 fillers, 1 long pause.');
});
