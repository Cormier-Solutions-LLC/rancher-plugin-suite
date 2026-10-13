const failure=(replica,code='ENGINE_API_UNAVAILABLE',status=503)=>Object.assign(new Error(`DNS engine ${replica} ${code==='ENGINE_AUTH_REJECTED'?'authentication was rejected':'API operation was not confirmed'}.`),{code,status});
const installedBase=replica=>`http://dns-manager-api-${replica}.dns-system.svc:5380/api/`;
const checkReplica=replica=>{if(!Number.isInteger(replica)||replica<0||replica>2)throw failure('unknown','ENGINE_INVALID_REFERENCE',400);};
const checkPath=(replica,path)=>{if(!/^[a-zA-Z]+(?:\/[a-zA-Z]+)*$/.test(path))throw failure(replica,'ENGINE_INVALID_REFERENCE',400);};
const checkPassword=password=>{if(typeof password!=='string'||!password||password.length>4096)throw failure('unknown','ENGINE_INVALID_CREDENTIAL',422);return password;};
// Endpoints are installed dependencies. Tests inject an isolated transport;
// no endpoint or username is accepted from a recovery request.
export function dnsEngineApi({readPassword,fetchImpl=fetch,baseForReplica=installedBase}={}){
 const sessions=new Map();let mountedPassword;
 async function request(replica,path,values={},token){
  checkReplica(replica);checkPath(replica,path);
  try{
   const response=await fetchImpl(baseForReplica(replica)+path,{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded',...(token?{Authorization:'Bearer '+token}:{})},body:new URLSearchParams(values),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw failure(replica);
   const text=await response.text();if(text.length>2*1024*1024)throw failure(replica);
   const result=JSON.parse(text);
   if(result.status!=='ok')throw failure(replica,path==='user/login'?'ENGINE_AUTH_REJECTED':'ENGINE_API_UNCONFIRMED',path==='user/login'?401:503);
   return result;
  }catch(error){if(error.code?.startsWith('ENGINE_'))throw error;throw failure(replica);}
 }
 async function login(replica,password){const result=await request(replica,'user/login',{user:'admin',pass:checkPassword(password)});if(typeof result.token!=='string'||!result.token||result.token.length>8192||/[\r\n]/.test(result.token))throw failure(replica);return result.token;}
 const logout=(replica,token)=>request(replica,'user/logout',{},token).catch(()=>{});
 return {
  async api(replica,path,values={}){
   checkReplica(replica);checkPath(replica,path);const password=checkPassword(await readPassword());
   if(password!==mountedPassword){mountedPassword=password;sessions.clear();}
   try{if(!sessions.has(replica))sessions.set(replica,await login(replica,password));return (await request(replica,path,values,sessions.get(replica))).response;}
   catch(error){sessions.delete(replica);throw error;}
  },
  async verifyPassword(replica,password){const token=await login(replica,password);try{const result=await request(replica,'user/profile/get',{},token);if(result.response?.username!=='admin'||result.response.disabled||result.response.isSsoUser)throw failure(replica,'ENGINE_AUTH_REJECTED',401);return {replica,authenticated:true};}finally{await logout(replica,token);}},
  async verifyMountedPassword(replica){checkReplica(replica);const password=checkPassword(await readPassword());return this.verifyPassword(replica,password);},
  async changePassword(replica,before,target){
   checkPassword(target);const token=await login(replica,before);
   try{await request(replica,'user/changePassword',{pass:before,newPass:target},token);}
   finally{await logout(replica,token);}
   // A fresh login proves the password, rather than trusting an old session.
   return this.verifyPassword(replica,target);
  }
 };
}
