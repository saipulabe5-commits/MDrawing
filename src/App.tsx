import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProjectProvider } from "./context/ProjectContext";
import { DocumentProvider } from "./context/DocumentContext";
import { DrawingTemplateProvider } from "./context/DrawingTemplateContext";
import { AIProvider } from "./context/AIContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MainLayout } from "./layouts/MainLayout";
const LoginView=lazy(()=>import('./views/LoginView').then(m=>({default:m.LoginView})));
const AccessDeniedView=lazy(()=>import('./views/AccessDeniedView').then(m=>({default:m.AccessDeniedView})));
const NotFoundView=lazy(()=>import('./views/NotFoundView').then(m=>({default:m.NotFoundView})));
const DashboardView=lazy(()=>import('./views/DashboardView').then(m=>({default:m.DashboardView})));
const PipelineView=lazy(()=>import('./views/PipelineView').then(m=>({default:m.PipelineView})));
const QuotationDetailView=lazy(()=>import('./views/QuotationDetailView').then(m=>({default:m.QuotationDetailView})));
const ProjectsView=lazy(()=>import('./views/ProjectsView').then(m=>({default:m.ProjectsView})));
const ProjectDetailView=lazy(()=>import('./views/ProjectDetailView').then(m=>({default:m.ProjectDetailView})));
const NewProjectWizardView=lazy(()=>import('./views/NewProjectWizardView').then(m=>({default:m.NewProjectWizardView})));
const DrawingTemplatesView=lazy(()=>import('./views/DrawingTemplatesView').then(m=>({default:m.DrawingTemplatesView})));
const ClientsView=lazy(()=>import('./views/ClientsView').then(m=>({default:m.ClientsView})));
const VendorsView=lazy(()=>import('./views/VendorsView').then(m=>({default:m.VendorsView})));
const FinancialReportsView=lazy(()=>import('./views/FinancialReportsView').then(m=>({default:m.FinancialReportsView})));
const FinancialAuditLogView=lazy(()=>import('./views/FinancialAuditLogView').then(m=>({default:m.FinancialAuditLogView})));
const ActivityLogView=lazy(()=>import('./views/ActivityLogView').then(m=>({default:m.ActivityLogView})));
const NotificationsView=lazy(()=>import('./views/NotificationsView').then(m=>({default:m.NotificationsView})));
const UserGuideView=lazy(()=>import('./views/UserGuideView').then(m=>({default:m.UserGuideView})));
const SettingsView=lazy(()=>import('./views/SettingsView').then(m=>({default:m.SettingsView})));
const SolarAuditView=lazy(()=>import('./views/SolarAuditView').then(m=>({default:m.SolarAuditView})));
import { Toaster } from "react-hot-toast";

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !appUser) {
    return <Navigate to="/login" replace />;
  }

  if (!appUser.isActive) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <DocumentProvider>
              <DrawingTemplateProvider>
                <AIProvider>
                  <BrowserRouter>
                    <Suspense fallback={<div role="status" className="p-8">Memuat panel…</div>}><Routes>
                      <Route path="/login" element={<LoginView />} />
                      <Route path="/access-denied" element={<AccessDeniedView />} />
                      
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <MainLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<DashboardView />} />
                        <Route path="pipeline" element={<PipelineView />} />
                        <Route path="quotations/:id" element={<QuotationDetailView />} />
                        <Route path="projects" element={<ProjectsView />} />
                        <Route path="projects/new" element={<NewProjectWizardView />} />
                        <Route path="projects/:id/wizard" element={<NewProjectWizardView />} />
                        <Route path="projects/:id" element={<ProjectDetailView />} />
                        <Route path="templates" element={<DrawingTemplatesView />} />
                        <Route path="clients" element={<ClientsView />} />
                        <Route path="vendors" element={<VendorsView />} />
                        <Route path="reports" element={<FinancialReportsView />} />
                        <Route path="financial-audit" element={<FinancialAuditLogView />} />
                        <Route path="notifications" element={<NotificationsView />} />
                        <Route path="activity-log" element={<ActivityLogView />} />
                        <Route path="solar-audit" element={<SolarAuditView />} />
                        <Route path="guide" element={<UserGuideView />} />
                        <Route path="settings" element={<SettingsView />} />
                        <Route path="*" element={<NotFoundView />} />
                      </Route>
                    </Routes></Suspense>
                  </BrowserRouter>
                  <Toaster 
                    position="bottom-right"
                    toastOptions={{
                      style: {
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '1rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      },
                    }}
                  />
                </AIProvider>
              </DrawingTemplateProvider>
            </DocumentProvider>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
