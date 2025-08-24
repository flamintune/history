import { useState, useEffect, KeyboardEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { loadData, saveData, STORAGE_KEYS, getPageViewsByDomain } from '@/lib/storage-manager';
import { UserSettings, PageView } from '@/lib/types';
import { browser } from 'wxt/browser';
import { ScrollArea } from './ui/scroll-area';

const DEFAULT_USER_SETTINGS: UserSettings = {
  collectData: true,
  collectionFrequency: "daily",
  excludeIncognito: true,
  excludedDomains: [],
  trackPageViewDuration: true,
  inactivityThresholdMinutes: 5,
  pauseOnInactivity: true,
  pageViewStorageDays: 30
};

export function DomainExclusionManager() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [newDomain, setNewDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [domainSuggestions, setDomainSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [topDomains, setTopDomains] = useState<{domain: string, count: number, totalDuration: number}[]>([]);

  // Load settings and top domains on component mount
  useEffect(() => {
    const loadSettingsAndDomains = async () => {
      try {
        // Load user settings
        const userSettings = await loadData<UserSettings>(
          STORAGE_KEYS.userSettings,
          DEFAULT_USER_SETTINGS
        );
        setSettings(userSettings);
        
        // Load all page views to extract domains
        const allPageViews = await loadData<Record<string, PageView>>(STORAGE_KEYS.pageViews, {});
        
        // Extract and count domains
        const domainMap = new Map<string, {count: number, totalDuration: number}>();
        
        Object.values(allPageViews).forEach(pageView => {
          const domain = pageView.hostname;
          const currentValue = domainMap.get(domain) || {count: 0, totalDuration: 0};
          domainMap.set(domain, {
            count: currentValue.count + 1,
            totalDuration: currentValue.totalDuration + pageView.totalDuration
          });
        });
        
        // Convert to array and sort by count (descending)
        const sortedDomains = Array.from(domainMap.entries())
          .map(([domain, stats]) => ({
            domain,
            count: stats.count,
            totalDuration: stats.totalDuration
          }))
          .sort((a, b) => b.totalDuration - a.totalDuration)
          .slice(0, 10); // Get top 10 domains
        
        setTopDomains(sortedDomains);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading settings or domains:', error);
        setMessage({ text: 'Failed to load settings', type: 'error' });
        setIsLoading(false);
      }
    };

    loadSettingsAndDomains();
  }, []);

  // Save settings when they change
  const saveSettings = async (updatedSettings: UserSettings) => {
    try {
      await saveData(STORAGE_KEYS.userSettings, updatedSettings);
      setSettings(updatedSettings);
      setMessage({ text: 'Settings saved successfully', type: 'success' });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ text: 'Failed to save settings', type: 'error' });
    }
  };

  // Normalize a domain by removing protocol, www, etc.
  const normalizeDomain = (domain: string): string => {
    let normalizedDomain = domain.trim().toLowerCase();
    
    // Remove protocol if present
    if (normalizedDomain.startsWith('http://')) {
      normalizedDomain = normalizedDomain.substring(7);
    } else if (normalizedDomain.startsWith('https://')) {
      normalizedDomain = normalizedDomain.substring(8);
    }
    
    // Remove www. prefix if present
    if (normalizedDomain.startsWith('www.')) {
      normalizedDomain = normalizedDomain.substring(4);
    }
    
    // Remove path, query parameters, and hash
    normalizedDomain = normalizedDomain.split('/')[0];
    
    return normalizedDomain;
  };

  // Format duration in seconds to a human-readable string
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Add a new domain to the exclusion list
  const addDomain = async () => {
    if (!newDomain) return;
    
    // Normalize the domain
    const normalizedDomain = normalizeDomain(newDomain);
    
    // Validate domain format (basic check)
    if (!normalizedDomain.includes('.') || normalizedDomain.length < 3) {
      setMessage({ text: 'Please enter a valid domain name', type: 'error' });
      return;
    }
    
    // Check if domain is already in the list
    if (settings.excludedDomains.includes(normalizedDomain)) {
      setMessage({ text: 'Domain is already excluded', type: 'error' });
      return;
    }
    
    // Add the domain to the list
    const updatedSettings = {
      ...settings,
      excludedDomains: [...settings.excludedDomains, normalizedDomain]
    };
    
    await saveSettings(updatedSettings);
    setNewDomain('');
    setShowSuggestions(false);
    
    // Notify all tabs about the updated exclusion list
    browser.runtime.sendMessage({
      type: 'settings_updated',
      data: { settings: updatedSettings }
    }).catch(error => {
      console.error('Error notifying about settings update:', error);
    });
  };

  // Remove a domain from the exclusion list
  const removeDomain = async (domain: string) => {
    const updatedSettings = {
      ...settings,
      excludedDomains: settings.excludedDomains.filter(d => d !== domain)
    };
    
    await saveSettings(updatedSettings);
    
    // Notify all tabs about the updated exclusion list
    browser.runtime.sendMessage({
      type: 'settings_updated',
      data: { settings: updatedSettings }
    }).catch(error => {
      console.error('Error notifying about settings update:', error);
    });
  };

  // Handle domain input changes and update suggestions
  const handleDomainInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewDomain(value);
    
    if (value.length > 1) {
      // Filter top domains based on input
      const filteredDomains = topDomains
        .map(item => item.domain)
        .filter(domain => 
          domain.toLowerCase().includes(value.toLowerCase()) && 
          !settings.excludedDomains.includes(domain)
        )
        .slice(0, 5); // Limit to 5 suggestions
      
      setDomainSuggestions(filteredDomains);
      setShowSuggestions(filteredDomains.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle keyboard events for domain input
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDomain();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Select a domain suggestion
  const selectSuggestion = (domain: string) => {
    setNewDomain(domain);
    setShowSuggestions(false);
  };

  // Add a domain from the top domains list
  const addFromTopDomains = (domain: string) => {
    setNewDomain(domain);
    setTimeout(() => addDomain(), 0);
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Domain Exclusion Settings</CardTitle>
        <CardDescription>
          Manage domains that should be excluded from time tracking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {message && (
            <div className={`p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}
          
          <div className="relative">
            <div className="flex space-x-2">
              <Input
                placeholder="Enter domain to exclude (e.g., example.com)"
                value={newDomain}
                onChange={handleDomainInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => newDomain.length > 1 && setShowSuggestions(domainSuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="flex-1"
              />
              <Button onClick={addDomain}>Add</Button>
            </div>
            
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                <ul>
                  {domainSuggestions.map((domain) => (
                    <li 
                      key={domain} 
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => selectSuggestion(domain)}
                    >
                      {domain}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Excluded Domains</h3>
            <ScrollArea className="h-[150px] border rounded-md p-2">
              {settings.excludedDomains.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No domains excluded</p>
              ) : (
                <ul className="space-y-2">
                  {settings.excludedDomains.map((domain) => (
                    <li key={domain} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>{domain}</span>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => removeDomain(domain)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
          
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Top Time-Consuming Domains</h3>
            <p className="text-xs text-gray-500 mb-2">Click on a domain to add it to the exclusion list</p>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {topDomains.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No domain data available</p>
              ) : (
                <ul className="space-y-2">
                  {topDomains.map((item) => (
                    <li 
                      key={item.domain} 
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-100 ${
                        settings.excludedDomains.includes(item.domain) ? 'bg-gray-200' : 'bg-gray-50'
                      }`}
                      onClick={() => !settings.excludedDomains.includes(item.domain) && addFromTopDomains(item.domain)}
                    >
                      <div>
                        <span className="font-medium">{item.domain}</span>
                        <div className="text-xs text-gray-500">
                          {item.count} page{item.count !== 1 ? 's' : ''} • {formatDuration(item.totalDuration)}
                        </div>
                      </div>
                      {settings.excludedDomains.includes(item.domain) ? (
                        <span className="text-xs text-gray-500">Excluded</span>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addFromTopDomains(item.domain);
                          }}
                        >
                          Exclude
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-2">
        <p className="text-xs text-gray-500">
          Time tracking will be disabled for these domains
        </p>
        <p className="text-xs text-gray-500">
          Excluding domains helps protect your privacy and reduces unnecessary data collection
        </p>
      </CardFooter>
    </Card>
  );
}