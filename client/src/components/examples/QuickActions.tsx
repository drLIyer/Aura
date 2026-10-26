import QuickActions from '../QuickActions';

export default function QuickActionsExample() {
  return (
    <div className="p-6">
      <QuickActions onAction={(action) => console.log('Action clicked:', action)} />
    </div>
  );
}
