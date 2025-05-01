import type { Meta, StoryObj } from '@storybook/react';

import { CodeBlock, Headline, List, Paragraph, Prose } from '@/components/ui/typography';

const meta: Meta<typeof Headline> = {
  title: 'Components/Typography',
  component: Headline,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A collection of typography components for consistent text styling across your application.

## Components
- **Headline**: For section headings (h1-h6)
- **Paragraph**: For body text with optional lead styling
- **List**: For ordered and unordered lists
- **CodeBlock**: For displaying code snippets
- **Prose**: For rich text content with consistent styling

## Features
- Consistent text hierarchy
- Responsive font sizes
- Dark mode support
- Customizable via className
- Semantic HTML elements
- Accessible by default

## Usage Guidelines
- Use appropriate heading levels for document structure
- Apply lead paragraphs sparingly for emphasis
- Maintain consistent spacing with lists
- Use code blocks for technical content
- Leverage prose for formatted content

## Accessibility
- Proper heading hierarchy
- Semantic HTML structure
- Sufficient color contrast
- Readable font sizes
- Proper list markup
`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Headlines: Story = {
  render: () => (
    <div className="space-y-4">
      <Headline as="h1">Heading 1</Headline>
      <Headline as="h2">Heading 2</Headline>
      <Headline as="h3">Heading 3</Headline>
      <Headline as="h4">Heading 4</Headline>
      <Headline as="h5">Heading 5</Headline>
      <Headline as="h6">Heading 6</Headline>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different heading levels with consistent styling.',
      },
    },
  },
};

export const Paragraphs: Story = {
  render: () => (
    <div className="space-y-4">
      <Paragraph lead>
        This is a lead paragraph that stands out with larger text. Use it for introductory text or important messages.
      </Paragraph>
      <Paragraph>
        This is a regular paragraph with standard text size. It's perfect for body content and general information. The
        text maintains good readability and proper line height.
      </Paragraph>
      <Paragraph>
        Multiple paragraphs can be used to structure your content into logical sections. This helps improve readability
        and content organization.
      </Paragraph>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Paragraphs with lead and regular styling options.',
      },
    },
  },
};

export const Lists: Story = {
  render: () => (
    <div className="space-y-6">
      <List>
        <li>Unordered list item one</li>
        <li>Unordered list item two</li>
        <li>Unordered list item three</li>
      </List>
      <List ordered>
        <li>Ordered list item one</li>
        <li>Ordered list item two</li>
        <li>Ordered list item three</li>
      </List>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Ordered and unordered lists with consistent styling.',
      },
    },
  },
};

export const Code: Story = {
  render: () => (
    <CodeBlock>
      {`function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');`}
    </CodeBlock>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Code block for displaying formatted code snippets.',
      },
    },
  },
};

export const ProseContent: Story = {
  render: () => (
    <Prose>
      <h1>Article Title</h1>
      <p>
        This is an example of rich text content styled with the Prose component. It provides consistent typography for
        articles, blog posts, and other formatted content.
      </p>
      <h2>Section Heading</h2>
      <p>
        The Prose component handles various HTML elements like paragraphs, headings, lists, and more with proper spacing
        and styling.
      </p>
      <ul>
        <li>Consistent typography</li>
        <li>Proper spacing</li>
        <li>Dark mode support</li>
      </ul>
      <h3>Subsection</h3>
      <p>You can nest different elements and maintain a consistent look throughout your content.</p>
      <pre>
        <code>{'// Example code block within prose'}</code>
      </pre>
    </Prose>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Rich text content with consistent styling using the Prose component.',
      },
    },
  },
};
