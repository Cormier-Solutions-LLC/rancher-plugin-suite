// A session-only model. Never serialize this object into saved preview state/drafts.
export function createSnapshotUnlockSession(records, read) {
  const rows = records.map(record => ({...record,password:'',status:record.encrypted?'Missing password':'Ready',snapshot:null}));
  return {
    rows,
    setPassword(row, password) {row.password=password;row.snapshot=null;row.status=password?'Not verified':'Missing password';},
    applyToAll(row) { for (const other of this.rows.filter(item=>item.encrypted)) this.setPassword(other,row.password); },
    async verify(row) {
      row.snapshot=null;
      if (row.encrypted&&!row.password) {row.status='Missing password';return;}
      row.status='Verifying';const password=row.password;
      try {const snapshot=await read(row.id,password);if(row.password!==password)return;row.snapshot=snapshot;row.status='Verified';}
      catch(error){if(row.password===password)row.status=error.message||'Could not verify';}
    },
    async verifyAll() {for(const row of this.rows)await this.verify(row);},
    get excluded() {return this.rows.filter(row=>!row.snapshot);},
    get eligible() {return this.rows.filter(row=>row.snapshot);},
    result() {return {sources:this.eligible.map(row=>row.snapshot),passwords:Object.fromEntries(this.eligible.filter(row=>row.encrypted).map(row=>[row.id,row.password])),excluded:this.excluded.map(row=>({id:row.id,name:row.scope?.label||row.name,reason:row.status}))};},
    clear() {for(const row of this.rows){row.password='';row.snapshot=null;}},
  };
}
