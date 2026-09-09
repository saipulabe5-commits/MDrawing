import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProjectProvider } from "./context/ProjectContext";
import { DocumentProvider } from "./context/DocumentContext";
import { DrawingTemplateProvider } from "./context/DrawingTemplateContext";
import { AIProvider } from "./context/AIContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MainLayout } from "./layouts/MainLayout";
import { LoginView } from "./views/LoginView";
import { AccessDeniedView } from "./views/AccessDeniedView";
import { NotFoundView } from "./views/NotFoundView";
import { DashboardView } from "./views/DashboardView";
import { ProjectsView } from "./views/ProjectsView";
import { ProjectDetailView } from "./views/ProjectDetailView";
import { NewProjectWizardView } from "./views/NewProjectWizardView";
import { DrawingTemplatesView } from "./views/DrawingTemplatesView";
import { ClientsView } from "./views/ClientsView";
import { VendorsView } from "./views/VendorsView";
import { FinancialReportsView } from "./views/FinancialReportsView";
import { FinancialAuditLogView } from "./views/FinancialAuditLogView";
import { ActivityLogView } from "./views/ActivityLogView";
import { UserGuideView } from "./views/UserGuideView";
import { SettingsView } from "./views/SettingsView";
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
                    <Routes>
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
                        <Route path="projects" element={<ProjectsView />} />
                        <Route path="projects/new" element={<NewProjectWizardView />} />
                        <Route path="projects/:id/wizard" element={<NewProjectWizardView />} />
                        <Route path="projects/:id" element={<ProjectDetailView />} />
                        <Route path="templates" element={<DrawingTemplatesView />} />
                        <Route path="clients" element={<ClientsView />} />
                        <Route path="vendors" element={<VendorsView />} />
                        <Route path="reports" element={<FinancialReportsView />} />
                        <Route path="financial-audit" element={<FinancialAuditLogView />} />
                        <Route path="activity-log" element={<ActivityLogView />} />
                        <Route path="guide" element={<UserGuideView />} />
                        <Route path="settings" element={<SettingsView />} />
                        <Route path="*" element={<NotFoundView />} />
                      </Route>
                    </Routes>
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
