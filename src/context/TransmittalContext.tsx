import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  collection, doc, onSnapshot, query, setDoc, deleteDoc, where, orderBy, runTransaction 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { DrawingTransmittal } from "../types";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "./AuthContext";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";

interface TransmittalContextType {
  transmittals: DrawingTransmittal[];
  loading: boolean;
  createTransmittal: (
    data: Omit<DrawingTransmittal, "id" | "transmittalNumber" | "createdAt" | "updatedAt">
  ) => Promise<DrawingTransmittal>;
  deleteTransmittal: (id: string) => Promise<void>;
  getNextTransmittalNumber: () => Promise<string>;
}

const TransmittalContext = createContext<TransmittalContextType | undefined>(undefined);

export function TransmittalProvider({ 
  projectId, 
  children 
}: { 
  projectId: string; 
  children: React.ReactNode;
}) {
  const [transmittals, setTransmittals] = useState<DrawingTransmittal[]>([]);
  const [loading, setLoading] = useState(true);
  const { canManageTransmittal, isOwner, canManageProjects } = usePermissions();
  const { appUser } = useAuth();

  useEffect(() => {
    if (!projectId) {
      setTransmittals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "drawingTransmittals"),
      where("projectId", "==", projectId),
      orderBy("issuedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as DrawingTransmittal);
        setTransmittals(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching drawingTransmittals:", error);
        handleFirestoreError(error, OperationType.GET, "drawingTransmittals");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const getNextTransmittalNumber = async (): Promise<string> => {
    const counterRef = doc(db, "documentCounters", "transmittal");
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      let sequence = 1;
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        if (data.year === currentYear && data.month === currentMonth) {
          sequence = (data.sequence || 0) + 1;
        }
      }

      transaction.set(counterRef, {
        id: "transmittal",
        prefix: "TRM",
        year: currentYear,
        month: currentMonth,
        sequence,
        updatedAt: new Date().toISOString(),
      });

      const monthStr = currentMonth.toString().padStart(2, "0");
      const seqStr = sequence.toString().padStart(3, "0");
      return `TRM/${currentYear}/${monthStr}/${seqStr}`;
    });
  };

  const createTransmittal = async (
    data: Omit<DrawingTransmittal, "id" | "transmittalNumber" | "createdAt" | "updatedAt">
  ): Promise<DrawingTransmittal> => {
    if (!canManageTransmittal()) {
      throw new Error("Anda tidak memiliki wewenang untuk menerbitkan transmittal gambar.");
    }
    if (!appUser) {
      throw new Error("Sesi pengguna tidak valid.");
    }

    try {
      const transmittalNumber = await getNextTransmittalNumber();
      const id = uuidv4();
      const now = new Date().toISOString();

      const newTransmittal: DrawingTransmittal = {
        ...data,
        id,
        projectId,
        transmittalNumber,
        issuedBy: appUser.uid,
        issuedByName: appUser.name || appUser.email || "Penanggung Jawab Proyek",
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, "drawingTransmittals", id), newTransmittal);
      toast.success(`Transmittal ${transmittalNumber} berhasil diterbitkan`);
      return newTransmittal;
    } catch (error) {
      console.error("Error creating transmittal:", error);
      handleFirestoreError(error, OperationType.CREATE, "drawingTransmittals");
      toast.error("Gagal menerbitkan transmittal gambar");
      throw error;
    }
  };

  const deleteTransmittal = async (id: string) => {
    if (!canManageProjects() && !isOwner()) {
      throw new Error("Hanya Manajer/Owner yang berhak menghapus arsip transmittal.");
    }
    try {
      await deleteDoc(doc(db, "drawingTransmittals", id));
      toast.success("Arsip transmittal berhasil dihapus");
    } catch (error) {
      console.error("Error deleting transmittal:", error);
      handleFirestoreError(error, OperationType.DELETE, `drawingTransmittals/${id}`);
      toast.error("Gagal menghapus transmittal");
      throw error;
    }
  };

  return (
    <TransmittalContext.Provider
      value={{
        transmittals,
        loading,
        createTransmittal,
        deleteTransmittal,
        getNextTransmittalNumber,
      }}
    >
      {children}
    </TransmittalContext.Provider>
  );
}

export function useTransmittals() {
  const context = useContext(TransmittalContext);
  if (!context) {
    throw new Error("useTransmittals must be used within a TransmittalProvider");
  }
  return context;
}
