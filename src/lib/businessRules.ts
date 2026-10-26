export function syncStatusAndProgress(
  status: string, 
  progress: number
): { status: string; progress: number } {
  let newStatus = status;
  let newProgress = typeof progress === 'number' && !isNaN(progress) ? progress : 0;

  // Status-driven adjustments (when status is explicitly set)
  if (newStatus === 'Selesai') {
    newProgress = 100;
  } else if (newStatus === 'Belum Mulai') {
    newProgress = 0;
  } else if (newStatus === 'Proses') {
    if (newProgress <= 0 || newProgress >= 100) {
      newProgress = 50;
    }
  } else if (newStatus === 'Review') {
    if (newProgress <= 0 || newProgress >= 100) {
      newProgress = 80;
    }
  } else if (newStatus === 'Revisi') {
    if (newProgress <= 0 || newProgress >= 100) {
      newProgress = 40;
    }
  }

  // Progress-driven adjustments (when progress hits boundary values)
  if (newProgress === 100 && newStatus !== 'Selesai') {
    newStatus = 'Selesai';
  } else if (newProgress === 0 && newStatus !== 'Hold' && newStatus !== 'Belum Mulai') {
    // If progress is strictly 0 and status is not Hold, status is Belum Mulai
    newStatus = 'Belum Mulai';
  } else if (newProgress > 0 && newProgress < 100 && (newStatus === 'Belum Mulai' || newStatus === 'Selesai')) {
    newStatus = 'Proses';
  }

  newProgress = Math.max(0, Math.min(100, Math.round(newProgress)));

  return { status: newStatus, progress: newProgress };
}

export function getDeadlineLabel(deadline: string | null, status: string): string {
  if (status === 'Hold') return 'Hold';
  if (!deadline) return 'Aman';
  
  if (status === 'Selesai') return 'Selesai';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dlDate = new Date(deadline);
  dlDate.setHours(0, 0, 0, 0);

  const diffTime = dlDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays <= 3) return 'Due Soon';
  return 'Aman';
}
