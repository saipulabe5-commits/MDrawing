import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc, updateDoc, deleteDoc, where, orderBy, writeBatch } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { DrawingGroup, DrawingItem, DrawingRevision } from "../types";
import { usePermissions } from "../hooks/usePermissions";
import { syncStatusAndProgress } from "../lib/businessRules";
import { generateSequentialDrawingNumbers } from "../lib/drawingNumberUtils";
import { useAuth } from "./AuthContext";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";

interface DrawingContextType {
  groups: DrawingGroup[];
  items: DrawingItem[];
  revisions: DrawingRevision[];
  loading: boolean;
  createGroup: (name: string, projectId: string) => Promise<void>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string, deleteItems: boolean) => Promise<void>;
  createItem: (data: Omit<DrawingItem, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateItem: (id: string, data: Partial<DrawingItem>, newRevisionNote?: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  reorderItems: (reorderedItems: DrawingItem[]) => Promise<void>;
  renumberGroupItems: (groupId: string | null) => Promise<void>;
  duplicateItem: (id: string) => Promise<void>;
  bulkUpdateItems: (ids: string[], data: Partial<DrawingItem>) => Promise<void>;
  importItems: (newGroups: Partial<DrawingGroup>[], newItems: Partial<DrawingItem>[]) => Promise<void>;
}

const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

export function DrawingProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const [groups, setGroups] = useState<DrawingGroup[]>([]);
  const [items, setItems] = useState<DrawingItem[]>([]);
  const [revisions, setRevisions] = useState<DrawingRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const { canManageProjects } = usePermissions();
  const { appUser } = useAuth();

  useEffect(() => {
    if (!projectId) {
      setGroups([]);
      setItems([]);
      setRevisions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qGroups = query(
      collection(db, "drawingGroups"),
      where("projectId", "==", projectId),
      orderBy("sortOrder", "asc")
    );

    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => doc.data() as DrawingGroup));
    }, (error) => {
      console.error("Error fetching drawing groups:", error);
    });

    const qItems = query(
      collection(db, "drawingItems"),
      where("projectId", "==", projectId),
      where("isDeleted", "==", false),
      orderBy("sortOrder", "asc")
    );

    const unsubItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => doc.data() as DrawingItem));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching drawing items:", error);
      setLoading(false);
    });

    const qRevisions = query(
      collection(db, "drawingRevisions"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc")
    );

    const unsubRevisions = onSnapshot(qRevisions, (snapshot) => {
      setRevisions(snapshot.docs.map(doc => doc.data() as DrawingRevision));
    }, (error) => {
      console.error("Error fetching drawing revisions:", error);
    });

    return () => {
      unsubGroups();
      unsubItems();
      unsubRevisions();
    };
  }, [projectId]);

  const createGroup = async (name: string, projectId: string) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const sortOrder = groups.length > 0 ? Math.max(...groups.map(g => g.sortOrder)) + 1 : 0;
      
      const newGroup: DrawingGroup = {
        id,
        projectId,
        groupName: name,
        groupCode: name.substring(0, 3).toUpperCase(),
        sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, "drawingGroups", id), newGroup);
      toast.success("Grup berhasil dibuat");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "drawingGroups");
      toast.error("Gagal membuat grup");
    }
  };

  const updateGroup = async (id: string, name: string) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      await updateDoc(doc(db, "drawingGroups", id), {
        groupName: name,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Grup berhasil diperbarui");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drawingGroups/${id}`);
      toast.error("Gagal memperbarui grup");
    }
  };

  const deleteGroup = async (id: string, deleteItems: boolean) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      const groupItems = items.filter(i => i.groupId === id);
      const ops: Array<() => void> = [];
      const chunkSize = 400;

      // Collect all operations
      const allOps: Array<{ type: 'delete' | 'update'; ref: any; data?: any }> = [
        { type: 'delete', ref: doc(db, "drawingGroups", id) }
      ];

      groupItems.forEach(item => {
        if (deleteItems) {
          allOps.push({
            type: 'update',
            ref: doc(db, "drawingItems", item.id),
            data: { isDeleted: true, updatedAt: new Date().toISOString() }
          });
        } else {
          allOps.push({
            type: 'update',
            ref: doc(db, "drawingItems", item.id),
            data: { groupId: null, updatedAt: new Date().toISOString() }
          });
        }
      });

      let committedOps = 0;
      for (let i = 0; i < allOps.length; i += chunkSize) {
        const chunk = allOps.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(op => {
          if (op.type === 'delete') batch.delete(op.ref);
          else batch.update(op.ref, op.data);
        });
        await batch.commit();
        committedOps += chunk.length;
      }

      toast.success("Grup berhasil dihapus");
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `drawingGroups/${id}`);
      toast.error("Gagal menghapus grup: " + (error?.message || "Terjadi kesalahan"));
    }
  };

  const createItem = async (data: Omit<DrawingItem, "id" | "createdAt" | "updatedAt">) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const synced = syncStatusAndProgress(data.status, data.progress);
      const newItem: DrawingItem = {
        ...data,
        id,
        status: synced.status as any,
        progress: synced.progress,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, "drawingItems", id), newItem);
      toast.success("Gambar berhasil ditambahkan");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "drawingItems");
      toast.error("Gagal menambahkan gambar");
    }
  };

  const updateItem = async (id: string, data: Partial<DrawingItem>, newRevisionNote?: string) => {
    const isTeam = appUser?.role === 'TEAM';
    if (!canManageProjects() && !isTeam) throw new Error("Unauthorized");
    try {
      const currentItem = items.find(i => i.id === id);
      if (!currentItem) return;

      // If team member, check if item is assigned to them or unassigned
      if (isTeam && !canManageProjects()) {
        if (currentItem.picId && currentItem.picId !== appUser?.uid) {
          throw new Error("Anda hanya dapat mengedit gambar yang ditugaskan kepada Anda.");
        }
      }

      const newStatus = data.status || currentItem.status;
      const newProgress = data.progress !== undefined ? data.progress : currentItem.progress;
      const synced = syncStatusAndProgress(newStatus, newProgress);

      if (isTeam && !canManageProjects()) {
        // TEAM can only update status, progress, notes, updatedAt according to firestore.rules
        const updatePayload: Record<string, any> = {
          status: synced.status,
          progress: synced.progress,
          updatedAt: new Date().toISOString(),
        };
        if (data.notes !== undefined) {
          updatePayload.notes = data.notes;
        }
        await updateDoc(doc(db, "drawingItems", id), updatePayload);
        toast.success("Gambar berhasil diperbarui");
        return;
      }

      const batch = writeBatch(db);
      let newRevisionCount = currentItem.revisionCount;

      if (newRevisionNote && appUser) {
        newRevisionCount += 1;
        const revId = uuidv4();
        const rev: DrawingRevision = {
          id: revId,
          itemId: id,
          projectId,
          notes: newRevisionNote,
          createdBy: appUser.uid,
          createdByName: appUser.name || 'Unknown',
          createdAt: new Date().toISOString()
        };
        batch.set(doc(db, "drawingRevisions", revId), rev);
      }

      batch.update(doc(db, "drawingItems", id), {
        ...data,
        status: synced.status,
        progress: synced.progress,
        revisionCount: newRevisionCount,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      toast.success("Gambar berhasil diperbarui");
    } catch (error: any) {
      console.error("Error updating item:", error);
      toast.error(error.message || "Gagal memperbarui gambar");
    }
  };

  const bulkUpdateItems = async (ids: string[], data: Partial<DrawingItem>) => {
    const isTeam = appUser?.role === 'TEAM';
    if (!canManageProjects() && !isTeam) {
      toast.error("Akses terbatas: Anda tidak memiliki wewenang untuk mengubah data gambar.");
      throw new Error("Unauthorized");
    }
    const now = new Date().toISOString();
    let updatedCount = 0;
    const chunkSize = 400;

    // Filter candidate items
    const validUpdates: Array<{ id: string; payload: Record<string, any> }> = [];
    ids.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item) {
        if (isTeam && !canManageProjects()) {
          if (item.picId && item.picId !== appUser?.uid) {
            return;
          }
        }

        const newStatus = data.status !== undefined ? data.status : item.status;
        const newProgress = data.progress !== undefined ? data.progress : item.progress;
        const synced = syncStatusAndProgress(newStatus, newProgress);

        if (isTeam && !canManageProjects()) {
          const updatePayload: Record<string, any> = {
            status: synced.status,
            progress: synced.progress,
            updatedAt: now,
          };
          if (data.notes !== undefined) {
            updatePayload.notes = data.notes;
          }
          validUpdates.push({ id, payload: updatePayload });
        } else {
          const updatePayload: Record<string, any> = {
            ...data,
            status: synced.status,
            progress: synced.progress,
            updatedAt: now,
          };
          validUpdates.push({ id, payload: updatePayload });
        }
      }
    });

    if (validUpdates.length === 0) {
      toast.error("Tidak ada gambar yang dapat diperbarui (periksa hak akses tugas gambar)");
      return;
    }

    try {
      for (let i = 0; i < validUpdates.length; i += chunkSize) {
        const chunk = validUpdates.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(u => {
          batch.update(doc(db, "drawingItems", u.id), u.payload);
        });
        await batch.commit();
        updatedCount += chunk.length;
      }
      toast.success(`${updatedCount} Gambar berhasil diperbarui`);
    } catch (error: any) {
      console.error("Error bulk updating items:", error);
      handleFirestoreError(error, OperationType.UPDATE, "drawingItems (batch)");
      if (updatedCount > 0) {
        toast.error(`Perhatian: Hanya ${updatedCount} dari ${validUpdates.length} gambar berhasil diperbarui sebelum terputus: ${error.message}`);
      } else {
        toast.error(error.message || "Gagal mengupdate gambar secara massal");
      }
      throw error;
    }
  };

  const duplicateItem = async (id: string) => {
    if (!canManageProjects() || !appUser) throw new Error("Unauthorized");
    try {
      const itemToCopy = items.find(i => i.id === id);
      if (!itemToCopy) return;
      
      const newId = uuidv4();
      const now = new Date().toISOString();
      const newItem: DrawingItem = {
        ...itemToCopy,
        id: newId,
        drawingNumber: `${itemToCopy.drawingNumber}-COPY`,
        status: 'Belum Mulai',
        progress: 0,
        revisionCount: 0,
        notes: '',
        createdBy: appUser.uid,
        createdAt: now,
        updatedAt: now
      };
      await setDoc(doc(db, "drawingItems", newId), newItem);
      toast.success("Gambar berhasil diduplikasi");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "drawingItems");
      toast.error("Gagal menduplikasi gambar");
    }
  };

  const importItems = async (newGroups: Partial<DrawingGroup>[], newItems: Partial<DrawingItem>[]) => {
    if (!canManageProjects() || !appUser) throw new Error("Unauthorized");
    const now = new Date().toISOString();
    const ops: Array<{ type: 'group' | 'item'; ref: any; data: any }> = [];

    newGroups.forEach(g => {
      const id = g.id!;
      ops.push({
        type: 'group',
        ref: doc(db, "drawingGroups", id),
        data: { ...g, projectId, createdAt: now, updatedAt: now }
      });
    });

    newItems.forEach(i => {
      const id = uuidv4();
      const synced = syncStatusAndProgress(i.status as string, i.progress as number);
      ops.push({
        type: 'item',
        ref: doc(db, "drawingItems", id),
        data: {
          ...i,
          id,
          projectId,
          status: synced.status,
          progress: synced.progress,
          isDeleted: false,
          revisionCount: 0,
          createdBy: appUser.uid,
          createdAt: now,
          updatedAt: now
        }
      });
    });

    const chunkSize = 400;
    let committedGroups = 0;
    let committedItems = 0;

    try {
      for (let i = 0; i < ops.length; i += chunkSize) {
        const chunk = ops.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(op => {
          batch.set(op.ref, op.data);
        });
        await batch.commit();
        chunk.forEach(op => {
          if (op.type === 'group') committedGroups++;
          else committedItems++;
        });
      }
      toast.success(`Berhasil mengimpor ${committedItems} gambar dan ${committedGroups} grup`);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, "import batch");
      if (committedItems > 0 || committedGroups > 0) {
        toast.error(`Perhatian: Berhasil sebagian (${committedItems} gambar, ${committedGroups} grup) sebelum gagal: ${error.message}`);
      } else {
        toast.error("Gagal mengimpor gambar: " + (error?.message || "Terjadi kesalahan"));
      }
      throw error;
    }
  };

  const deleteItem = async (id: string) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      // Soft delete
      await updateDoc(doc(db, "drawingItems", id), {
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Gambar berhasil dihapus");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `drawingItems/${id}`);
      toast.error("Gagal menghapus gambar");
    }
  };

  const reorderItems = async (reorderedItems: DrawingItem[]) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    const now = new Date().toISOString();
    const chunkSize = 400;
    let committed = 0;

    try {
      for (let i = 0; i < reorderedItems.length; i += chunkSize) {
        const chunk = reorderedItems.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item, index) => {
          const actualIndex = i + index;
          const itemRef = doc(db, "drawingItems", item.id);
          const updateData: Record<string, any> = {
            sortOrder: actualIndex,
            updatedAt: now,
          };
          if (item.drawingNumber !== undefined) {
            updateData.drawingNumber = item.drawingNumber;
          }
          if (item.groupId !== undefined) {
            updateData.groupId = item.groupId;
          }
          batch.update(itemRef, updateData);
        });
        await batch.commit();
        committed += chunk.length;
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, "drawingItems (batch)");
      toast.error("Gagal menyimpan urutan gambar: " + (error?.message || "Terjadi kesalahan"));
      throw error;
    }
  };

  const renumberGroupItems = async (groupId: string | null) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      const group = groups.find(g => g.id === groupId);
      const groupItems = items
        .filter(i => !i.isDeleted && (i.groupId || null) === (groupId || null))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (groupItems.length === 0) {
        toast("Tidak ada gambar dalam grup ini untuk diurutkan");
        return;
      }

      const newNumbers = generateSequentialDrawingNumbers(groupItems, group?.groupName);
      const now = new Date().toISOString();
      const chunkSize = 400;
      let committed = 0;

      for (let i = 0; i < groupItems.length; i += chunkSize) {
        const chunk = groupItems.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item, index) => {
          const actualIndex = i + index;
          const itemRef = doc(db, "drawingItems", item.id);
          batch.update(itemRef, {
            sortOrder: actualIndex,
            drawingNumber: newNumbers[actualIndex] || item.drawingNumber,
            updatedAt: now,
          });
        });
        await batch.commit();
        committed += chunk.length;
      }

      toast.success(
        group
          ? `Nomor gambar grup "${group.groupName}" berhasil diurutkan otomatis (${newNumbers[0]} s/d ${newNumbers[newNumbers.length - 1]})`
          : `Nomor gambar berhasil diurutkan otomatis (${newNumbers[0]} s/d ${newNumbers[newNumbers.length - 1]})`
      );
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, "drawingItems (batch renumber)");
      toast.error("Gagal mengurutkan nomor gambar: " + (error?.message || "Terjadi kesalahan"));
    }
  };

  return (
    <DrawingContext.Provider value={{
      groups, items, revisions, loading, createGroup, updateGroup, deleteGroup, createItem, updateItem, deleteItem, reorderItems, renumberGroupItems, duplicateItem, bulkUpdateItems, importItems
    }}>
      {children}
    </DrawingContext.Provider>
  );
}

export function useDrawings() {
  const context = useContext(DrawingContext);
  if (context === undefined) {
    throw new Error("useDrawings must be used within a DrawingProvider");
  }
  return context;
}
