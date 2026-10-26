import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { AppUser, CanonicalUserRole } from "../types";
import { syncToUserDirectory } from "../security/userDirectory";
import { useTheme } from "./ThemeContext";
import toast from "react-hot-toast";

export const AUTHORIZED_OWNER_EMAILS = [
  "saipulabe5@gmail.com",
  "saipulabe@gmail.com",
];

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  realAppUser: AppUser | null;
  simulatedRole: CanonicalUserRole | null;
  setSimulatedRole: (role: CanonicalUserRole | null) => void;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [simulatedRole, setSimulatedRoleState] = useState<CanonicalUserRole | null>(() => {
    return (sessionStorage.getItem("mdrawing_simulated_role") as CanonicalUserRole) || null;
  });
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  const setSimulatedRole = (role: CanonicalUserRole | null) => {
    if (role) {
      sessionStorage.setItem("mdrawing_simulated_role", role);
      toast.success(`Beralih ke mode simulasi peran: ${role}`);
    } else {
      sessionStorage.removeItem("mdrawing_simulated_role");
      toast.success("Kembali ke peran utama");
    }
    setSimulatedRoleState(role);
  };

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let hasAlertedDeactivation = false;

    // Safety watchdog timeout to prevent infinite loading screen on network hiccups
    const watchdogTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[AUTH] Auth loading timeout reached. Falling back to loaded state.");
          return false;
        }
        return prev;
      });
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous user snapshot listener if any
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      setUser(firebaseUser);
      hasAlertedDeactivation = false;
      
      if (!firebaseUser) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      // 1. Check if token claims need refresh or bootstrap
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch("/api/auth/bootstrap-check-owner", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token: idToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.bootstrapped || data.role === "OWNER") {
            // Force token refresh so that custom claims are present in ID token
            await firebaseUser.getIdToken(true);
          }
        }
      } catch (err) {
        console.warn("[AUTH] Initial claim verification note:", err);
      }

      // Listen to the user document in Firestore to handle Realtime Deactivation and Role updates
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userEmail = (firebaseUser.email || "").toLowerCase().trim();
      const isAuthorizedOwner = AUTHORIZED_OWNER_EMAILS.includes(userEmail);

      const getOwnerProfile = (existing?: Partial<AppUser>): AppUser => ({
        uid: firebaseUser.uid,
        email: userEmail,
        name: firebaseUser.displayName || existing?.name || (userEmail.startsWith("saipulabe5") ? "saipul abe" : "Saipul Abe"),
        role: "OWNER",
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        canApproveFinance: true,
        canExportFinanceReport: true,
        canVoidFinanceTransaction: true,
        canEditPaidTransaction: true,
        canViewVendorCost: true,
        canViewVendorPayment: true,
        canManageTransmittal: true,
        canManageVendor: true,
        canCreateProject: true,
        canEditProject: true,
        canDeleteProject: true,
        canManageDrawingRegister: true,
        canUpdateDrawingStatus: true,
        assignedProjectIds: existing?.assignedProjectIds || [],
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(existing?.themePreference ? { themePreference: existing.themePreference } : {}),
      });

      unsubUser = onSnapshot(userDocRef, async (docSnap) => {
        if (!docSnap.exists()) {
          if (isAuthorizedOwner) {
            const ownerProfile = getOwnerProfile();
            setAppUser(ownerProfile);
            try {
              await setDoc(userDocRef, ownerProfile, { merge: true });
              await syncToUserDirectory(ownerProfile);
            } catch (err) {
              console.warn("[AUTH] Could not save initial owner profile to Firestore:", err);
            }
          } else {
            // Safe default self-registration: VIEWER with inactive status and zero privileged capabilities
            const initialUserData: AppUser = {
              uid: firebaseUser.uid,
              email: userEmail,
              name: firebaseUser.displayName || "Pengguna Baru",
              role: "VIEWER",
              isActive: false,
              canViewFinance: false,
              canEditFinance: false,
              canApproveFinance: false,
              canExportFinanceReport: false,
              canVoidFinanceTransaction: false,
              canEditPaidTransaction: false,
              canViewVendorCost: false,
              canViewVendorPayment: false,
              canManageTransmittal: false,
              assignedProjectIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            try {
              await setDoc(userDocRef, initialUserData);
              await syncToUserDirectory(initialUserData);
            } catch (error) {
              console.error("[AUTH] Error creating initial user profile:", error);
            }
            setAppUser(initialUserData);
          }
        } else {
          const userData = docSnap.data() as AppUser;
          if (isAuthorizedOwner) {
            const ownerProfile = getOwnerProfile(userData);
            setAppUser(ownerProfile);

            if (!userData.isActive || userData.role !== "OWNER") {
              setDoc(userDocRef, ownerProfile, { merge: true }).catch((err) => {
                console.warn("[AUTH] Error auto-activating owner in Firestore:", err);
              });
              syncToUserDirectory(ownerProfile).catch(() => {});
            }
          } else {
            setAppUser(userData);

            // If account is inactive, notify user and let routing handle navigation to /access-denied
            if (!userData.isActive) {
              if (!hasAlertedDeactivation) {
                hasAlertedDeactivation = true;
                toast.error("Akun Anda saat ini belum aktif. Silakan hubungi Administrator/Owner untuk aktivasi.", { id: "account-deactivated-toast" });
              }
            }
          }

          // Sync theme preference if exists
          if (userData.themePreference) {
            if (localStorage.getItem("app_theme") !== userData.themePreference) {
              setTheme(userData.themePreference);
            }
          }
        }
        setLoading(false);
      }, (error) => {
        console.error("User snapshot error:", error);
        if (isAuthorizedOwner) {
          setAppUser(getOwnerProfile());
        }
        setLoading(false);
      });
    });

    return () => {
      clearTimeout(watchdogTimer);
      if (unsubUser) unsubUser();
      unsubscribe();
    };
  }, [setTheme]);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("[AUTH ERROR CODE]:", error?.code, "[AUTH ERROR MESSAGE]:", error?.message, error);
      if (error?.code === 'auth/unauthorized-domain') {
        toast.error(
          `Domain ${window.location.hostname} belum diizinkan di Firebase Console. Tambahkan '${window.location.hostname}' ke Firebase Authentication -> Settings -> Authorized Domains.`,
          { duration: 10000, id: 'unauthorized-domain-toast' }
        );
      } else {
        toast.error(`Gagal login [${error?.code || 'ERROR'}]: ${error?.message || 'Gagal login dengan Google'}`);
      }
    }
  };

  const logOut = async () => {
    try {
      setUser(null);
      setAppUser(null);
      sessionStorage.removeItem("mdrawing_simulated_role");
      setSimulatedRoleState(null);
      await signOut(auth);
      toast.success("Berhasil keluar dari akun MDrawing");
    } catch (error: any) {
      console.error("Logout failed:", error);
      toast.error(`Gagal keluar: ${error?.message || 'Terjadi kesalahan'}`);
    }
  };

  const effectiveAppUser = React.useMemo(() => {
    if (!appUser) return null;
    if (!simulatedRole) return appUser;
    if (appUser.role !== 'OWNER' && appUser.role !== 'ADMIN') return appUser;

    return {
      ...appUser,
      role: simulatedRole,
      canViewFinance: simulatedRole === 'FINANCE' || simulatedRole === 'OWNER' || simulatedRole === 'ADMIN',
      canEditFinance: simulatedRole === 'FINANCE' || simulatedRole === 'OWNER' || simulatedRole === 'ADMIN',
      canManageProjects: simulatedRole === 'PROJECT_LEADER' || simulatedRole === 'ADMIN' || simulatedRole === 'OWNER',
    };
  }, [appUser, simulatedRole]);

  return (
    <AuthContext.Provider value={{ user, appUser: effectiveAppUser, realAppUser: appUser, simulatedRole, setSimulatedRole, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
