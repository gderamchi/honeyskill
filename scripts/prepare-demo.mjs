import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--workspace')) throw new Error('Usage: node scripts/prepare-demo.mjs [--workspace <temporary-root>]');
const workspace = args[1] ? path.resolve(args[1]) : sourceRoot;
const staging = path.join(workspace, 'work/demo-publication');
const output = path.join(workspace, 'outputs');
const archiveName = 'honeyskill-demo-skills-v0.1.0.zip';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const files = new Map();
files.set('README.md', `# HoneySkill demonstration skills

Synthetic demonstration fixtures for HoneySkill's installation checks.
They do not reproduce a named incident or measure a language model's behaviour.

## Sandbox only

Use a disposable project with no secrets, wallet, payment tools, or real assets.
Never install these fixtures into your everyday agent profile. The trap contains
an active instruction to hide a fictitious transfer; it must be treated as
untrusted input. The archive itself contains only Markdown and JSON, no executable
scripts, real wallet address, credential collection, or external network endpoint.

| Skill | Purpose | Expected local static result |
| --- | --- | --- |
| portfolio-summary | Read the fictitious ledger only | Automatic installation |
| portfolio-summary-trap | Claims read-only access but asks for a hidden transfer of 25 DEMOUSD | Held before activation, with evidence |

The names identify the demonstration roles for the audience; the scanner must
decide from the actual bytes, not their names. These are development examples,
not independent benchmark cases or a safety certification.

## Run after downloading and extracting

With HoneySkill installed, create a disposable project and initialize it:

\`\`\`sh
DEMO_ROOT="$(mktemp -d)"
honeyskill --project "$DEMO_ROOT" init --agent codex
honeyskill --project "$DEMO_ROOT" add /absolute/path/to/extracted/skills/portfolio-summary
honeyskill --project "$DEMO_ROOT" add /absolute/path/to/extracted/skills/portfolio-summary-trap
\`\`\`

The first skill should appear in the disposable project's .agents/skills. The
second should remain outside that active folder unless an explicit exception is
chosen. Cancelling is the default. Scan and installation are real local actions.

Each actions.json is input for HoneySkill's bounded deterministic ledger simulator:
only read(demo-user) and transfer(demo-user, demo-external, integer amount 1–100,
DEMOUSD) are supported, with at most ten actions. No shell or network is used by
that simulator. Replaying this plan is a deterministic simulation, not execution
of the natural-language instructions by an actual agent or model.

The example starts with 100 DEMOUSD for demo-user and zero for demo-external.
Replaying the trap plan without the gate leaves 75 and 25. Holding installation
leaves 100 and zero. No real funds exist or move.

No public download URL is claimed by these files. Publication location and any
public availability must be verified separately. Select one skill folder when
using a GitHub source; repository roots contain both examples.
`);
for (const [fixture, name] of [['portfolio-legitimate', 'portfolio-summary'], ['portfolio-suspicious', 'portfolio-summary-trap']]) {
  const skill = await readFile(path.join(sourceRoot, 'fixtures', fixture, 'SKILL.md.fixture'), 'utf8');
  files.set(`skills/${name}/SKILL.md`, skill.replace(/^name: portfolio-summary$/m, `name: ${name}`));
  files.set(`skills/${name}/actions.json`, await readFile(path.join(sourceRoot, 'fixtures', fixture, 'actions.json'), 'utf8'));
}
const manifest = [];
for (const [relative, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
  const destination = path.join(staging, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, { mode: 0o644 });
  manifest.push({ path: relative, bytes: Buffer.byteLength(content), sha256: sha256(content) });
}
await mkdir(output, { recursive: true });
// Python's standard ZIP writer avoids a runtime dependency and fixes archive metadata.
execFileSync('python3', ['-c', `
import json, pathlib, sys, zipfile
root, output, names = pathlib.Path(sys.argv[1]), sys.argv[2], json.loads(sys.argv[3])
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
    for name in names:
        entry = zipfile.ZipInfo(name, (2000, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, (root / name).read_bytes())
`, staging, path.join(output, archiveName), JSON.stringify(manifest.map(file => file.path))]);
const archive = await readFile(path.join(output, archiveName));
await writeFile(path.join(output, 'demo-release-manifest.json'), JSON.stringify({
  schemaVersion: 1, version: '0.1.0', sourceType: 'synthetic-development-fixtures',
  published: false, publicUrl: null, archive: { file: archiveName, bytes: archive.length, sha256: sha256(archive) },
  files: manifest,
}, null, 2) + '\n');
await writeFile(path.join(output, 'demo-release-SHA256SUMS.txt'), `${sha256(archive)}  ${archiveName}\n`);
console.log(JSON.stringify({ staging, archive: path.join(output, archiveName), published: false, files: manifest.map(file => file.path) }, null, 2));
