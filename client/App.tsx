import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import CreateForm from "./pages/CreateForm";
import FormPreviewPage from "./pages/FormPreviewPage";
import FormDetail from "./pages/FormDetail";
import SharedFormView from "./pages/SharedFormView";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminForms from "./pages/admin/Forms";
import AdminSubmissions from "./pages/admin/Submissions";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create"
                element={
                  <ProtectedRoute>
                    <CreateForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/preview"
                element={
                  <ProtectedRoute>
                    <FormPreviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/:formId"
                element={
                  <ProtectedRoute>
                    <FormDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/form/:shareToken"
                element={<SharedFormView />}
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/forms"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminForms />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/submissions"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminSubmissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
