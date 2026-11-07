// Only publish non-secret configuration values. Never expose TURNSTILE_SECRET_KEY or BLOB_READ_WRITE_TOKEN.
export default function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','public, max-age=120');
 const ready=!!(process.env.BLOB_READ_WRITE_TOKEN&&process.env.TURNSTILE_SECRET_KEY&&process.env.VITE_TURNSTILE_SITE_KEY);
 return res.status(200).json({metadataUploadReady:ready,
   turnstileSiteKey:ready?process.env.VITE_TURNSTILE_SITE_KEY:null,
   uploadLimitBytes:1048576,network:'devnet'});
}
