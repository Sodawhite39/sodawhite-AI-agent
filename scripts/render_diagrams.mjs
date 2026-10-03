// Rebuild original teaching diagrams from their editable JSON descriptions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const style = process.argv[2] || 'editorial';
const palettes = {
  editorial: {bg:'#FFFFFF', ink:'#15243D', muted:'#52627C', accent:'#2563EB', fill:'#EEF4FF'},
  notion: {bg:'#FAFAFA', ink:'#1A1A1A', muted:'#4A4A4A', accent:'#27364B', fill:'#F2F5F8'},
  warm: {bg:'#FFFAF0', ink:'#4A3228', muted:'#725A4D', accent:'#C05621', fill:'#FFF0DF'}
};
if (!palettes[style]) throw new Error('Unknown style');
const p = palettes[style];
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fitFont = (s, available, cap) => Math.min(cap, Math.floor(available / [...s].reduce((sum,c)=>sum+(/[\x00-\x7f]/.test(c)?0.56:1),0)));
const files = (await fs.readdir(path.join(root,'illustrations'))).filter(x=>/^ch\d\d\.json$/.test(x)).sort();
await fs.mkdir(path.join(root,'assets'),{recursive:true});
await fs.mkdir(path.join(root,'illustrations','prompts'),{recursive:true});
let count = 0;
for (const file of files) {
  const figures = JSON.parse(await fs.readFile(path.join(root,'illustrations',file),'utf8'));
  for (const f of figures) {
    if (!/^[a-z0-9-]+$/.test(f.filename)) throw new Error('Unsafe figure filename');
    const nodes = f.nodes;
    if (nodes.length < 2 || nodes.length > 6) throw new Error(`${f.filename}: use 2–6 nodes`);
    const cols = nodes.length > 4 ? 3 : nodes.length === 4 ? 2 : nodes.length;
    const rows = Math.ceil(nodes.length/cols);
    const width = 1800, height = rows===1 ? 800 : 1080;
    const margin = 90, gap = 60;
    const cardW = (width-2*margin-gap*(cols-1))/cols;
    const cardH = 275;
    const y0 = 250;
    const parts = [];
    const text = (x,y,value,size=34,fill=p.ink,weight=400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(value)}</text>`;
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(f.title)}</title><desc id="desc">${esc(f.subtitle)}。${esc(nodes.map(n=>n.title+' '+n.lines.join(' ')).join('；'))}</desc><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="${p.accent}"/></marker></defs><rect width="100%" height="100%" fill="${p.bg}"/><g font-family="Heiti SC,PingFang SC,Noto Sans CJK SC,Microsoft YaHei,sans-serif">`);
    parts.push(`<rect x="90" y="68" width="11" height="58" rx="5" fill="${p.accent}"/>`);
    parts.push(text(125,113,f.title,fitFont(f.title,1580,52),p.ink,650));
    parts.push(text(125,175,f.subtitle,fitFont(f.subtitle,1580,32),p.muted));
    const position = i => {
      const row = Math.floor(i/cols);
      const col = ['flow','cycle'].includes(f.kind) && row%2 ? cols-1-i%cols : i%cols;
      return {col,row,x:margin+col*(cardW+gap),y:y0+row*(cardH+80)};
    };
    nodes.forEach((n,i)=>{
      const {col,row,x,y}=position(i);
      if (n.title.length>19 || n.lines.some(s=>s.length>25) || n.lines.length>3) throw new Error(`${f.filename}: shorten card text`);
      parts.push(`<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="25" fill="${p.fill}" stroke="#D7E0EF" stroke-width="2"/><circle cx="${x+42}" cy="${y+43}" r="20" fill="${p.accent}"/>`);
      parts.push(text(x+36,y+51,String(i+1),23,'#FFFFFF',600));
      const fontSize = fitFont(n.title,cardW-56,36);
      parts.push(text(x+28,y+106,n.title,fontSize,p.ink,650));
      n.lines.forEach((line,j)=>parts.push(text(x+28,y+162+j*45,line,fitFont(line,cardW-56,30),p.muted)));
      if (['flow','cycle'].includes(f.kind) && i<nodes.length-1) {
        const next=position(i+1);
        const d=next.row>row ? `M${x+cardW/2} ${y+cardH+10}V${next.y-14}` : next.col>col ? `M${x+cardW+10} ${y+cardH/2}H${next.x-14}` : `M${x-10} ${y+cardH/2}H${next.x+cardW+14}`;
        parts.push(`<path d="${d}" fill="none" stroke="${p.accent}" stroke-width="3" marker-end="url(#arrow)"/>`);
      }
    });
    if(f.kind==='cycle' && rows===1) {
      const bottom=y0+cardH+75;
      parts.push(`<path d="M${width-margin-cardW/2} ${y0+cardH+8}V${bottom}H${margin+cardW/2}V${y0+cardH+12}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-dasharray="8 8" marker-end="url(#arrow)"/>`);
    }
    if(f.kind==='cycle' && rows>1) {
      const last=position(nodes.length-1);
      const x=margin-35;
      parts.push(`<path d="M${last.x-8} ${last.y+cardH/2}H${x}V${y0+cardH/2}H${margin-12}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-dasharray="8 8" marker-end="url(#arrow)"/>`);
    }
    if(f.returnLabel) parts.push(text(125,height-178,f.returnLabel,fitFont(f.returnLabel,1550,26),p.accent));
    parts.push(`<line x1="90" y1="${height-160}" x2="1710" y2="${height-160}" stroke="#D7E0EF" stroke-width="2"/>`);
    parts.push(text(90,height-105,f.footnote||'教学示意',fitFont(f.footnote||'教学示意',1620,31),p.muted));
    parts.push(text(90,height-51,'苏打白 Dev · AI Agent 通俗学习版',25,p.muted));
    parts.push('</g></svg>');
    const svg=parts.join('\n');
    await fs.writeFile(path.join(root,'assets',f.filename+'.svg'),svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(root,'assets',f.filename+'.png'));
    await fs.writeFile(path.join(root,'illustrations','prompts',f.filename+'.md'),`# ${f.title}\n\n风格 ${style}。中文教学信息图，白底或所选浅色底，大字、强对比，保留每一个节点的原意。\n\n图意\n\n${f.subtitle}\n\n${nodes.map((n,i)=>`${i+1}. ${n.title}，${n.lines.join('，')}`).join('\n')}\n\n${f.returnLabel||''}\n\n图下注解\n\n${f.footnote||'教学示意'}\n\n由 JSON 原创图文直接渲染 SVG 与 PNG，非模型实验截图。\n`);
    count++;
    console.log(f.filename);
  }
}
console.log(`Rendered ${count} figures in ${style} style.`);
