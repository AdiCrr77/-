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
  let warmthChecks=evaluate(feedback?.w,'warmth');
  if(typeof feedback?.i!=='string')reject();
  const insultQuote=feedback.i;
  const insultFound=!!insultQuote.trim()&&quoteMatches(insultQuote,transcripts);
  if(insultQuote.trim()&&!insultFound)reject();
  if(insultFound)warmthChecks=warmthChecks.map(check=>({...check,quote:insultQuote,quoteFound:true,pass:false,reason:'insult_cap'}));
  const score=checks=>100-25*checks.filter(check=>!check.pass).length;
  return {persuasion:score(persuasionChecks),warmth:score(warmthChecks),persuasionChecks,warmthChecks,
    warmthInsult:{quote:insultQuote,quoteFound:insultFound,applied:insultFound}};
}
