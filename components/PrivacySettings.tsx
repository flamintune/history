import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { loadData, saveData, STORAGE_KEYS, autoCleanupPageViewData } from '@/lib/storage-manager';
import { UserSettings } from '@/lib/types';
import { browser } from 'wxt/browser';
import { Switch } from './ui/switch';
import { Shield, Eye, EyeOff, Clock, Calendar, Database } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

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

export function PrivacySettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const userSettings = await loadData<UserSettings>(
          STORAGE_KEYS.userSettings,
          DEFAULT_USER_SETTINGS
        );
        setSettings(userSettings);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setMessage({ text: 'Failed to load settings', type: 'error' });
        setIsLoading(false);
      }
    };

    loadSettings();
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
      
      // Notify all tabs about the updated settings
      browser.runtime.sendMessage({
        type: 'settings_updated',
        data: { settings: updatedSettings }
      }).catch(error => {
        console.error('Error notifying about settings update:', error);
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ text: 'Failed to save settings', type: 'error' });
    }
  };

  // Toggle tracking enable/disable
  const toggleTracking = async () => {
    const updatedSettings = {
      ...settings,
      trackPageViewDuration: !settings.trackPageViewDuration
    };
    
    await saveSettings(updatedSettings);
  };

  // Toggle incognito mode handling
  const toggleIncognitoExclusion = async () => {
    const updatedSettings = {
      ...settings,
      excludeIncognito: !settings.excludeIncognito
    };
    
    await saveSettings(updatedSettings);
  };

  // Toggle pause on inactivity
  const togglePauseOnInactivity = async () => {
    const updatedSettings = {
      ...settings,
      pauseOnInactivity: !settings.pauseOnInactivity
    };
    
    await saveSettings(updatedSettings);
  };

  // Update inactivity threshold
  const updateInactivityThreshold = async (minutes: number) => {
    const updatedSettings = {
      ...settings,
      inactivityThresholdMinutes: minutes
    };
    
    await saveSettings(updatedSettings);
  };
  
  // Update data retention period
  const updateRetentionPeriod = async (days: number) => {
    const updatedSettings = {
      ...settings,
      pageViewStorageDays: days
    };
    
    await saveSettings(updatedSettings);
    
    // Apply the retention period by running cleanup
    try {
      await autoCleanupPageViewData(days);
      setMessage({ text: `Data retention period set to ${days} days`, type: 'success' });
    } catch (error) {
      console.error('Error applying retention period:', error);
      setMessage({ text: 'Failed to apply data retention period', type: 'error' });
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="h-5 w-5 mr-2 text-blue-500" />
          Privacy Settings
        </CardTitle>
        <CardDescription>
          Control how your browsing data is collected and managed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {message && (
            <div className={`p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}
          
          {/* Tracking toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center">
                {settings.trackPageViewDuration ? (
                  <Eye className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <EyeOff className="h-4 w-4 mr-2 text-red-500" />
                )}
                <span className="text-sm font-medium">Page View Tracking</span>
              </div>
              <p className="text-xs text-gray-500">
                {settings.trackPageViewDuration 
                  ? "Tracking is enabled - time spent on pages will be recorded" 
                  : "Tracking is disabled - no browsing data will be collected"}
              </p>
            </div>
            <Switch 
              checked={settings.trackPageViewDuration} 
              onCheckedChange={toggleTracking}
            />
          </div>
          
          {/* Incognito mode handling */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">Exclude Incognito Browsing</span>
              <p className="text-xs text-gray-500">
                When enabled, pages visited in incognito mode will not be tracked
              </p>
            </div>
            <Switch 
              checked={settings.excludeIncognito} 
              onCheckedChange={toggleIncognitoExclusion}
            />
          </div>
          
          {/* Inactivity settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-blue-500" />
              <span className="text-sm font-medium">Inactivity Settings</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm">Pause tracking during inactivity</span>
                <p className="text-xs text-gray-500">
                  Stop counting time when you're not actively using the page
                </p>
              </div>
              <Switch 
                checked={settings.pauseOnInactivity} 
                onCheckedChange={togglePauseOnInactivity}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Inactivity threshold</span>
                <span className="text-sm font-medium">{settings.inactivityThresholdMinutes} minutes</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => updateInactivityThreshold(Math.max(1, settings.inactivityThresholdMinutes - 1))}
                  disabled={settings.inactivityThresholdMinutes <= 1}
                >
                  -
                </Button>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${(settings.inactivityThresholdMinutes / 15) * 100}%` }}
                  ></div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => updateInactivityThreshold(Math.min(15, settings.inactivityThresholdMinutes + 1))}
                  disabled={settings.inactivityThresholdMinutes >= 15}
                >
                  +
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Time without activity before tracking is paused (1-15 minutes)
              </p>
            </div>
          </div>
          
          {/* Data retention settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center">
              <Database className="h-4 w-4 mr-2 text-blue-500" />
              <span className="text-sm font-medium">Data Retention Settings</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Automatic data cleanup</span>
                <span className="text-sm font-medium">{settings.pageViewStorageDays} days</span>
              </div>
              <div className="flex items-center space-x-2">
                <Select
                  value={settings.pageViewStorageDays.toString()}
                  onValueChange={(value) => updateRetentionPeriod(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select retention period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">365 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                Browsing data older than this will be automatically deleted
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-2">
        <p className="text-xs text-gray-500">
          All data is stored locally on your device and is never sent to external servers
        </p>
      </CardFooter>
    </Card>
  );
}