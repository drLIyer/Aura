import CycleTrackerCard from '../CycleTrackerCard';

export default function CycleTrackerCardExample() {
  return (
    <div className="p-6">
      <CycleTrackerCard
        currentDay={23}
        cycleLength={28}
        phase="luteal"
        daysUntilPeriod={5}
        onLogPeriod={() => console.log('Log period clicked')}
      />
    </div>
  );
}
