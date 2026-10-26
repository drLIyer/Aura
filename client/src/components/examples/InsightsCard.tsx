import InsightsCard from '../InsightsCard';

export default function InsightsCardExample() {
  const insights = [
    {
      type: 'cycle' as const,
      title: 'PMS Migraine Pattern Detected',
      message: '75% of your migraines occur 3-5 days before your period starts. You\'re currently in day 23 of your cycle.'
    },
    {
      type: 'warning' as const,
      title: 'Low Water Intake Pattern',
      message: 'You drank less than 1.5L yesterday. Low hydration was present before 3 of your last 5 migraines.'
    },
    {
      type: 'info' as const,
      title: 'Sleep Pattern Detected',
      message: 'Migraines are 70% more likely when your sleep score is below 65.'
    },
    {
      type: 'success' as const,
      title: 'Good Progress',
      message: 'Your readiness score has improved by 15% this week!'
    }
  ];

  return (
    <div className="p-6">
      <InsightsCard insights={insights} />
    </div>
  );
}
