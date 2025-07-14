import React, { useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePageViewStats } from '../hooks/usePageViewStats';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ui/confirm-dialog';
import type { PageView } from '../lib/types';

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

type ListItem = { type: 'header'; hostname: string } | { type: 'view'; data: PageView };

export const PageViewList: React.FC = () => {
  const { stats, loading, handleDelete } = usePageViewStats();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo(() => {
    const items: ListItem[] = [];
    const groupedByHostname = stats.reduce((acc, stat) => {
      const hostname = stat.hostname;
      if (!acc[hostname]) {
        acc[hostname] = [];
      }
      acc[hostname].push(stat);
      return acc;
    }, {} as Record<string, PageView[]>);

    for (const hostname in groupedByHostname) {
      items.push({ type: 'header', hostname });
      groupedByHostname[hostname].forEach(view => {
        items.push({ type: 'view', data: view });
      });
    }
    return items;
  }, [stats]);

  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatItems[index].type === 'header' ? 48 : 40), // Header is taller
    overscan: 5,
  });

  const openConfirmDialog = (url: string) => {
    setUrlToDelete(url);
    setDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (urlToDelete) {
      handleDelete(urlToDelete);
    }
    setUrlToDelete(null);
    setDialogOpen(false);
  };

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (stats.length === 0) {
    return <div className="text-center p-4 text-gray-500">No page view data yet.</div>;
  }

  return (
    <>
      <div ref={parentRef} className="h-[400px] overflow-y-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = flatItems[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.type === 'header' ? (
                  <h3 className="text-lg font-semibold p-2 sticky top-0 bg-white dark:bg-gray-800 py-2 z-10">
                    {item.hostname}
                  </h3>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <img src={item.data.faviconUrl || './icon/32.png'} alt="favicon" className="w-4 h-4 flex-shrink-0" />
                      <a href={item.data.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate" title={item.data.url}>
                        {item.data.url.replace(`https://${item.data.hostname}`, '').replace(`http://${item.data.hostname}`, '')}
                      </a>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="text-sm font-medium">{formatDuration(item.data.totalDuration)}</span>
                      <Button variant="ghost" size="icon" onClick={() => openConfirmDialog(item.data.url)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Are you absolutely sure?"
        description="This action cannot be undone. This will permanently delete this page view record."
      />
    </>
  );
};