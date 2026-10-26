import ScoreCard from '../ScoreCard';

export default function ScoreCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      <ScoreCard title="Readiness" score={82} description="Overall recovery" color="purple" />
      <ScoreCard title="Sleep Score" score={76} description="Sleep quality" color="blue" />
      <ScoreCard title="Stress Level" score={65} description="Stress management" color="green" />
    </div>
  );
}
