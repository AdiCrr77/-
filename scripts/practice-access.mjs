// Numbers live only in local configuration and runtime memory.
export function parseAllowedNumbers(value='') {
  if(!value)return new Set();
  const entries=String(value).split(',');
  if(entries.some(number=>! /^[1-9]\d{6,14}$/.test(number))) throw new Error('PRACTICE_ALLOWED_NUMBERS must be comma-separated international digits without + or spaces.');
  return new Set(entries);
}
export function phoneFromJid(jid) {
  return /^([1-9]\d{6,14})(?::\d+)?@s\.whatsapp\.net$/.exec(jid??'')?.[1];
}
export function acceptsPracticeEvent(event,{allowedNumbers=null,selfNumber,selfLid}={}) {
  if(event.isGroup||event.chatId?.endsWith('@g.us'))return false;
  const sender=phoneFromJid(event.senderId);
  if(!sender)return false;
  // Legacy workers receive events only from the bridge's existing self-chat gate.
  if(allowedNumbers===null)return true;
  const self=sender===selfNumber&&(phoneFromJid(event.chatId)===selfNumber||event.chatId===selfLid);
  if(event.fromOwner&&!self)return false;
  return self||allowedNumbers.has(sender);
}
export function maskPhoneNumbers(text) {
  return String(text).replace(/\+?\b\d[\d ()-]*\d\b/g,match=>{
    const digits=match.replace(/\D/g,'');
    return digits.length>=7?'****'+digits.slice(-4):match;
  });
}
export function bridgeAccessEnvironment(allowedNumbers,selfNumber) {
  if(!allowedNumbers.size)return {WHATSAPP_MODE:'self-chat',WHATSAPP_ALLOWED_USERS:'',WHATSAPP_DM_POLICY:'allowlist',WHATSAPP_GROUP_POLICY:'disabled',WHATSAPP_GROUP_ALLOWED_USERS:'',WHATSAPP_FORWARD_OWNER_MESSAGES:'false'};
  if(!selfNumber)throw new Error('Pair WhatsApp in self-chat mode before enabling PRACTICE_ALLOWED_NUMBERS.');
  return {WHATSAPP_MODE:'bot',WHATSAPP_ALLOWED_USERS:[selfNumber,...allowedNumbers].join(','),WHATSAPP_DM_POLICY:'allowlist',WHATSAPP_GROUP_POLICY:'disabled',WHATSAPP_GROUP_ALLOWED_USERS:'',WHATSAPP_FORWARD_OWNER_MESSAGES:'true'};
}
