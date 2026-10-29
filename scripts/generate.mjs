import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPhpIdnaBundle, verifyJsIdnaBundle } from './php-idna-bundle.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const idna = verifyPhpIdnaBundle(root);
const jsIdna = verifyJsIdnaBundle(root);
const sourceBytes = readFileSync(resolve(root, 'normative/CONTRACT.json'));
const source = JSON.parse(sourceBytes);
if (source.wire_version !== 'v4' || source.release_version !== null || source.status !== 'implementation_candidate_not_exact_approved_not_frozen') throw new Error('Invalid V4 candidate declaration');
if (source.types.Url.domain_policy.unicode_version !== jsIdna.unicode_version) throw new Error('Mismatched V4 domain policy data');
if (source.routes.length !== 36 || source.routes.some((route, index) => route.id !== 'V4-' + String(index+1).padStart(2,'0') || !route.path.startsWith('/discussion-bridge/v4/'))) throw new Error('Inconsistent single V4 route set');
if (source.types.MappingAdopt || source.types.ToExcerpt || source.types.Policy.fields.existing_record_adoption || Object.keys(source.types.ToRepresentation.variants).join(',') !== 'full,generated_excerpt') throw new Error('Earlier-development grammar in active V4 source');
const identity = { path: 'normative/CONTRACT.json', bytes: sourceBytes.length, sha256: hash(sourceBytes) };
const schema = {
  implementation_version: source.implementation_version, candidate_id: source.candidate_id, wire_version: 'v4', status: source.status,
  release_version: null, source_identity: identity, grammar: source.grammar,
  types: source.types, routes: source.routes, transport: source.transport,
  bounds: source.bounds, errors: source.errors, work_transitions: source.work_transitions,
  generated_excerpt: source.generated_excerpt, limitation: source.limitation,
};
const schemaBytes = Buffer.from(JSON.stringify(schema,null,2)+'\n');
const schemaHash = hash(schemaBytes);
const render = (path) => {
  const text = readFileSync(resolve(root,path),'utf8').replaceAll('%CANDIDATE_ID%',source.candidate_id).replaceAll('%IMPLEMENTATION_VERSION%',source.implementation_version)
    .replaceAll('%SCHEMA_SHA256%',schemaHash).replaceAll('%IDNA_SHA256%',idna.sha256).replaceAll('%NORMATIVE_IDENTITY%',JSON.stringify(identity))
    .replaceAll('%JS_IDNA_BUNDLE%', () => jsIdna.runtime);
  if (/%(?:CANDIDATE_ID|IMPLEMENTATION_VERSION|SCHEMA_SHA256|IDNA_SHA256|JS_IDNA_BUNDLE|NORMATIVE_IDENTITY)%/.test(text)) throw new Error('Unresolved generated template');
  return Buffer.from(text);
};
const outputs = {
  'src/cms-schema.json': schemaBytes,
  'src/cms-runtime.mjs': render('implementation/cms-runtime.mjs.in'),
  'src/php/CmsCodec.php': render('implementation/CmsCodec.php.in'),
};
outputs['src/cms-contract.mjs'] = Buffer.from("import { createHash } from 'node:crypto';\nimport { readFileSync } from 'node:fs';\nimport { specIdentity } from './cms-runtime.mjs';\nexport * from './cms-runtime.mjs';\nconst bytes = readFileSync(new URL('../'+specIdentity.path,import.meta.url));\nif(bytes.length!==specIdentity.bytes||createHash('sha256').update(bytes).digest('hex')!==specIdentity.sha256)throw new Error('V4 normative candidate identity mismatch');\n");
outputs['CANDIDATE.json'] = Buffer.from(JSON.stringify({
  candidate_id: source.candidate_id, implementation_version:source.implementation_version, wire_version:'v4', status:source.status, release_version:null,
  normative:identity, routes:source.routes.map((route)=>route.id),
  schema:{path:'src/cms-schema.json',bytes:schemaBytes.length,sha256:schemaHash},
  javascript:{path:'src/cms-runtime.mjs',bytes:outputs['src/cms-runtime.mjs'].length,sha256:hash(outputs['src/cms-runtime.mjs'])},
  php:{path:'src/php/CmsCodec.php',bytes:outputs['src/php/CmsCodec.php'].length,sha256:hash(outputs['src/php/CmsCodec.php']),namespace:'DiscussionBridge\\CmsV4'},
  php_dependencies:{path:idna.path,bytes:idna.bytes,sha256:idna.sha256,namespace:idna.namespace},
  javascript_dependencies:{path:jsIdna.path,bytes:jsIdna.bytes,sha256:jsIdna.sha256,namespace:jsIdna.namespace,unicode_version:jsIdna.unicode_version,embedded_in:'src/cms-runtime.mjs'},
  native_interfaces:source.native_interfaces, unresolved:source.unresolved,limitation:source.limitation,
},null,2)+'\n');
outputs['ROUTES.md']=Buffer.from('# V4 current candidate routes\n\nGenerated from normative/CONTRACT.json. Content Connection authorization and current scope/policy apply to every shared route. No older-version route/negotiation is accepted. Native admin interfaces are separately protected current forum operations, not adapter grants.\n\n| ID | Method | Path | Input/query | Response | Success |\n|---|---|---|---|---|---|\n'+source.routes.map((route)=>'| '+[route.id,route.method,route.path,route.input??(route.query?'query '+route.query:'none'),route.response,route.success_http.join(', ')].join(' | ')+' |').join('\n')+'\n\n## Protected native interfaces\n\n| ID | Method | Path | Authority |\n|---|---|---|---|\n'+source.native_interfaces.map((route)=>'| '+[route.id,route.method,route.path,route.authorization].join(' | ')+' |').join('\n')+'\n\nExact native fields and source/policy/shared-engine/URL-lock rules are in the normative source. Unselected HTML/source-public proof, actual native attention-profile qualification and support-access mechanisms remain separate from route declarations.\n');
const manifest = {
  format:1,candidate_id:source.candidate_id,implementation_version:source.implementation_version,wire_version:'v4',status:source.status,release_version:null,normative:identity,
  php_dependencies:{path:idna.path,bytes:idna.bytes,sha256:idna.sha256,namespace:idna.namespace},
  javascript_dependencies:{path:jsIdna.path,bytes:jsIdna.bytes,sha256:jsIdna.sha256,namespace:jsIdna.namespace,unicode_version:jsIdna.unicode_version,embedded_in:'src/cms-runtime.mjs'},
  derivation_sources:['scripts/generate.mjs','scripts/php-idna-bundle.mjs','implementation/cms-runtime.mjs.in','implementation/CmsCodec.php.in'].map((path)=>{
    const bytes=readFileSync(resolve(root,path));return {path,bytes:bytes.length,sha256:hash(bytes)};
  }),
  members:Object.entries(outputs).map(([path,bytes])=>({path,bytes:bytes.length,sha256:hash(bytes)})),
};
outputs['ARTIFACTS.json']=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
const check=process.argv.includes('--check');
for(const [path,bytes] of Object.entries(outputs)){
  const absolute=resolve(root,path);
  if(check){if(!existsSync(absolute)||!readFileSync(absolute).equals(bytes))throw new Error('Stale V4 generated member: '+path);}
  else{mkdirSync(dirname(absolute),{recursive:true});writeFileSync(absolute,bytes);}
}
console.log(JSON.stringify({status:check?'exact_V4_derivation_checked':'generated_V4_candidate',candidate_id:source.candidate_id,members:manifest.members},null,2));
