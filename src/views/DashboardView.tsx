import React, { useEffect, useState, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { Card, Badge } from '../components/ui';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Building2, FolderKanban, CheckCircle2, TrendingUp } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DrawingItem } from '../types';
import { calculateProjectProgress } from '../engine/projectProgressEngine';

export function DashboardView() {
  const { projects, loadingProjects } = useProjects();
  const [allItems, setAllItems] = useState<DrawingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (loadingProjects) return;

    if (projects.length === 0) {
      setAllItems([]);
      setLoadingItems(false);
      return;
    }

    const projectIds = projects.map((p) => p.id).filter(Boolean);
    if (projectIds.length === 0) {
      setAllItems([]);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);

    // Chunk project IDs into slices of 10 to comply with Firestore 'in' query limitations
    const chunkSize = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += chunkSize) {
      chunks.push(projectIds.slice(i, i + chunkSize));
    }

    const chunkResults = new Map<number, DrawingItem[]>();
    const unsubs: Array<() => void> = [];
    let pendingInitialSnapshots = chunks.length;

    chunks.forEach((chunk, index) => {
      const q = query(
        collection(db, "drawingItems"),
        where("projectId", "in", chunk),
        where("isDeleted", "==", false)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          chunkResults.set(
            index,
            snapshot.docs.map((doc) => doc.data() as DrawingItem)
          );

          // Flatten all chunk results
          const aggregated: DrawingItem[] = [];
          chunkResults.forEach((items) => aggregated.push(...items));
          setAllItems(aggregated);

          if (pendingInitialSnapshots > 0) {
            pendingInitialSnapshots--;
            if (pendingInitialSnapshots === 0) {
              setLoadingItems(false);
            }
          }
        },
        (error) => {
          console.error(`Error fetching dashboard items for chunk ${index}:`, error);
          if (pendingInitialSnapshots > 0) {
            pendingInitialSnapshots--;
            if (pendingInitialSnapshots === 0) {
              setLoadingItems(false);
            }
          }
        }
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [projects, loadingProjects]);

  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'Berjalan');
    const completedProjects = projects.filter(p => p.status === 'Selesai');
    const totalProjects = projects.length;

    const itemsStatusData = [
      { name: 'Selesai', value: allItems.filter(i => i.status === 'Selesai').length, color: 'var(--color-accent-green)' },
      { name: 'Proses', value: allItems.filter(i => i.status === 'Proses').length, color: 'var(--color-accent-blue)' },
      { name: 'Review', value: allItems.filter(i => i.status === 'Review').length, color: 'var(--color-accent-orange)' },
      { name: 'Revisi', value: allItems.filter(i => i.status === 'Revisi').length, color: 'var(--color-accent-red)' },
      { name: 'Belum Mulai', value: allItems.filter(i => i.status === 'Belum Mulai').length, color: 'var(--color-text-secondary)' },
      { name: 'Hold', value: allItems.filter(i => i.status === 'Hold').length, color: 'var(--color-border)' },
    ].filter(item => item.value > 0);

    const projectProgressData = activeProjects.map(p => {
      const pItems = allItems.filter(i => i.projectId === p.id);
      const avgProgress = calculateProjectProgress(pItems as any);
      return {
        name: p.projectName.substring(0, 15) + (p.projectName.length > 15 ? '...' : ''),
        progress: avgProgress
      };
    }).sort((a, b) => b.progress - a.progress);

    const overallActiveItems = allItems;
    const overallProgress = calculateProjectProgress(overallActiveItems as any);

    return {
      activeProjects,
      completedProjects,
      totalProjects,
      itemsStatusData,
      projectProgressData,
      overallProgress: Math.round(overallProgress),
      totalItems: allItems.length
    };
  }, [projects, allItems]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Ringkasan aktivitas dan status proyek Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)] rounded-xl flex items-center justify-center">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Total Proyek</p>
            {loadingProjects ? (
              <div className="h-8 w-16 bg-black/5 dark:bg-white/5 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{stats.totalProjects}</p>
            )}
          </div>
        </Card>
        
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--color-accent-orange)]/10 text-[var(--color-accent-orange)] rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Proyek Aktif</p>
            {loadingProjects ? (
              <div className="h-8 w-16 bg-black/5 dark:bg-white/5 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{stats.activeProjects.length}</p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Total Gambar</p>
            {loadingItems ? (
              <div className="h-8 w-16 bg-black/5 dark:bg-white/5 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{stats.totalItems}</p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--color-accent-green)]/10 text-[var(--color-accent-green)] rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Progress Keseluruhan</p>
            {loadingItems || loadingProjects ? (
              <div className="h-8 w-24 bg-black/5 dark:bg-white/5 rounded animate-pulse mt-1"></div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{stats.overallProgress}%</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-6 text-[var(--color-text-primary)]">Distribusi Status Gambar (Seluruh Proyek)</h3>
          {loadingItems ? (
            <div className="h-[300px] w-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats.itemsStatusData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.itemsStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.itemsStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-surface)', 
                      borderColor: 'var(--color-border)', 
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                    }}
                    itemStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 500 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-xl">
              <p className="text-sm text-[var(--color-text-secondary)]">Belum ada data gambar</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-6 text-[var(--color-text-primary)]">Progress Proyek Aktif (%)</h3>
          {loadingProjects || loadingItems ? (
            <div className="h-[300px] w-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats.projectProgressData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.projectProgressData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--color-text-secondary)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-text-primary)" fontSize={12} width={100} tick={{ fill: 'var(--color-text-primary)', fontWeight: 500 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-surface)', 
                      borderColor: 'var(--color-border)', 
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                    }}
                    itemStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                    cursor={{fill: 'var(--color-border)', opacity: 0.2}}
                  />
                  <Bar dataKey="progress" fill="var(--color-accent-blue)" radius={[0, 4, 4, 0]} barSize={20}>
                    {stats.projectProgressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.progress === 100 ? 'var(--color-accent-green)' : 'var(--color-accent-blue)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-xl">
              <p className="text-sm text-[var(--color-text-secondary)]">Belum ada proyek aktif</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
