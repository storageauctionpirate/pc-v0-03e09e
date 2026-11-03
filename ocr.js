/* Plate Check label reader — all on the phone (Tesseract.js). Auto-rotate, light/contrast fix, crop to the text block, spell-fix. */
(function(){
'use strict';
const TESS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const LABEL_WORDS='ingredients ingredient contains less than of the following or and to with from for made added preserve preserves freshness color colors flavor flavors flavoring natural artificial organic enriched unbleached bleached flour wheat niacin reduced iron thiamine mononitrate riboflavin folic acid water sugar salt sea oil oils vegetable canola sunflower safflower soybean palm corn cottonseed olive coconut high oleic expeller pressed starch modified food dextrose maltodextrin syrup solids cane brown invert yeast extract leavening baking soda sodium bicarbonate ammonium calcium phosphate monocalcium dicalcium tricalcium aluminum pyrophosphate acid citric lactic malic ascorbic tartaric acetic vinegar spices spice seasoning powder garlic onion paprika turmeric annatto extract extracts cheese cheddar mozzarella parmesan romano cultures enzymes milk skim nonfat whole pasteurized cream butter buttermilk whey lactose casein caseinate protein isolate concentrate egg eggs yolk white soy lecithin emulsifier gum guar xanthan arabic acacia gellan cellulose carrageenan pectin gelatin agar mono diglycerides polysorbate glycerin glycerol sorbitol mannitol maltitol erythritol xylitol sucralose acesulfame potassium aspartame stevia honey molasses cocoa chocolate processed alkali dutch vanilla vanillin tocopherols mixed vitamin palmitate rosemary bht bha tbhq sorbate benzoate propionate nitrite nitrate sulfite metabisulfite dioxide silicon titanium caramel red yellow blue lake beta carotene paprika oleoresin tomato paste puree potato potatoes rice tapioca cassava arrowroot oat oats barley rye malt malted spelt quinoa chia flax flaxseed sesame seeds seed almond almonds peanut peanuts cashew cashews walnut walnuts pecan pecans hazelnut hazelnuts pistachio coconut tree nuts nut fish shellfish shrimp anchovy anchovies crab chicken beef pork turkey broth stock fat lard tallow gluten free certified may traces trace facility processes shared equipment allergen allergens semolina durum dried dehydrated granulated roasted toasted cultured part low moisture shredded grated blend glucose fructose corn high sweetener sweeteners natural thickener stabilizer acidity regulator anticaking caking agent agents prevent cocoa butter mass skimmed powder liquid inulin fiber chicory root soluble insoluble resistant dextrin polydextrose psyllium husk pumpkin avocado agave cinnamon nutmeg ginger pepper black chili chile jalapeno cumin oregano basil thyme parsley dill mustard celery cilantro lemon lime orange juice apple grape raisin date fig dates figs cranberry blueberry strawberry banana pineapple mango peach cherry berry berries fruit vegetable carrot spinach beet pea peas bean beans lentil chickpea zucchini pepper peppers mushroom mushrooms cauliflower broccoli kale olive olives pickle cucumber monosodium glutamate disodium inosinate guanylate hydrolyzed autolyzed smoke smoked liquid sauce soy tamari worcestershire ketchup mayonnaise dressing'.split(' ');
let VOCAB=null, BYLEN=null;
function buildVocab(){ if(VOCAB) return; VOCAB=new Set(LABEL_WORDS);
  const add=s=>String(s).toLowerCase().split(/[^a-z]+/).forEach(w=>{ if(w.length>=3) VOCAB.add(w); });
  (window.FC_CATALOG||[]).forEach(([c,n])=>{ add(c); add(n); });
  const F=window.FC||{}; Object.keys(F.KB||{}).forEach(add); const ent=o=>o instanceof Map?[...o.entries()]:Array.isArray(o)?o:Object.entries(o||{}); ent(F.DISH).forEach(d=>{ add(d[0]); add(JSON.stringify(d[1])); }); ent(F.E).forEach(e=>add(JSON.stringify(e[1])));
  BYLEN=new Map(); VOCAB.forEach(w=>{ if(!BYLEN.has(w.length)) BYLEN.set(w.length,[]); BYLEN.get(w.length).push(w); }); }
function lev(a,b,max){ if(Math.abs(a.length-b.length)>max) return max+1; let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){ const cur=[i]; let best=i; for(let j=1;j<=b.length;j++){ cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); if(cur[j]<best) best=cur[j]; } if(best>max) return max+1; prev=cur; } return prev[b.length]; }
const fixCache=new Map();
function fixWord(w){ const lw=w.toLowerCase(); if(lw.length<3||VOCAB.has(lw)) return w; if(fixCache.has(lw)) return fixCache.get(lw)===null?w:matchCase(w,fixCache.get(lw));
  // common OCR swaps first
  const sw=lw.replace(/0/g,'o').replace(/1|\|/g,'l').replace(/5/g,'s').replace(/rn/g,'m').replace(/vv/g,'w');
  if(VOCAB.has(sw)){ fixCache.set(lw,sw); return matchCase(w,sw); }
  for(let i=0;i<sw.length;i++) if(sw[i]==='l'){ const t=sw.slice(0,i)+'i'+sw.slice(i+1); if(VOCAB.has(t)){ fixCache.set(lw,t); return matchCase(w,t); } }
  if(lw.length<5){ fixCache.set(lw,null); return w; } const max=lw.length>=8?2:1; let best=null, bd=max+1, tie=false;
  for(let L=lw.length-max;L<=lw.length+max;L++){ for(const v of (BYLEN.get(L)||[])){ const d=lev(lw,v,max); if(d<bd){ bd=d; best=v; tie=false; } else if(d===bd&&v!==best) tie=true; } }
  const r=(best&&!tie&&bd<=max)?best:null; fixCache.set(lw,r); return r?matchCase(w,r):w; }
