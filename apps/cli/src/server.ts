import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listReports, listInstalls, loadConfig, readReport } from '../../../packages/core/src/index.js';
import { assetRoot } from './paths.js';
import { reportHtml } from './report.js';
export const scope = 'Seuls les ajouts et mises à jour réalisés avec HoneySkill passent par ce contrôle. Les copies manuelles et autres installateurs restent hors périmètre.';
const equal = (a:string,b:string) => {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y);};
const webRoot=existsSync(join(assetRoot,'web'))?join(assetRoot,'web'):join(assetRoot,'apps/web/dist');
const cookies = (req:IncomingMessage) => { const values=(req.headers.cookie??'').split(';').map(c=>c.trim()); return values.find(c=>c.startsWith('honeyskill_session='))?.slice(19) ?? values.find(c=>c.startsWith('skillgate_session='))?.slice(18) ?? ''; };
export async function startUi(projectRoot:string, port=0) {
  const token=randomBytes(32).toString('hex');
  let origin='';
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      if (req.headers.host!==new URL(origin).host || (req.headers.origin && req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'Origine ou hôte refusé.'});
      const url=new URL(req.url??'/',origin);
      if(req.method==='GET' && url.pathname==='/' && equal(url.searchParams.get('session')??'',token)) {
        res.writeHead(303,{'Set-Cookie':`honeyskill_session=${token}; HttpOnly; SameSite=Strict; Path=/`,Location:'/'});return res.end();
      }
      if(!equal(cookies(req),token)) return json(403,{error:'Session locale requise. Utilisez le lien affiché par honeyskill ui.'});
      if(req.method!=='GET' && req.method!=='HEAD') return json(405,{error:'Interface en lecture seule. Les exceptions restent dans le CLI.'});
      if(url.pathname==='/api/state') return json(200,{reports:await listReports(projectRoot),installations:await listInstalls(projectRoot),scope,profile:(await loadConfig(projectRoot)).profile});
      if(url.pathname==='/api/research') return json(200,{sources:JSON.parse(await readFile(join(assetRoot,'research/sources.json'),'utf8')),techniques:JSON.parse(await readFile(join(assetRoot,'research/techniques.json'),'utf8'))});
      if(url.pathname==='/api/benchmark') {
        try{return json(200,JSON.parse(await readFile(join(projectRoot,'.skillgate/benchmark.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return json(200,null);throw e;}
      }
      const match=url.pathname.match(/^\/api\/reports\/([a-zA-Z0-9-]{1,80})(\/html)?$/);
      if(match) {
        const report=await readReport(projectRoot,match[1]);
        if(match[2]){res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(reportHtml(report));}
        return json(200,report);
      }
      if(url.pathname.startsWith('/api/')) return json(404,{error:'Rapport ou route introuvable.'});
      const asset=url.pathname==='/'?'index.html':url.pathname.match(/^\/assets\/([a-zA-Z0-9_.-]+\.(js|css))$/)?.[0].slice(1);
      if(!asset)return json(404,{error:'Page introuvable.'});
      const file=await readFile(join(webRoot,asset));
      const type=asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':'text/html';
      res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`});res.end(req.method==='HEAD'?undefined:file);
    } catch(e) {
      const code=(e as NodeJS.ErrnoException).code;
      json(['ENOENT','REPORT_NOT_FOUND'].includes(code??'')?404:500,{error:code==='ENOENT'?'Ressource introuvable.':'Lecture impossible. Vérifiez les fichiers locaux et relancez le CLI.'});
    }
  });
  server.requestTimeout=10_000;server.headersTimeout=10_000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve());});
  const address=server.address(); if(!address || typeof address==='string')throw new Error('Port local indisponible.');
  origin=`http://127.0.0.1:${address.port}`;
  return {server,origin,url:`${origin}/?session=${token}`,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
