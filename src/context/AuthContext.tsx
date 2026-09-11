import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { AppUser, CanonicalUserRole } from "../types";
import { useTheme } from "./ThemeContext";
import toast from "react-hot-toast";

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
        const tokenResult = await firebaseUser.getIdTokenResult();
        if (!tokenResult.claims.role) {
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
            if (data.bootstrapped) {
              // Force token refresh so that custom claims are present in ID token
              await firebaseUser.getIdToken(true);
            }
          }
        }
      } catch (err) {
        console.warn("[AUTH] Initial claim verification note:", err);
      }

      // Listen to the user document in Firestore to handle Realtime Deactivation and Role updates
      const userDocRef = doc(db, "users", firebaseUser.uid);
      unsubUser = onSnapshot(userDocRef, async (docSnap) => {
        if (!docSnap.exists()) {
          // Document does not exist yet. Delegate bootstrap and account linking to server:
          try {
            const idToken = await firebaseUser.getIdToken();
            const response = await fetch("/api/auth/bootstrap-check-owner", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ token: idToken }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.bootstrapped) {
                // Force token refresh to pick up official Custom Claims set by Admin SDK
                await firebaseUser.getIdToken(true);
                // Server wrote the canonical active user doc to Firestore. Return early and let onSnapshot pick it up.
                return;
              }
            }
          } catch (bootErr) {
            console.error("[AUTH] Error calling bootstrap endpoint:", bootErr);
          }

          // If not bootstrapped/linked by server, register as standard VIEWER (pending admin activation)
          // Allowed by firestore.rules: incoming().role == "VIEWER" && incoming().isActive == false
          const standardViewer: Partial<AppUser> = {
            uid: firebaseUser.uid,
            email: (firebaseUser.email || "").toLowerCase(),
            name: firebaseUser.displayName || "Pengguna Baru",
            role: "VIEWER",
            isActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          try {
            await setDoc(userDocRef, standardViewer);
          } catch (error) {
            console.error("[AUTH] Error creating standard viewer profile:", error);
          }
        } else {
          const userData = docSnap.data() as AppUser;
          setAppUser(userData);

          // Real-time deactivation check with server re-sync verification
          if (!userData.isActive && userData.role !== "OWNER") {
            // Attempt self-healing re-sync with server (e.g. if Owner pre-registered or activated the email)
            let resynced = false;
            try {
              const idToken = await firebaseUser.getIdToken();
              const response = await fetch("/api/auth/bootstrap-check-owner", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ token: idToken }),
              });
              if (response.ok) {
                const data = await response.json();
                if (data.bootstrapped && data.isActive) {
                  await firebaseUser.getIdToken(true);
                  resynced = true;
                  return; // Successfully linked and activated, do NOT sign out!
                }
              }
            } catch (syncErr) {
              console.warn("[AUTH] Resync attempt error:", syncErr);
            }

            if (!resynced) {
              if (!hasAlertedDeactivation) {
                hasAlertedDeactivation = true;
                toast.error("Akun Anda saat ini belum aktif atau belum disetujui Administrator.", { id: "account-deactivated-toast" });
              }
              await auth.signOut();
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
      toast.error(`Gagal login [${error?.code || 'ERROR'}]: ${error?.message || 'Gagal login dengan Google'}`);
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
      canViewFinance: simulatedRole === 'FINANCE' || simulatedRole === 'OWNER',
      canEditFinance: simulatedRole === 'FINANCE' || simulatedRole === 'OWNER',
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
