import { TableOfContents } from '@/components/ui/table-of-contents';
import type { Meta, StoryObj } from '@storybook/react';
import { Headline, Paragraph, Prose } from '../../../src/components/ui/typography';

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
      <div className="max-w-md h-screen sticky top-0">
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
      <Prose className="max-w-2xl">
        <Headline as="h1" id="introduction">
          Introduction
        </Headline>
        <Paragraph>This is the introduction section. Scroll down to see the table of contents update.</Paragraph>

        <Headline as="h2" id="getting-started">
          Getting Started
        </Headline>
        <Paragraph>Getting started with our amazing product.</Paragraph>

        <Headline as="h3" id="installation">
          Installation
        </Headline>
        <Paragraph>Installation instructions go here.</Paragraph>

        <Headline as="h3" id="configuration">
          Configuration
        </Headline>
        <Paragraph>Configuration options and settings.</Paragraph>

        <Headline as="h2" id="features">
          Features
        </Headline>
        <Paragraph>All the amazing features we offer.</Paragraph>

        <Headline as="h3" id="customization">
          Customization
        </Headline>
        <Paragraph>How to customize the product to your needs.</Paragraph>

        <Headline as="h3" id="advanced-usage">
          Advanced Usage
        </Headline>
        <Paragraph>Advanced features and usage patterns.</Paragraph>

        <Headline as="h2" id="conclusion">
          Conclusion
        </Headline>
        <Paragraph>Wrap up and next steps.</Paragraph>
      </Prose>
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
