/* Food Check engine v0: report parser + offline matcher. No network, no AI. Works for 50-2,000+ item panels. */
(function(root){
'use strict';
const STOP=new Set(['organic','fresh','natural','pure','raw','pasteurized','pasteurised','part','skim','low','moisture','reduced','nonfat','lowfat','contains','less','than','of','the','a','an','or','with','and','for','color','colour','added','to','preserve','freshness','as','from','made','in','by','its','product','ingredients','ingredient','including']);
const IRR={leaves:'leaf',potatoes:'potato',tomatoes:'tomato',olives:'olive',chives:'chive',dates:'date',grapes:'grape',noodles:'noodle',molasses:'molasses',asparagus:'asparagus',couscous:'couscous',hummus:'hummus',citrus:'citrus',gas:'gas',swiss:'swiss',brussels:'brussels',lentils:'lentil',oats:'oat',chips:'chip',fries:'fry',cookies:'cookie',greens:'green',sprouts:'sprout'};
function stem(w){ if(IRR[w])return IRR[w]; if(w.length<=3)return w;
  if(/ies$/.test(w))return w.slice(0,-3)+'y'; if(/(ches|shes|sses|xes|oes)$/.test(w))return w.slice(0,-2);
  if(/s$/.test(w)&&!/(ss|us|is)$/.test(w))return w.slice(0,-1); return w;}
function toks(s){ return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/['’`]/g,'').replace(/\bmono\s*-?\s*and\s*-?\s*di/g,'monoanddi').replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean).map(stem); }
function norm(s){ return toks(s).join(' '); }
function keyToks(s){ return toks(s).filter(t=>!STOP.has(t)); }

/* ---------- Hidden-ingredient knowledge base ----------
 term -> [note, tier1, tier2, exclude]. Tier entries: '=x' exact item key, 'x' item key contains phrase x, '#cat' report category.
 Tier1 = what it is made from (counts toward verdict). Tier2 = possible source (shown as "check"). */
const PLANT=['soy','oat','almond','coconut','rice','cashew','hemp','flax','pea','macadamia','peanut','cocoa','cacao','chocolate','pickle','apple','shea','sunflower','nut','seed','buckwheat'];
const DAIRY1=['=milk','=cow milk','whole milk','boiled milk','condensed milk','evaporated milk','milk powder','milk protein','whey','casein','=lactose'];
const DAIRYALL=['milk','cream','butter','cheese','yogurt','kefir','whey','casein','ghee','quark','lactose','#dairy'];
const WHEAT1=['=wheat','=wheat flour','=whole wheat flour','=durum wheat','=wheat berry','=gluten'];
const WHEATALL=['wheat','spelt','farro','einkorn','emmer','kamut','triticale','freekeh','couscous','seitan','gluten','semolina'];
const CORN1=['=corn','=corn flour','=yellow cornmeal','=cornstarch','=corn syrup','=high fructose corn syrup','=maltodextrin','=dextrose'];
const SOY1=['=soy','=soybean','=soybean flour','soy protein','=soybean oil','=tofu','=edamame','=soy lecithin'];
const SOYALL=['soy','tofu','tempeh','edamame','miso','tamari'];
const BEEF=['beef','steak','brisket','chuck','prime rib','tri tip','filet mignon','tenderloin','=bison steak'];
const PORK=['pork','ham','bacon','lard','sausage'];
const EGG=['egg','#eggs'];
const OIL=['oil'];
const K={
'whey':['milk protein (dairy)',['whey','=milk','=cow milk','boiled milk','casein','milk protein'],DAIRYALL,PLANT],
'whey protein':['milk protein (dairy)',['whey'],DAIRYALL,PLANT],
'casein':['milk protein (dairy)',['casein','=milk','=cow milk','boiled milk','milk protein'],DAIRYALL,PLANT],
'caseinate':['milk protein (dairy)',['casein','=milk','=cow milk','milk protein'],DAIRYALL,PLANT],
'sodium caseinate':['milk protein (dairy)',['casein','=milk','milk protein'],DAIRYALL,PLANT],
'lactose':['milk sugar (dairy)',['=lactose','=milk','=cow milk','boiled milk','milk powder'],DAIRYALL,PLANT],
'milk':['dairy',DAIRY1,DAIRYALL,PLANT],'nonfat milk':['dairy',DAIRY1,DAIRYALL,PLANT],'whole milk':['dairy',DAIRY1,DAIRYALL,PLANT],
'milk solid':['dairy',DAIRY1,DAIRYALL,PLANT],'milkfat':['dairy (butterfat)',['butter','cream','=milk'],DAIRYALL,PLANT],'milk fat':['dairy (butterfat)',['butter','cream','=milk'],DAIRYALL,PLANT],
'butter':['dairy',['=butter','salted butter','unsalted butter'],DAIRYALL,PLANT],'butterfat':['dairy',['butter','cream'],DAIRYALL,PLANT],
'ghee':['clarified butter (dairy)',['ghee','clarified butter'],DAIRYALL,PLANT],
'cream':['dairy',['=cream','clotted cream'],DAIRYALL,PLANT],'heavy cream':['dairy',['=cream'],DAIRYALL,PLANT],
'cheese':['dairy — type not stated',[],['cheese','=milk','#dairy'],PLANT],'cheese culture':['dairy cultures',[],['cheese','#dairy'],PLANT],
'american cheese':['processed cheese (dairy)',['=american cheese','cheddar cheese','colby cheese'],DAIRYALL,PLANT],
'yogurt':['dairy',['=plain yogurt','greek yogurt'],DAIRYALL,PLANT],'enzyme':['often from milk (cheese rennet)',[],['#dairy'],PLANT],
'egg':['egg',EGG,['egg'],['eggplant','eggshell']],'albumin':['egg white protein',['egg white','=egg'],EGG,['eggplant']],'mayonnaise':['egg + oil',['egg yolk','=egg'],['egg','oil'],['eggplant']],
'flour':['usually wheat',WHEAT1,WHEATALL,[]],'enriched flour':['wheat',WHEAT1,WHEATALL,[]],'bleached flour':['wheat',WHEAT1,WHEATALL,[]],'all purpose flour':['wheat',WHEAT1,WHEATALL,[]],
'wheat flour':['wheat',WHEAT1,WHEATALL,[]],'enriched wheat flour':['wheat',WHEAT1,WHEATALL,[]],'whole wheat flour':['whole wheat incl. germ',WHEAT1.concat(['wheat germ']),WHEATALL,[]],
'semolina':['durum wheat',['durum wheat','=wheat'],WHEATALL,[]],'gluten':['wheat protein',WHEAT1.concat(['seitan']),WHEATALL,[]],'vital wheat gluten':['wheat protein',WHEAT1.concat(['seitan']),WHEATALL,[]],
'malt':['usually barley',['=malt','=barley'],['malt','barley'],[]],'malted barley':['barley',['=malt','=barley'],['malt'],[]],'malt extract':['barley',['=malt','=barley'],['malt'],[]],'barley malt':['barley',['=malt','=barley'],['malt'],[]],
'bread':['wheat, yeast, oil, sugar',WHEAT1,WHEATALL.concat(['yeast','sugar','oil']),[]],'bun':['wheat, yeast, oil, sugar',WHEAT1,WHEATALL.concat(['sugar']),[]],'pasta':['durum wheat',['durum wheat','=wheat'],WHEATALL,[]],'breadcrumb':['wheat',WHEAT1,WHEATALL,[]],'crouton':['wheat',WHEAT1,WHEATALL,[]],
'corn syrup':['corn',CORN1,['corn'],['peppercorn']],'high fructose corn syrup':['corn',CORN1,['corn'],['peppercorn']],'cornstarch':['corn',CORN1,['corn'],['peppercorn']],'corn starch':['corn',CORN1,['corn'],['peppercorn']],
'dextrose':['usually corn sugar',CORN1,['corn'],['peppercorn']],'maltodextrin':['usually corn (sometimes wheat)',CORN1,['corn','wheat'],['peppercorn']],'glucose syrup':['corn or wheat',CORN1,['corn','wheat'],['peppercorn']],
'caramel color':['often from corn',[],['corn','sugar'],['peppercorn']],'citric acid':['usually fermented from corn',[],['corn'],['peppercorn']],'xanthan gum':['fermented, often on corn/soy/wheat',['xanthan gum'],['corn','soy','wheat'],['peppercorn']],
'sorbitol':['often from corn',['sorbitol'],['corn'],['peppercorn']],'erythritol':['often from corn',['erythritol'],['corn'],['peppercorn']],'ascorbic acid':['often from corn',[],['corn'],['peppercorn']],
'modified food starch':['corn, wheat, potato or tapioca',['modified food starch'],['corn','wheat','potato','cassava','#modified starch'],['peppercorn']],'modified corn starch':['corn',CORN1.concat(['modified food starch']),['corn','#modified starch'],['peppercorn']],'food starch':['corn, wheat or potato',['modified food starch'],['corn','wheat','potato'],['peppercorn']],
'starch':['corn, wheat, potato or tapioca',[],['corn','wheat','potato','cassava'],['peppercorn']],'tapioca':['cassava',['cassava','yuca'],[],[]],'tapioca starch':['cassava',['cassava','yuca'],[],[]],
'corn tortilla':['corn',CORN1,['corn'],['peppercorn']],'masa':['corn',CORN1,['corn'],['peppercorn']],'tortilla chip':['corn + oil',CORN1,['corn','oil'],['peppercorn']],'popcorn':['corn',CORN1,['corn'],['peppercorn']],'cornmeal':['corn',CORN1,['corn'],['peppercorn']],
'soy lecithin':['soy',SOY1,SOYALL,[]],'lecithin':['usually soy or sunflower',['=soy lecithin','=sunflower lecithin'],['soy','sunflower'],[]],'sunflower lecithin':['sunflower',['=sunflower lecithin'],['sunflower'],[]],
'soy':['soy',SOY1,SOYALL,[]],'soya':['soy',SOY1,SOYALL,[]],'soy protein':['soy',['soy protein','=soy'],SOYALL,[]],'textured vegetable protein':['soy',['soy protein','=soy'],SOYALL,[]],'tvp':['soy',['soy protein'],SOYALL,[]],
'hydrolyzed soy protein':['soy + free glutamate (MSG-like)',['soy protein','=soy'],SOYALL.concat(['glutamate','msg']),[]],'hydrolyzed vegetable protein':['soy/corn/wheat + glutamate',[],['soy','corn','wheat','glutamate','msg'],[]],
'soy sauce':['soy + wheat',['soy sauce'],['soy','wheat','tamari'],[]],'tamari':['soy',['tamari'],['soy'],[]],'miso':['soy',['miso'],['soy'],[]],
'vegetable oil':['soy, canola, corn, cottonseed, sunflower or palm',['=vegetable oil'],['soybean oil','canola oil','cottonseed oil','sunflower oil','palm oil','corn oil','safflower oil'],[]],
'vegetable shortening':['palm or soybean oil',[],['palm oil','soybean oil','cottonseed oil'],[]],'shortening':['palm or soybean oil',[],['palm oil','soybean oil','cottonseed oil','lard'],[]],
'margarine':['vegetable oils (+ sometimes whey)',[],['soybean oil','palm oil','canola oil','whey'],[]],'palm kernel oil':['palm',['palm oil'],[],[]],'hydrogenated oil':['soy/cottonseed/palm',[],['soybean oil','cottonseed oil','palm oil'],[]],
'natural flavor':['undisclosed — can hide dairy, soy, corn, glutamate',[],['#flavor enhancer'],[]],'natural flavoring':['undisclosed',[],['#flavor enhancer'],[]],'artificial flavor':['undisclosed',[],[],[]],'flavor':['undisclosed',[],['#flavor enhancer'],[]],
'spice':['undisclosed spice blend',[],['#spices'],[]],'seasoning':['blend — usually salt, spices, sugar, often MSG',[],['#spices','#seasoning','salt','msg'],[]],
'yeast extract':['free glutamate (MSG-like)',['yeast extract'],['glutamate','msg','yeast','#flavor enhancer'],[]],'autolyzed yeast':['free glutamate (MSG-like)',['yeast extract'],['glutamate','msg','yeast'],[]],'autolyzed yeast extract':['free glutamate (MSG-like)',['yeast extract'],['glutamate','msg','yeast'],[]],
'msg':['monosodium glutamate',['=msg','monosodium glutamate'],['glutamate','#flavor enhancer'],[]],'monosodium glutamate':['MSG',['=msg','monosodium glutamate'],['glutamate'],[]],
'sugar':['cane or beet sugar',['=white sugar','=cane sugar','=sugar'],['sugar'],['coconut','brown']],'cane sugar':['sugar',['=cane sugar','=white sugar'],['sugar'],['coconut']],'brown sugar':['sugar + molasses',['brown sugar'],['molasses','sugar'],['coconut']],
'honey':['honey',['honey'],[],[]],'cocoa':['cacao',['=cocoa','cacao'],['chocolate'],[]],'cocoa butter':['cacao fat',['=cocoa','cacao'],['chocolate'],[]],'chocolate':['cacao, sugar, often milk + soy lecithin',['chocolate','cacao','=cocoa'],['sugar','=milk','soy lecithin'],[]],
'salt':['salt',['=table salt','=sea salt','=salt'],['salt'],['celery']],'sea salt':['salt',['=sea salt'],['salt'],['celery']],
'silicon dioxide':['anti-caking agent (silica)',['silicon dioxide','silica'],['#anti caking agent','silicate'],[]],'silica':['anti-caking agent',['silica','silicon dioxide'],['#anti caking agent'],[]],'anticaking agent':['anti-caking agent — type not stated',[],['#anti caking agent'],[]],'anti caking agent':['anti-caking agent — type not stated',[],['#anti caking agent'],[]],
'calcium silicate':['anti-caking agent',['calcium silicate'],['#anti caking agent'],[]],'cellulose':['anti-caking / filler (wood pulp)',['=cellulose','microcrystalline cellulose','vegetable cellulose'],['cellulose'],[]],'powdered cellulose':['anti-caking agent (on shredded cheese)',['microcrystalline cellulose','vegetable cellulose','=cellulose'],['cellulose','#anti caking agent'],[]],
'potato starch':['potato',['potato'],['starch'],[]],'natamycin':['mold inhibitor (cheese)',['natamycin'],['#preservative'],[]],
'sodium nitrite':['curing salt',['sodium nitrite'],['nitrite','nitrate'],[]],'celery powder':['natural nitrite source',['celery'],['nitrite','nitrate'],[]],'cultured celery':['natural nitrite source',['celery'],['nitrite','nitrate'],[]],
'sulfite':['preservative',['sulfite','sulfur dioxide','metabisulfite'],['#preservative'],[]],'sodium bisulfite':['sulfite',['hydrogen sulfite','sulfite'],[],[]],'potassium metabisulfite':['sulfite',['potassium metabisulfite'],['sulfite'],[]],
'mono and diglyceride':['emulsifier from soy/palm/animal fat',['=mono and diglyceride'],['soybean oil','palm oil','animal stearin','lard','beef tallow'],[]],'monoanddiglyceride':['emulsifier from soy/palm/animal fat',['=mono and diglyceride'],['soybean oil','palm oil','animal stearin','lard','beef tallow'],[]],
'gelatin':['animal collagen (pork/beef)',['gelatin'],['porcine collagen','bovine collagen','collagen'],[]],'collagen':['animal protein',['collagen'],['gelatin'],[]],
'carmine':['red dye from insects',['carmine'],[],[]],'confectioner glaze':['shellac',['shellac'],['#coating'],[]],'resinous glaze':['shellac',['shellac'],['#coating'],[]],'wax':['coating wax',[],['wax','#coating'],[]],
'pepperoni':['pork + beef, paprika, nitrite',['pork sausage','ground pork'],PORK.concat(BEEF,['paprika','sodium nitrite','black pepper','garlic powder']),[]],
'sausage':['pork + spices',['pork sausage'],PORK.concat(['fennel seed','black pepper','sodium nitrite']),[]],'bacon':['cured pork',['bacon'],PORK.concat(['sodium nitrite']),[]],'ham':['cured pork',['=ham'],PORK.concat(['sodium nitrite']),[]],
'beef':['beef',['=beef','ground beef','ground angus beef'],BEEF,['jerky','bone broth','liver','heart','kidney']],'ground beef':['beef',['=beef','ground angus beef','ground beef','ground wagyu beef'],BEEF,['jerky','broth','liver','heart','kidney']],
'pork':['pork',['=pork','ground pork'],PORK,[]],'chicken':['chicken',['=chicken','chicken breast','chicken thigh','ground chicken'],['chicken'],['egg','liver','heart','collagen','broth']],'turkey':['turkey',['=turkey','turkey breast','ground turkey'],['turkey'],['liver','tail']],
'chicken broth':['chicken',['chicken bone broth'],['chicken'],['egg']],'beef broth':['beef',['beef bone broth'],BEEF,[]],'broth':['meat or veg stock, often with yeast extract',[],['bone broth','yeast extract','onion','celery'],[]],'stock':['meat or veg stock',[],['bone broth','yeast extract','onion','celery'],[]],
'fish':['fish',['=fish'],['#seafood'],['shrimp','crab','lobster','clam','oyster','mussel','scallop','prawn','crayfish','squid','octopus','snail','jellyfish','cuttlefish']],
'shellfish':['crustaceans + mollusks',['=shellfish'],['shrimp','crab','lobster','clam','oyster','mussel','scallop','prawn','crayfish'],[]],'shrimp':['shrimp',['=shrimp','shrimp'],['prawn'],[]],'crab':['crab',['crab'],[],[]],'tuna':['tuna',['tuna'],[],[]],'salmon':['salmon',['salmon'],['trout'],[]],'anchovy':['anchovy',['anchovy'],[],[]],
'fish sauce':['anchovy',['fish sauce','anchovy'],[],[]],'worcestershire sauce':['anchovy, vinegar, molasses',['worcestershire'],['anchovy','malt vinegar','molasses','tamarind'],[]],'oyster sauce':['oyster',['oyster sauce'],['oyster'],[]],
'peanut':['peanut',['peanut'],[],['oil']],'tree nut':['tree nuts',['=tree nut'],['#nuts'],['peanut']],'nut':['nuts — type not stated',[],['#nuts'],[]],'almond':['almond',['=almond'],['almond'],[]],
'vinegar':['usually corn-based white vinegar',['=white vinegar','=vinegar'],['vinegar','corn'],['peppercorn']],'distilled vinegar':['usually corn',['=white vinegar'],['corn','vinegar'],['peppercorn']],
'ketchup':['tomato, vinegar, sugar/HFCS, onion',['=ketchup','=tomato'],['vinegar','sugar','high fructose corn syrup','onion powder','corn'],['peppercorn']],'mustard':['mustard seed, vinegar, turmeric',['=mustard','mustard seed'],['vinegar','turmeric'],['green']],
'tomato':['tomato',['=tomato'],['tomato'],['tomatillo']],'tomato paste':['tomato',['=tomato'],[],['tomatillo']],'tomato puree':['tomato',['=tomato'],[],['tomatillo']],'tomato sauce':['tomato, onion, garlic, basil, oil',['=tomato'],['basil','oregano','garlic','onion','olive oil'],['tomatillo']],'marinara':['tomato, garlic, basil, olive oil',['=tomato'],['basil','oregano','garlic','olive oil','onion'],['tomatillo']],'salsa':['tomato, onion, chili, cilantro, lime',['=tomato'],['onion','jalapeno','cilantro','lime'],['tomatillo']],
'onion':['onion',['=onion','=yellow onion','=white onion'],['onion'],['pearl']],'garlic':['garlic',['=garlic','garlic white'],['garlic'],[]],'potato':['potato',['=potato','white potato'],['potato'],['sweet']],'pepper':['black pepper or bell pepper',[],['black pepper','bell pepper'],[]],
'chili pepper':['chili',[],['jalapeno','serrano','cayenne','chili powder','habanero','red pepper flake'],[]],'chile':['chili',[],['jalapeno','serrano','poblano','cayenne','chili powder'],[]],'paprika extract':['paprika (color)',['paprika'],[],[]],'annatto':['color from achiote seed',['annatto'],[],[]],'turmeric':['turmeric',['turmeric'],[],[]],
'lettuce':['lettuce',['=lettuce','iceberg lettuce','romaine lettuce'],['lettuce'],[]],'mushroom':['mushroom — type not stated',['=mushroom','button mushroom'],['mushroom'],[]],'olive':['olive',['olive'],[],['oil']],'avocado':['avocado',['=avocado'],['avocado'],[]],'guacamole':['avocado, onion, lime, cilantro',['=avocado'],['onion','lime','cilantro','jalapeno','tomato'],['oil']],
'yeast':['yeast',['=yeast'],['yeast','nutritional yeast'],[]],'baking soda':['sodium bicarbonate',[],[],[]],'baking powder':['often contains cornstarch',[],['corn','cornstarch'],['peppercorn']],
'lemon juice':['lemon',['lemon'],[],[]],'apple':['apple',['=apple'],['apple'],['cashew','pineapple']],'grape':['grape',['=grape'],['grape'],['grapefruit']],
'red 40':['synthetic dye',['red 40'],[],[]],'tbhq':['preservative',['tbhq'],[],[]],'titanium dioxide':['whitener',['titanium dioxide'],[],[]]
};
// E-numbers -> report names
const E={e551:'silicon dioxide',e552:'calcium silicate',e554:'sodium aluminosilicate',e555:'aluminum potassium silicate',e556:'aluminum calcium silicate',e558:'bentonite',e559:'aluminum silicate',e530:'magnesium oxide',e553b:'talc',e570:'stearic acid',e470b:'magnesium stearate',e341:'tricalcium phosphate',e575:'glucono delta lactone',e578:'calcium gluconate',e904:'shellac',e901:'beeswax',e902:'candelilla wax',e903:'carnauba wax',e905:'microcrystalline wax',e912:'montanic acid ester',e462:'ethylcellulose',e621:'monosodium glutamate',e622:'monopotassium glutamate',e623:'calcium diglutamate',e624:'monoammonium glutamate',e625:'magnesium diglutamate',e620:'glutamic acid',e626:'guanylic acid',e627:'disodium guanylate',e628:'dipotassium guanylate',e629:'calcium guanylate',e630:'inosinic acid',e631:'disodium inosinate',e632:'dipotassium inosinate',e633:'dicalcium inosinate',e634:'calcium 5 ribonucleotide',e635:'disodium 5 ribonucleotide',e640:'glycine and sodium salt',e1404:'oxidized starch',e1410:'monostarch phosphate',e1412:'distarch phosphate',e1413:'phosphated distarch phosphate',e1414:'acetylated distarch phosphate',e1420:'acetylated starch',e1440:'hydroxypropyl starch',e1442:'hydroxypropyl distarch phosphate',e1450:'starch sodium octenylsuccinate',e234:'nisin',e235:'natamycin',e283:'potassium propionate',e282:'calcium propionate',e281:'sodium propionate',e280:'propionic acid',e202:'potassium sorbate',e200:'sorbic acid',e203:'calcium sorbate',e210:'benzoic acid',e211:'sodium benzoate',e213:'calcium benzoate',e220:'sulfur dioxide',e221:'sodium sulfite',e222:'sodium hydrogen sulfite',e223:'sodium metabisulfite',e224:'potassium metabisulfite',e226:'calcium sulfite',e227:'calcium hydrogen sulfite',e242:'dimethyl dicarbonate',e249:'potassium nitrite',e250:'sodium nitrite',e251:'sodium nitrate',e252:'potassium nitrate',e262:'sodium diacetate',e325:'sodium lactate',e326:'potassium lactate',e1105:'lysozyme',e239:'hexamethylenetetramine',e214:'ethyl paraben',e218:'methyl paraben',e440:'pectin',e410:'locust bean gum',e412:'guar gum',e415:'xanthan gum',e417:'tara gum',e418:'gellan gum',e414:'gum arabic',e416:'karaya gum',e425:'konjac gum',e407:'carrageenan',e407a:'treated eucheuma seaweed',e401:'sodium alginate',e402:'potassium alginate',e403:'ammonium alginate',e405:'propylene glycol alginate',e460:'microcrystalline cellulose',e461:'methylcellulose',e463:'hydroxypropyl cellulose',e464:'hydroxypropyl methylcellulose',e465:'ethyl methylcellulose',e466:'carboxymethyl cellulose',e1200:'polydextrose',e508:'potassium chloride',e517:'ammonium sulfate',e523:'aluminum ammonium sulfate',e955:'sucralose',e950:'acesulfame k',e951:'aspartame',e954:'saccharin',e952:'sodium cyclamate',e957:'thaumatin',e961:'neotame',e960:'stevia',e420:'sorbitol',e421:'mannitol',e953:'isomalt',e965:'maltitol',e966:'lactitol',e967:'xylitol',e968:'erythritol',e160b:'annatto',e160c:'paprika',e100:'turmeric',e120:'carmine',e322:'lecithin',e471:'mono and diglyceride',e330:'citric acid',e150:'caramel color',e150a:'caramel color',e150d:'caramel color',e171:'titanium dioxide',e129:'red 40',e319:'tbhq'};
// Typical-recipe knowledge for dishes and menu items (used when no ingredient list is given).
const DISH={
'pizza':'wheat flour, yeast, olive oil, sugar, salt, tomato sauce, mozzarella cheese, oregano, basil, garlic',
'cheese pizza':'wheat flour, yeast, olive oil, sugar, salt, tomato sauce, mozzarella cheese, parmesan cheese, oregano, basil, garlic',
'pepperoni pizza':'wheat flour, yeast, olive oil, sugar, salt, tomato sauce, mozzarella cheese, pepperoni, oregano, basil, garlic',
'margherita':'wheat flour, yeast, olive oil, salt, tomato, mozzarella cheese, basil',
'burger':'bun, ground beef, lettuce, tomato, onion, dill pickle, ketchup, mustard, salt, black pepper',
'hamburger':'bun, ground beef, lettuce, tomato, onion, dill pickle, ketchup, mustard, salt, black pepper',
'cheeseburger':'bun, ground beef, american cheese, lettuce, tomato, onion, dill pickle, ketchup, mustard, salt, black pepper',
'taco':'corn tortilla, ground beef, chili powder, cumin, garlic powder, onion powder, lettuce, cheddar cheese, tomato, sour cream',
'burrito':'wheat flour tortilla, rice, pinto bean, ground beef, cheddar cheese, sour cream, salsa, cumin, chili powder',
'quesadilla':'wheat flour tortilla, monterey jack cheese, cheddar cheese, vegetable oil',
'nacho':'tortilla chip, cheddar cheese, jalapeno pepper, sour cream, salsa, pinto bean',
'caesar salad':'romaine lettuce, parmesan cheese, crouton, egg yolk, anchovy, lemon juice, garlic, olive oil, worcestershire sauce, black pepper',
'garden salad':'green leaf lettuce, tomato, cucumber, carrot, red onion',
'cobb salad':'romaine lettuce, chicken breast, bacon, egg, avocado, blue cheese, tomato',
'spaghetti':'pasta, tomato sauce, garlic, olive oil, basil, parmesan cheese',
'spaghetti and meatball':'pasta, tomato sauce, ground beef, ground pork, breadcrumb, egg, parmesan cheese, garlic, onion, parsley',
'lasagna':'pasta, ground beef, tomato sauce, ricotta cheese, mozzarella cheese, parmesan cheese, egg, basil, garlic, onion',
'mac and cheese':'pasta, cheddar cheese, milk, butter, wheat flour, salt',
'macaroni and cheese':'pasta, cheddar cheese, milk, butter, wheat flour, salt',
'alfredo':'pasta, butter, cream, parmesan cheese, garlic',
'fried chicken':'chicken, wheat flour, egg, buttermilk, paprika, garlic powder, black pepper, vegetable oil',
'chicken nugget':'chicken, wheat flour, modified food starch, vegetable oil, salt, dextrose, yeast extract',
'chicken tender':'chicken, wheat flour, egg, vegetable oil, salt, black pepper',
'french fry':'potato, vegetable oil, salt, dextrose',
'fries':'potato, vegetable oil, salt, dextrose',
'hot dog':'bun, pork, beef, salt, corn syrup, sodium nitrite, paprika, mustard',
'grilled cheese':'bread, butter, american cheese',
'bacon egg and cheese':'bun, bacon, egg, american cheese, butter',
'pancake':'wheat flour, milk, egg, sugar, baking powder, butter, maple syrup',
'waffle':'wheat flour, milk, egg, sugar, baking powder, butter',
'omelet':'egg, butter, milk, cheddar cheese',
'scrambled egg':'egg, butter, milk, salt',
'steak':'beef, salt, black pepper, butter, garlic',
'ribeye':'ribeye steak, salt, black pepper, butter',
'chili':'ground beef, kidney bean, tomato, onion, chili powder, cumin, garlic',
'sushi':'white rice, rice vinegar, sugar, salt, nori, salmon, tuna, soy sauce, wasabi',
'california roll':'white rice, rice vinegar, sugar, crab, imitation crab, cucumber, avocado, mayonnaise, sesame seed',
'fried rice':'white rice, egg, soy sauce, green pea, carrot, scallion, vegetable oil, sesame oil',
'pad thai':'rice noodle, egg, shrimp, peanut, fish sauce, tamari, sugar, lime, bean sprout, scallion',
'ramen':'wheat noodle, pork, broth, soy sauce, miso, egg, scallion, yeast extract',
'pho':'rice noodle, beef, broth, fish sauce, onion, ginger root, basil, cilantro, lime',
'curry':'onion, garlic, ginger root, yellow curry powder, coconut milk, tomato, vegetable oil',
'butter chicken':'chicken, butter, cream, tomato, onion, garlic, ginger root, garam masala, cumin, plain yogurt',
'gyro':'pita, lamb, beef, tzatziki, plain yogurt, cucumber, garlic, onion, tomato',
'hummus':'chickpea, tahini, lemon juice, garlic, olive oil, salt',
'falafel':'chickpea, onion, garlic, parsley, cilantro, cumin, vegetable oil',
'club sandwich':'bread, turkey breast, bacon, lettuce, tomato, mayonnaise',
'blt':'bread, bacon, lettuce, tomato, mayonnaise',
'chicken wing':'chicken wing, vegetable oil, butter, cayenne pepper, vinegar, garlic powder',
'buffalo wing':'chicken wing, vegetable oil, butter, cayenne pepper, vinegar, garlic powder',
'clam chowder':'clams, potato, cream, butter, onion, celery, wheat flour, bacon',
'fish and chip':'fish, wheat flour, malt vinegar, potato, vegetable oil, salt',
'fish taco':'fish, corn tortilla, white cabbage, lime, sour cream, mayonnaise, cilantro',
'smoothie':'banana, strawberries, plain yogurt, honey, milk',
'ice cream':'cream, milk, sugar, egg yolk, corn syrup, guar gum, carrageenan',
'milkshake':'ice cream, milk, whipped cream',
'cheesecake':'cream cheese, sugar, egg, wheat flour, butter, graham cracker',
'brownie':'chocolate, butter, sugar, egg, wheat flour, cocoa',
'chocolate chip cookie':'wheat flour, butter, sugar, brown sugar, egg, chocolate, baking soda, salt',
'donut':'wheat flour, sugar, vegetable oil, egg, milk, yeast, soy lecithin',
'bagel':'wheat flour, malt, yeast, salt, sugar',
'croissant':'wheat flour, butter, milk, sugar, yeast, egg',
'oatmeal':'oat, milk, brown sugar, cinnamon',
'latte':'milk, coffee','cappuccino':'milk, coffee','mocha':'milk, coffee, chocolate, whipped cream',
'potato chip':'potato, vegetable oil, salt','cheese puff':'cornmeal, vegetable oil, whey, cheddar cheese, salt, maltodextrin, natural flavor, annatto',
'enchilada':'corn tortilla, chicken, enchilada sauce, chili powder, monterey jack cheese, onion',
'mashed potato':'potato, butter, milk, salt','baked potato':'potato, butter, sour cream, chives, bacon, cheddar cheese',
'meatloaf':'ground beef, breadcrumb, egg, onion, ketchup, worcestershire sauce',
'pot roast':'chuck roast, carrot, potato, onion, celery, beef broth, thyme',
'shrimp scampi':'shrimp, butter, garlic, white wine, lemon juice, pasta, parsley',
'poke':'tuna, salmon, soy sauce, sesame oil, scallion, white rice, avocado, seaweed'
};
/* ---------- index ---------- */
function itemKeys(name){ const out=new Set(); let s=String(name).replace(/\s*\/\s*/g,' and ');
  const m=s.match(/^(.*?)\s*\(([^)]*)\)\s*(.*)$/); let base=s, par='';
  if(m){ base=(m[1]+' '+m[3]).trim(); par=m[2].trim(); }
  const b=keyToks(base).join(' '); if(b) out.add(b);
  if(par && !/^raw$/i.test(par)){ const p=keyToks(par).join(' '); if(p){ out.add(p+' '+b); if(/^(msg|cassava|graviola)$/.test(p)) out.add(p);} }
  out.add(keyToks(s).join(' ')); out.delete(''); return [...out]; }
function Index(profile){ // profile.items: [{name, cat, level}] level 0 = tested clear / unflagged
  this.items=profile.items; this.byFirst=new Map(); this.byKey=new Map(); this.catOf=new Map();
  this.items.forEach((it,i)=>{ it._keys=itemKeys(it.name); it._ck=norm(it.cat||''); it._full=keyToks(it.name.replace(/\(raw\)/i,'')).join(' ');
    it._keys.forEach(k=>{ const f=k.split(' ')[0]; if(!this.byFirst.has(f))this.byFirst.set(f,[]); this.byFirst.get(f).push([k.split(' '),i]);
      if(!this.byKey.has(k))this.byKey.set(k,[]); this.byKey.get(k).push(i); }); });
  this.kbFirst=new Map(); const kbSeen=new Set(); Object.keys(K).forEach(t=>{ const tt=keyToks(t); const f=tt[0]; if(!f||kbSeen.has(tt.join(' ')))return; kbSeen.add(tt.join(' ')); if(!this.kbFirst.has(f))this.kbFirst.set(f,[]); this.kbFirst.get(f).push([tt,t]); });
  Object.keys(DISH).forEach(()=>{});
  this.cache=new Map();
}
Index.prototype.resolve=function(spec,excl){ // spec list -> item indices
  const ck=JSON.stringify([spec,excl]); if(this.cache.has(ck))return this.cache.get(ck);
  const ex=(excl||[]).map(x=>norm(x)); const out=new Set();
  spec.forEach(s=>{ if(s[0]==='='){ (this.byKey.get(keyToks(s.slice(1)).join(' '))||[]).forEach(i=>out.add(i)); return; }
    if(s[0]==='#'){ const c=norm(s.slice(1)); this.items.forEach((it,i)=>{ if(it._ck===c)out.add(i); }); return; }
    const p=' '+keyToks(s).join(' ')+' '; this.items.forEach((it,i)=>{ if(it._keys.some(k=>(' '+k+' ').includes(p)))out.add(i); }); });
  const res=[...out].filter(i=>{ const k=' '+this.items[i]._keys.join(' | ')+' '; return !ex.some(x=>k.includes(' '+x+' ')||k.includes(' '+x)); });
  this.cache.set(ck,res); return res; };
/* ---------- ingredient list parsing ---------- */
function splitIngredients(text){ let t=String(text).replace(/\r/g,'\n');
  const m=t.match(/ingredients?\s*[:\-]/i); if(m) t=t.slice(m.index+m[0].length);
  t=t.replace(/\bcontains\s*:?[^.\n]*allergen[^.\n]*/ig,'').replace(/\b(contains|containing)\s+(2|two|1|one)\s*%?\s*(percent)?\s*or less of\s*:?/ig,',').replace(/\b(contains\s+)?less than\s*\d+\s*%\s*(of)?\s*:?/ig,',')
   .replace(/\bmay contain[^.\n]*/ig,'').replace(/\bfor freshness\b|\bto preserve freshness\b|\bas a preservative\b|\bto prevent caking\b/ig,'');
  const out=[]; let depth=0, cur='', parent=[];
  const push=()=>{ const s=cur.replace(/\d+(\.\d+)?\s*%/g,'').replace(/[*†.]+$/g,'').trim(); if(s.replace(/[^a-z]/ig,'').length>1) out.push({text:s,parent:parent[parent.length-1]||null}); cur=''; };
  for(const ch of t){ if(ch==='('||ch==='['||ch==='{'){ const s=cur.trim(); if(s){ out.push({text:s.replace(/\d+%/g,'').trim(),parent:parent[parent.length-1]||null,group:true}); parent.push(s);} else parent.push(parent[parent.length-1]||''); cur=''; depth++; }
    else if(ch===')'||ch===']'||ch==='}'){ push(); parent.pop(); depth=Math.max(0,depth-1); }
    else if(ch===','||ch===';'||ch==='\n'||ch==='•'||ch==='·'){ push(); }
    else if(ch==='.' && depth===0){ push(); }
    else cur+=ch; }
  push(); // split "and"/"or" lists like "soybean and/or canola oil" kept whole; split "salt and pepper"
  const fin=[]; out.forEach(o=>{ if(/\band\/or\b/i.test(o.text)){ const parts=o.text.split(/\band\/or\b|\bor\b/i).map(s=>s.trim()).filter(Boolean); const tail=(parts[parts.length-1].match(/\b(oil|starch|flour|syrup|gum)\b/i)||[])[0];
      parts.forEach(p=>fin.push({text: tail&&!new RegExp('\\b'+tail+'\\b','i').test(p)?p+' '+tail:p, parent:o.parent, alt:true})); } else fin.push(o); });
  return fin; }
/* ---------- matcher ---------- */
function eTrans(t){ return t.replace(/\be\s?-?\s?(\d{3,4}[a-d]?)\b/ig,(m,n)=>E['e'+n.toLowerCase()]?' '+E['e'+n.toLowerCase()]+' ':m); }
Index.prototype.matchPhrase=function(phrase){
  const tk=keyToks(eTrans(phrase)); const spans=[];
  for(let i=0;i<tk.length;i++){
    (this.byFirst.get(tk[i])||[]).forEach(([kt,idx])=>{ if(kt.every((w,j)=>tk[i+j]===w)) spans.push({s:i,e:i+kt.length,kind:'item',idx,key:kt.join(' ')}); });
    (this.kbFirst.get(tk[i])||[]).forEach(([kt,term])=>{ if(kt.every((w,j)=>tk[i+j]===w)) spans.push({s:i,e:i+kt.length,kind:'kb',term}); }); }
  // longest non-overlapping; item beats kb on equal length
  spans.sort((a,b)=>(b.e-b.s)-(a.e-a.s)||(a.kind==='item'?-1:1)); const used=new Array(tk.length).fill(null); const chosen=[];
  spans.forEach(sp=>{ let free=true; for(let j=sp.s;j<sp.e;j++){ if(used[j]&&used[j]!==sp.key+sp.kind){free=false;break;} }
    if(free){ for(let j=sp.s;j<sp.e;j++)used[j]=sp.key+sp.kind; chosen.push(sp);} });
  const hits=[]; const exactKeys=new Set();
  chosen.filter(c=>c.kind==='item').forEach(c=>{ exactKeys.add(c.key); });
  // exact item hits; when a key maps to several items (e.g. "garlic" -> white/purple/black) prefer the plain one
  [...exactKeys].forEach(k=>{ const ids=this.byKey.get(k)||[]; const full=ids.filter(i=>this.items[i]._full===k||this.items[i]._keys[0]===k&&ids.length===1);
    const prim=full.length?full:ids; prim.forEach(i=>hits.push({i,how:'exact',via:null}));
    if(full.length) ids.filter(i=>!full.includes(i)).forEach(i=>hits.push({i,how:'possible',via:'other types of '+k})); });
  // if a KB term is the same word as an exact item, still add its derived info (e.g. "whey" item + milk family)
  const kbTerms=chosen.filter(c=>c.kind==='kb').map(c=>c.term);
  Object.keys(K).forEach(t=>{ const kt=keyToks(t).join(' '); if(exactKeys.has(kt) && !kbTerms.includes(t)) kbTerms.push(t); });
  kbTerms.forEach(t=>{ const [note,t1,t2,ex]=K[t]; this.resolve(t1,ex).forEach(i=>hits.push({i,how:'derived',via:t+' → '+note})); this.resolve(t2,ex).forEach(i=>hits.push({i,how:'possible',via:t+' → '+note})); });
  // dedupe: keep strongest relation per item
  const rank={exact:3,derived:2,possible:1}; const best=new Map();
  hits.forEach(h=>{ const b=best.get(h.i); if(!b||rank[h.how]>rank[b.how]) best.set(h.i,h); });
  const res=[...best.values()].map(h=>Object.assign({item:this.items[h.i]},h));
  res.sort((a,b)=>rank[b.how]-rank[a.how]||b.item.level-a.item.level);
  const notes=kbTerms.map(t=>({term:t,note:K[t][0]}));
  const matchedTok=used.filter(Boolean).length;
  return {phrase,hits:res,notes,known:matchedTok>0};
};
function summarize(hits){ let lvl=0, plvl=0, clear=false;
  hits.forEach(h=>{ if(h.how!=='possible'){ lvl=Math.max(lvl,h.item.level); if(h.item.level===0)clear=true; } else plvl=Math.max(plvl,h.item.level); });
  return {level:lvl, possible:plvl>lvl?plvl:0, clear:clear&&lvl===0}; }
function findDishes(text){ const t=' '+keyToks(text).join(' ')+' '; const found=[];
  Object.keys(DISH).sort((a,b)=>b.length-a.length).forEach(d=>{ const k=' '+keyToks(d).join(' ')+' '; if(t.includes(k) && !found.some(f=>(' '+keyToks(f).join(' ')+' ').includes(k))) found.push(d); });
  return found; }
Index.prototype.analyze=function(text,opts){ opts=opts||{};
  const raw=String(text||'').trim(); if(!raw) return null;
  const looksList=/ingredients?\s*[:\-]/i.test(raw)||(raw.match(/,/g)||[]).length>=2;
  let parts=[], dishes=[];
  if(looksList) parts=splitIngredients(raw).map(p=>Object.assign(p,{src:'label'}));
  else { dishes=findDishes(raw);
    raw.split(/[\n,;+&]|\bwith\b|\band\b/i).map(s=>s.trim()).filter(s=>s.length>1).forEach(s=>parts.push({text:s,src:'typed'}));
    dishes.forEach(d=>splitIngredients(DISH[d]).forEach(p=>parts.push({text:p.text,src:'recipe',dish:d}))); }
  (opts.extra||[]).forEach(p=>parts.push(p));
  const seen=new Set(); const rows=[];
  parts.forEach(p=>{ const k=norm(p.text); if(!k||seen.has(k))return; seen.add(k);
    const m=this.matchPhrase(p.text); if(p.src==='typed' && !m.known && dishes.length) return;
    const s=summarize(m.hits); rows.push(Object.assign({},p,m,s)); });
  let top=0, ptop=0; rows.forEach(r=>{ top=Math.max(top,r.level); ptop=Math.max(ptop,r.possible); });
  return {rows,dishes,level:top,possible:ptop>top?ptop:0,count:{3:rows.filter(r=>r.level===3).length,2:rows.filter(r=>r.level===2).length,1:rows.filter(r=>r.level===1).length}};
};
Index.prototype.analyzeMenu=function(text){ const lines=String(text).split(/\n+/).map(s=>s.trim()).filter(s=>/[a-z]{3}/i.test(s)&&s.length<200);
  return lines.map(l=>{ const a=this.analyze(l.replace(/\$?\d+[.,]?\d*\s*$/,'')); return a&&{line:l,res:a}; }).filter(Boolean); };
/* ---------- report parser (generic; 5Strands-style + level-tagged lines + section headers) ---------- */
const LVL_RX=/\b(?:level|lvl|stage|tier|class|grade)\s*[:#]?\s*([0-6])\b/i;
const WORD_LVL=[[/\b(severe|very high|highest|high|red|avoid|strong)\b/i,3],[/\b(moderate|medium|yellow|elevated|caution|limit)\b/i,2],[/\b(mild|low|green|slight|minor|borderline)\b/i,1],[/\b(none|normal|clear|negative|no reaction|--)\b/i,0]];
function levelOf(s){ const m=s.match(LVL_RX); if(m){ const n=+m[1]; return n>3?3:n; } for(const [rx,l] of WORD_LVL) if(rx.test(s)) return l; return null; }
// rows: [{y, page, cells:[{x, str}]}] (from pdf.js / OCR) or plain lines
function parseReport(input){ const rows=typeof input==='string'?input.split(/\n/).map((l,i)=>({y:-i*20,page:1,cells:[{x:0,str:l}]})):input;
  const found=new Map(); const add=(name,cat,level)=>{ name=name.replace(/\s{2,}/g,' ').replace(/[|•]+/g,'').trim(); if(name.length<2||name.length>60||!/[a-z]/i.test(name))return;
    const k=norm(name)+'|'+norm(cat||''); const prev=found.get(k); if(!prev||(level||0)>(prev.level||0)) found.set(k,{name,cat:cat||'Other',level:level||0}); };
  // Strategy A: "[Category] - Item" with a level marker to the left (handles 2-column + wrapped rows)
  const markers=[], entries=[];
  rows.forEach(r=>{ const line=r.cells.map(c=>c.str).join(' ');
    r.cells.forEach(c=>{ const t=c.str.trim(); if(/^(level|stage)\s*[0-3]$/i.test(t)||t==='--') markers.push({x:c.x,y:r.y,page:r.page,level:t==='--'?0:+t.slice(-1)}); });
    const rx=/\[([^\]]{2,40})\]\s*[-–—:]\s*([^\[\]]+?)(?=\s{3,}|\s+(?:LEVEL|Level|Stage)\s*\d|\s+--\s|\s*$|\s+[A-Z0-9]{4}\s+\[)/g; let m;
    // locate x of each entry from cells
    let acc='', xs=[]; r.cells.forEach(c=>{ xs.push([acc.length,c.x]); acc+=c.str+' '; });
    while((m=rx.exec(acc))){ let x=0; for(const [p,cx] of xs){ if(p<=m.index)x=cx; } entries.push({x,y:r.y,page:r.page,cat:m[1].trim(),name:m[2].trim(),line}); } });
  if(entries.length>=5){ entries.forEach(e=>{ let best=null,bd=1e9; markers.forEach(mk=>{ if(mk.page!==e.page||mk.x>e.x)return; const dx=e.x-mk.x, dy=Math.abs(mk.y-e.y); if(dx>260||dy>26)return; const d=dy*4+dx*0.2; if(d<bd){bd=d;best=mk;} });
      add(e.name,e.cat,best?best.level:0); }); return finish(found,'bracket'); }
  // Strategy B/C: level on the same line, or under a level/section header
  let section=null, cat=null;
  rows.forEach(r=>{ const line=r.cells.map(c=>c.str).join(' ').trim(); if(!line)return;
    const lv=levelOf(line); const words=line.replace(LVL_RX,'').replace(/\b(severe|very high|highest|high|moderate|medium|mild|low|response|reaction|priority|foods?|items?|sensitivit(y|ies)|intolerances?|red|yellow|green)\b/ig,'').replace(/[-–—:|()]/g,' ').trim();
    if(lv!==null && words.length<3){ section=lv; return; }
    if(/^[A-Z][A-Za-z &/]{2,30}:?$/.test(line) && lv===null && section!==null && /:$|^[A-Z &]+$/.test(line)){ cat=line.replace(/:$/,'').trim(); return; }
    if(lv!==null){ const nm=line.replace(LVL_RX,'').replace(/\b(severe|very high|highest|high|moderate|medium|mild|low|red|yellow|green|avoid|limit)\b/ig,'').replace(/[\d.]+\s*%?/g,'').replace(/[-–—:|()]+/g,' ').trim();
      nm.split(/,|;/).forEach(n=>add(n,cat,lv)); return; }
    if(section!==null){ line.split(/,|;|•/).forEach(n=>{ if(n.trim().split(' ').length<=6) add(n.trim(),cat,section); }); } });
  return finish(found,'lines'); }
function finish(found,mode){ const items=[...found.values()]; const c={0:0,1:0,2:0,3:0}; items.forEach(i=>c[i.level]++); return {mode,items,counts:c}; }
// pdf.js text items -> rows
function rowsFromPdfItems(pages){ const rows=[]; pages.forEach((items,pi)=>{ const byY=[]; items.forEach(it=>{ if(!it.str||!it.str.trim())return; const y=it.transform[5], x=it.transform[4];
    let r=byY.find(r=>Math.abs(r.y-y)<3.5); if(!r){ r={y,page:pi+1,cells:[]}; byY.push(r);} r.cells.push({x,str:it.str}); });
  byY.forEach(r=>{ r.cells.sort((a,b)=>a.x-b.x); // insert gap marker for wide gaps
    const c2=[]; r.cells.forEach((c,i)=>{ c2.push(c); }); r.cells=c2; });
  byY.sort((a,b)=>b.y-a.y); byY.forEach(r=>{ // join cells with triple space when far apart so column boundaries survive
    let acc=[]; r.cells.forEach((c,i)=>{ if(i&&c.x-r.cells[i-1].x>(r.cells[i-1].str.length*5.2+40)) acc.push({x:c.x-1,str:'  '}); acc.push(c); }); r.cells=acc; rows.push(r); }); });
  return rows; }
/* ---------- profile share-code (levels packed 2 bits/item over the base catalog) ---------- */
// v: per catalog item, -1 = not in profile, 0 = tested clear, 1..3 = level. Packed base-5, 3 items per byte.
function b64(s){ return (typeof btoa!=='undefined'?btoa(s):Buffer.from(s,'binary').toString('base64')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64(c){ c=c.replace(/-/g,'+').replace(/_/g,'/'); return typeof atob!=='undefined'?atob(c):Buffer.from(c,'base64').toString('binary'); }
function packLevels(v){ let s=''; for(let i=0;i<v.length;i+=3){ let b=0; for(let j=2;j>=0;j--) b=b*5+((v[i+j]==null||v[i+j]<0)?0:v[i+j]+1); s+=String.fromCharCode(b);} return b64(s); }
function unpackLevels(code,n){ const s=unb64(code); const out=[]; for(let i=0;i<s.length;i++){ let b=s.charCodeAt(i); for(let j=0;j<3;j++){ out.push((b%5)-1); b=Math.floor(b/5);} } return out.slice(0,n); }
const API={norm,toks,keyToks,itemKeys,Index,splitIngredients,parseReport,rowsFromPdfItems,packLevels,unpackLevels,findDishes,KB:K,DISH,E};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.FC=API;
})(typeof window!=='undefined'?window:globalThis);
