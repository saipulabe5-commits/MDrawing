import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function NotFoundView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-6xl font-bold text-[var(--color-text-secondary)]/30 mb-4">404</h1>
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Halaman Tidak Ditemukan</h2>
      <p className="text-[var(--color-text-secondary)] mb-6 max-w-sm">
        Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link to="/">
        <Button variant="primary">Kembali ke Dashboard</Button>
      </Link>
    </div>
  );
}
