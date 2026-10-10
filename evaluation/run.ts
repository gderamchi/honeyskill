import { runBenchmark } from './runner.js';
import { writeFile,mkdir } from 'node:fs/promises';
const result=await runBenchmark({projectRoot:process.cwd(),command:'pnpm benchmark'});
await mkdir('outputs',{recursive:true});
await writeFile('outputs/benchmark.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({result:'outputs/benchmark.json',metrics:result.metrics,comparisons:result.comparisons},null,2));