function matchCase(src,w){ const up=(src.match(/[A-Z]/g)||[]).length, lo=(src.match(/[a-z]/g)||[]).length; return up>=lo&&up>0?w.toUpperCase():src[0]===src[0].toUpperCase()?w[0].toUpperCase()+w.slice(1):w; }
function spellFix(t){ buildVocab(); return t.replace(/[A-Za-z0-9|]{3,}/g,m=>/[a-z]/i.test(m)&&!/^\d+$/.test(m)?fixWord(m):m); }
function vocabScore(words){ buildVocab(); let n=0; for(const w of words){ const t=(w.text||'').toLowerCase().replace(/[^a-z]/g,''); if(t.length>=3&&w.confidence>=45&&VOCAB.has(t)) n++; } return n; }
/* ---------- image prep ---------- */
async function toCanvas(file,max){ let bmp; try{ bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); }catch(e){ const u=URL.createObjectURL(file); const im=new Image(); im.src=u; await im.decode(); bmp=im; }
  const w=bmp.width,h=bmp.height, s=Math.min(1,max/Math.max(w,h)); const c=document.createElement('canvas'); c.width=Math.round(w*s); c.height=Math.round(h*s);
  const x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(bmp,0,0,c.width,c.height); return c; }
function rotate(c,deg){ if(!deg) return c; const o=document.createElement('canvas'); const sw=deg%180!==0; o.width=sw?c.height:c.width; o.height=sw?c.width:c.height; const x=o.getContext('2d'); x.translate(o.width/2,o.height/2); x.rotate(deg*Math.PI/180); x.drawImage(c,-c.width/2,-c.height/2); return o; }
function crop(c,b){ const o=document.createElement('canvas'); o.width=b.w; o.height=b.h; o.getContext('2d').drawImage(c,b.x,b.y,b.w,b.h,0,0,b.w,b.h); return o; }
function scaleTo(c,f){ if(Math.abs(f-1)<.05) return c; const o=document.createElement('canvas'); o.width=Math.round(c.width*f); o.height=Math.round(c.height*f); const x=o.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(c,0,0,o.width,o.height); return o; }
// best channel -> flatten uneven light (glare, shadows, curved bags) -> fix polarity -> stretch contrast
function enhance(c){ const W=c.width,H=c.height, x=c.getContext('2d'); const id=x.getImageData(0,0,W,H), d=id.data, N=W*H;
  const ch=[new Float32Array(N),new Float32Array(N),new Float32Array(N),new Float32Array(N)];
  for(let i=0,p=0;i<N;i++,p+=4){ ch[0][i]=d[p]; ch[1][i]=d[p+1]; ch[2][i]=d[p+2]; ch[3][i]=.299*d[p]+.587*d[p+1]+.114*d[p+2]; }
  // pick the channel with the most local contrast (coloured packaging)
  let g=ch[3], bestS=-1; for(const a of ch){ let s=0; for(let i=W+1;i<N;i+=7){ s+=Math.abs(a[i]-a[i-1])+Math.abs(a[i]-a[i-W]); } if(s>bestS*1.12){ bestS=s; g=a; } }
  // polarity: text should be dark on light
  const hist=new Uint32Array(256); for(let i=0;i<N;i++) hist[g[i]|0]++; let acc=0, med=0; for(let v=0;v<256;v++){ acc+=hist[v]; if(acc>=N/2){ med=v; break; } }
  if(med<105) for(let i=0;i<N;i++) g[i]=255-g[i];
  // background estimate: box blur via integral image, radius ~ 1/24 of size
  const r=Math.max(8,Math.round(Math.max(W,H)/24)); const I=new Float64Array((W+1)*(H+1));
  for(let y=0;y<H;y++){ let row=0; for(let xx=0;xx<W;xx++){ row+=g[y*W+xx]; I[(y+1)*(W+1)+xx+1]=I[y*(W+1)+xx+1]+row; } }
  const out=new Float32Array(N);
  for(let y=0;y<H;y++){ const y0=Math.max(0,y-r), y1=Math.min(H,y+r+1); for(let xx=0;xx<W;xx++){ const x0=Math.max(0,xx-r), x1=Math.min(W,xx+r+1);
    const s=I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0]; const bg=s/((y1-y0)*(x1-x0)); out[y*W+xx]=Math.min(1.25,g[y*W+xx]/(bg+8)); } }
  // stretch 1st-99th percentile
  const h2=new Uint32Array(512); for(let i=0;i<N;i++) h2[Math.min(511,out[i]*400|0)]++; let lo=0,hi=511; acc=0; for(let v=0;v<512;v++){ acc+=h2[v]; if(acc>N*.01){ lo=v; break; } } acc=0; for(let v=511;v>=0;v--){ acc+=h2[v]; if(acc>N*.01){ hi=v; break; } }
  lo/=400; hi/=400; const sc=255/Math.max(.05,hi-lo);
  for(let i=0,p=0;i<N;i++,p+=4){ const v=Math.max(0,Math.min(255,(out[i]-lo)*sc)); d[p]=d[p+1]=d[p+2]=v; d[p+3]=255; }
  const o=document.createElement('canvas'); o.width=W; o.height=H; o.getContext('2d').putImageData(id,0,0); return o; }
