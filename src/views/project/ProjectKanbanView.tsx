import React from 'react';
import { useDrawings } from '../../context/DrawingContext';
import { usePermissions } from '../../hooks/usePermissions';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Badge, Card } from '../../components/ui';
import { DrawingItem, DrawingItemStatus } from '../../types';
import toast from 'react-hot-toast';

const STATUS_COLUMNS: DrawingItemStatus[] = [
  'Belum Mulai',
  'Proses',
  'Review',
  'Revisi',
  'Selesai',
  'Hold'
];

export function ProjectKanbanView({ search }: { search: string }) {
  const { items, updateItem } = useDrawings();
  const { canManageProjects, role, appUser } = usePermissions();

  const isTeam = role === 'TEAM';
  const isManager = canManageProjects();

  const canMoveItem = (item: DrawingItem) => {
    if (isManager) return true;
    if (isTeam) {
      // Team members can only change status of their own assigned drawing or unassigned
      return !item.picId || item.picId === appUser?.uid;
    }
    return false;
  };

  const getCardTooltip = (item: DrawingItem) => {
    if (isManager) return undefined;
    if (isTeam) {
      if (!item.picId || item.picId === appUser?.uid) return undefined;
      return `Akses terbatas: Hanya PIC (${item.picName || 'terkait'}) atau Manager yang dapat memindahkan gambar ini`;
    }
    return "Akses terbatas: Memerlukan izin Kelola Proyek (Owner / Admin / Project Leader)";
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    if (source.droppableId === destination.droppableId) return;

    const item = items.find(i => i.id === draggableId);
    if (!item) return;

    if (!canMoveItem(item)) {
      toast.error(
        isTeam
          ? `Akses terbatas: Anda hanya dapat memindahkan gambar yang ditugaskan kepada Anda (PIC: ${item.picName || 'terkait'}).`
          : "Akses terbatas: Anda tidak memiliki wewenang mengubah status gambar."
      );
      return;
    }

    const newStatus = destination.droppableId as DrawingItemStatus;
    updateItem(draggableId, { status: newStatus });
  };

  const getStatusColor = (s: string) => {
    switch(s) {
      case 'Selesai': return 'success';
      case 'Proses': return 'info';
      case 'Review': return 'warning';
      case 'Revisi': return 'danger';
      case 'Hold': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="flex h-full min-h-[600px] overflow-x-auto pb-4 gap-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        {STATUS_COLUMNS.map(status => {
          const colItems = items.filter(i => 
            i.status === status && 
            (i.drawingName.toLowerCase().includes(search.toLowerCase()) || 
             i.drawingNumber.toLowerCase().includes(search.toLowerCase()))
          );

          return (
            <div key={status} className="flex-shrink-0 w-80 bg-black/5 dark:bg-white/5 rounded-xl flex flex-col p-3">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{status}</h3>
                <Badge variant="default" className="text-xs">{colItems.length}</Badge>
              </div>
              
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className={`flex-1 transition-colors rounded-lg min-h-[150px] ${snapshot.isDraggingOver ? 'bg-black/5 dark:bg-white/10' : ''}`}
                  >
                    {colItems.map((item, index) => {
                      const canMove = canMoveItem(item);
                      const cardTooltip = getCardTooltip(item);

                      return (
                        <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canMove}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-3 last:mb-0 ${snapshot.isDragging ? 'opacity-75' : ''}`}
                            >
                              <Card 
                                className={`p-3 shadow-sm hover:shadow-md transition-shadow bg-[var(--color-surface)] border border-[var(--color-border)] ${canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-80'}`}
                                title={cardTooltip}
                              >
                                <div className="text-xs font-mono text-[var(--color-text-secondary)] mb-1 flex justify-between items-center">
                                  <span>{item.drawingNumber}</span>
                                  {!canMove && (
                                    <span className="text-xs text-[var(--color-text-secondary)] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded font-medium">
                                      Terkunci
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 mb-2">
                                  {item.drawingName}
                                </h4>
                                <div className="flex justify-between items-center mt-3">
                                  {item.picName ? (
                                    <div className="w-6 h-6 rounded-full bg-[var(--color-accent-blue)] text-white flex items-center justify-center text-xs font-medium" title={`PIC: ${item.picName}`}>
                                      {item.picName.charAt(0).toUpperCase()}
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10" title="Belum ada PIC" />
                                  )}
                                  <Badge variant={getStatusColor(item.status) as any}>{item.progress}%</Badge>
                                </div>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
}
