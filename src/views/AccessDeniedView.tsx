import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Card, Badge } from "../components/ui";
import { ShieldAlert, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";

export function AccessDeniedView() {
  const { user, appUser, logOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  // Auto-redirect to dashboard the instant Owner activates this user
  useEffect(() => {
    if (appUser?.isActive) {
      navigate("/", { replace: true });
    }
  }, [appUser?.isActive, navigate]);

  const handleCheckStatus = () => {
    setChecking(true);
    setTimeout(() => {
      const email = (user?.email || appUser?.email || "").toLowerCase().trim();
      const isOwnerEmail = email === "saipulabe5@gmail.com" || email === "saipulabe@gmail.com";
      if (appUser?.isActive || isOwnerEmail) {
        navigate("/", { replace: true });
      } else {
        window.location.reload();
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <Card className="w-full max-w-md p-8 text-center space-y-6 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl">
        <div className="mx-auto w-16 h-16 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Menunggu Aktivasi Akun
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Akun Google Anda telah terhubung, namun saat ini berstatus <strong>Non-Aktif</strong>.
          </p>
        </div>

        {/* User Card */}
        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-left text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">Akun Google:</span>
            <Badge variant="warning">Non-Aktif</Badge>
          </div>
          <div className="font-semibold text-[var(--color-text-primary)] truncate">
            {user?.displayName || "Pengguna MDrawing"}
          </div>
          <div className="text-[var(--color-text-secondary)] font-mono truncate">
            {user?.email || "-"}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 text-left space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            Langkah Selanjutnya:
          </div>
          <p>
            Minta <strong>Owner</strong> atau <strong>Administrator</strong> untuk mengaktifkan akun Anda melalui menu <strong>Pengaturan &rarr; Izin Pengguna</strong>. Halaman ini akan otomatis beralih ke aplikasi begitu akun Anda diaktifkan.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleCheckStatus} disabled={checking} className="w-full h-10">
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Memeriksa Status..." : "Periksa Status Sekarang"}
          </Button>

          <Button variant="ghost" onClick={logOut} className="w-full h-10 text-[var(--color-text-secondary)]">
            <LogOut className="w-4 h-4 mr-2" />
            Ganti Akun / Logout
          </Button>
        </div>
      </Card>
    </div>
  );
}
