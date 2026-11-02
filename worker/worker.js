// Plate Check meal-photo analyzer — Cloudflare Worker (NOT DEPLOYED YET).
// Holds the OpenAI key server-side as a secret: `wrangler secret put OPENAI_API_KEY`. The phone app sends ONLY the photo,
// never the user's report; matching to Level 1/2/3 happens on the phone.
const ORIGIN='https://storageauctionpirate.github.io';
const PROMPT=`You identify food in a photo for a food-sensitivity checker. Return JSON only:
{"dish":"short dish name","ingredients":[{"name":"ingredient","kind":"visible|likely|possible"}]}
List what you can see ("visible"), then what a typical recipe for this dish contains ("likely"): oils, butter, flours, starches,
sauces, seasonings, dairy, eggs, sugars, additives. Use plain grocery names (e.g. "soybean oil", "mozzarella cheese", "wheat flour",
"garlic", "black pepper"). Max 30 ingredients. If it is a label or menu, read it instead and list the ingredients/dishes.`;
export default { async fetch(req, env) {
  const cors={'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};
  if(req.method==='OPTIONS') return new Response(null,{headers:cors});
  if(req.method!=='POST') return new Response('POST only',{status:405,headers:cors});
  if((req.headers.get('origin')||'')!==ORIGIN) return new Response('forbidden',{status:403});
  const {image}=await req.json(); if(!image||!/^data:image\/(jpeg|png|webp);base64,/.test(image)||image.length>2_500_000) return new Response('bad image',{status:400,headers:cors});
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'authorization':'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},
    body:JSON.stringify({model:env.MODEL||'gpt-4o-mini',response_format:{type:'json_object'},max_tokens:700,
      messages:[{role:'system',content:PROMPT},{role:'user',content:[{type:'text',text:'Analyze this photo.'},{type:'image_url',image_url:{url:image,detail:'low'}}]}]})});
  if(!r.ok) return new Response('upstream '+r.status,{status:502,headers:cors});
  const j=await r.json(); let out; try{ out=JSON.parse(j.choices[0].message.content); }catch(e){ out={dish:'',ingredients:[]}; }
  return new Response(JSON.stringify(out),{headers:{...cors,'content-type':'application/json'}});
}};
