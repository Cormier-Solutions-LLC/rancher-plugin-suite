export function estimateSnapshotStorage(availableBytes, largestSnapshotBytes, schedule, now=Date.now()) {
 const capacity = largestSnapshotBytes>0 ? Math.max(0,Math.floor(availableBytes/largestSnapshotBytes)) : null;
 if (!schedule?.enabled) return {capacity,runOutAt:null,reason:'Automatic Snapshots Disabled'};
 if (capacity===null) return {capacity,runOutAt:null,reason:'Save A Snapshot To Estimate Usage'};
 const interval=Number(schedule.interval), unit=schedule.unit;
 if (!Number.isInteger(interval) || interval<1 || !['minutes','hours','days','weeks','months'].includes(unit)) return {capacity,runOutAt:null,reason:'Schedule Unavailable'};
 const first = Date.parse(schedule.nextRun || '');
 const date=new Date(Number.isFinite(first)?Math.max(now,first):now);
 if (unit==='months') {
  const advance=count=>{const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+count*interval);const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,end));};
  // Repeated month-end clamps converge within a full four-year calendar cycle.
  const warmup=Math.min(capacity,48); for(let i=0;i<warmup;i++)advance(1);
  if(capacity>warmup)advance(capacity-warmup);
 } else date.setTime(date.getTime()+capacity*interval*({minutes:60000,hours:3600000,days:86400000,weeks:604800000})[unit]);
 return {capacity,runOutAt:Number.isFinite(date.getTime())?date.toISOString():null,reason:Number.isFinite(date.getTime())?'':'Beyond Supported Date Range'};
}
