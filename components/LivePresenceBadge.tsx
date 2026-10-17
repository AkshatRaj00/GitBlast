'use client';
import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function RealNetworkTelemetry() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [netSpeed, setNetSpeed] = useState<string>('');

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updateConnectionStatus = () => {
      setIsOnline(navigator.onLine);
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn && conn.downlink) {
        setNetSpeed(`${conn.downlink} Mbps (${conn.rtt || 20}ms)`);
      } else {
        setNetSpeed(navigator.onLine ? 'Connected' : 'Offline');
      }
    };

    updateConnectionStatus();

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener('change', updateConnectionStatus);
    }

    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
      if (conn) {
        conn.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
      {isOnline ? (
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span>{netSpeed || 'ONLINE'}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1 text-rose-400 font-bold">
          <WifiOff className="w-3 h-3 text-rose-400" />
          <span>OFFLINE</span>
        </span>
      )}
    </div>
  );
}
