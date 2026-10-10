// Wire fixtures exercise validation and transport, not the model's semantic judgment.
export function checkedFeedback(persuasion,warmth,quote='raise') {
  const category=(score,prefix)=>Object.fromEntries([1,2,3,4].map((index)=>[`${prefix}${index}`,{
    ...(prefix==='W'?{level:index<=Math.round(score/25)?'clear':'missing'}:{pass:index<=Math.round(score/25)}),quote:index<=Math.round(score/25)?quote:'MISSING',
  }]));
  return {k:category(persuasion,'P'),w:category(warmth,'W'),i:''};
}
