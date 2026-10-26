import TrendsChart from '../TrendsChart';

export default function TrendsChartExample() {
  const trendData = [
    { date: '1/1', readiness: 75, sleep: 80, stress: 70, migraine: 0 },
    { date: '1/2', readiness: 82, sleep: 85, stress: 75, migraine: 0 },
    { date: '1/3', readiness: 68, sleep: 65, stress: 55, migraine: 1 },
    { date: '1/4', readiness: 71, sleep: 72, stress: 68, migraine: 0 },
    { date: '1/5', readiness: 85, sleep: 88, stress: 80, migraine: 0 },
    { date: '1/6', readiness: 78, sleep: 82, stress: 72, migraine: 0 },
    { date: '1/7', readiness: 82, sleep: 76, stress: 65, migraine: 0 },
  ];

  return (
    <div className="p-6">
      <TrendsChart data={trendData} days={7} />
    </div>
  );
}
