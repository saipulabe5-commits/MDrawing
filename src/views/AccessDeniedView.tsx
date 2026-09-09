import { useAuth } from "../context/AuthContext";
import { Button, Card } from "../components/ui";
import { ShieldAlert } from "lucide-react";

export function AccessDeniedView() {
  const { logOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F5F5F7] dark:bg-[#1E1E1E]">
      <Card className="w-full max-w-sm p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-[var(--color-accent-red)]/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-[var(--color-accent-red)]" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Akses Ditolak
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Akun Anda saat ini belum aktif atau tidak memiliki izin untuk mengakses aplikasi ini. Silakan hubungi Administrator.
          </p>
        </div>

        <Button variant="secondary" onClick={logOut} className="w-full">
          Kembali ke Login
        </Button>
      </Card>
    </div>
  );
}
