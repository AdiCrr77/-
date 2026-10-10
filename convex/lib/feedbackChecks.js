import {quoteMatches} from './clarity.js';
import {FEEDBACK_RUBRICS} from './feedbackRubrics.js';

export function scoreFeedbackChecks(feedback,transcripts,situation='raise') {
  const rubric=FEEDBACK_RUBRICS[situation];
  if(!rubric)throw new Error('invalid_scores');
  const reject=()=>{
    const error=new Error('invalid_scores');
    error.feedbackScores={persuasion:feedback?.k,warmth:feedback?.w};
    throw error;
  };
  const fullAnswer=transcripts.filter(text=>typeof text==='string').join(' ');
  const evaluate=(checks,category)=>{
    const keys=[1,2,3,4].map(index=>`${category==='persuasion'?'P':'W'}${index}`);
    if(!checks||typeof checks!=='object'||Array.isArray(checks)||Object.keys(checks).length!==4||keys.some(key=>!Object.hasOwn(checks,key)))reject();
    return keys.map((key,index)=>{
      const check=checks[key];
      if(!check||typeof check!=='object'||Array.isArray(check)||Object.keys(check).length!==2||!Object.hasOwn(check,'pass')||!Object.hasOwn(check,'quote')||typeof check.pass!=='boolean'||typeof check.quote!=='string')reject();
      const omission=check.quote==='MISSING';
      if(omission&&check.pass)reject();
      if(!omission&&check.quote.trim().split(/\s+/u).length>15)reject();
      const quote=omission?fullAnswer:check.quote;
      const quoteFound=quoteMatches(quote,omission?[fullAnswer]:transcripts);
      if(!check.pass&&!omission&&!quoteFound)reject();
      return {check:index+1,name:rubric[category][index].name,aiPass:check.pass,quote,quoteFound,pass:check.pass&&!omission&&quoteFound,
        ...(omission?{reason:'missing_evidence'}:{})};
    });
  };
  const persuasionChecks=evaluate(feedback?.k,'persuasion');
  const warmthKeys=['W1','W2','W3','W4'];
  if(!feedback?.w||typeof feedback.w!=='object'||Array.isArray(feedback.w)||Object.keys(feedback.w).length!==4||warmthKeys.some(key=>!Object.hasOwn(feedback.w,key)))reject();
  let warmthChecks=warmthKeys.map((key,index)=>{
    const check=feedback.w[key];
    if(!check||typeof check!=='object'||Array.isArray(check)||Object.keys(check).some(field=>!['level','quote'].includes(field))||!['clear','partial','missing'].includes(check.level))reject();
    const aiLevel=check.level;
    const sourceQuote=typeof check.quote==='string'?check.quote:'';
    const omission=aiLevel==='missing'&&sourceQuote==='MISSING';
    if(sourceQuote!=='MISSING'&&sourceQuote.trim().split(/\s+/u).length>15)reject();
    const quote=omission?fullAnswer:sourceQuote;
    const quoteFound=quoteMatches(quote,omission?[fullAnswer]:transcripts);
    const level=aiLevel!=='missing'&&sourceQuote!=='MISSING'&&quoteFound?aiLevel:'missing';
    return {check:index+1,name:rubric.warmth[index].name,aiPass:aiLevel==='clear',aiLevel,quote,quoteFound,pass:level==='clear',level,points:level==='clear'?25:level==='partial'?12.5:0,
      ...(level==='missing'?{reason:omission?'missing_evidence':'unsupported_evidence'}:{})};
  });
  if(typeof feedback?.i!=='string')reject();
  const insultQuote=feedback.i;
  const insultFound=!!insultQuote.trim()&&quoteMatches(insultQuote,transcripts);
  if(insultQuote.trim()&&!insultFound)reject();
  if(insultFound)warmthChecks=warmthChecks.map(check=>({...check,quote:insultQuote,quoteFound:true,pass:false,level:'missing',points:0,reason:'insult_cap'}));
  const score=checks=>100-25*checks.filter(check=>!check.pass).length;
  return {persuasion:score(persuasionChecks),warmth:Math.round(warmthChecks.reduce((sum,check)=>sum+check.points,0)),persuasionChecks,warmthChecks,
    warmthInsult:{quote:insultQuote,quoteFound:insultFound,applied:insultFound}};
}
