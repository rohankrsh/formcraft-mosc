import 'dotenv/config';
import { formRepository } from '../server/repositories/formRepository.js';
import { closeOraclePool } from '../server/database/oracle.js';

async function testFullRepo() {
  console.log('[Test] Initializing OracleFormRepository...');
  await formRepository.init();

  console.log('[Test] Calling listForms()...');
  const forms = await formRepository.listForms();
  console.log(`[Test] Total forms returned: ${forms.length}`);
  forms.forEach(f => {
    console.log(`  - ID: ${f.id} | Name: "${f.name}" | Status: ${f.status} | Ver: ${f.publishedVersion} | Depts: [${f.departmentIds.join(', ')}]`);
  });

  console.log('\n[Test] Calling getFormById("mosc_initial_nursing_assessment")...');
  const mosc = await formRepository.getFormById('mosc_initial_nursing_assessment');
  console.log('  Meta ID:', mosc.meta.id);
  console.log('  Draft Title:', mosc.draft?.title);
  console.log('  Draft Fields Count:', Object.keys(mosc.draft?.fields || {}).length);
  console.log('  Published Definition Title:', mosc.publishedDefinition?.title);
  console.log('  Published Definition Fields Count:', Object.keys(mosc.publishedDefinition?.fields || {}).length);

  console.log('\n[Test] Calling getVersionDefinition("mosc_initial_nursing_assessment", 8)...');
  const v8 = await formRepository.getVersionDefinition('mosc_initial_nursing_assessment', 8);
  console.log('  V8 Title:', v8?.title);
  console.log('  V8 Fields Count:', Object.keys(v8?.fields || {}).length);

  console.log('\n[Test] Calling getVersionDefinition("anaesthesia_procedural_docket", 4)...');
  const an4 = await formRepository.getVersionDefinition('anaesthesia_procedural_docket', 4);
  console.log('  Anaesthesia V4 Title:', an4?.title);
  console.log('  Anaesthesia V4 Fields Count:', Object.keys(an4?.fields || {}).length);

  console.log('\n[Test] Calling getFormVersions("mosc_initial_nursing_assessment")...');
  const vers = await formRepository.getFormVersions('mosc_initial_nursing_assessment');
  console.log('  Versions count:', vers.length);
  console.log('  Versions list:', vers.map(v => `v${v.versionNumber} (${v.createdAt})`).join(', '));

  await closeOraclePool();
  console.log('\n[Test] ALL TESTS COMPLETED SUCCESSFULLY!');
}

testFullRepo().catch((err) => {
  console.error('[Test] FAILED:', err);
  process.exit(1);
});
