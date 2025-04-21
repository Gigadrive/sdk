import type { Meta, StoryObj } from '@storybook/react';

import { ActionPanel, ActionPanelBody, ActionPanelFooter, ActionPanelTitle } from '@/components/ui/action-panel';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'Components/ActionPanel',
  component: ActionPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
### Action Panel Component

A versatile panel component designed for displaying important information and actions. Perfect for confirmations, warnings, or any content that requires user attention or interaction.

#### Features

- **Structured Layout**: Clear separation of title, body, and footer sections
- **Flexible Content**: Supports various content types and lengths
- **Customizable Styling**: Adaptable to different design needs
- **Responsive Design**: Works well across different screen sizes
- **Accessibility**: Built with accessibility in mind

#### Best Practices

1. **Content Organization**
   - Keep titles clear and concise
   - Use body section for detailed information
   - Place actions in the footer section
   - Maintain consistent spacing and alignment

2. **Visual Hierarchy**
   - Use clear visual separation between sections
   - Ensure important information stands out
   - Maintain consistent styling with your application

3. **Action Placement**
   - Group related actions together
   - Use appropriate button variants
   - Consider mobile layout for action buttons

#### Usage Guidelines

1. **When to Use**
   - Confirmation dialogs
   - Warning messages
   - Important notifications
   - Action confirmations
   - Information panels

2. **Implementation**
   - Import required components: \`ActionPanel\`, \`ActionPanelTitle\`, \`ActionPanelBody\`, \`ActionPanelFooter\`
   - Structure content appropriately
   - Add actions in the footer section

3. **Customization**
   - Apply custom styles through className props
   - Modify spacing and layout as needed
   - Adapt to your application's design system`,
      },
    },
  },
} satisfies Meta<typeof ActionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A basic action panel with title and description.',
      },
    },
  },
  render: () => (
    <ActionPanel className="w-full max-w-2xl">
      <ActionPanelTitle>Default Action Panel</ActionPanelTitle>
      <ActionPanelBody>This is a basic action panel with a title and description.</ActionPanelBody>
    </ActionPanel>
  ),
};

export const WithFooter: Story = {
  parameters: {
    docs: {
      description: {
        story: 'An action panel with a footer containing action buttons.',
      },
    },
  },
  render: () => (
    <ActionPanel className="w-full max-w-2xl">
      <ActionPanelTitle>Action Panel with Footer</ActionPanelTitle>
      <ActionPanelBody>This action panel includes a footer with action buttons.</ActionPanelBody>
      <ActionPanelFooter>
        <div className="flex gap-3">
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </div>
      </ActionPanelFooter>
    </ActionPanel>
  ),
};

export const WithLongContent: Story = {
  parameters: {
    docs: {
      description: {
        story: 'An action panel demonstrating how it handles longer content with multiple paragraphs.',
      },
    },
  },
  render: () => (
    <ActionPanel className="w-full max-w-2xl">
      <ActionPanelTitle>Action Panel with Long Content</ActionPanelTitle>
      <ActionPanelBody>
        <p className="mb-2">
          This action panel contains a longer description with multiple paragraphs to demonstrate how content flows
          within the component.
        </p>
        <p className="mb-2">
          Action panels are useful for displaying important information that requires user attention or action. They can
          contain various UI elements like text, buttons, and form controls.
        </p>
        <p>
          The styling ensures proper spacing and readability of the content while maintaining a consistent look and feel
          with the rest of the application.
        </p>
      </ActionPanelBody>
      <ActionPanelFooter>
        <div className="flex justify-end gap-3">
          <Button variant="outline">Cancel</Button>
          <Button>Continue</Button>
        </div>
      </ActionPanelFooter>
    </ActionPanel>
  ),
};

export const WithCustomStyling: Story = {
  parameters: {
    docs: {
      description: {
        story: "An action panel with custom styling applied to demonstrate the component's flexibility.",
      },
    },
  },
  render: () => (
    <ActionPanel className="w-full max-w-2xl border border-blue-200 dark:border-blue-800">
      <ActionPanelTitle className="text-blue-700 dark:text-blue-300">Custom Styled Panel</ActionPanelTitle>
      <ActionPanelBody className="text-blue-600 dark:text-blue-400">
        This action panel has custom styling applied to demonstrate the component's flexibility.
      </ActionPanelBody>
      <ActionPanelFooter className="flex justify-between">
        <Button variant="outline">Back</Button>
        <Button className="bg-blue-600 hover:bg-blue-700">Next</Button>
      </ActionPanelFooter>
    </ActionPanel>
  ),
};

export const MultipleActions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'An action panel for a critical action (account deletion) with multiple action options.',
      },
    },
  },
  render: () => (
    <ActionPanel className="w-full max-w-2xl">
      <ActionPanelTitle>Confirm Account Deletion</ActionPanelTitle>
      <ActionPanelBody>
        Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently
        removed.
      </ActionPanelBody>
      <ActionPanelFooter>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete Account</Button>
        </div>
      </ActionPanelFooter>
    </ActionPanel>
  ),
};