/* ---------- OCR ---------- */
let workerP=null;
function loadScript(src){ return new Promise((ok,no)=>{ if(window.Tesseract) return ok(); const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>no(new Error('reader download failed')); document.head.appendChild(s); }); }
function warm(){ if(!workerP) workerP=loadScript(TESS).then(()=>Tesseract.createWorker('eng',1)).catch(e=>{ workerP=null; throw e; }); return workerP; }
async function rec(c,psm){ const w=await warm(); const r=await w.recognize(c,{rotateAuto:true}); return r.data; }
function allWords(d){ if(d.words&&d.words.length) return d.words; const out=[]; (d.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(w=>out.push(w))))); return out; }
function textBox(words,W,H){ const good=words.filter(w=>w.confidence>=55&&(w.text||'').replace(/[^a-z]/gi,'').length>=3); if(good.length<4) return null;
  const q=(arr,p)=>{ const s=[...arr].sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.max(0,Math.floor(p*(s.length-1))))]; };
  let x0=q(good.map(w=>w.bbox.x0),.03), y0=q(good.map(w=>w.bbox.y0),.03), x1=q(good.map(w=>w.bbox.x1),.97), y1=q(good.map(w=>w.bbox.y1),.97);
  const ing=good.find(w=>/ngred/i.test(w.text)); if(ing) y0=Math.min(y0,ing.bbox.y0);
  const hs=good.map(w=>w.bbox.y1-w.bbox.y0); const mh=q(hs,.5); const m=mh*1.6; x0=Math.max(0,x0-m); y0=Math.max(0,y0-m); x1=Math.min(W,x1+m); y1=Math.min(H,y1+m);
  return {x:Math.round(x0),y:Math.round(y0),w:Math.round(x1-x0),h:Math.round(y1-y0),mh}; }
