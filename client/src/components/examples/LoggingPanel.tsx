import { Droplets } from "lucide-react";
import LoggingPanel from '../LoggingPanel';

export default function LoggingPanelExample() {
  const entries = [
    { time: '08:30', value: '500ml' },
    { time: '11:15', value: '250ml' },
    { time: '14:45', value: '450ml' }
  ];

  const quickAddOptions = [
    { label: '250ml', value: '250ml' },
    { label: '500ml', value: '500ml' },
    { label: '750ml', value: '750ml' }
  ];

  return (
    <div className="p-6 max-w-md">
      <LoggingPanel
        title="Water Log"
        icon={<Droplets className="w-5 h-5 text-chart-2" />}
        entries={entries}
        quickAddOptions={quickAddOptions}
        onAdd={(value) => console.log('Added:', value)}
      />
    </div>
  );
}
