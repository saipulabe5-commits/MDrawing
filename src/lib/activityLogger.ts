import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ActivityAction, ActivityEntityType, ActivityLog } from '../types';

export async function logActivity(params: {
  projectId?: string;
  projectName?: string;
  entityType: ActivityEntityType;
  entityId: string;
  entityName?: string;
  action: ActivityAction;
  user: {
    uid: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  details: string;
  oldValue?: any;
  newValue?: any;
}): Promise<string | null> {
  try {
    const activityData: Omit<ActivityLog, 'id'> = {
      projectId: params.projectId,
      projectName: params.projectName,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      action: params.action,
      userId: params.user.uid,
      userName: params.user.name || params.user.email || 'Pengguna',
      userRole: params.user.role,
      details: params.details,
      oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : null,
      newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'activityLogs'), activityData);
    return docRef.id;
  } catch (err: any) {
    console.warn('[ACTIVITY LOG] Failed to record activity log:', err.message);
    return null;
  }
}
