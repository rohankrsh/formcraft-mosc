import 'dotenv/config';
import { formRepository } from '../server/repositories/formRepository.js';
import { closeOraclePool } from '../server/database/oracle.js';

async function testLifecycle() {
  console.log('[Lifecycle Test] Starting form lifecycle test in Oracle...');
  await formRepository.init();

  const testId = `test_form_${Date.now()}`;
  const testTitle = `Automated Oracle Test Form ${Date.now()}`;

  const testDef = {
    version: '1.0.0',
    id: testId,
    title: testTitle,
    description: 'Testing Oracle-First form lifecycle',
    settings: {
      submitButtonText: 'Submit Test',
      departmentIds: ['CARDIOLOGY', 'GENERAL_MEDICINE'],
      departmentNames: ['Cardiology', 'General Medicine'],
    },
    fields: {
      f1: { id: 'f1', name: 'patient_notes', type: 'textarea', label: 'Clinical Notes' },
    },
    layout: [
      {
        id: 'sec1',
        title: 'Primary Section',
        rows: [{ id: 'r1', columns: [{ id: 'c1', width: 12, fieldIds: ['f1'] }] }],
      },
    ],
  };

  // 1. Save draft
  console.log('[Lifecycle Test] 1. Saving draft...');
  const saved = await formRepository.saveForm(testDef, { name: testTitle, status: 'draft' });
  console.log('   Saved form ID:', saved.meta.id, 'Slug:', saved.meta.slug, 'Draft fields:', Object.keys(saved.draft?.fields || {}).length);
  console.log('   Saved departments:', saved.meta.departmentIds);

  if (saved.meta.id !== testId || Object.keys(saved.draft?.fields || {}).length !== 1) {
    throw new Error('Save draft validation failed');
  }

  // 2. Publish form
  console.log('[Lifecycle Test] 2. Publishing form...');
  const published = await formRepository.publishForm(testId);
  console.log('   Published Version:', published.version, 'Status:', published.meta.status);
  if (published.version !== 1 || published.meta.status !== 'published') {
    throw new Error('Publish form validation failed');
  }

  // 3. Retrieve published definition
  console.log('[Lifecycle Test] 3. Retrieving published definition by slug...');
  const bySlug = await formRepository.getFormBySlug(saved.meta.slug);
  console.log('   Retrieved by slug title:', bySlug.publishedDefinition?.title);
  if (bySlug.publishedDefinition?.title !== testTitle) {
    throw new Error('Get by slug validation failed');
  }

  // 4. Retrieve specific version
  console.log('[Lifecycle Test] 4. Retrieving version 1 definition...');
  const verDef = await formRepository.getVersionDefinition(testId, 1);
  console.log('   Version 1 title:', verDef?.title);
  if (verDef?.title !== testTitle) {
    throw new Error('Get version definition validation failed');
  }

  // 5. Unpublish form
  console.log('[Lifecycle Test] 5. Unpublishing form...');
  await formRepository.unpublishForm(testId);
  const unpub = await formRepository.getFormById(testId);
  console.log('   Status after unpublish:', unpub.meta.status);
  if (unpub.meta.status !== 'unpublished') {
    throw new Error('Unpublish validation failed');
  }

  // 6. Delete test form
  console.log('[Lifecycle Test] 6. Deleting test form...');
  const delRes = await formRepository.deleteForm(testId);
  console.log('   Delete response:', delRes.message);

  const checkDeleted = await formRepository.getFormById(testId);
  if (checkDeleted !== null) {
    throw new Error('Delete form validation failed: form still exists');
  }
  console.log('   Verified form completely deleted from Oracle.');

  await closeOraclePool();
  console.log('[Lifecycle Test] SUCCESS: All Oracle lifecycle operations verified!');
}

testLifecycle().catch((err) => {
  console.error('[Lifecycle Test] FAILED:', err);
  process.exit(1);
});
