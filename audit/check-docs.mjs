// Usage: node check-docs.mjs <repoRoot> [files...]  — checks relative links/anchors, screenshot headings, style basics.
import fs from "node:fs"; import path from "node:path";
const root = process.argv[2]; const docs = path.join(root, "docs");
const files = process.argv.slice(3).length ? process.argv.slice(3) : walk(docs).map(f => path.relative(docs, f));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):p.endsWith(".md")?[p]:[]})}
function slugs(md){const out=new Set();const seen={};let inCode=false;for(const l of md.split("\n")){if(/^```/.test(l)){inCode=!inCode;continue}if(inCode)continue;const m=/^#{1,6}\s+(.*?)\s*#*\s*$/.exec(l);if(!m)continue;let s=m[1].replace(/<[^>]+>/g,"").replace(/[*_`]/g,"").replace(/\[([^\]]*)\]\([^)]*\)/g,"$1").toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu,"").replace(/\s/g,"-");const n=seen[s]??0;seen[s]=n+1;out.add(n?`${s}-${n}`:s)}return out}
function headings(md){let inCode=false;return md.split("\n").filter(l=>{if(/^```/.test(l)){inCode=!inCode;return false}return !inCode&&/^#{1,6}\s/.test(l)}).map(l=>l.replace(/^#+\s+/,"").trim())}
let errs=0; const shots=fs.readFileSync(new URL("./screenshot-headings.txt",import.meta.url),"utf8").trim().split("\n").map(l=>l.split("|"));
for(const rel of files){const abs=path.join(docs,rel);if(!fs.existsSync(abs)){console.log(`MISSING FILE ${rel}`);errs++;continue}const md=fs.readFileSync(abs,"utf8");
 const own=slugs(md); let inCode=false;
 md.split("\n").forEach((line,i)=>{if(/^```/.test(line)){inCode=!inCode;return}if(inCode)return;
  for(const m of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){const t=m[1];if(/^(https?:|mailto:)/.test(t))continue;const [p,a]=t.split("#");
   const target=p?path.resolve(path.dirname(abs),decodeURIComponent(p)):abs;
   if(p&&!fs.existsSync(target)){console.log(`${rel}:${i+1} broken link ${t}`);errs++;continue}
   if(a&&target.endsWith(".md")){const s=target===abs?own:slugs(fs.readFileSync(target,"utf8"));if(!s.has(a.toLowerCase())){console.log(`${rel}:${i+1} broken anchor ${t}`);errs++}}}
 });
 const hs=headings(md);for(const [f,h] of shots){if(f===rel&&!hs.includes(h)){console.log(`${rel} SCREENSHOT HEADING MISSING: "${h}"`);errs++}}
 if(md.split("\n").filter(l=>/^# /.test(l)).length!==1){console.log(`${rel} has ${md.split("\n").filter(l=>/^# /.test(l)).length} H1`);errs++}
 if(/\n\n\n/.test(md)){console.log(`${rel} has double blank lines`);}
 if(/^---\s*$/m.test(md.replace(/```[\s\S]*?```/g,""))){console.log(`${rel} has horizontal rule`);}
}
console.log(errs?`${errs} errors`:"ok"); process.exit(errs?1:0);
