import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Inventory } from '../../core/src/acquisition.js';

// These are source-text formats omitted by the preserved installation inventory.
const extraTextExtensions = new Set(['.xsd','.svg','.rst','.r','.rb','.go','.rs','.java','.c','.h','.cpp','.hpp','.sol','.vy','.fish','.bat','.cmd','.properties','.config','.gradle','.groovy','.psm1','.psd1']);
export async function includeSecurityText(snapshot: string, input: Inventory): Promise<void> {
  const resolved = new Set<string>();
  for(const item of input.coverage.ignored) {
    if(item.reason!=='Binary format or file extension is unsupported by static analysis.' || !extraTextExtensions.has(path.extname(item.file).toLowerCase())) continue;
    const entry=input.manifest.find(x=>x.path===item.file); if(!entry)continue;
    const handle=await fs.open(path.join(snapshot,item.file),constants.O_RDONLY|constants.O_NOFOLLOW);
    let bytes:Buffer;
    try {
      const stat=await handle.stat(); if(!stat.isFile() || stat.nlink!==1 || stat.size!==entry.size)throw new Error('Snapshot changed during text reading.');
      bytes=Buffer.alloc(entry.size+1);const read=await handle.read(bytes,0,bytes.length,0);bytes=bytes.subarray(0,read.bytesRead);
      if(bytes.length!==entry.size || createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Snapshot changed during text reading.');
    } finally {await handle.close();}
    try {
      const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))continue;
      input.texts.set(item.file,text);input.coverage.supported++;resolved.add(item.file);
    } catch { /* Binary remains explicitly unverified. Never execute or XML-parse source. */ }
  }
  input.coverage.ignored=input.coverage.ignored.filter(x=>!resolved.has(x.file));
  if(!input.coverage.errors.length&&!input.coverage.ignored.length&&!input.coverage.limitsReached.length&&!input.coverage.unresolved.length)input.coverage.status='complete_for_supported_checks';
}
