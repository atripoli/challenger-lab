import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SkillPrompts from './pages/SkillPrompts.jsx';
import Experiments from './pages/Experiments.jsx';
import ExperimentNew from './pages/ExperimentNew.jsx';
import ExperimentDetail from './pages/ExperimentDetail.jsx';
import ExperimentCompare from './pages/ExperimentCompare.jsx';
import Clients from './pages/Clients.jsx';
import ClientForm from './pages/ClientForm.jsx';
import Products from './pages/Products.jsx';
import ProductForm from './pages/ProductForm.jsx';
import ProductHistory from './pages/ProductHistory.jsx';
import Team from './pages/Team.jsx';
import TeamForm from './pages/TeamForm.jsx';
import Placeholder from './pages/Placeholder.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="experiments"      element={<Experiments />} />
        <Route path="experiments/new"     element={<ProtectedRoute roles={['admin','analyst']}><ExperimentNew /></ProtectedRoute>} />
        <Route path="experiments/compare" element={<ExperimentCompare />} />
        <Route path="experiments/:id"     element={<ExperimentDetail />} />
        <Route path="clients"          element={<Clients />} />
        <Route path="clients/new"      element={<ProtectedRoute roles={['admin','analyst']}><ClientForm /></ProtectedRoute>} />
        <Route path="clients/:id/edit" element={<ProtectedRoute roles={['admin','analyst']}><ClientForm /></ProtectedRoute>} />
        <Route path="products"         element={<Products />} />
        <Route path="products/new"     element={<ProtectedRoute roles={['admin','analyst']}><ProductForm /></ProtectedRoute>} />
        <Route path="products/:id/edit" element={<ProtectedRoute roles={['admin','analyst']}><ProductForm /></ProtectedRoute>} />
        <Route path="products/:id/history" element={<ProductHistory />} />
        <Route
          path="skill-prompts"
          element={
            <ProtectedRoute roles={['admin']}>
              <SkillPrompts />
            </ProtectedRoute>
          }
        />
        <Route
          path="team"
          element={<ProtectedRoute roles={['admin']}><Team /></ProtectedRoute>}
        />
        <Route
          path="team/new"
          element={<ProtectedRoute roles={['admin']}><TeamForm /></ProtectedRoute>}
        />
        <Route
          path="team/:id/edit"
          element={<ProtectedRoute roles={['admin']}><TeamForm /></ProtectedRoute>}
        />
      </Route>
    </Routes>
  );
}
