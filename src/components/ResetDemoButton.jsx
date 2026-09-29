import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { usePreferences } from '../store/PreferencesStore';

// Two-step reset: the first click asks, the second wipes saved demo data.
export default function ResetDemoButton({ className = '' }) {
  const { resetDemo } = useMissions();
  const { resetPreferences } = usePreferences();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(id);
  }, [confirming]);

  const onClick = () => {
    if (!confirming) return setConfirming(true);
    setConfirming(false);
    resetDemo();
    resetPreferences();
    navigate('/app');
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
        confirming ? 'text-red-300 hover:text-red-200' : 'text-gray-400 hover:text-white'
      } ${className}`}
    >
      <RotateCcw className="w-3 h-3" />
      {confirming ? 'Click again to erase all demo data' : 'Reset demo data'}
    </button>
  );
}
