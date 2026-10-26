import WaterIntakeCard from '../WaterIntakeCard';

export default function WaterIntakeCardExample() {
  const waterLog = [
    { time: '08:30', amount: 500 },
    { time: '11:15', amount: 250 },
    { time: '14:45', amount: 450 }
  ];

  return (
    <div className="p-6">
      <WaterIntakeCard waterIntake={1200} waterGoal={2000} waterLog={waterLog} />
    </div>
  );
}
