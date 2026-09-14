const http=require('http'),fs=require('fs'),p=require('path');
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css'};
http.createServer((q,s)=>{
  let f=decodeURIComponent(q.url.split('?')[0]); if(f==='/')f='/index.html';
  const fp=p.join(__dirname,f);
  fs.readFile(fp,(e,d)=>{ if(e){s.writeHead(404);s.end('not found');return;}
    s.writeHead(200,{'Content-Type':T[p.extname(fp)]||'application/octet-stream','Cache-Control':'no-store, max-age=0'});
    s.end(d); });
}).listen(5199,()=>console.log('serving isochrone-globe on 5199 (no-store)'));
