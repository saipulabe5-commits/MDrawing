import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Card } from "../components/ui";
import { Layers } from "lucide-react";

export function LoginView() {
  const { user, appUser, loading, signIn } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] dark:bg-[#1E1E1E]">
        <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && appUser && appUser.isActive) {
    return <Navigate to="/" replace />;
  }

  if (user && appUser && !appUser.isActive) {
    return <Navigate to="/access-denied" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F5F5F7] dark:bg-[#1E1E1E]">
      <Card className="w-full max-w-sm p-8 text-center space-y-6 bg-white/70 dark:bg-[#2C2C2E]/70 backdrop-blur-xl">
        <div className="mx-auto w-16 h-16 bg-[var(--color-accent-blue)] rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-accent-blue)]/20 mb-6">
          <Layers className="w-8 h-8 text-white" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            MDrawing
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Sistem Manajemen Gambar & Keuangan Proyek
          </p>
        </div>

        <Button onClick={signIn} className="w-full h-11 text-base">
          Login dengan Google
        </Button>
      </Card>
    </div>
  );
}
