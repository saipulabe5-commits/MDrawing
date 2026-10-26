export interface DrawingProgressItem {
  id?: string;
  status: string;
  progress: number;
  isDeleted?: boolean;
}

/**
 * MDrawing Core Definition of Project Progress
 * 
 * Invariant:
 * Project progress is defined strictly as the arithmetic mean 
 * of the progress of all ACTIVE drawings in the project.
 * Drawings that are "Hold" or deleted are excluded from the calculation.
 * 
 * If a project has 0 active drawings, progress is 0.
 */
export function calculateProjectProgress(drawings: DrawingProgressItem[]): number {
  if (!drawings || drawings.length === 0) {
    return 0;
  }
  
  const activeDrawings = drawings.filter(d => !d.isDeleted && d.status !== 'Hold');
  
  if (activeDrawings.length === 0) {
    return 0;
  }
  
  const totalProgress = activeDrawings.reduce((acc, curr) => acc + (curr.progress || 0), 0);
  const average = totalProgress / activeDrawings.length;
  
  // Return rounded to nearest integer
  return Math.round(average);
}
