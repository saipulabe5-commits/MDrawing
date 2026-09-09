import React, { createContext, useContext, useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { DrawingTemplate, DrawingTemplateGroup, DrawingTemplateItem } from "../types";
import { useAuth } from "./AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { seedDefaultTemplates } from "../lib/templateSeedData";
import { generateSequentialDrawingNumbers } from "../lib/drawingNumberUtils";

interface DrawingTemplateContextType {
  templates: DrawingTemplate[];
  loadingTemplates: boolean;
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;
  selectedTemplate: DrawingTemplate | null;
  groups: DrawingTemplateGroup[];
  items: DrawingTemplateItem[];
  loadingDetail: boolean;
  createTemplate: (data: { templateName: string; projectType?: string; description: string }) => Promise<string>;
  updateTemplate: (id: string, data: Partial<DrawingTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  createGroup: (templateId: string, groupName: string) => Promise<string>;
  updateGroup: (groupId: string, groupName: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  reorderGroups: (groups: DrawingTemplateGroup[]) => Promise<void>;
  createItem: (
    templateId: string,
    groupId: string,
    data: { drawingNumber: string; drawingName: string; scale: string; notes?: string }
  ) => Promise<string>;
  updateItem: (itemId: string, data: Partial<DrawingTemplateItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  duplicateItem: (item: DrawingTemplateItem) => Promise<void>;
  reorderItems: (items: DrawingTemplateItem[]) => Promise<void>;
  renumberGroupItems: (groupId: string) => Promise<void>;
  importSeedTemplates: (replaceExisting?: boolean) => Promise<number>;
  applyTemplateToProject: (projectId: string, templateId: string, strategy?: "append" | "overwrite") => Promise<void>;
  saveProjectAsTemplate: (
    templateName: string,
    projectType: string,
    description: string,
    projectGroups: { id: string; groupName: string; groupCode?: string; sortOrder?: number }[],
    projectItems: { id: string; groupId?: string | null; drawingNumber: string; drawingName: string; scale?: string; sortOrder?: number; notes?: string }[]
  ) => Promise<string>;
}

const DrawingTemplateContext = createContext<DrawingTemplateContextType | undefined>(undefined);

export function DrawingTemplateProvider({ children }: { children: React.ReactNode }) {
  const [templates, setTemplates] = useState<DrawingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [groups, setGroups] = useState<DrawingTemplateGroup[]>([]);
  const [items, setItems] = useState<DrawingTemplateItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { appUser } = useAuth();
  const { canManageProjects } = usePermissions();

  // 1. Fetch all templates
  useEffect(() => {
    if (!appUser) {
      setTemplates([]);
      setLoadingTemplates(false);
      return;
    }

    const q = query(collection(db, "drawingTemplates"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tpls = snapshot.docs.map((doc) => doc.data() as DrawingTemplate);
        setTemplates(tpls);
        setLoadingTemplates(false);
      },
      (error) => {
        console.error("Error fetching templates:", error);
        handleFirestoreError(error, OperationType.GET, "drawingTemplates");
        setLoadingTemplates(false);
      }
    );

    return () => unsubscribe();
  }, [appUser]);

  // 2. Fetch groups & items for the selected template
  useEffect(() => {
    if (!selectedTemplateId) {
      setGroups([]);
      setItems([]);
      setLoadingDetail(false);
      return;
    }

    setLoadingDetail(true);

    const grpQuery = query(
      collection(db, "drawingTemplateGroups"),
      where("templateId", "==", selectedTemplateId)
    );

    const itemQuery = query(
      collection(db, "drawingTemplateItems"),
      where("templateId", "==", selectedTemplateId)
    );

    let grpUnsub = onSnapshot(
      grpQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as DrawingTemplateGroup);
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setGroups(list);
      },
      (err) => console.error("Error fetching template groups:", err)
    );

    let itemUnsub = onSnapshot(
      itemQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as DrawingTemplateItem);
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setItems(list);
        setLoadingDetail(false);
      },
      (err) => {
        console.error("Error fetching template items:", err);
        setLoadingDetail(false);
      }
    );

    return () => {
      grpUnsub();
      itemUnsub();
    };
  }, [selectedTemplateId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  // --- CRUD Template ---
  const createTemplate = async (data: { templateName: string; projectType?: string; description: string }) => {
    if (!canManageProjects() || !appUser) throw new Error("Akses Ditolak");

    const id = uuidv4();
    const now = new Date().toISOString();
    const newDoc: DrawingTemplate = {
      id,
      templateName: data.templateName,
      projectType: data.projectType || "Umum",
      description: data.description,
      groupCount: 0,
      itemCount: 0,
      createdBy: appUser.uid,
      createdByName: appUser.name || appUser.email,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, "drawingTemplates", id), newDoc);
    toast.success(`Template '${data.templateName}' berhasil dibuat`);
    return id;
  };

  const updateTemplate = async (id: string, data: Partial<DrawingTemplate>) => {
    if (!canManageProjects()) throw new Error("Akses Ditolak");
    const now = new Date().toISOString();
    await updateDoc(doc(db, "drawingTemplates", id), {
      ...data,
      updatedAt: now,
    });
    toast.success("Informasi template diperbarui");
  };

  const deleteTemplate = async (id: string) => {
    if (!canManageProjects()) throw new Error("Akses Ditolak");

    try {
      const batch = writeBatch(db);
      // Delete template doc
      batch.delete(doc(db, "drawingTemplates", id));

      // Fetch and delete associated groups
      const grpSnap = await getDocs(query(collection(db, "drawingTemplateGroups"), where("templateId", "==", id)));
      grpSnap.forEach((d) => batch.delete(d.ref));

      // Fetch and delete associated items
      const itmSnap = await getDocs(query(collection(db, "drawingTemplateItems"), where("templateId", "==", id)));
      itmSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit();

      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
      }
      toast.success("Template berhasil dihapus");
    } catch (err: any) {
      console.error("Gagal menghapus template:", err);
      toast.error("Gagal menghapus template: " + err.message);
    }
  };

  // --- CRUD Groups ---
  const createGroup = async (templateId: string, groupName: string) => {
    if (!canManageProjects()) throw new Error("Akses Ditolak");

    const id = uuidv4();
    const now = new Date().toISOString();
    const nextSortOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.sortOrder)) + 1 : 1;

    const newGroup: DrawingTemplateGroup = {
      id,
      templateId,
      groupName,
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "drawingTemplateGroups", id), newGroup);

    // Update groupCount on template
    batch.update(doc(db, "drawingTemplates", templateId), {
      groupCount: groups.length + 1,
      updatedAt: now,
    });

    await batch.commit();
    toast.success(`Grup '${groupName}' ditambahkan`);
    return id;
  };

  const updateGroup = async (groupId: string, groupName: string) => {
    if (!canManageProjects()) throw new Error("Akses Ditolak");
    await updateDoc(doc(db, "drawingTemplateGroups", groupId), {
      groupName,
      updatedAt: new Date().toISOString(),
    });
    toast.success("Nama grup berhasil diperbarui");
  };

  const deleteGroup = async (groupId: string) => {
    if (!canManageProjects() || !selectedTemplateId) throw new Error("Akses Ditolak");

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "drawingTemplateGroups", groupId));

      // Delete items inside this group
      const relatedItems = items.filter((i) => i.groupId === groupId);
      relatedItems.forEach((i) => batch.delete(doc(db, "drawingTemplateItems", i.id)));

      // Update counts
      const now = new Date().toISOString();
      batch.update(doc(db, "drawingTemplates", selectedTemplateId), {
        groupCount: Math.max(0, groups.length - 1),
        itemCount: Math.max(0, items.length - relatedItems.length),
        updatedAt: now,
      });

      await batch.commit();
      toast.success("Grup dan gambar di dalamnya berhasil dihapus");
    } catch (err: any) {
      toast.error("Gagal menghapus grup: " + err.message);
    }
  };

  const reorderGroups = async (reordered: DrawingTemplateGroup[]) => {
    if (!canManageProjects()) return;
    try {
      const batch = writeBatch(db);
      reordered.forEach((grp, idx) => {
        batch.update(doc(db, "drawingTemplateGroups", grp.id), {
          sortOrder: idx + 1,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Gagal menyusun ulang grup:", err);
      toast.error("Gagal menyusun ulang urutan grup");
    }
  };

  // --- CRUD Items ---
  const createItem = async (
    templateId: string,
    groupId: string,
    data: { drawingNumber: string; drawingName: string; scale: string; notes?: string }
  ) => {
    if (!canManageProjects()) throw new Error("Akses Ditolak");

    const id = uuidv4();
    const now = new Date().toISOString();
    const groupItems = items.filter((i) => i.groupId === groupId);
    const nextSortOrder = groupItems.length > 0 ? Math.max(...groupItems.map((i) => i.sortOrder)) + 1 : 1;

    const newItem: DrawingTemplateItem = {
      id,
      templateId,
      groupId,
      drawingNumber: data.drawingNumber,
      drawingName: data.drawingName,
      scale: data.scale || "1:100",
      notes: data.notes || "",
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "drawingTemplateItems", id), newItem);

    batch.update(doc(db, "drawingTemplates", templateId), {
      itemCount: items.length + 1,
      updatedAt: now,
    });

    await batch.commit();
    toast.success(`Gambar '${data.drawingName}' ditambahkan ke template`);
    return id;
  };

  const updateItem = async (itemId: string, data: Partial<DrawingTemplateItem>) => {
    if (!canManageProjects()) throw new Error("Akses Ditolak");
    await updateDoc(doc(db, "drawingTemplateItems", itemId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    toast.success("Gambar template berhasil diperbarui");
  };

  const deleteItem = async (itemId: string) => {
    if (!canManageProjects() || !selectedTemplateId) throw new Error("Akses Ditolak");
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "drawingTemplateItems", itemId));

      batch.update(doc(db, "drawingTemplates", selectedTemplateId), {
        itemCount: Math.max(0, items.length - 1),
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      toast.success("Gambar berhasil dihapus dari template");
    } catch (err: any) {
      toast.error("Gagal menghapus gambar: " + err.message);
    }
  };

  const duplicateItem = async (item: DrawingTemplateItem) => {
    if (!canManageProjects() || !selectedTemplateId) throw new Error("Akses Ditolak");
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const dupItem: DrawingTemplateItem = {
        ...item,
        id,
        drawingName: `${item.drawingName} (Salinan)`,
        sortOrder: item.sortOrder + 1,
        createdAt: now,
        updatedAt: now,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "drawingTemplateItems", id), dupItem);

      batch.update(doc(db, "drawingTemplates", selectedTemplateId), {
        itemCount: items.length + 1,
        updatedAt: now,
      });

      await batch.commit();
      toast.success(`Gambar '${item.drawingName}' berhasil diduplikasi`);
    } catch (err: any) {
      toast.error("Gagal menduplikasi gambar: " + err.message);
    }
  };

  const reorderItems = async (reordered: DrawingTemplateItem[]) => {
    if (!canManageProjects()) return;
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      reordered.forEach((itm, idx) => {
        const updateData: Record<string, any> = {
          sortOrder: idx + 1,
          updatedAt: now,
        };
        if (itm.drawingNumber !== undefined) {
          updateData.drawingNumber = itm.drawingNumber;
        }
        if (itm.groupId !== undefined) {
          updateData.groupId = itm.groupId;
        }
        batch.update(doc(db, "drawingTemplateItems", itm.id), updateData);
      });
      await batch.commit();
    } catch (err) {
      console.error("Gagal menyusun ulang gambar:", err);
      toast.error("Gagal menyusun urutan gambar");
    }
  };

  const renumberGroupItems = async (groupId: string) => {
    if (!canManageProjects()) return;
    try {
      const group = groups.find((g) => g.id === groupId);
      const groupItems = items
        .filter((i) => i.groupId === groupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (groupItems.length === 0) {
        toast("Tidak ada gambar dalam grup template ini");
        return;
      }

      const newNumbers = generateSequentialDrawingNumbers(groupItems, group?.groupName);
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      groupItems.forEach((itm, idx) => {
        batch.update(doc(db, "drawingTemplateItems", itm.id), {
          sortOrder: idx + 1,
          drawingNumber: newNumbers[idx] || itm.drawingNumber,
          updatedAt: now,
        });
      });

      await batch.commit();
      toast.success(
        group
          ? `Nomor gambar template grup "${group.groupName}" berhasil diurutkan (${newNumbers[0]} s/d ${newNumbers[newNumbers.length - 1]})`
          : `Nomor gambar template berhasil diurutkan`
      );
    } catch (err: any) {
      console.error("Gagal mengurutkan nomor template:", err);
      toast.error("Gagal mengurutkan nomor gambar template");
    }
  };

  // --- Seed Initial Templates ---
  const importSeedTemplates = async (replaceExisting: boolean = false): Promise<number> => {
    if (!canManageProjects() || !appUser) {
      toast.error("Hanya Manager/Owner yang dapat mengimpor template contoh.");
      throw new Error("Akses Ditolak");
    }

    try {
      const count = await seedDefaultTemplates(appUser.uid, appUser.name || appUser.email, replaceExisting);
      toast.success(
        replaceExisting
          ? `Berhasil memperbarui ${count} paket template standar CAD!`
          : `Berhasil mengimpor ${count} template gambar awal!`
      );
      return count;
    } catch (err: any) {
      console.error("Gagal mengimpor template awal:", err);
      toast.error("Gagal mengimpor template awal: " + err.message);
      throw err;
    }
  };

  // --- Apply Template to an Existing Project ---
  const applyTemplateToProject = async (
    projectId: string,
    templateId: string,
    strategy: "append" | "overwrite" = "append"
  ) => {
    if (!canManageProjects() || !appUser) {
      toast.error("Akses Ditolak: Hanya Manager/Owner yang dapat mengelola gambar proyek.");
      throw new Error("Akses Ditolak");
    }

    try {
      // 1. Fetch template groups and items
      const [tplGroupsSnap, tplItemsSnap] = await Promise.all([
        getDocs(query(collection(db, "drawingTemplateGroups"), where("templateId", "==", templateId))),
        getDocs(query(collection(db, "drawingTemplateItems"), where("templateId", "==", templateId))),
      ]);

      const tplGroups = tplGroupsSnap.docs.map((d) => d.data() as DrawingTemplateGroup);
      const tplItems = tplItemsSnap.docs.map((d) => d.data() as DrawingTemplateItem);

      if (tplGroups.length === 0 && tplItems.length === 0) {
        toast.error("Template yang dipilih belum memiliki grup atau item gambar.");
        return;
      }

      const batch = writeBatch(db);
      const now = new Date().toISOString();

      let currentGroupOffset = 0;
      let currentItemOffset = 0;

      if (strategy === "overwrite") {
        const [existingGroupsSnap, existingItemsSnap] = await Promise.all([
          getDocs(query(collection(db, "drawingGroups"), where("projectId", "==", projectId))),
          getDocs(query(collection(db, "drawingItems"), where("projectId", "==", projectId))),
        ]);

        existingGroupsSnap.docs.forEach((d) => {
          batch.delete(d.ref);
        });

        existingItemsSnap.docs.forEach((d) => {
          batch.update(d.ref, { isDeleted: true, updatedAt: now });
        });
      } else {
        const [existingGroupsSnap, existingItemsSnap] = await Promise.all([
          getDocs(query(collection(db, "drawingGroups"), where("projectId", "==", projectId))),
          getDocs(query(collection(db, "drawingItems"), where("projectId", "==", projectId), where("isDeleted", "==", false))),
        ]);
        currentGroupOffset = existingGroupsSnap.size;
        currentItemOffset = existingItemsSnap.size;
      }

      // Map template groupId to new project drawingGroup id
      const groupMap = new Map<string, string>();

      tplGroups.sort((a, b) => a.sortOrder - b.sortOrder);
      tplGroups.forEach((tg, idx) => {
        const newGroupId = uuidv4();
        groupMap.set(tg.id, newGroupId);

        const newGroupDoc = {
          id: newGroupId,
          projectId,
          groupName: tg.groupName,
          groupCode: tg.groupCode || tg.groupName.substring(0, 3).toUpperCase(),
          sortOrder: currentGroupOffset + idx,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, "drawingGroups", newGroupId), newGroupDoc);
      });

      tplItems.sort((a, b) => a.sortOrder - b.sortOrder);
      tplItems.forEach((ti, idx) => {
        const newItemId = uuidv4();
        const mappedGroupId = groupMap.get(ti.groupId) || null;

        const newItemDoc = {
          id: newItemId,
          projectId,
          groupId: mappedGroupId,
          drawingNumber: ti.drawingNumber,
          drawingName: ti.drawingName,
          scale: ti.scale || "1:100",
          status: "Belum Mulai",
          progress: 0,
          priority: "Normal",
          revisionCount: 0,
          notes: ti.notes || "",
          isDeleted: false,
          sortOrder: currentItemOffset + idx,
          createdBy: appUser.uid,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, "drawingItems", newItemId), newItemDoc);
      });

      // Audit log
      const tpl = templates.find((t) => t.id === templateId);
      const logRef = doc(collection(db, "activityLogs"));
      batch.set(logRef, {
        entityType: "PROJECT",
        entityId: projectId,
        action: "UPDATE",
        userId: appUser.uid,
        userName: appUser.name || appUser.email,
        userRole: appUser.role,
        details: `Menerapkan template gambar "${tpl?.templateName || templateId}" (Strategi: ${strategy}).`,
        createdAt: now,
      });

      await batch.commit();
      toast.success(`Template berhasil diterapkan (${tplGroups.length} grup, ${tplItems.length} gambar)!`);
    } catch (err: any) {
      console.error("Gagal menerapkan template:", err);
      toast.error("Gagal menerapkan template ke proyek: " + err.message);
      throw err;
    }
  };

  // --- Save Current Project Drawings as a New Reusable Template ---
  const saveProjectAsTemplate = async (
    templateName: string,
    projectType: string,
    description: string,
    projectGroups: { id: string; groupName: string; groupCode?: string; sortOrder?: number }[],
    projectItems: { id: string; groupId?: string | null; drawingNumber: string; drawingName: string; scale?: string; sortOrder?: number; notes?: string }[]
  ): Promise<string> => {
    if (!canManageProjects() || !appUser) {
      toast.error("Akses Ditolak: Hanya Manager/Owner yang dapat membuat template.");
      throw new Error("Akses Ditolak");
    }

    try {
      const templateId = uuidv4();
      const now = new Date().toISOString();
      const batch = writeBatch(db);

      const templateDoc: DrawingTemplate = {
        id: templateId,
        templateName,
        projectType: projectType || "Umum",
        description: description || `Dibuat dari gambar proyek pada ${new Date().toLocaleDateString("id-ID")}`,
        groupCount: projectGroups.length,
        itemCount: projectItems.length,
        createdBy: appUser.uid,
        createdByName: appUser.name || appUser.email,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, "drawingTemplates", templateId), templateDoc);

      const groupMap = new Map<string, string>();
      projectGroups.forEach((g, idx) => {
        const newTplGroupId = uuidv4();
        groupMap.set(g.id, newTplGroupId);

        const tplGroup: DrawingTemplateGroup = {
          id: newTplGroupId,
          templateId,
          groupName: g.groupName,
          groupCode: g.groupCode || g.groupName.substring(0, 3).toUpperCase(),
          sortOrder: typeof g.sortOrder === "number" ? g.sortOrder : idx,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, "drawingTemplateGroups", newTplGroupId), tplGroup);
      });

      projectItems.forEach((item, idx) => {
        const newTplItemId = uuidv4();
        const mappedGroupId = item.groupId ? (groupMap.get(item.groupId) || "") : "";

        const tplItem: DrawingTemplateItem = {
          id: newTplItemId,
          templateId,
          groupId: mappedGroupId,
          drawingNumber: item.drawingNumber,
          drawingName: item.drawingName,
          scale: item.scale || "1:100",
          sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx,
          notes: item.notes || "",
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, "drawingTemplateItems", newTplItemId), tplItem);
      });

      const logRef = doc(collection(db, "activityLogs"));
      batch.set(logRef, {
        entityType: "DRAWING_TEMPLATE",
        entityId: templateId,
        action: "CREATE",
        userId: appUser.uid,
        userName: appUser.name || appUser.email,
        userRole: appUser.role,
        details: `Menyimpan template baru "${templateName}" (${projectGroups.length} grup, ${projectItems.length} gambar) dari proyek.`,
        createdAt: now,
      });

      await batch.commit();
      toast.success(`Template "${templateName}" berhasil disimpan!`);
      return templateId;
    } catch (err: any) {
      console.error("Gagal menyimpan proyek sebagai template:", err);
      toast.error("Gagal menyimpan template: " + err.message);
      throw err;
    }
  };

  return (
    <DrawingTemplateContext.Provider
      value={{
        templates,
        loadingTemplates,
        selectedTemplateId,
        setSelectedTemplateId,
        selectedTemplate,
        groups,
        items,
        loadingDetail,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        createGroup,
        updateGroup,
        deleteGroup,
        reorderGroups,
        createItem,
        updateItem,
        deleteItem,
        duplicateItem,
        reorderItems,
        renumberGroupItems,
        importSeedTemplates,
        applyTemplateToProject,
        saveProjectAsTemplate,
      }}
    >
      {children}
    </DrawingTemplateContext.Provider>
  );
}

export function useDrawingTemplates() {
  const context = useContext(DrawingTemplateContext);
  if (!context) {
    throw new Error("useDrawingTemplates must be used within a DrawingTemplateProvider");
  }
  return context;
}

export const useDrawingTemplate = useDrawingTemplates;
