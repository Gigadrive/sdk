import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { type SelectRangeEventHandler } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { addDays, format } from 'date-fns';

const meta = {
  title: 'Components/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A flexible calendar component built on top of react-day-picker with a beautiful design and extensive functionality.

## Features
- Multiple selection modes (single date, date range)
- Customizable styling
- Disabled dates support
- Outside days display
- Custom navigation icons
- Footer customization
- Responsive design
- Dark mode support
- Keyboard navigation
- Localization support

## Accessibility
- Full keyboard navigation
- ARIA labels for dates and controls
- Screen reader friendly
- Focus management
- Clear visual indicators
- High contrast states
- Semantic HTML structure

## Usage Guidelines
- Use for date selection interfaces
- Use for scheduling and booking systems
- Use for event calendars
- Use for date range selection
- Use when precise date input is needed

## Best Practices
- Provide clear date format examples
- Show selected dates clearly
- Disable invalid dates
- Consider date ranges carefully
- Use appropriate date constraints
- Provide clear feedback
- Consider mobile interactions
- Include helper text when needed

## Props
- \`mode\`: Selection mode ('single' | 'range' | 'multiple')
- \`selected\`: Selected date(s)
- \`onSelect\`: Selection handler
- \`disabled\`: Disabled dates configuration
- \`showOutsideDays\`: Whether to show days from previous/next months
- \`className\`: Additional CSS classes
- \`classNames\`: Custom class names for subcomponents
- \`footer\`: Custom footer content

## Customization
- Custom navigation icons
- Custom day rendering
- Custom header format
- Custom footer content
- Style overrides
- Class name customization
- Date formatting
`,
      },
    },
  },
  argTypes: {
    mode: {
      description: 'The selection mode of the calendar',
      control: 'select',
      options: ['single', 'range', 'multiple'],
      table: {
        defaultValue: { summary: 'single' },
      },
    },
    selected: {
      description: 'The selected date(s)',
      control: 'object',
    },
    onSelect: {
      description: 'Callback when date selection changes',
      control: 'function',
    },
    disabled: {
      description: 'Configuration for disabled dates',
      control: 'object',
    },
    showOutsideDays: {
      description: 'Whether to show days from previous/next months',
      control: 'boolean',
      table: {
        defaultValue: { summary: true },
      },
    },
    className: {
      description: 'Additional CSS classes to apply to the calendar',
      control: 'text',
    },
    footer: {
      description: 'Custom footer content',
      control: 'text',
    },
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Calendar />,
  parameters: {
    docs: {
      description: {
        story: 'Basic calendar with default configuration.',
      },
    },
  },
};

const CalendarWithSelectedDate = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return (
    <div className="flex flex-col items-center gap-4">
      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
      <p className="text-sm">Selected date: {date ? format(date, 'PPP') : 'None'}</p>
    </div>
  );
};

export const WithSelectedDate: Story = {
  render: () => <CalendarWithSelectedDate />,
  parameters: {
    docs: {
      description: {
        story: 'Calendar with single date selection and display of the selected date.',
      },
    },
  },
};

const CalendarWithDateRange = () => {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  const handleSelect: SelectRangeEventHandler = (range) => {
    setDateRange({ from: range?.from, to: range?.to });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Calendar mode="range" selected={dateRange} onSelect={handleSelect} className="rounded-md border" />
      <div className="text-sm">
        <p>From: {dateRange.from ? format(dateRange.from, 'PPP') : 'None'}</p>
        <p>To: {dateRange.to ? format(dateRange.to, 'PPP') : 'None'}</p>
      </div>
    </div>
  );
};

export const DateRange: Story = {
  render: () => <CalendarWithDateRange />,
  parameters: {
    docs: {
      description: {
        story: 'Calendar configured for date range selection with start and end date display.',
      },
    },
  },
};

const CalendarWithDisabledDates = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Disable weekends and past dates
  const disabledDays = [
    { before: new Date() },
    { dayOfWeek: [0, 6] }, // Sunday and Saturday
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        disabled={disabledDays}
        className="rounded-md border"
      />
      <p className="text-sm">Selected date: {date ? format(date, 'PPP') : 'None'}</p>
      <p className="text-xs text-muted-foreground">Weekends and past dates are disabled</p>
    </div>
  );
};

export const WithDisabledDates: Story = {
  render: () => <CalendarWithDisabledDates />,
  parameters: {
    docs: {
      description: {
        story: 'Calendar with disabled dates (weekends and past dates) to demonstrate date constraints.',
      },
    },
  },
};

const CalendarWithFooter = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
        footer={
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDate(addDays(new Date(), 7))}>
              Next Week
            </Button>
          </div>
        }
      />
    </div>
  );
};

export const WithFooter: Story = {
  render: () => <CalendarWithFooter />,
  parameters: {
    docs: {
      description: {
        story: 'Calendar with custom footer buttons for quick date selection.',
      },
    },
  },
};
