// Internal visual QA sheets; the delivered figures remain unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.verification');
await fs.mkdir(output, {recursive:true});
const files = (await fs.readdir(path.join(root, 'assets'))).filter(x=>/^ch\d\d-.*\.png$/.test(x)).sort();
for (let start=0; start<files.length; start+=10) {
  const batch = files.slice(start,start+10);
  const layers = [];
  for (let i=0; i<batch.length; i++) {
    const input=await sharp(path.join(root,'assets',batch[i])).resize(900,540,{fit:'contain',background:'#FFFFFF'}).png().toBuffer();
    layers.push({input,left:(i%2)*900,top:Math.floor(i/2)*540});
  }
  const file=path.join(output,`contact-${String(start/10+1).padStart(2,'0')}.png`);
  await sharp({create:{width:1800,height:Math.ceil(batch.length/2)*540,channels:4,background:'#DCE2EA'}}).composite(layers).png().toFile(file);
  console.log(`${file}\n${batch.join('\n')}`);
}
