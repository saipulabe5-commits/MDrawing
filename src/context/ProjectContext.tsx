import { apiRequest } from '../lib/commandClient';
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
    let live = true;
    setProjects([]);
    setLoadingProjects(true);
    if (!appUser?.isActive) {
      setLoadingProjects(false);
      return;
    }

    // 1. Primary: Real-time direct Firestore listener (consistent with Drawing/Vendor/Document contexts)
    const q = query(collection(db, "projects"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!live) return;
        const projectList = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Project))
          .filter((p) => !p.isArchived);
        setProjects(projectList);
        setLoadingProjects(false);
      },
      async (firestoreErr) => {
        console.warn("[PROJECTS] Firestore direct listener fallback to server API:", firestoreErr.message);
        // 2. Secondary fallback: Server API
        try {
          const result = await apiRequest('/api/projects');
          if (live) {
            setProjects(result.projects.filter((p: any) => !p.isArchived));
            setLoadingProjects(false);
          }
        } catch (apiErr: any) {
          if (live) {
            setProjects([]);
            setLoadingProjects(false);
            console.error("[PROJECTS] Failed to load projects from server:", apiErr.message);
          }
        }
      }
    );

    const onProjectsChanged = async () => {
      // Event listener for manual invalidation
      try {
        const result = await apiRequest('/api/projects');
        if (live && result?.projects) {
          setProjects(result.projects.filter((p: any) => !p.isArchived));
        }
      } catch {
        // Ignored; Firestore real-time listener will keep state sync
      }
    };
    window.addEventListener('mdrawing-projects-changed', onProjectsChanged);

    return () => {
      live = false;
      unsubscribe();
      window.removeEventListener('mdrawing-projects-changed', onProjectsChanged);
    };
  }, [appUser]);

  const createProject = async (data: any, templateId?: string) => {const id=uuidv4();const result=await apiRequest('/api/projects/command',{action:'create',id,data,templateId,requestId:id});window.dispatchEvent(new Event('mdrawing-projects-changed'));return result.id;};

  const updateProject = async (id:string,data:Partial<Project>)=>{await apiRequest('/api/projects/command',{action:'save',id,data});window.dispatchEvent(new Event('mdrawing-projects-changed'));};

  const deleteProject = async(id:string)=>{await apiRequest('/api/projects/command',{action:'archive',id});window.dispatchEvent(new Event('mdrawing-projects-changed'));};

  const activateProject = async(id:string,context?:any)=>{await apiRequest('/api/projects/command',{action:'activate',id,data:context?.project||{}});window.dispatchEvent(new Event('mdrawing-projects-changed'));return true;};

  const saveProjectWorkflowDraft = async(id:string,stage:string,completedStages:string[],draftData?:Partial<Project>)=>{await updateProject(id,draftData||{});};

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
