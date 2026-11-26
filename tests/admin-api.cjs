const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/belkhi-moderation/index.ts','utf8'));
const owner = 'b3e10000-0000-4000-8000-000000000001';
const target = 'b3e10000-0000-4000-8000-000000000002';
const tender = 'b3e20000-0000-4000-8000-000000000001';
function server(actor={id:owner,app_metadata:{belkhi_role:'owner'}}, response={}) {
  let handle;
  const calls=[];
  const context=vm.createContext({
    Request,Response,URLSearchParams,AbortSignal,
    Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://test.invalid':'mock-service-role'},serve:fn=>handle=fn},
    fetch:async(url,options)=>{
      calls.push({url,options,body:options.body?JSON.parse(options.body):undefined});
      if(url.endsWith('/auth/v1/user'))return Response.json(actor);
      return Response.json(typeof response==='function'?response(url,options):response);
    },
  });
  vm.runInContext(source,context);
  return {
    calls,
    request:(input,token='mock-owner-token')=>handle(new Request('https://edge.invalid/',{
      method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(input),
    })),
  };
}
(async()=>{
  let s=server(),r=await s.request({action:'overview'},'');
  assert.equal(r.status,401);assert.equal(s.calls.length,0);
  s=server({id:target,user_metadata:{belkhi_role:'owner'},app_metadata:{}});
  r=await s.request({action:'overview'});assert.equal(r.status,403);assert.equal(s.calls.length,1);
  s=server({id:owner,app_metadata:{belkhi_role:'owner'},banned_until:'2999-01-01'});
  assert.equal((await s.request({action:'overview'})).status,403);

  const aggregate={accounts:{total:4,customers:2,specialists:2,admins:1,blocked:1},tenders:{total:2,open:1,in_progress:1},bids:{total:3}};
  s=server(undefined,aggregate);r=await s.request({action:'overview'});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),aggregate);
  assert.equal(s.calls[1].url,'https://test.invalid/rest/v1/rpc/belkhi_admin_overview');
  assert.equal(s.calls[1].options.headers.Authorization,'Bearer mock-service-role');
  assert.equal(r.headers.get('Cache-Control'),'no-store');

  for(const role of ['all','customers','specialists','admins']){
    s=server(undefined,[]);r=await s.request({action:'accounts',role,page:2,search:'  test  ',status:'blocked'});
    assert.equal(r.status,200);assert.deepEqual(s.calls[1].body,{account_id:null,search_text:'test',account_status:'blocked',start_at:60,role_filter:role});
  }
  for(const input of [{action:'accounts',role:'owner'},{action:'tenders',status:'deleted'},{action:'tenders',owner_id:'bad'},
    {action:'tenders',page:-1},{action:'journal',target:'bad'},{action:'journal',event:'delete'},
    {action:'tender',id:'bad'},{action:'choose',id:tender}]){
    s=server();r=await s.request(input);assert.equal(r.status,400,JSON.stringify(input));assert.equal(s.calls.length,1);
  }
  s=server(undefined,[]);r=await s.request({action:'tenders',search:' <test> ',status:'open',owner_id:target,page:1});
  assert.equal(r.status,200);assert.deepEqual(s.calls[1].body,{search_text:'<test>',tender_status:'open',customer_id:target,start_at:30});
  assert.equal(s.calls[1].url,'https://test.invalid/rest/v1/rpc/belkhi_admin_tenders');

  const metadata={id:tender,owner_id:target,status:'open',details:{title:'Test'},bid_count:2,files:[{name:'plan.pdf',type:'application/pdf',size:3}]};
  s=server(undefined,metadata);r=await s.request({action:'tender',id:tender});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),metadata);assert.deepEqual(s.calls[1].body,{tender_id:tender});
  s=server(undefined,null);assert.equal((await s.request({action:'tender',id:tender})).status,404);

  s=server(undefined,[]);r=await s.request({action:'journal',target,event:'read_messages',page:3});
  assert.equal(r.status,200);
  const journal=new URL(s.calls[1].url);assert.equal(journal.searchParams.get('target'),'eq.'+target);
  assert.equal(journal.searchParams.get('action'),'eq.read_messages');assert.equal(journal.searchParams.get('offset'),'90');assert.equal(journal.searchParams.get('limit'),'31');

  // Existing account and blocking calls retain the array-based account lookup and the protected-admin rule.
  s=server(undefined,[{id:owner,owner:true}]);assert.equal((await s.request({action:'block',id:owner,reason:'test'})).status,403);
  assert.equal(s.calls.length,2);
  console.log('PASS owner JWT guard, spoofed user_metadata denied, banned owner denied, overview, role filters, tenders/tender, journal filters, pagination, input validation, protected admin and no-store');
})().catch(error=>{console.error(error);process.exit(1)});
