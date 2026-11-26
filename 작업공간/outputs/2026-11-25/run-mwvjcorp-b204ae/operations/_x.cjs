const fs=require('fs');
process.chdir('C:/Users/재영이/AIOffice');
const ids="mwu61zwd-2a9784 mwu6qnnc-08f2e7 mwu93zql-536025 mwu9chvc-393846 mwu9e3qt-f08f47 mwua3zg0-2166af mwua94og-1e28bc mwualycv-63d2d4 mwuani93-d61573 mwuc4ulk-c166f7 mwudaxd2-74d871".split(' ');
for(const i of ids){
 const p='.office/orchestrations/'+i+'.json';
 const dir='outputs/2026-11-24/run-'+i;
 console.log('=====',i);
 if(!fs.existsSync(p)){console.log('NO ORCH');}else{
 const o=JSON.parse(fs.readFileSync(p,'utf8'));
 console.log('req:',o.originalRequest.split('\n')[0].slice(0,160));
 console.log('status',o.status,'rejects',o.rejects,'reviewRejects',o.reviewRejects,'progress',o.progressChecks,'revCount',o.revisionCount,'revs',JSON.stringify(o.revisions||[]).slice(0,300));
 console.log('budget',JSON.stringify(o.budget).slice(0,120),'decisions',JSON.stringify(o.decisions).slice(0,100));
 console.log('stages',(o.plan&&o.plan.stages||[]).map(s=>s.id+':'+s.agent).join(' '),'review',JSON.stringify(o.plan&&o.plan.review&&o.plan.review.by),'deliv',JSON.stringify(o.plan&&o.plan.deliverables));
 }
 const r='.office/runs/'+i+'.result.md';
 console.log('runs:',fs.existsSync(r)?fs.readFileSync(r,'utf8').slice(0,200).replace(/\n/g,' '):'none');
 const files=[];
 (function w(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const q=d+'/'+f.name;if(f.isDirectory())w(q);else files.push([fs.statSync(q).mtime.toISOString().slice(11,16),q.replace(dir+'/','')]);}})(dir);
 files.sort();
 console.log('files(UTC)',files.map(f=>f.join(' ')).join(' | '));
}
