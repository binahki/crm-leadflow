import { useState, useEffect } from 'react';

export function useGreeting(firstName?: string) {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      let timeGreeting = '';

      if (hour >= 6 && hour < 12) {
        timeGreeting = 'Bom dia';
      } else if (hour >= 12 && hour < 18) {
        timeGreeting = 'Boa tarde';
      } else {
        timeGreeting = 'Boa noite';
      }

      setGreeting(firstName ? `${timeGreeting}, ${firstName}` : timeGreeting);
    };

    updateGreeting();
    
    // Update every minute to keep greeting current
    const interval = setInterval(updateGreeting, 60000);

    return () => clearInterval(interval);
  }, [firstName]);

  return greeting;
}