function clean(t){ t=t.replace(/[‘’`´]/g,"'").replace(/[“”]/g,'"').replace(/-\s*\n\s*/g,'').replace(/\s*\n\s*/g,' ').replace(/\s{2,}/g,' ').replace(/[|]/g,'l');
  t=spellFix(t);
  const m=t.search(/\b(ingr?e?d[il1i]?e?nts?|ingredlents|lngredients|ingredients)\s*[:;.]?/i); if(m>=0) t=t.slice(m);
  const stop=t.slice(12).search(/\b(nutrition facts|distributed by|manufactured (by|for)|made by|packed (by|for)|best (by|before)|keep (frozen|refrigerated)|questions or comments|questions\?|comments\?|www\.|serving size|cooking instructions|store in)\b/i); if(stop>=0) t=t.slice(0,stop+12);
  return t.trim(); }
async function readLabel(file,onStep){ const step=s=>onStep&&onStep(s); warm().catch(()=>{});
  step('photo'); const base=await toCanvas(file,2000); step('clean');
  const prep=(c,k)=>k==='enh'?enhance(c):c;
  const mid=scaleTo(base,Math.min(1,1600/Math.max(base.width,base.height)));
  // two looks at the same photo: as shot, and contrast-boosted / glare-flattened. keep the better one.
  step('read'); let best=null;
  for(const k of ['raw','enh']){ const c=prep(mid,k); const d=await rec(c,3); const w=allWords(d); const sc=vocabScore(w);
    if(!best||sc>best.score) best={k,c,d,words:w,score:sc}; if(best.score>=40) break; }
  let {k:kind,c:en,d,words,score}=best, rot=0;
  if(score<8){ // sideways / upside-down photo: try the other orientations on a small copy
    for(const kk of ['raw','enh']){ const small=prep(scaleTo(mid,Math.min(1,1100/Math.max(mid.width,mid.height))),kk);
      for(const deg of [90,270,180]){ step('turn'); const dd=await rec(rotate(small,deg),3); const s=vocabScore(allWords(dd)); if(s>score*1.3+2){ score=s; rot=deg; kind=kk; } if(score>=12) break; }
      if(rot) break; }
    if(rot){ en=prep(rotate(mid,rot),kind); d=await rec(en,3); words=allWords(d); score=vocabScore(words); } }
  // crop to the text block and zoom so letters are ~30px tall, then read again (both looks)
  const b=textBox(words,en.width,en.height);
  if(b&&b.mh>0&&(b.w*b.h<en.width*en.height*.8||b.mh<22)){ step('zoom');
    const fullSc=base.width/(rot%180?en.height:en.width); const src=rotate(base,rot);
    const bb={x:Math.round(b.x*fullSc),y:Math.round(b.y*fullSc),w:Math.round(b.w*fullSc),h:Math.round(b.h*fullSc)};
    const want=Math.min(3, 30/(b.mh*fullSc)); let cz=crop(src,bb); const f=Math.min(want,2600/Math.max(cz.width,cz.height)); cz=scaleTo(cz,f);
    for(const kk of [kind, kind==='raw'?'enh':'raw']){ const d2=await rec(prep(cz,kk),3); const s2=vocabScore(allWords(d2)); if(s2>=score){ d=d2; score=s2; } if(score>=60) break; } }
  const text=clean(d.text||''); const tw=(text.match(/[a-z]{3,}/gi)||[]).length;
  return {text, score, rotated:rot, ok: score>=10 && tw>=4, conf:d.confidence, look:kind}; }
window.PCOCR={readLabel,warm,enhance,spellFix,clean,_vocab:()=>{ buildVocab(); return VOCAB; }};
})();
