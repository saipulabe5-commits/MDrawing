import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc, updateDoc, deleteDoc, where, orderBy, writeBatch, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Project, ProjectStatus, DrawingGroup, DrawingItem, DrawingItemStatus, DrawingPriority, DrawingTemplateGroup, DrawingTemplateItem } from "../types";
import { useAuth } from "./AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";

interface ProjectContextType {
  projects: Project[];
  loadingProjects: boolean;
  createProject: (
    data: Omit<Project, "id" | "createdAt" | "updatedAt" | "createdBy">,
    templateId?: string
  ) => Promise<string | undefined>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  activateProject: (id: string, context?: any) => Promise<boolean>;
  saveProjectWorkflowDraft: (
    id: string,
    stage: string,
    completedStages: string[],
    draftData?: Partial<Project>
  ) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const { appUser } = useAuth();
  const { role, canManageProjects, canAccessProject } = usePermissions();

  useEffect(() => {
    if (!appUser) return;

    let q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    
    // If not OWNER/ADMIN, only fetch assigned projects
    // For now we fetch all and filter client side if needed, or query specifically.
    // Firestore security rules will need to align with this.
    // If user is VIEWER, they can only view projects they are assigned to.
    if (role === "CLIENT_VIEWER" || role === "TEAM" || role === "PROJECT_LEADER") {
       if (appUser.assignedProjectIds && appUser.assignedProjectIds.length > 0) {
          // Firestore 'in' query supports up to 10 items.
          // If a user has >10 projects, we need a different strategy, but for now this suffices.
          q = query(
            collection(db, "projects"), 
            where("id", "in", appUser.assignedProjectIds.slice(0, 10)),
            orderBy("createdAt", "desc")
          );
       } else {
          setProjects([]);
          setLoadingProjects(false);
          return;
       }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projData = snapshot.docs.map(doc => doc.data() as Project);
      setProjects(projData);
      setLoadingProjects(false);
    }, (error) => {
      console.error("Error fetching projects", error);
      setLoadingProjects(false);
    });

    return () => unsubscribe();
  }, [appUser, role]);

  const createProject = async (
    data: Omit<Project, "id" | "createdAt" | "updatedAt" | "createdBy">,
    templateId?: string
  ) => {
    if (!canManageProjects() || !appUser) throw new Error("Unauthorized");
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      const newProject: Project = {
        workflowStage: "PROJECT_SETUP",
        workflowVersion: 1,
        completedStages: ["PROJECT_SETUP"],
        stageChecklist: {},
        blockingIssues: [],
        ...data,
        id,
        createdBy: appUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      if (templateId) {
        const batch = writeBatch(db);
        batch.set(doc(db, "projects", id), newProject);

        // Fetch groups and items from drawingTemplateGroups & drawingTemplateItems
        const grpSnap = await getDocs(
          query(collection(db, "drawingTemplateGroups"), where("templateId", "==", templateId))
        );
        const itemSnap = await getDocs(
          query(collection(db, "drawingTemplateItems"), where("templateId", "==", templateId))
        );

        const groupMapping = new Map<string, string>();
        const sortedGroups = grpSnap.docs
          .map((d) => d.data() as DrawingTemplateGroup)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const sortedItems = itemSnap.docs
          .map((d) => d.data() as DrawingTemplateItem)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        sortedGroups.forEach((tplGrp) => {
          const newGroupId = uuidv4();
          groupMapping.set(tplGrp.id, newGroupId);

          const newGroup: DrawingGroup = {
            id: newGroupId,
            projectId: id,
            groupCode: `GRP-${tplGrp.sortOrder.toString().padStart(2, "0")}`,
            groupName: tplGrp.groupName,
            sortOrder: tplGrp.sortOrder,
            createdAt: now,
            updatedAt: now,
          };
          batch.set(doc(db, "drawingGroups", newGroupId), newGroup);
        });

        let itemCount = 0;
        sortedItems.forEach((tplItem) => {
          const newGroupId = groupMapping.get(tplItem.groupId) || null;
          const newItemId = uuidv4();
          itemCount++;

          const newItem: DrawingItem = {
            id: newItemId,
            projectId: id,
            groupId: newGroupId,
            drawingNumber: tplItem.drawingNumber,
            drawingName: tplItem.drawingName,
            scale: tplItem.scale || "1:100",
            picId: "",
            picName: "",
            picEmail: "",
            deadline: null,
            status: "Belum Mulai",
            progress: 0,
            priority: "Normal",
            notes: tplItem.notes || "",
            revisionCount: 0,
            isDeleted: false,
            sortOrder: tplItem.sortOrder,
            createdBy: appUser.uid,
            createdAt: now,
            updatedAt: now,
          };
          batch.set(doc(db, "drawingItems", newItemId), newItem);
        });

        const logId = uuidv4();
        batch.set(doc(db, "activityLogs", logId), {
          id: logId,
          projectId: id,
          projectName: newProject.projectName,
          userId: appUser.uid,
          userName: appUser.name || appUser.email,
          userRole: appUser.role,
          entityType: "PROJECT",
          entityId: id,
          entityName: newProject.projectName,
          action: "CREATE",
          details: `Membuat proyek '${newProject.projectName}' dengan menerapkan template (${sortedGroups.length} grup, ${itemCount} gambar kerja).`,
          createdAt: now,
        });

        await batch.commit();
        toast.success(`Proyek berhasil dibuat dengan ${itemCount} gambar kerja dari template!`);
        return id;
      } else {
        await setDoc(doc(db, "projects", id), newProject);
        toast.success("Proyek berhasil dibuat");
        return id;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "projects");
      toast.error("Gagal membuat proyek");
    }
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      await updateDoc(doc(db, "projects", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Proyek berhasil diperbarui");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
      toast.error("Gagal memperbarui proyek");
    }
  };

  const deleteProject = async (id: string) => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      await deleteDoc(doc(db, "projects", id));
      toast.success("Proyek berhasil dihapus");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      toast.error("Gagal menghapus proyek");
    }
  };

  const activateProject = async (id: string, context?: any): Promise<boolean> => {
    if (!canManageProjects() || !appUser) throw new Error("Hanya Owner atau Admin yang berhak mengaktifkan proyek.");
    try {
      const now = new Date().toISOString();
      const projRef = doc(db, "projects", id);
      const batch = writeBatch(db);

      batch.update(projRef, {
        status: "Berjalan" as ProjectStatus,
        workflowStage: "ACTIVE",
        activatedAt: now,
        activatedBy: appUser.uid,
        lastWorkflowTransitionAt: now,
        lastWorkflowTransitionBy: appUser.uid,
        updatedAt: now,
      });

      const logId = uuidv4();
      batch.set(doc(db, "activityLogs", logId), {
        id: logId,
        projectId: id,
        projectName: context?.project?.projectName || "Project",
        userId: appUser.uid,
        userName: appUser.name || appUser.email,
        userRole: appUser.role,
        entityType: "PROJECT",
        entityId: id,
        entityName: context?.project?.projectName || "Project",
        action: "STATUS_CHANGE",
        details: "Aktivasi proyek resmi melalui Pre-Flight Inspection Gate (Status: Berjalan, Stage: ACTIVE).",
        createdAt: now,
      });

      await batch.commit();
      toast.success("Proyek resmi diaktifkan! Status proyek kini: Berjalan (ACTIVE).");
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
      toast.error("Gagal mengaktifkan proyek: Terjadi kesalahan pada server.");
      return false;
    }
  };

  const saveProjectWorkflowDraft = async (
    id: string,
    stage: string,
    completedStages: string[],
    draftData?: Partial<Project>
  ): Promise<void> => {
    if (!canManageProjects()) throw new Error("Unauthorized");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "projects", id), {
        ...(draftData || {}),
        workflowStage: stage,
        completedStages: Array.from(new Set(completedStages)),
        lastWorkflowTransitionAt: now,
        lastWorkflowTransitionBy: appUser?.uid || "system",
        updatedAt: now,
      });
      toast.success("Draft kemajuan setup proyek berhasil disimpan.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
      toast.error("Gagal menyimpan draft proyek.");
    }
  };

  return (
    <ProjectContext.Provider value={{
      projects, 
      loadingProjects, 
      createProject, 
      updateProject, 
      deleteProject,
      activateProject,
      saveProjectWorkflowDraft
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
}

export const useProject = useProjects;
