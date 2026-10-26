import { Project } from "../types";

export function generateNextProjectCode(projects: Project[]): string {
  const year = new Date().getFullYear();
  const prefix = `PRJ-${year}-`;
  let maxSequence = 0;

  if (projects && projects.length > 0) {
    projects.forEach(p => {
      if (p.projectCode && p.projectCode.startsWith(prefix)) {
        const seqStr = p.projectCode.substring(prefix.length);
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    });
  }

  const nextSequence = maxSequence + 1;
  return `${prefix}${nextSequence.toString().padStart(3, '0')}`;
}
