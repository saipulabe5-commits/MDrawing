import { apiRequest } from '../lib/commandClient';
/**
 * MDrawing PIC & Public User Directory Service (AUD-15)
 * 
 * Provides isolated, sanitized access to user identity for PIC assignment
 * without exposing internal security profiles, capabilities, or project assignments.
 */

import { collection, doc, onSnapshot, getDocs, setDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CanonicalUserRole } from "../types";

export interface PublicUserDirectoryItem {
  uid: string;
  id?: string;
  name: string;
  email: string;
  role: CanonicalUserRole;
  isActive: boolean;
  avatarUrl?: string;
  updatedAt?: string;
}

/**
 * Sanitizes any raw user record so it only contains non-sensitive PIC fields.
 * Explicitly strips all capabilities and project assignments.
 */
export function sanitizeUserForPublicDirectory(raw: any): PublicUserDirectoryItem {
  return {
    uid: String(raw.uid || raw.id || ""),
    id: String(raw.uid || raw.id || ""),
    name: String(raw.name || raw.displayName || raw.email?.split("@")[0] || "User"),
    email: String(raw.email || ""),
    role: (raw.role || "VIEWER") as CanonicalUserRole,
    isActive: raw.isActive === true,
    avatarUrl: raw.avatarUrl || undefined,
    updatedAt: raw.updatedAt || undefined,
  };
}

/**
 * Subscribes to the sanitized /userDirectory collection for PIC assignment.
 */
export function subscribePublicUserDirectory(
  onUpdate: (users: PublicUserDirectoryItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const dirCol = collection(db, "userDirectory");
    return onSnapshot(
      dirCol,
      (snapshot) => {
        const users = snapshot.docs
          .map((d) => sanitizeUserForPublicDirectory({ id: d.id, ...d.data() }))
          .filter((u) => u.isActive);
        onUpdate(users);
      },
      (err) => {
        console.warn("[USER DIRECTORY] Firestore listener fallback:", err.message);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn("[USER DIRECTORY] Init error:", err.message);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Fetches the public user directory once.
 */
export async function getPublicUserDirectory(): Promise<PublicUserDirectoryItem[]> {
  try {
    const dirCol = collection(db, "userDirectory");
    const snap = await getDocs(dirCol);
    if (!snap.empty) {
      return snap.docs
        .map((d) => sanitizeUserForPublicDirectory({ id: d.id, ...d.data() }))
        .filter((u) => u.isActive);
    }
  } catch (err: any) {
    console.warn("[USER DIRECTORY] Direct getDocs failed, attempting API fallback:", err.message);
  }

  // Fallback to server endpoint /api/users/directory
  try {
    const result = await apiRequest("/api/users/directory");
    const res = {ok:true,json:async()=>result};
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.users)) {
        return data.users.map(sanitizeUserForPublicDirectory).filter((u: any) => u.isActive);
      }
    }
  } catch (apiErr) {
    console.error("[USER DIRECTORY] API fallback failed:", apiErr);
  }

  return [];
}

/**
 * Writes or updates a minimal entry in /userDirectory.
 */
export async function syncToUserDirectory(user: Partial<PublicUserDirectoryItem> & { uid: string }): Promise<void> {
  if (!user.uid) return;
  const sanitized = sanitizeUserForPublicDirectory(user);
  const dirRef = doc(db, "userDirectory", user.uid);
  await setDoc(dirRef, {
    uid: sanitized.uid,
    name: sanitized.name,
    email: sanitized.email,
    role: sanitized.role,
    isActive: sanitized.isActive,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
