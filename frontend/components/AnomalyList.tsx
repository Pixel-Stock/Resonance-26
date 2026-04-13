'use client';

import { Anomaly } from '../lib/types';
import AnomalyCard from './AnomalyCard';

interface Props {
  anomalies: Anomaly[];
  selected: Anomaly | null;
  onSelect: (a: Anomaly) => void;
}

export default function AnomalyList({ anomalies, selected, onSelect }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-xs p-4 text-center">
        NO ANOMALIES MATCH CURRENT FILTER
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {anomalies.map((a, i) => (
        <AnomalyCard
          key={a.id}
          anomaly={a}
          isSelected={selected?.id === a.id}
          onClick={() => onSelect(a)}
          delay={i * 80}
        />
      ))}
    </div>
  );
}
