import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
await mkdir('outputs',{recursive:true});
execFileSync('npm',['pack','./dist','--pack-destination','outputs','--ignore-scripts','--loglevel','error'], {stdio:'inherit'});
