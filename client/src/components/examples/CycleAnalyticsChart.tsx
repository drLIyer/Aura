import CycleAnalyticsChart from '../CycleAnalyticsChart';

export default function CycleAnalyticsChartExample() {
  const cycleData = [
    { phase: 'Menstruation', migraines: 2, total: 12 },
    { phase: 'Follicular', migraines: 1, total: 12 },
    { phase: 'Ovulation', migraines: 0, total: 12 },
    { phase: 'Luteal', migraines: 9, total: 12 }
  ];

  return (
    <div className="p-6">
      <CycleAnalyticsChart data={cycleData} />
    </div>
  );
}
