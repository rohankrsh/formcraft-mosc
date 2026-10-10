# Oracle Database Integration Guide for FormCraft

This document provides a comprehensive technical reference for the Oracle Database integration in **FormCraft**. It covers architecture, security allowlisting, authentication, REST API endpoints, schema extensions, frontend builder UI controls, and automated verification suites.

---

## 📋 Table of Contents
1. [Architectural Overview](#1-architectural-overview)
2. [Security & Isolation Boundary](#2-security--isolation-boundary)
3. [Environment Configuration](#3-environment-configuration)
4. [Backend Directory Structure](#4-backend-directory-structure)
5. [Database Connection & Pool Management](#5-database-connection--pool-management)
6. [Data Dictionary & Metadata Services](#6-data-dictionary--metadata-services)
7. [REST API Endpoints Reference](#7-rest-api-endpoints-reference)
8. [Frontend & UI Integration](#8-frontend--ui-integration)
9. [Offline Export Safety Protection](#9-offline-export-safety-protection)
10. [Automated Verification & Test Suites](#10-automated-verification--test-suites)

---

## 1. Architectural Overview

FormCraft integrates with Oracle Database using **`node-oracledb` (v7+) in pure JavaScript Thin Mode**. This design provides:
- **Zero Native Dependencies**: Does not require Oracle Instant Client or C++ binaries.
- **Connection Pooling**: Managed pool (`poolMin: 2`, `poolMax: 10`) for thread-safe concurrent transactions.
- **Graceful Resilience**: If the Oracle database is unreachable or starting up, the Express server continues running in **degraded mode**, serving AI import (PDF/Excel) and drag-and-drop form editing without crashing.
- **Strict Parameterization**: 100% of dynamic SQL operations use Oracle bind variables (`:bindVar`) with explicit bind types (`oracledb.STRING`, `oracledb.NUMBER`, `oracledb.DATE`) to completely eliminate SQL injection.
- **Human-in-the-Loop Binding**: AI document ingestion generates form visual structures only; database bindings are explicitly mapped by authorized administrators via the UI Property Panel.

---

## 2. Security & Isolation Boundary

### A. Allowlisted Entities Boundary (`server/config/bindableEntities.js`)
FormCraft enforces an immutable allowlist. Requests targeting unlisted tables or columns are immediately rejected with **`403 Forbidden`** before reaching the database:

| Allowlisted Table | Primary Key | Permitted Columns | Description |
| :--- | :--- | :--- | :--- |
| **`PATIENT`** | `PATIENT_ID` | `PATIENT_ID`, `FIRST_NAME`, `LAST_NAME`, `DOB`, `GENDER`, `PHONE`, `EMAIL`, `BLOOD_GROUP`, `STATUS`, `CREATED_AT` | Master patient records |
| **`ADMISSION`** | `ADMISSION_ID` | `ADMISSION_ID`, `PATIENT_ID`, `ADMISSION_DATE`, `DISCHARGE_DATE`, `ROOM_NO`, `DEPARTMENT`, `DOCTOR_IN_CHARGE`, `STATUS` | Inpatient hospital admissions |
| **`VITALS`** | `VITAL_ID` | `VITAL_ID`, `PATIENT_ID`, `RECORDED_AT`, `TEMPERATURE`, `PULSE`, `RESP_RATE`, `BP_SYSTOLIC`, `BP_DIASTOLIC`, `SPO2` | Patient vital sign readings |
| **`DRUG_MASTER`** | `DRUG_ID` | `DRUG_ID`, `DRUG_NAME`, `GENERIC_NAME`, `CATEGORY`, `UNIT`, `STOCK_QTY`, `STATUS` | Medication catalogue / options |

### B. Authentication Gate (`server/middleware/requireAuth.js`)
All database metadata and form data endpoints require an API key passed in the `x-api-key` header:
- **Header**: `x-api-key: <AUTH_SECRET>` (Default: `formcraft_secret_key_2026`)
- **Unauthenticated / Invalid**: Returns `401 Unauthorized`:
  ```json
  { "success": false, "error": "Unauthorized: Invalid or missing API key." }
  ```

### C. Error Masking & Information Leakage Prevention
Under no circumstances are raw Oracle error codes (`ORA-01722`, `ORA-00942`, `ORA-00001`), database connection strings, or credentials exposed to the frontend or API responses. Internal errors are logged to the backend console while clients receive sanitized messages (e.g. `"Unable to save form data to database."`).

---

## 3. Environment Configuration

The application is configured via `.env` in the root workspace (`d:\formbuilder\.env`):

```env
# Google Gemini Multimodal API Key (for PDF/Excel parsing)
GEMINI_API_KEY=your_gemini_api_key_here

# Oracle Database Configuration (Thin Mode)
DB_USER=smitajuly06
DB_PASSWORD=your_oracle_password_here
DB_CONNECT_STRING=192.168.1.104:1521/lifetest

# FormCraft API Secret Key
AUTH_SECRET=formcraft_secret_key_2026

# Backend Server Port
PORT=3001
```

---

## 4. Backend Directory Structure

```
d:\formbuilder\
├── server.js                               # Main Express application & route mounter
├── server\
│   ├── config\
│   │   └── bindableEntities.js             # Security allowlist & helper functions
│   ├── database\
│   │   └── oracle.js                       # Connection pool, transaction helper, health ping
│   ├── middleware\
│   │   └── requireAuth.js                  # x-api-key verification middleware
│   ├── services\
│   │   ├── databaseMetadataService.js      # Dynamic USER_*/ALL_* schema introspection
│   │   ├── formService.js                  # Form JSON persistence (server/data/forms/)
│   │   └── formDataService.js              # Prefill, dynamic options, insert & update transactions
│   ├── controllers\
│   │   ├── database.controller.js          # Metadata controllers
│   │   ├── form.controller.js              # Form definition CRUD
│   │   └── formData.controller.js          # Oracle form data transactions
│   ├── routes\
│   │   ├── database.routes.js              # /api/database/*
│   │   ├── forms.routes.js                 # /api/forms (definition endpoints)
│   │   └── formData.routes.js              # /api/forms/:formId/data* & /api/forms/:formId/options
│   └── data\
│       └── forms\                          # Stored form definition JSON files
├── test_oracle_connection.js               # Diagnostic script for schema ownership checks
└── test_oracle_integration.js              # 22-assertion automated test suite
```

---

## 5. Database Connection & Pool Management

### `server/database/oracle.js`
- **Initialization**: Automatically creates pool on startup via `initOraclePool()`.
- **Transaction Wrapper**:
  ```javascript
  import { withTransaction } from './server/database/oracle.js';

  await withTransaction(async (conn) => {
    await conn.execute(insertSql, binds, { autoCommit: false });
    // Any uncaught error here automatically executes conn.rollback()
    // Normal return automatically executes conn.commit()
  });
  ```
- **Health Check Ping**: `pingDatabase()` executes `SELECT 1 FROM DUAL` to verify pool liveness without keeping idle connections open.
- **Graceful Termination**: `closeOraclePool()` safely closes the pool during process shutdown.

---

## 6. Data Dictionary & Metadata Services

### `server/services/databaseMetadataService.js`
The metadata service automatically introspects Oracle data dictionaries using dynamic schema detection:
1. **Schema Resolution**: First queries `USER_TABLES` to verify if the logged-in user (`DB_USER`) owns the target tables.
2. **Fallback Resolution**: If not found in `USER_TABLES`, inspects `ALL_TABLES` to identify the owning schema and queries `ALL_TAB_COLUMNS` / `ALL_CONSTRAINTS`.
3. **Data Type Normalization**:
   - `NUMBER`, `FLOAT`, `INTEGER` ➔ `NUMBER`
   - `DATE`, `TIMESTAMP` ➔ `DATE`
   - `VARCHAR2`, `CHAR`, `NVARCHAR2`, `CLOB` ➔ `STRING`
4. **Foreign Key Mapping**: Automatically extracts relational foreign keys where **both** tables are on the allowlist.

---

## 7. REST API Endpoints Reference

All endpoints (except `/api/health` and `/api/forms` import) require the `x-api-key: formcraft_secret_key_2026` header.

### A. Health & Diagnostics
- **`GET /api/health`**
  - Public endpoint reporting server, AI, and Oracle database connectivity status.
  - Response:
    ```json
    {
      "status": "ok",
      "service": "form-builder",
      "database": {
        "type": "oracle",
        "connected": true
      },
      "aiEnabled": true,
      "model": "gemini-3.5-flash",
      "supportedFormats": ["xlsx", "xls", "pdf"]
    }
    ```

### B. Database Metadata Introspection
- **`GET /api/database/tables`**
  - Returns allowlisted tables that are verified in the database.
- **`GET /api/database/tables/:table/columns`**
  - Returns allowlisted columns for the specified table with data types, nullability, and primary key flags.
- **`GET /api/database/tables/:table/primary-key`**
  - Returns primary key column(s) and constraint names for the table.
- **`GET /api/database/tables/:table/relationships`**
  - Returns foreign key relationships where both ends are allowlisted.

### C. Form Definitions
- **`POST /api/forms`**
  - Saves or updates a form definition JSON in `server/data/forms/<formId>.json`.
- **`GET /api/forms/:formId`**
  - Retrieves the persisted form definition.

### D. Dynamic Options Lookup
- **`GET /api/forms/:formId/options`**
  - Scans all fields in the form definition for `optionsBinding` configurations (e.g. Select dropdowns bound to `DRUG_MASTER`) and returns batched `{ [fieldName]: [{ label, value }] }` options.

### E. Oracle Record Operations
- **`GET /api/forms/:formId/data/:recordId`**
  - Reads a record by primary key from the form's `primaryEntity` table.
  - Automatically formats `DATE` columns as UTC ISO-8601 (`YYYY-MM-DD`) strings.
- **`POST /api/forms/:formId/data`**
  - Validates required fields and data types against form definition rules.
  - Executes a parameterized `INSERT INTO <primaryEntity> (...) VALUES (...)` with explicit Oracle bind types.
  - Returns `{ success: true, data: { primaryKey: <id> } }`.
- **`PUT /api/forms/:formId/data/:recordId`**
  - Validates submission and executes a parameterized `UPDATE <primaryEntity> SET ... WHERE <primaryKeyColumn> = :recordId`.

---

## 8. Frontend & UI Integration

### A. Schema Extensions (`src/types/schema.ts`)
```typescript
export type OracleBindType = 'STRING' | 'NUMBER' | 'DATE';
export type DataBindingMode = 'read-write' | 'read-only' | 'write-only';

export interface DataBindingConfig {
  entity: string;
  column: string;
  oracleType: OracleBindType;
  mode?: DataBindingMode;
}

export interface OptionsBindingConfig {
  table: string;
  valueColumn: string;
  labelColumn: string;
  filterSql?: string;
}

export interface FormSettings {
  // ... existing layout & theme settings
  primaryEntity?: string;
  primaryKeyColumn?: string;
}

export interface FormField {
  // ... existing field properties
  dataBinding?: DataBindingConfig;
  optionsBinding?: OptionsBindingConfig;
}
```

### B. Property Panel Database Controls (`src/components/properties/PropertyPanel.tsx`)
- **Form Settings Panel**: Provides dropdowns to select the **Oracle Target Table** (e.g. `PATIENT`) and **Primary Key Column** (e.g. `PATIENT_ID`). Dropdown options are fetched from `/api/database/tables`.
- **Field Inspector Panel**:
  - **Oracle Data Binding Card**: Allows binding an individual input field to an allowlisted column with configurable data type (`STRING`, `NUMBER`, `DATE`) and mode (`Read / Write`, `Read Only`, `Write Only`).
  - **Oracle Dynamic Options Card**: For `select` and `radio` fields, allows binding options dynamically to a database table (e.g. Table: `DRUG_MASTER`, Value: `DRUG_ID`, Label: `DRUG_NAME`).

### C. Live Preview Toolbar & Submission (`src/components/preview/LivePreview.tsx`)
- **Prefill Toolbar**: Displays an active Oracle connection status bar with a **Record ID** input. Entering an ID and clicking **Fetch** loads live data from Oracle directly into the form fields.
- **Transactional Submission**:
  - Automatically toggles between **Insert (`POST`)** for new records and **Update (`PUT`)** when editing an existing record.
  - Displays committed transaction badges and formatted JSON response inspection.

---

## 9. Offline Export Safety Protection

FormCraft includes a standalone zero-dependency HTML exporter (`src/utils/exportHtml.ts`) that bundles forms into self-contained HTML files.

### Safety Mechanism (`src/components/header/Header.tsx`):
- When a form contains **active Oracle database bindings**, the header **Download Form** button displays an amber `DB` badge.
- Clicking the button opens a modal explaining that offline static files cannot execute Oracle database transactions or store database credentials.
- Users are instructed that database-bound forms operate securely through the live, authenticated Express API routes.

---

## 10. Automated Verification & Test Suites

### A. Integration Test Suite (`test_oracle_integration.js`)
An automated end-to-end integration test verifies all 7 architectural pillars:
```bash
node test_oracle_integration.js
```

**Test Coverage (22 / 22 Assertions - 100% Pass Rate)**:
1. **Health Endpoint**: Validates 200 response, database type `"oracle"`, and boolean connection status.
2. **Security & Auth Gate**: Validates rejection of unauthenticated (401) and invalid API key requests.
3. **Allowlist Boundary**: Validates 403 Forbidden on non-allowlisted tables, PK lookups, and relationship queries.
4. **Form Definition Persistence**: Validates saving and reading form JSON definitions.
5. **Dynamic Options Lookup**: Validates batch options endpoint responses.
6. **Server-Side Data Validation**: Validates 400 Bad Request with field-level error messages for invalid input.
7. **SQL Injection Defense & Error Masking**: Validates parameterized binds and verifies raw Oracle error codes are masked from clients.

### B. Production Build Verification
```bash
npm run build
```
Executes `tsc -b && vite build` to ensure type safety and production asset compilation.
