import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface DateRangeSelectorProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onRangeChange: (startDate: Date | undefined, endDate: Date | undefined) => void;
}

type DatePreset = {
  label: string;
  getValue: () => { start: Date; end: Date };
};

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  onRangeChange,
}) => {
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  const handleStartDateSelect = (date: Date | undefined) => {
    onRangeChange(date, endDate);
    setIsStartDateOpen(false);
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    onRangeChange(startDate, date);
    setIsEndDateOpen(false);
  };

  const clearDateRange = () => {
    onRangeChange(undefined, undefined);
  };

  const today = new Date();

  const presets: DatePreset[] = [
    {
      label: 'Today',
      getValue: () => {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      },
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = subDays(today, 1);
        const start = new Date(yesterday);
        start.setHours(0, 0, 0, 0);
        const end = new Date(yesterday);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      },
    },
    {
      label: 'Last 7 days',
      getValue: () => {
        const end = new Date();
        const start = subDays(end, 6);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      },
    },
    {
      label: 'This week',
      getValue: () => {
        const start = startOfWeek(today, { weekStartsOn: 0 });
        return { start, end: today };
      },
    },
    {
      label: 'This month',
      getValue: () => {
        const start = startOfMonth(today);
        return { start, end: today };
      },
    },
    {
      label: 'Last month',
      getValue: () => {
        const start = startOfMonth(subDays(startOfMonth(today), 1));
        const end = endOfMonth(start);
        return { start, end };
      },
    },
  ];

  const applyPreset = (preset: DatePreset) => {
    const { start, end } = preset.getValue();
    onRangeChange(start, end);
    setIsPresetsOpen(false);
  };

  // Display the selected date range in a more user-friendly format
  const getDateRangeLabel = () => {
    if (startDate && endDate) {
      if (startDate.toDateString() === endDate.toDateString()) {
        return format(startDate, 'MMM d, yyyy');
      }
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={isPresetsOpen} onOpenChange={setIsPresetsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-8 px-2 text-xs"
            title="Quick date range presets"
          >
            Presets
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2 space-y-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                className="w-full justify-start text-left text-xs h-8"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center space-x-2">
        <div className="grid gap-2">
          <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[130px] justify-start text-left font-normal text-xs h-8",
                  !startDate && "text-muted-foreground"
                )}
                title="Select start date"
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {startDate ? format(startDate, 'MMM d, yyyy') : <span>Start date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                initialFocus
                disabled={(date) => endDate ? date > endDate : false}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid gap-2">
          <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[130px] justify-start text-left font-normal text-xs h-8",
                  !endDate && "text-muted-foreground"
                )}
                title="Select end date"
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {endDate ? format(endDate, 'MMM d, yyyy') : <span>End date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                initialFocus
                disabled={(date) => startDate ? date < startDate : false}
              />
            </PopoverContent>
          </Popover>
        </div>
        {(startDate || endDate) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs" 
            onClick={clearDateRange}
            title="Clear date selection"
          >
            Clear
          </Button>
        )}
      </div>
      
      {/* Display selected range summary */}
      {startDate && endDate && (
        <div className="w-full mt-1 text-xs text-muted-foreground">
          Selected: {getDateRangeLabel()}
        </div>
      )}
    </div>
  );
};