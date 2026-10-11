import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import {
  InstallRecordSchema, ResearchSourceSchema, ScanReportSchema, TechniqueCardSchema,
  type Finding, type InstallRecord, type ScanReport,
} from '../../../packages/contracts/src/index.js';
import './style.css';

const StateSchema = z.object({ reports: z.array(ScanReportSchema), installations: z.array(InstallRecordSchema), scope: z.string(), profile: z.string() });
const ResearchSchema = z.object({ sources: z.array(ResearchSourceSchema), techniques: z.array(TechniqueCardSchema) });
const RatioSchema = z.object({ numerator: z.number().nonnegative(), denominator: z.number().nonnegative(), value: z.number().nullable() });
const BenchmarkSchema = z.object({
  kind: z.literal('internal-synthetic'), split: z.string(), startedAt: z.string(), completedAt: z.string(),
  command: z.string(), sourceRevision: z.string(), versions: z.record(z.string(), z.string().nullable()),
  metrics: z.object({ recall: RatioSchema, falsePositiveRate: RatioSchema, precision: RatioSchema, legitimateAutoInstall: RatioSchema, suspectRetained: RatioSchema, incompleteRetained: RatioSchema, completeCoverage: RatioSchema, engineFailures: RatioSchema, autoInstallDecisions: RatioSchema, latencyMs: z.object({ median: z.number().nullable(), p95: z.number().nullable() }) }),
  comparisons: z.object({ native: z.string(), hybrid: z.string(), cisco: z.string() }), limitations: z.array(z.string()),
  cases: z.array(z.object({ caseId: z.string(), label: z.enum(['suspect', 'legitimate', 'incomplete']), risk: z.enum(['none', 'detected']).nullable(), decision: z.enum(['allow', 'hold', 'review']).nullable(), durationMs: z.number(), error: z.string().nullable() })),
});
type LocalState = z.infer<typeof StateSchema>;
type Research = z.infer<typeof ResearchSchema>;
type View = 'analyses' | 'sources' | 'benchmark';
type Resource<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('La session locale a expiré ou n’est pas autorisée. Rouvrez l’interface locale HoneySkill depuis le projet.');
    throw new Error(`Le serveur local n’a pas pu fournir les données (HTTP ${response.status}). Rouvrez l’interface locale HoneySkill et réessayez.`);
  }
  return response.json();
}

function useResource<T>(path: string, parse: (value: unknown) => T, revision = 0): Resource<T> {
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setResource({ status: 'loading' });
    getJson(path, controller.signal).then((value) => {
      if (!controller.signal.aborted) setResource({ status: 'ready', data: parse(value) });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const message = error instanceof z.ZodError ? 'Le format du rapport local est invalide. Aucune conclusion n’est affichée ; consultez le CLI et son diagnostic.' : error instanceof Error ? error.message : 'La lecture des données locales a échoué.';
      setResource({ status: 'error', message });
    });
    return () => controller.abort();
  }, [path, revision]);
  return resource;
}

const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};
const count = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
const coverageLabel = (value: ScanReport['coverage']['status']) => ({ complete_for_supported_checks: 'Contrôles pris en charge terminés', partial: 'Analyse partielle', failed: 'Analyse échouée' })[value];
const severityLabel = (value: Finding['severity']) => ({ medium: 'Modérée', high: 'Élevée', critical: 'Critique' })[value];
const confidenceLabel = (value: Finding['confidence']) => ({ low: 'Faible', medium: 'Moyenne', high: 'Élevée' })[value];
const categoryLabel: Record<Finding['category'], string> = { 'FIN-01': 'Secrets financiers', 'FIN-02': 'Bénéficiaire détourné', 'FIN-03': 'Autorisation de dépense', 'FIN-04': 'Paramètres financiers', 'FIN-05': 'Contenu distant ou masqué', 'FIN-06': 'Instruction financière cachée' };

function Icon({ name }: { name: 'check' | 'hold' | 'review' | 'arrow' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'check' ? <path d="m5 12 4 4L19 6" /> : name === 'hold' ? <><path d="M9 3h6l6 6v6l-6 6H9l-6-6V9Z" /><path d="M12 7v6m0 4h.01" /></> : name === 'review' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></> : <path d="M5 12h14m-6-6 6 6-6 6" />}
  </svg>;
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <section className="notice error-notice" role="alert"><Icon name="review" /><div><h2>Données indisponibles</h2><p>{message}</p>{retry && <button className="button" onClick={retry}>Réessayer</button>}</div></section>;
}

