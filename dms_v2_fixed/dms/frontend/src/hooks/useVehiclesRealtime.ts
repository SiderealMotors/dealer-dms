'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Subscribes to Supabase Postgres changes on `Vehicle` and calls `onEvent` for any mutation.
 * Requires `Vehicle` to be added to Supabase Realtime publication and RLS policies that allow SELECT.
 */
export function useVehiclesRealtime(onEvent: () => void, enabled: boolean) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const channel = supabase
      .channel('vehicles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Vehicle' },
        () => {
          cb.current();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}
