import type { Meta, StoryObj } from '@storybook/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const meta: Meta<typeof Collapsible> = {
  title: 'Components/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A collapsible component built on top of Radix UI's Collapsible primitive, providing a way to show and hide content with smooth animations.

## Features
- Smooth expand/collapse animations
- Controlled and uncontrolled modes
- Keyboard navigation
- Accessible by default
- Customizable styling
- Support for nested collapsibles
- Icon integration
- Dark mode compatible

## Subcomponents
- \`Collapsible\`: The root container component
- \`CollapsibleTrigger\`: The button that toggles the collapsible content
- \`CollapsibleContent\`: The content that is shown/hidden

## Accessibility
- WAI-ARIA compliant collapsible pattern
- Keyboard navigation (Enter/Space to toggle)
- Focus management
- Proper ARIA states
- Screen reader announcements
- Focus visible indicators

## Usage Guidelines
- Use for expandable sections
- Use for FAQs
- Use for nested navigation
- Use for accordions
- Use for content that can be hidden
- Consider mobile interactions
- Maintain consistent behavior

## Best Practices
- Provide clear toggle indicators
- Use appropriate icons
- Consider default open state
- Maintain consistent styling
- Use appropriate spacing
- Consider content length
- Provide visual feedback
- Consider mobile touch targets

## Props
- \`open\`: Controlled open state
- \`defaultOpen\`: Default open state
- \`onOpenChange\`: Change handler
- \`className\`: Additional CSS classes

## Customization
- Custom animations
- Custom triggers
- Custom content styling
- Icon customization
- Spacing adjustments
- Border styles
- Background colors
- Typography
`,
      },
    },
  },
  argTypes: {
    open: {
      description: 'The controlled open state of the collapsible',
      control: 'boolean',
    },
    defaultOpen: {
      description: 'The default open state when uncontrolled',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Callback when the open state changes',
      control: 'function',
    },
    className: {
      description: 'Additional CSS classes to apply to the collapsible',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const CollapsibleDemo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-[350px] space-y-2">
      <div className="flex items-center justify-between space-x-4 px-4">
        <h4 className="text-sm font-medium">What is a Collapsible component?</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-2 px-4">
        <div className="rounded-md border px-4 py-3 text-sm">
          The Collapsible component allows you to create expandable sections of content. It's useful for FAQs, nested
          navigation, or any UI that requires showing and hiding content.
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const Default: Story = {
  render: () => <CollapsibleDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Basic collapsible with a toggle button and content.',
      },
    },
  },
};

const MultipleCollapsibleDemo = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    item1: false,
    item2: false,
  });

  const toggleItem = (item: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  return (
    <div className="space-y-4 w-[350px]">
      <Collapsible open={openItems.item1} onOpenChange={() => toggleItem('item1')} className="space-y-2">
        <div className="flex items-center justify-between space-x-4 px-4">
          <h4 className="text-sm font-medium">First Section</h4>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              {openItems.item1 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-2 px-4">
          <div className="rounded-md border px-4 py-3 text-sm">
            This is the content for the first collapsible section.
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openItems.item2} onOpenChange={() => toggleItem('item2')} className="space-y-2">
        <div className="flex items-center justify-between space-x-4 px-4">
          <h4 className="text-sm font-medium">Second Section</h4>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              {openItems.item2 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-2 px-4">
          <div className="rounded-md border px-4 py-3 text-sm">
            This is the content for the second collapsible section.
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export const MultipleCollapsibles: Story = {
  render: () => <MultipleCollapsibleDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Multiple collapsible sections with independent state management.',
      },
    },
  },
};

const NestedCollapsibleDemo = () => {
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);

  return (
    <Collapsible open={parentOpen} onOpenChange={setParentOpen} className="w-[350px] space-y-2">
      <div className="flex items-center justify-between space-x-4 px-4">
        <h4 className="text-sm font-medium">Parent Collapsible</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-9 p-0">
            {parentOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-4 px-4">
        <div className="rounded-md border px-4 py-3 text-sm">This is the parent collapsible content.</div>

        <Collapsible open={childOpen} onOpenChange={setChildOpen} className="space-y-2 ml-4">
          <div className="flex items-center justify-between space-x-4 px-4">
            <h5 className="text-sm font-medium">Nested Collapsible</h5>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {childOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-2 px-4">
            <div className="rounded-md border px-4 py-3 text-sm">This is the nested collapsible content.</div>
          </CollapsibleContent>
        </Collapsible>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const Nested: Story = {
  render: () => <NestedCollapsibleDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Nested collapsibles demonstrating hierarchical content structure.',
      },
    },
  },
};
