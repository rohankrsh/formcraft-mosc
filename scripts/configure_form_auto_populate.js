import { formRepository } from '../server/repositories/formRepository.js';
import { initOraclePool } from '../server/database/oracle.js';

async function updateForms() {
  await initOraclePool();
  await formRepository.init();

  const formIds = ['mosc_initial_nursing_assessment', 'form_initial_nursing_assessment'];

  for (const formId of formIds) {
    const formRecord = await formRepository.getFormById(formId);
    if (!formRecord) {
      console.log(`Form not found: ${formId}`);
      continue;
    }

    const isPublished = Boolean(formRecord.publishedDefinition);
    const def = formRecord.publishedDefinition || formRecord.draft;
    if (!def || !def.fields) {
      console.log(`No fields in form: ${formId}`);
      continue;
    }

    let modified = false;

    // 1. Configure Target Field A: nurse name field
    for (const [fId, f] of Object.entries(def.fields)) {
      if (
        fId === 'fld_nurse_name' ||
        f.name === 'nurse_name' ||
        (f.label && f.label.includes('Assessment Completed by Staff Nurse'))
      ) {
        f.autoPopulate = {
          autoPopulate: true,
          dataSource: 'loggedInUser',
          sourceField: 'staff_name',
          populateWhen: 'empty',
        };
        f.dataSource = 'loggedInUser';
        f.sourceField = 'staff_name';
        f.populateWhen = 'empty';
        modified = true;
        console.log(`Configured autoPopulate on ${formId} field: ${fId} (${f.label})`);
      }

      // 2. Configure Target Field B: Morse table columns
      if (f.type === 'table' && f.tableConfig?.columns) {
        for (const col of f.tableConfig.columns) {
          const colLabel = (col.label || '').toLowerCase();
          if (
            col.id === 'col_b4it_6' ||
            col.id === 'staff_name_sign' ||
            col.key === 'col_b4it_6' ||
            col.key === 'staff_name_sign' ||
            colLabel.includes('staff name & sign')
          ) {
            col.autoPopulate = {
              autoPopulate: true,
              dataSource: 'loggedInUser',
              sourceField: 'staff_name',
              populateWhen: 'empty',
            };
            col.dataSource = 'loggedInUser';
            col.sourceField = 'staff_name';
            col.populateWhen = 'empty';
            modified = true;
            console.log(`Configured autoPopulate on ${formId} table column: ${col.id} (${col.label})`);
          }
        }
      }
    }

    if (modified) {
      // Save form definition to repository
      await formRepository.saveForm(def, {
        description: 'Added loggedInUser staff auto-population configuration',
      });
      // Also publish if it was published
      if (isPublished) {
        await formRepository.publishForm(formId, {
          changelog: 'Added logged-in staff auto-population configuration',
        });
      }
      console.log(`Successfully updated and saved ${formId} in Oracle Database!`);
    } else {
      console.log(`No fields required modification for ${formId}`);
    }
  }

  process.exit(0);
}

updateForms().catch((err) => {
  console.error('Error configuring forms:', err);
  process.exit(1);
});
