'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json','.ogg':'audio/ogg','.m4a':'audio/mp4'};
async function serve(){const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),f=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(path.relative(ROOT,f).startsWith('..')||!fs.existsSync(f)||fs.statSync(f).isDirectory())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));return{server,origin:`http://127.0.0.1:${server.address().port}`};}
module.exports={ROOT,serve};
