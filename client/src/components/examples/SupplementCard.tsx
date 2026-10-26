import SupplementCard from '../SupplementCard';

export default function SupplementCardExample() {
  const supplementLog = [
    { name: 'CoQ10' },
    { name: 'Magnesium Citrate' }
  ];

  return (
    <div className="p-6">
      <SupplementCard supplementLog={supplementLog} />
    </div>
  );
}