function Loading() { return <div className="loading" role="status"><span className="loader" /> Lecture des données locales…</div>; }

function reportStatus(report: ScanReport, installation?: InstallRecord) {
  if (installation?.status === 'installed_with_exception') return { label: 'Installé avec exception', tone: 'warning', icon: 'hold' as const };
  if (installation) return { label: 'Installé', tone: 'success', icon: 'check' as const };
  if (report.decision === 'hold') return { label: 'Retenu avant activation', tone: 'warning', icon: 'hold' as const };
  if (report.decision === 'review') return { label: 'Revue nécessaire', tone: 'review', icon: 'review' as const };
  return { label: 'Installation autorisée', tone: 'success', icon: 'check' as const };
}

function ReportDetail({ report, installation, previousInstallation }: { report: ScanReport; installation?: InstallRecord; previousInstallation?: InstallRecord }) {
  const status = reportStatus(report, installation);
  const uncertain = report.coverage.status !== 'complete_for_supported_checks';
  const exception = installation?.status === 'installed_with_exception';
  const firstFinding = report.findings[0];
  const headline = exception ? 'Cette version est active malgré le risque.' : report.risk === 'detected' ? firstFinding?.financialConsequence ?? 'Un risque financier a été détecté.' : uncertain ? 'L’analyse ne permet pas une installation automatique.' : 'Aucun risque détecté dans le périmètre analysé.';
  return <article className="report" aria-label={`Rapport de ${report.name}`}>
    <div className="report-heading"><div><p className="eyebrow">Version analysée</p><h2>{report.name}</h2></div><a className="text-link" href={`/api/reports/${encodeURIComponent(report.id)}/html`} target="_blank" rel="noreferrer">Rapport HTML <span aria-hidden="true">↗</span></a></div>
    <p className="origin"><span>{report.source.kind === 'local' ? 'Dossier local' : 'GitHub public'}</span><span>{report.source.locator}{report.source.subdirectory ? ` · ${report.source.subdirectory}` : ''}</span></p>
    <section className={`verdict ${status.tone}`} aria-labelledby="verdict-title">
      <div className="verdict-label"><Icon name={status.icon} /><strong>{status.label}</strong>{uncertain && <Badge tone="review">{coverageLabel(report.coverage.status)}</Badge>}</div>
      <h3 id="verdict-title">{headline}</h3>
      <p>{exception ? 'L’exception vaut uniquement pour cette empreinte et cette destination. Le contrôle à l’installation ne protège plus cette version.' : installation ? 'La version analysée a été activée. Aucune action supplémentaire n’est nécessaire.' : report.decision === 'allow' ? 'Ce rapport autorise cette version. Aucune installation correspondante n’est enregistrée.' : 'Le contrôle ne permet pas l’activation automatique de cette version. Consultez les preuves avant toute décision.'}</p>
      {previousInstallation && <p className="previous-version">Une autre version de ce skill est enregistrée comme active : <code>{previousInstallation.fingerprint.slice(0, 16)}</code>. Cette analyse ne la remplace pas.</p>}
    </section>
    <div className="facts-strip"><div><span>Profil</span><strong>{report.profile === 'static' ? 'Analyse statique' : 'Analyse hybride'}</strong></div><div><span>Couverture</span><strong>{report.coverage.read} / {report.coverage.inventoried} fichiers lus</strong></div><div><span>Durée mesurée</span><strong>{count(report.durationMs)} ms</strong></div></div>
    {report.findings.length > 0 && <section className="detail-section"><div className="section-heading"><h3>Ce qui a motivé la décision</h3><span>{report.findings.length} constat{report.findings.length > 1 ? 's' : ''}</span></div><div className="finding-list">{report.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}</div></section>}
    <section className="detail-section"><h3>Couverture et limites</h3><div className={`coverage-line ${uncertain ? 'coverage-partial' : ''}`}><Icon name={uncertain ? 'review' : 'check'} /><strong>{coverageLabel(report.coverage.status)}</strong></div><p className="muted">{report.coverage.supported} fichier{report.coverage.supported > 1 ? 's' : ''} pris en charge · {count(report.coverage.bytes)} octets inventoriés. Une analyse terminée ne prouve pas la sûreté de tous les comportements.</p>
      {report.analyses.map((analysis, index) => <div className="engine-line" key={`${analysis.engine}-${index}`}><span>{analysis.engine === 'native' ? 'Statique natif' : analysis.engine === 'semantic' ? 'Sémantique' : analysis.engine}</span><Badge tone={analysis.status === 'completed' ? 'neutral' : 'review'}>{analysis.status === 'completed' ? 'Terminé' : analysis.status === 'failed' ? 'Échec' : 'Indisponible'}</Badge><p>{analysis.detail}</p></div>)}
      {(report.coverage.errors.length > 0 || report.coverage.limitsReached.length > 0 || report.coverage.unresolved.length > 0 || report.coverage.ignored.length > 0) && <ul className="coverage-issues">{report.coverage.errors.map((item, i) => <li key={`error-${i}`}><strong>Erreur :</strong> {item}</li>)}{report.coverage.limitsReached.map((item, i) => <li key={`limit-${i}`}><strong>Limite atteinte :</strong> {item}</li>)}{report.coverage.unresolved.map((item, i) => <li key={`unresolved-${i}`}><strong>Non résolu :</strong> {item}</li>)}{report.coverage.ignored.map((item, i) => <li key={`ignored-${i}`}><code>{item.file}</code> : {item.reason}</li>)}</ul>}
      {report.limitations.length > 0 && <details><summary>Limites annoncées par le moteur</summary><ul>{report.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
      {report.capabilities.length > 0 && <details><summary>Capacités détectées</summary><ul>{report.capabilities.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
    </section>
    <section className="detail-section"><h3>Trace de cette version</h3><ol className="timeline"><li><span className="timeline-dot" /><div><strong>Analyse terminée</strong><time dateTime={report.completedAt}>{date(report.completedAt)}</time><p>Décision du moteur : {report.decision === 'allow' ? 'autoriser' : report.decision === 'hold' ? 'retenir' : 'examiner'}.</p></div></li>{installation?.events.map((event, index) => <li key={`${event.at}-${index}`}><span className="timeline-dot" /><div><strong>{{ installed: 'Version installée', update_installed: 'Mise à jour installée', exception_accepted: 'Exception acceptée' }[event.action] ?? event.action}</strong><time dateTime={event.at}>{date(event.at)}</time><p>{event.detail}</p></div></li>)}</ol>
      {installation?.operatorDecision && <div className="operator"><strong>Exception enregistrée</strong><p>Opérateur déclaré : {installation.operatorDecision.operator}</p>{installation.operatorDecision.reason && <p>Motif : {installation.operatorDecision.reason}</p>}<p className="muted">Cet identifiant local n’est pas une identité vérifiée. Le journal local est modifiable par son propriétaire.</p></div>}
    </section>
    <section className="detail-section technical"><details><summary>Origine, empreinte et versions du moteur</summary><dl><dt>Rapport</dt><dd><code>{report.id}</code></dd><dt>SHA-256 du paquet</dt><dd><code>{report.fingerprint}</code></dd>{report.source.revision && <><dt>Révision source</dt><dd><code>{report.source.revision}</code></dd></>}{installation && <><dt>Destination</dt><dd><code>{installation.target}</code></dd></>}<dt>Moteur / règles / politique / corpus</dt><dd>{report.engineVersion} / {report.rulesVersion} / {report.policyVersion} / {report.corpusVersion}</dd></dl></details></section>
    {!installation && report.decision !== 'allow' && <details className="exception-details"><summary>Décider d’une exception dans le terminal</summary><p>Le choix par défaut est de laisser cette version retenue. Une exception explicite peut activer ce snapshot avec le statut « installé avec exception ». Elle ne couvrira aucune future version.</p><p>Inspectez d’abord le rapport dans le projet :</p><pre className="command"><code>honeyskill inspect {report.id}</code></pre><p>Puis, pour demander une exception explicite :</p><pre className="command"><code>honeyskill approve {report.id} --reason "Motif de la décision"</code></pre><p className="muted">La commande affiche l’empreinte et la destination exactes et demande leur confirmation. Entrée seule annule. Cette interface est en lecture seule.</p></details>}
  </article>;
}

function FindingCard({ finding }: { finding: Finding }) {
  return <div className="finding"><div className="finding-heading"><div><span className="category">{finding.category}</span><strong>{categoryLabel[finding.category]}</strong></div><Badge tone="warning">Sévérité {severityLabel(finding.severity).toLowerCase()}</Badge></div><p className="finding-consequence">{finding.financialConsequence}</p><p>{finding.explanation}</p>{!finding.supported && <p className="unsupported">Constat non étayé : une revue est nécessaire avant de conclure.</p>}
    <details className="evidence-details" open><summary>Preuves dans le paquet ({finding.evidence.length})</summary>{finding.evidence.map((evidence, index) => <figure className="evidence" key={`${evidence.file}-${evidence.line}-${index}`}><figcaption><code>{evidence.file}</code><span>L{evidence.line}{evidence.endLine !== evidence.line ? `–${evidence.endLine}` : ''}</span></figcaption>{evidence.redacted && <p className="redaction-label">Secret apparent masqué · masquage non garanti exhaustif</p>}<pre><code>{evidence.excerpt}</code></pre></figure>)}</details>
    <p className="finding-meta">Confiance qualitative : {confidenceLabel(finding.confidence).toLowerCase()} · Moteur {finding.engine === 'native' ? 'statique natif' : 'sémantique'} · Technique {finding.technique}{finding.sources.length > 0 ? ` · Sources : ${finding.sources.join(', ')}` : ' · Hypothèse synthétique sans source d’incident'}</p>
  </div>;
}

function AnalysisView({ state }: { state: LocalState }) {
  const reports = [...state.reports].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0];
  if (!selected) return <section className="empty-state"><div className="empty-symbol"><Icon name="review" /></div><p className="eyebrow">Aucune analyse enregistrée</p><h2>Le prochain skill commence ici.</h2><p>Lancez un scan depuis ce projet. Les preuves et la décision apparaîtront après actualisation.</p><pre className="command"><code>honeyskill scan ./mon-skill</code></pre><p className="muted">Le scan n’exécute pas le code du skill et ne l’installe pas.</p></section>;
  const installation = state.installations.find((record) => record.scanId === selected.id && record.fingerprint === selected.fingerprint);
  const previousInstallation = state.installations.find((record) => record.name === selected.name && record.scanId !== selected.id);
  return <div className="analysis-layout"><aside className="report-list" aria-label="Analyses enregistrées"><div className="list-heading"><h2>Analyses</h2><span>{reports.length}</span></div>{reports.map((report) => {
    const record = state.installations.find((item) => item.scanId === report.id && item.fingerprint === report.fingerprint);
    const status = reportStatus(report, record);
    return <button key={report.id} className={`report-item ${selected.id === report.id ? 'selected' : ''}`} aria-pressed={selected.id === report.id} onClick={() => setSelectedId(report.id)}><span className="report-item-name">{report.name}</span><span className={`list-status ${status.tone}`}><Icon name={status.icon} />{status.label}</span><span className="report-item-date">{date(report.completedAt)}</span><code className="report-item-hash">{report.fingerprint.slice(0, 12)}</code></button>;
  })}</aside><ReportDetail key={selected.id} report={selected} installation={installation} previousInstallation={previousInstallation} /></div>;
}

const safeHref = (url: string) => /^https?:\/\//i.test(url) ? url : undefined;

function SourcesView() {
  const resource = useResource<Research>('/api/research', (value) => ResearchSchema.parse(value));
  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error') return <ErrorNotice message={resource.message} />;
  const { sources, techniques } = resource.data;
  const consulted = sources.filter((source) => source.status === 'consulted');
  const documented = techniques.filter((technique) => technique.kind === 'documented');
  const synthetic = techniques.filter((technique) => technique.kind === 'synthetic-hypothesis');
  return <section className="secondary-view"><p className="eyebrow">Confiance et provenance</p><h2>Ce qui documente les contrôles.</h2><p className="view-intro">Les références éclairent les règles et leurs limites. Elles ne constituent ni un jeu d’attaques exécutées, ni un entraînement de modèle.</p><div className="stats-strip"><div><strong>{consulted.length}</strong><span>sources consultées</span></div><div><strong>{documented.length}</strong><span>techniques documentées</span></div><div><strong>{synthetic.length}</strong><span>hypothèses synthétiques</span></div></div>
    <h3>Sources réellement référencées</h3><div className="source-list">{sources.map((source) => <article className="source-card" key={source.id}><div className="source-topline"><span className="category">{source.id}</span><Badge tone={source.status === 'consulted' ? 'neutral' : 'review'}>{source.status === 'consulted' ? 'Consultée' : 'Accès indisponible'}</Badge></div><h4>{safeHref(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a> : source.title}</h4><p className="source-publisher">{source.publisher} · Consultation : {source.accessedAt}</p><p>{source.summary}</p><details><summary>Section et limites de la source</summary><p>{source.section}</p><ul>{source.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></details></article>)}</div>
    <h3 className="techniques-title">Techniques et hypothèses du prototype</h3>{techniques.map((technique) => <details className="technique" key={technique.id}><summary><span className="category">{technique.category}</span> {technique.title}<span className="technique-kind">{technique.kind === 'documented' ? `Documentée · ${technique.source_id}` : 'Hypothèse synthétique'}</span></summary><p>{technique.mechanism}</p><dl><dt>Actif potentiellement exposé</dt><dd>{technique.asset}</dd><dt>Niveau de confirmation de la source</dt><dd>{technique.confirmation}</dd><dt>Limites</dt><dd>{technique.limitations.join(' ')}</dd><dt>Fixtures liées</dt><dd>{technique.fixtures.length ? technique.fixtures.join(', ') : 'Aucune fixture liée'}</dd></dl></details>)}
  </section>;
}

function BenchmarkView() {
  const resource = useResource('/api/benchmark', (value) => BenchmarkSchema.nullable().parse(value));
  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error') return <ErrorNotice message={resource.message} />;
  const result = resource.data;
  const metricLabels = { recall: 'Rappel sur les cas suspects', falsePositiveRate: 'Faux positifs sur les cas légitimes', precision: 'Précision des détections', legitimateAutoInstall: 'Cas légitimes autorisés', suspectRetained: 'Cas suspects retenus', incompleteRetained: 'Cas incomplets retenus', completeCoverage: 'Couverture complète des contrôles', engineFailures: 'Échecs du moteur', autoInstallDecisions: 'Décisions d’installation autorisée' } as const;
  return <section className="secondary-view"><p className="eyebrow">Évaluation reproductible</p><h2>Des résultats, avec leur périmètre.</h2><p className="view-intro">Le benchmark interne utilise des scénarios synthétiques. La détection à l’installation et le comportement d’un modèle face à une injection sont deux mesures distinctes.</p>{result == null ? <div className="empty-benchmark"><Badge>Non exécuté</Badge><h3>Aucun fichier de résultats disponible.</h3><p>Les chiffres seront affichés après une exécution locale enregistrée.</p><pre className="command"><code>honeyskill benchmark</code></pre></div> : <>
    <div className="run-summary"><Badge>Exécution réelle · moteur natif</Badge><p><strong>{result.cases.length} cas synthétiques évalués</strong> · {date(result.completedAt)}</p><span>Jeu {result.split === 'evaluation' ? 'd’évaluation' : 'de développement'} interne, créé par le même assistant. Aucun test indépendant à l’aveugle.</span></div>
    <div className="metric-grid">{Object.entries(metricLabels).map(([key, label]) => { const metric = result.metrics[key as keyof typeof metricLabels]; return <div className="metric" key={key}><span>{label}</span><strong>{count(metric.numerator)} <span>/ {count(metric.denominator)}</span></strong><p>{metric.value == null ? 'Non calculable' : new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(metric.value)}</p></div>; })}</div>
    <p className="metric-note">Les erreurs restent dans les dénominateurs. « Retenu » n’est pas synonyme de « risque détecté ». Les autorisations mesurent la politique ; ce benchmark ne réalise pas une installation pour chaque cas.</p>
    <div className="latency-row"><span>Latence médiane <strong>{result.metrics.latencyMs.median == null ? 'Inconnue' : `${count(Math.round(result.metrics.latencyMs.median))} ms`}</strong></span><span>95e percentile <strong>{result.metrics.latencyMs.p95 == null ? 'Inconnu' : `${count(Math.round(result.metrics.latencyMs.p95))} ms`}</strong></span></div>
    <h3>Comparaisons</h3><div className="comparison-list">{Object.entries(result.comparisons).map(([engine, execution]) => <div key={engine}><span>{engine === 'native' ? 'Règles natives' : engine === 'hybrid' ? 'Profil hybride' : 'Cisco Skill Scanner'}</span><Badge>{execution === 'executed' ? 'Exécuté' : 'Non exécuté'}</Badge></div>)}</div>
    <h3 className="techniques-title">Décisions par cas</h3><div className="table-wrap"><table><caption className="sr-only">Résultats mesurés des cas synthétiques</caption><thead><tr><th scope="col">Cas / annotation</th><th scope="col">Détection</th><th scope="col">Décision</th><th scope="col">Durée</th></tr></thead><tbody>{result.cases.map((item) => <tr key={item.caseId}><th scope="row"><code>{item.caseId}</code><span>{item.label === 'suspect' ? 'Suspect' : item.label === 'legitimate' ? 'Légitime' : 'Incomplet / limite'}</span></th><td>{item.error ? <span className="table-error">Échec : {item.error}</span> : item.risk === 'detected' ? 'Risque détecté' : 'Aucun risque détecté'}</td><td>{item.decision === 'allow' ? 'Autoriser' : item.decision === 'hold' ? 'Retenir' : item.decision === 'review' ? 'Examiner' : 'Aucune'}</td><td>{count(Math.round(item.durationMs))} ms</td></tr>)}</tbody></table></div>
    <details className="run-details"><summary>Reproduire cette exécution et lire ses limites</summary><pre className="command"><code>{result.command}</code></pre><dl><dt>Révision</dt><dd><code>{result.sourceRevision}</code></dd><dt>Versions</dt><dd>{Object.entries(result.versions).map(([key, value]) => `${key} : ${value ?? 'inconnue'}`).join(' · ')}</dd></dl><ul>{result.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></details>
    </>}</section>;
}

function App() {
  const [view, setView] = useState<View>('analyses');
  const [revision, setRevision] = useState(0);
  const state = useResource<LocalState>('/api/state', (value) => StateSchema.parse(value), revision);
  return <><a className="skip-link" href="#main">Aller au contenu</a><header className="app-header"><div className="header-inner"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); setView('analyses'); }} aria-label="HoneySkill, analyses"><span className="brand-mark" aria-hidden="true"><span /><span /></span><span>HoneySkill</span></a><span className="local-indicator"><span />Local · Codex</span></div></header><div className="app-shell"><div className="workspace-heading"><div><p className="eyebrow">Contrôle avant installation</p><h1>Analyses des skills</h1><p>Analysez les skills avant de les activer dans votre projet.</p></div><button className="button refresh" onClick={() => setRevision((value) => value + 1)} disabled={state.status === 'loading'}><span aria-hidden="true">↻</span> Actualiser</button></div><nav className="tabs" aria-label="Vues du contrôle"><button className={view === 'analyses' ? 'active' : ''} aria-current={view === 'analyses' ? 'page' : undefined} onClick={() => setView('analyses')}>Analyses</button><button className={view === 'sources' ? 'active' : ''} aria-current={view === 'sources' ? 'page' : undefined} onClick={() => setView('sources')}>Sources et techniques</button><button className={view === 'benchmark' ? 'active' : ''} aria-current={view === 'benchmark' ? 'page' : undefined} onClick={() => setView('benchmark')}>Évaluation</button></nav><main id="main" tabIndex={-1}>{view === 'analyses' ? state.status === 'loading' ? <Loading /> : state.status === 'error' ? <ErrorNotice message={state.message} retry={() => setRevision((value) => value + 1)} /> : <AnalysisView state={state.data} /> : view === 'sources' ? <SourcesView key={revision} /> : <BenchmarkView key={revision} />}</main><footer className="app-footer"><span className="footer-label">Périmètre du MVP</span><p>{state.status === 'ready' ? state.data.scope : 'Les installations et mises à jour passant par HoneySkill sont contrôlées. Les copies manuelles et autres installateurs restent hors périmètre.'} Aucun contrôle des transactions pendant l’exécution.</p><span className="footer-local">Lecture seule · Aucune télémétrie par défaut</span></footer></div></>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(<StrictMode><App /></StrictMode>);
