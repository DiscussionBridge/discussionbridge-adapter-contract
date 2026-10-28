// Reusable author checks extracted from pinned historical evidence; normal tests are self-contained.
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const old=resolve(root,'../../adapter-contract');
const schema=JSON.parse(readFileSync(resolve(root,'src/cms-schema.json'),'utf8'));
const raw=readFileSync(resolve(old,'approved-packet/ADAPTER_PROTOCOL_V2_CONFORMANCE_CASES_20261009.json'));
if(createHash('sha256').update(raw).digest('hex')!=='c5f2bae11a90337541f74fe5ef10d87262cdc986551c6a40e0761d99a7d52b13')throw new Error('Historical author-case pin mismatch');
const cases=JSON.parse(raw);
const changed=new Set(['Policy','Connection','ToRecord','ToResolve','ToRepresentation','WithdrawInput','ErrorCode','Error','Failure']);
const values={
  status:'derived reusable V4 author cases; not frozen/review/native proof',
  type_cases:cases.type_cases.filter((item)=>item.profile==='v2'&&schema.types[item.type]&&!changed.has(item.type)).map((item)=>({...item,profile:'v4'})),
  raw_json_cases:cases.raw_json_cases.filter((item)=>item.profile==='v2').map((item)=>({...item,profile:'v4'})),
};
writeFileSync(resolve(root,'fixtures/rejection-cases.json'),JSON.stringify(values,null,2)+'\n');
const map=JSON.parse(readFileSync(resolve(root,'derivation/HISTORICAL_ROUTE_MAP.json'))).routes;
const routes=(text)=>text.replace(/V2-\d{2}/g,(id)=>{const found=map.find((item)=>item.historical_id===id);if(!found)throw new Error('Removed route in current checks');return found.current_id;});
let js=readFileSync(resolve(old,'tests/cms-publication-conformance.test.mjs'),'utf8').replaceAll('\r\n','\n');
js=js.replace("const release = await json('release.json');\n",'');
js=js.replace("const examples = (await json('approved-packet/ADAPTER_PROTOCOL_V2_EXAMPLES_20261009.json')).v2_examples.filter((example) => cmsSchema.types[example.type]);","const examples = (await json('fixtures/positive-examples.json')).fixtures;");
js=js.replace("const cases = await json('approved-packet/ADAPTER_PROTOCOL_V2_CONFORMANCE_CASES_20261009.json');","const cases = await json('fixtures/rejection-cases.json');");
js=js.replace("const fixtures = await json('fixtures/cms-publication/derived-positive-examples.json');","const fixtures = await json('fixtures/positive-examples.json');");
js=js.replace("fixtures/core-publication/cms/numeric-lexemes.json","fixtures/numeric-lexemes.json");
js=js.replace(/test\('CMS implementation binds[\s\S]*?\n\}\);\r?\n/,'');
js=js.replace('    assert.deepEqual(fixture.derivation.corrections, []);\n','');
js=js.replaceAll("'v2'","'v4'").replaceAll('immutable CMS','derived V4');
js=js.replace('cmsSchema,\n','cmsSchema, cmsSchemaIdentity,\n');
js=js.replace("'b5ce03ac60379a60e9adc3b4193b9f49e9f6c0687010a91a138577d4cbf95760'",'cmsSchemaIdentity.sha256');
js=routes(js);
mkdirSync(resolve(root,'tests'),{recursive:true});
writeFileSync(resolve(root,'tests/cms-conformance.test.mjs'),js);
let php=readFileSync(resolve(old,'src/php/conformance.php'),'utf8').replaceAll('\r\n','\n');
php=php.replaceAll('DiscussionBridge\\CmsV2','DiscussionBridge\\CmsV4');
php=php.replace("'approved-packet/ADAPTER_PROTOCOL_V2_EXAMPLES_20261009.json'","'fixtures/positive-examples.json'");
php=php.replace("'approved-packet/ADAPTER_PROTOCOL_V2_CONFORMANCE_CASES_20261009.json'","'fixtures/rejection-cases.json'");
php=php.replace('fixtures/core-publication/cms/numeric-lexemes.json','fixtures/numeric-lexemes.json');
php=php.replace('$sourceExamples->v2_examples','$sourceExamples->fixtures').replaceAll("'v2'","'v4'");
php=php.replace(/\$run\('unchanged source identities[\s\S]*?\n\}\);\r?\n/,
  "$run('single V4 identities/count', function () use ($root, $examples, $schema, $check): void {\n    $check(count($examples) === 48);\n    $check(count($schema->routes) === 31);\n    $check(count(get_object_vars($schema->types)) === 136);\n    $check(hash_file('sha256', $root . '/src/cms-schema.json') === Codec::SCHEMA_SHA256);\n});\n");
php=php.replaceAll('frozen positive','derived V4 positive').replaceAll('frozen rejection','derived V4 rejection').replaceAll('frozen raw rejection','derived V4 raw rejection').replaceAll(' frozen CMS positives; 32 typed route envelopes',' V4 author positives; 31 typed route envelopes');
php=routes(php);
writeFileSync(resolve(root,'src/php/conformance.php'),php);
let behavior=readFileSync(resolve(old,'amendments/to-v2-delivery-20261014/tests/generated-excerpt.test.mjs'),'utf8').replaceAll('\r\n','\n');
behavior=behavior.replace("import * as current from '../../../src/cms-runtime.mjs';\n",'');
behavior=behavior.replace("import * as amended from '../generated/cms-runtime.mjs';","import * as amended from '../src/cms-runtime.mjs';\nconst current=amended;");
behavior=behavior.replace("new URL('../../../' + file, import.meta.url)","new URL('../' + file, import.meta.url)");
behavior=behavior.replace("const amendment = JSON.parse(readFileSync(new URL('../AMENDMENT.json', import.meta.url)));","const source = JSON.parse(readFileSync(new URL('../normative/CONTRACT.json', import.meta.url)));");
behavior=behavior.replace("fixtures/cms-publication/derived-positive-examples.json","fixtures/positive-examples.json");
behavior=behavior.replace(/test\('separate candidate preserves[\s\S]*?\n\}\);\n/,()=>{
    return "test('single V4 grammar has no old route/init/unmarked/adoption/profile surface',()=>{\n  assert.equal(amended.wireVersion,'v4'); assert.equal(amended.implementationVersion,'0.4.0-alpha.1');\n  assert.equal(amended.candidateId,source.candidate_id);\n  assert.equal(amended.cmsSchema.routes.length,31);\n  assert.equal(Object.keys(amended.cmsSchema.types).length,136);\n  assert.deepEqual(Object.keys(amended.cmsSchema.types.ToRepresentation.variants),['full','generated_excerpt']);\n  assert.equal(amended.cmsSchema.types.MappingAdopt,undefined);assert.equal(amended.cmsSchema.types.ToExcerpt,undefined);\n  assert.equal(amended.cmsSchema.types.Policy.fields.existing_record_adoption,undefined);\n  assert.throws(()=>amended.validateCmsRoute('V2-02'),/Unavailable CMS route/);\n  rejects(()=>amended.validateCms('ErrorCode','network_not_enrolled'));\n  rejects(()=>amended.validateCms('WithdrawInput',{mutation_id:example.mutation_id,expected_source_revision:null}));\n  const policy=copy(fixtures.find((item)=>item.type==='Policy').value);policy.existing_record_adoption='disabled';\n  rejects(()=>amended.validateCms('Policy',policy),'unknown_field');\n  assert.equal(amended.cmsSchema.transport.request_json_maximum_bytes,65536);\n  assert.equal(amended.cmsSchema.types.ContentHtml.utf8_maximum_bytes,49152);\n});\n";
});
behavior=behavior.replace(/test\('all 49 current-reachable[\s\S]*?\n\}\);\n/,
  "test('all current V4 author-positive shapes validate',()=>{assert.equal(fixtures.length,48);for(const item of fixtures)amended.validateCms(item.type,item.value);});\n");
behavior=behavior.replace("  assert.throws(() => current.validateCms('ToRecord', record)); // Strict old peer.\n",'');
behavior=behavior.replace("  amended.validateCms('ToRecord', legacy);","  rejects(() => amended.validateCms('ToRecord', legacy));");
behavior=behavior.replaceAll('or old bounded type','without old unmarked type').replaceAll("'V2-02'","'V4-02'");
// Keep explicit old-route rejection, never rewrite it into the current route.
behavior=behavior.replace("assert.throws(()=>amended.validateCmsRoute('V4-02'),/Unavailable CMS route/);","assert.throws(()=>amended.validateCmsRoute('V2-02'),/Unavailable CMS route/);");
behavior=behavior.replace('../../../../.tools/','../../../.tools/').replace('./php-conformance.php','./php-generated.php');
writeFileSync(resolve(root,'tests/v4-behavior.test.mjs'),behavior);
let generatedPhp=readFileSync(resolve(old,'amendments/to-v2-delivery-20261014/tests/php-conformance.php'),'utf8').replaceAll('\r\n','\n');
generatedPhp=generatedPhp.replace("require __DIR__ . '/../generated/CmsCodec.php';","require __DIR__ . '/../src/php/CmsCodec.php';");
generatedPhp=generatedPhp.replace("require __DIR__ . '/../../../src/php/CmsCodec.php';\n",'');
generatedPhp=generatedPhp.replaceAll('DiscussionBridge\\CmsV2\\GeneratedExcerpt20261014','DiscussionBridge\\CmsV4');
generatedPhp=generatedPhp.replace("new Codec(__DIR__ . '/../generated/cms-schema.json')","new Codec(__DIR__ . '/../src/cms-schema.json')");
generatedPhp=generatedPhp.replace(/^\$baselineCodec[^\n]*\n/m,'');
generatedPhp=generatedPhp.replace('ValidationException | \\DiscussionBridge\\CmsV2\\ValidationException','ValidationException');
generatedPhp=generatedPhp.replace("$reject(fn() => $baselineCodec->validate('ToRecord', $record));\n",'');
writeFileSync(resolve(root,'tests/php-generated.php'),generatedPhp);
console.log(JSON.stringify({type_cases:values.type_cases.length,raw_cases:values.raw_json_cases.length,status:'V4_author_vectors_derived'},null,2));
