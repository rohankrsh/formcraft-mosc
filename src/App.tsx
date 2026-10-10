import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FormsDashboard } from './dashboard/FormsDashboard';
import { BuilderPage } from './builder/BuilderPage';
import { RuntimePage } from './runtime/RuntimePage';
import { PatientList } from './pages/PatientList';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Central Forms Dashboard */}
        <Route path="/" element={<FormsDashboard />} />

        {/* HIS Inpatients List & Form Launcher */}
        <Route path="/patients" element={<PatientList />} />

        {/* Visual Drag-and-Drop Authoring Environment */}
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/builder/:formId" element={<BuilderPage />} />

        {/* Lightweight End-User Runtime */}
        <Route path="/forms/:slug" element={<RuntimePage />} />

        {/* Fallback to Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
