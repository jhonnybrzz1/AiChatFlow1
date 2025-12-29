// Event Tracker Service
// Service for tracking user events and analytics
import { useState, useEffect } from 'react';

interface EventData {
  eventName: string;
  properties?: Record<string, any>;
  timestamp: string;
}

export const useEventTracker = () => {
  const [events, setEvents] = useState<EventData[]>([]);

  // Load events from local storage on init
  useEffect(() => {
    const storedEvents = localStorage.getItem('trackedEvents');
    if (storedEvents) {
      try {
        setEvents(JSON.parse(storedEvents));
      } catch (error) {
        console.error('Failed to parse stored events:', error);
      }
    }
  }, []);

  // Save events to local storage when they change
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('trackedEvents', JSON.stringify(events));
    }
  }, [events]);

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    const eventData: EventData = {
      eventName,
      properties: properties || {},
      timestamp: new Date().toISOString()
    };

    // Add to state
    setEvents(prevEvents => [...prevEvents, eventData]);

    // Log to console for debugging
    console.log('Event tracked:', eventName, properties);

    // In a real implementation, this would send to an analytics service
    // For example: analyticsService.track(eventName, properties);

    // Send to server if available
    if (process.env.NODE_ENV === 'production') {
      sendEventToServer(eventData);
    }
  };

  const sendEventToServer = async (eventData: EventData) => {
    try {
      // In a real implementation, this would be an API call
      // await fetch('/api/track', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(eventData)
      // });
      
      console.log('Event sent to server:', eventData);
    } catch (error) {
      console.error('Failed to send event to server:', error);
      // Store for later retry
      localStorage.setItem('pendingEvents', JSON.stringify(eventData));
    }
  };

  const getEventHistory = () => {
    return events;
  };

  const clearEvents = () => {
    setEvents([]);
    localStorage.removeItem('trackedEvents');
    localStorage.removeItem('pendingEvents');
  };

  return {
    trackEvent,
    getEventHistory,
    clearEvents
  };
};

// Singleton instance for non-React contexts
export const eventTracker = {
  trackEvent: (eventName: string, properties?: Record<string, any>) => {
    const eventData: EventData = {
      eventName,
      properties: properties || {},
      timestamp: new Date().toISOString()
    };

    console.log('Event tracked:', eventName, properties);
    
    // Store in local storage
    const storedEvents = localStorage.getItem('trackedEvents');
    const events = storedEvents ? JSON.parse(storedEvents) : [];
    events.push(eventData);
    localStorage.setItem('trackedEvents', JSON.stringify(events));
  },

  getEventHistory: () => {
    const storedEvents = localStorage.getItem('trackedEvents');
    return storedEvents ? JSON.parse(storedEvents) : [];
  },

  clearEvents: () => {
    localStorage.removeItem('trackedEvents');
    localStorage.removeItem('pendingEvents');
  }
};