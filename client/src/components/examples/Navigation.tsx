import { useState } from 'react';
import Navigation from '../Navigation';

export default function NavigationExample() {
  const [currentView, setCurrentView] = useState('dashboard');
  return <Navigation currentView={currentView} onViewChange={setCurrentView} />;
}
