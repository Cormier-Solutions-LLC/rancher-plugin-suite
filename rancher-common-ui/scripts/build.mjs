import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
import ts from 'typescript';
import webpack from 'webpack';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const version=manifest.version;
if(!/^1\.\d+\.\d+$/.test(version))throw new Error('This build implements API 1 and requires a stable 1.x release version.');
const bundleName=`rancher-common-ui-${version}.umd.min.js`;

await mkdir(resolve(root,'.generated'),{recursive:true});
const factories = []; let css = await readFile(resolve(root,'src/theme.css'),'utf8');
for (const file of (await readdir(resolve(root,'src/components'))).filter(f=>f.endsWith('.vue')).sort()) {
  const name=file.slice(0,-4),source=await readFile(resolve(root,'src/components',file),'utf8');
  const id='data-v-rcui'+createHash('sha256').update(source).digest('hex').slice(0,8);
  const { descriptor, errors }=parse(source,{filename:file}); if(errors.length)throw errors[0];
  let code=compileScript(descriptor,{id,inlineTemplate:true,genDefaultAs:'__component'}).content;
  const dependencies=[];
  code=code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]vue['"];?/g,(_,bindings)=>`const {${bindings.replace(/\bas\b/g,':')}} = Vue;`);
  code=code.replace(/import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)\.vue['"];?/g,(_,local,dep)=>{dependencies.push(dep);return `const ${local}=components.${dep};`;});
  if (/^import\s/m.test(code)) throw new Error(`${file}: runtime components must be presentation-only; unexpected external import.`);
  code=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export\s*\{\s*\};?/g,'');
  factories.push({name,dependencies,code:`function create${name}(Vue, components) {\n${code}\n__component.__scopeId=${JSON.stringify(id)};return __component;\n}`});
  for(const style of descriptor.styles){const result=compileStyle({source:style.content,filename:file,id,scoped:style.scoped});if(result.errors.length)throw result.errors[0];let sharedStyle=result.code;for(const [token,alias] of Object.entries({'body-text':'text','box-bg':'panel','input-bg':'input','border':'line','muted':'muted','link':'link'})){sharedStyle=sharedStyle.replace(new RegExp('var\\(--'+token+'(?:,\\s*#[a-fA-F0-9]+)?\\)','g'),'var(--rcui-'+alias+')');}css+='\n'+sharedStyle;}
}
const ordered=[];const pending=[...factories];
while(pending.length){const i=pending.findIndex(f=>f.dependencies.every(d=>ordered.some(o=>o.name===d)));if(i<0)throw new Error('Missing or circular UI component dependency');ordered.push(...pending.splice(i,1));}
await writeFile(resolve(root,'.generated/components.mjs'),factories.map(f=>f.code).join('\n')+`\nexport function createComponents(Vue){const components={};${ordered.map(f=>`components.${f.name}=create${f.name}(Vue,components);`).join('\n')}return components;}\n`);
await writeFile(resolve(root,'.generated/theme.mjs'),`export default ${JSON.stringify(css)};\n`);
const out=resolve(root,`dist/${version}`);await mkdir(out,{recursive:true});
await new Promise((done,reject)=>webpack({mode:'production',entry:resolve(root,'src/index.mjs'),output:{path:out,filename:bundleName,library:{name:`rancher-common-ui-${version}`,type:'umd'},globalObject:'globalThis'},devtool:false,plugins:[new webpack.DefinePlugin({__COMMON_UI_VERSION__:JSON.stringify(version)})]},(error,stats)=>{if(error||stats.hasErrors())reject(error||new Error(stats.toString({all:false,errors:true})));else done();}));
await mkdir(resolve(out,'plugin'),{recursive:true});
await copyFile(resolve(out,bundleName),resolve(out,`plugin/${bundleName}`));
await writeFile(resolve(out,'files.txt'),`plugin/${bundleName}\n`);
await copyFile(resolve(root,'package.json'),resolve(out,'plugin/package.json'));
await writeFile(resolve(out,'files.txt'),`plugin/${bundleName}\nplugin/package.json\n`);
await copyFile(resolve(root,'package.json'),resolve(out,'package.json'));
console.log(`Built independent UIPlugin assets: ${out}`);
