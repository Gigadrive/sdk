import { TableOfContents } from '@/components/ui/table-of-contents';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof TableOfContents> = {
  title: 'Components/Table of Contents',
  component: TableOfContents,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A table of contents component that automatically tracks the current section as you scroll through the document.

## Features
- Automatic section tracking
- Smooth animations
- Active section indicator
- Nested section support
- Customizable styling
- Accessible navigation

## Usage
Use this component to provide easy navigation for long-form content like documentation, articles, or tutorials.
`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex gap-8">
      <div className="max-w-md h-screen sticky top-0 pt-8">
        <TableOfContents
          items={[
            { id: 'introduction', title: 'Introduction', level: 1 },
            { id: 'getting-started', title: 'Getting Started', level: 1 },
            { id: 'installation', title: 'Installation', level: 2 },
            { id: 'configuration', title: 'Configuration', level: 2 },
            { id: 'features', title: 'Features', level: 1 },
            { id: 'customization', title: 'Customization', level: 2 },
            { id: 'advanced-usage', title: 'Advanced Usage', level: 2 },
            { id: 'conclusion', title: 'Conclusion', level: 1 },
          ]}
        />
      </div>
      <div className="prose max-w-2xl">
        <h1 id="introduction">Introduction</h1>
        <p>This is the introduction section. Scroll down to see the table of contents update.</p>

        <h1 id="getting-started">Getting Started</h1>
        <p>Getting started with our amazing product.</p>

        <h2 id="installation">Installation</h2>
        <p>Installation instructions go here.</p>

        <h2 id="configuration">Configuration</h2>
        <p>Configuration options and settings.</p>

        <h1 id="features">Features</h1>
        <p>All the amazing features we offer.</p>

        <h2 id="customization">Customization</h2>
        <p>How to customize the product to your needs.</p>

        <h2 id="advanced-usage">Advanced Usage</h2>
        <p>Advanced features and usage patterns.</p>

        <h1 id="conclusion">Conclusion</h1>
        <p>Wrap up and next steps.</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Basic example showing the table of contents with nested sections and active tracking.',
      },
    },
  },
};
