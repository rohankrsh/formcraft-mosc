import * as metadataService from '../services/databaseMetadataService.js';

export async function getTables(req, res) {
  try {
    const tables = await metadataService.getTables();
    return res.json({ success: true, data: tables });
  } catch (err) {
    console.error('[DatabaseController] getTables error:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: 'Failed to retrieve database tables.',
    });
  }
}

export async function getColumns(req, res) {
  const { tableName } = req.params;
  try {
    const columns = await metadataService.getColumns(tableName);
    return res.json({ success: true, data: columns });
  } catch (err) {
    console.error(`[DatabaseController] getColumns('${tableName}') error:`, err);
    if (err.status === 403) {
      return res.status(403).json({
        success: false,
        error: `Table '${tableName}' is not in the allowed entity list.`,
      });
    }
    return res.status(err.status || 500).json({
      success: false,
      error: `Failed to retrieve column metadata for table '${tableName}'.`,
    });
  }
}

export async function getPrimaryKey(req, res) {
  const { tableName } = req.params;
  try {
    const pkInfo = await metadataService.getPrimaryKey(tableName);
    return res.json({ success: true, data: pkInfo });
  } catch (err) {
    console.error(`[DatabaseController] getPrimaryKey('${tableName}') error:`, err);
    if (err.status === 403) {
      return res.status(403).json({
        success: false,
        error: `Table '${tableName}' is not in the allowed entity list.`,
      });
    }
    return res.status(err.status || 500).json({
      success: false,
      error: `Failed to retrieve primary key for table '${tableName}'.`,
    });
  }
}

export async function getRelationships(req, res) {
  const { tableName } = req.params;
  try {
    const rels = await metadataService.getRelationships(tableName);
    return res.json({ success: true, data: rels });
  } catch (err) {
    console.error(`[DatabaseController] getRelationships('${tableName}') error:`, err);
    if (err.status === 403) {
      return res.status(403).json({
        success: false,
        error: `Table '${tableName}' is not in the allowed entity list.`,
      });
    }
    return res.status(err.status || 500).json({
      success: false,
      error: `Failed to retrieve relationships for table '${tableName}'.`,
    });
  }
}

export async function previewQuery(req, res) {
  const { sql, parameters } = req.body || {};
  try {
    const { testQueryPreview } = await import('../services/queryExecutionService.js');
    const result = await testQueryPreview(sql, parameters);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[DatabaseController] previewQuery error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to preview query.',
    });
  }
}

