import {put} from '@vercel/blob';
const TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const trim=(s,max)=>String(s||'').trim().slice(0,max);
function validHttps(url,allowedHosts){
 if(!url)return null;
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))return null;
  if(allowedHosts&&!allowedHosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;
  return u.toString();
 }catch{return null}
}
async function verifyTurnstile(token,ip){
 if(typeof token!=='string'||token.length<20||token.length>2500)return false;
 const body=new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY||'',response:token});
 if(ip)body.set('remoteip',ip);
 const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,
  signal:AbortSignal.timeout(7000)
 });
 if(!result.ok)return false;
 const value=await result.json();
 return value.success===true;
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.TURNSTILE_SECRET_KEY||!process.env.VITE_TURNSTILE_SITE_KEY)
  return res.status(503).json({error:'Protected media publisher is not configured. Use an existing metadata URL under Advanced.'});
 const body=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body)}catch{return null}})():req.body;
 if(!body||typeof body!=='object')return res.status(400).json({error:'Invalid metadata JSON.'});
 const name=trim(body.name,33),symbol=trim(body.symbol,11).toUpperCase(),description=trim(body.description,500);
 if(name.length<2||name.length>32||!/^[A-Z0-9]{2,10}$/.test(symbol))return res.status(400).json({error:'Invalid token name or ticker.'});
 const socials=body.socials||{};
 const website=socials.tokenWebsite?validHttps(socials.tokenWebsite):null;
 const twitter=socials.tokenX?validHttps(socials.tokenX,['x.com','twitter.com']):null;
 const telegram=socials.tokenTelegram?validHttps(socials.tokenTelegram,['t.me','telegram.me']):null;
 if((socials.tokenWebsite&&!website)||(socials.tokenX&&!twitter)||(socials.tokenTelegram&&!telegram))
  return res.status(400).json({error:'Invalid project social URL.'});
 const contentType=trim(body.imageType,100);
 if(!Object.hasOwn(TYPES,contentType)||typeof body.imageBase64!=='string'||body.imageBase64.length>1450000)
  return res.status(400).json({error:'Image must be PNG, JPEG or WebP under 1MB.'});
 let image;try{image=Buffer.from(body.imageBase64,'base64');}catch{return res.status(400).json({error:'Could not decode image.'})}
 if(image.length<100||image.length>1048576||image.toString('base64').replace(/=+$/,'')!==body.imageBase64.replace(/=+$/,''))
  return res.status(400).json({error:'Image upload is invalid or too large.'});
 const looksPng=contentType==='image/png'&&image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const looksJpg=contentType==='image/jpeg'&&image[0]===255&&image[1]===216&&image[image.length-2]===255&&image[image.length-1]===217;
 const looksWebp=contentType==='image/webp'&&image.toString('ascii',0,4)==='RIFF'&&image.toString('ascii',8,12)==='WEBP';
 if(!looksPng&&!looksJpg&&!looksWebp)return res.status(400).json({error:'Uploaded bytes do not match image format.'});
 try{
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  if(!await verifyTurnstile(body.turnstileToken,forwarded))return res.status(403).json({error:'Human verification failed or expired.'});
  const unique=crypto.randomUUID();
  const imageResult=await put('devnet-token-images/'+unique+'.'+TYPES[contentType],image,{
    access:'public',contentType,addRandomSuffix:false,token:process.env.BLOB_READ_WRITE_TOKEN
  });
  const json={
    name,symbol,description,image:imageResult.url,
    external_url:website||'',
    attributes:[],
    properties:{
      category:'image',
      files:[{uri:imageResult.url,type:contentType}]
    },
    extensions:{website:website||undefined,twitter:twitter||undefined,telegram:telegram||undefined}
  };
  const metadataResult=await put('devnet-token-metadata/'+unique+'.json',JSON.stringify(json),{
    access:'public',contentType:'application/json',addRandomSuffix:false,token:process.env.BLOB_READ_WRITE_TOKEN
  });
  return res.status(200).json({metadataUrl:metadataResult.url,imageUrl:imageResult.url,network:'devnet'});
 }catch{
  return res.status(503).json({error:'Could not publish token metadata. No Solana launch transaction was submitted.'});
 }
}
