import MigraineLogForm from '../MigraineLogForm';

export default function MigraineLogFormExample() {
  return (
    <div className="p-6 max-w-2xl">
      <MigraineLogForm
        onSubmit={(data) => console.log('Migraine logged:', data)}
        onCancel={() => console.log('Cancelled')}
      />
    </div>
  );
}
