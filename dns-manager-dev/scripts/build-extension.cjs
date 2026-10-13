const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),name='dns-manager',pkg=path.join(root,'pkg',name);
const shell=path.join(root,'node_modules','@rancher','shell'),link=path.join(pkg,'.shell');
if(fs.existsSync(link)){if(fs.realpathSync(link)!==fs.realpathSync(shell))throw new Error('Unexpected Rancher shell dependency link.');}
else fs.symlinkSync(shell,link,process.platform==='win32'?'junction':'dir');
const version=require(path.join(pkg,'package.json')).version;
const result=spawnSync(process.execPath,[require.resolve('@vue/cli-service/bin/vue-cli-service.js'),'build','--name',`${name}-${version}`,'--target','lib','index.js','--dest',path.join(root,'dist-pkg',`${name}-${version}`),'--formats','umd-min','--filename',`${name}-${version}`],{cwd:pkg,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status)process.exit(result.status);
const output=path.join(root,'dist-pkg',`${name}-${version}`),assets=path.join(output,'plugin');
fs.mkdirSync(assets,{recursive:true});
const bundle=`${name}-${version}.umd.min.js`;
fs.copyFileSync(path.join(output,bundle),path.join(assets,bundle));
fs.writeFileSync(path.join(output,'files.txt'),`plugin/${bundle}\n`);
fs.copyFileSync(path.join(pkg,'package.json'),path.join(output,'package.json'));
fs.copyFileSync(path.join(pkg,'package.json'),path.join(assets,'package.json'));
fs.appendFileSync(path.join(output,'files.txt'),'plugin/package.json\n');
console.log('Versioned extension assets prepared; nothing was published or installed.');
