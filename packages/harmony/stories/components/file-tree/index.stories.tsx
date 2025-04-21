import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { CollapseButton, File, Folder, Tree, type TreeViewElement } from '@/components/ui/file-tree';

const meta: Meta<typeof Tree> = {
  title: 'Components/FileTree',
  component: Tree,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The File-Tree component provides a hierarchical view of files and folders, similar to a file explorer. It supports nested structures, selection, expansion, and custom icons.

## Features
- Hierarchical file/folder structure
- Expandable/collapsible folders
- File/folder selection
- Custom icons support
- RTL support
- Keyboard navigation
- Accessibility features
- Scroll area for large trees
- Initial selection/expansion
- Collapse all functionality

## Props
- \`elements\`: TreeViewElement[] - The tree structure data
- \`initialSelectedId\`: string - Initially selected item ID
- \`initialExpandedItems\`: string[] - Initially expanded folder IDs
- \`indicator\`: boolean - Show selection indicator
- \`openIcon\`: ReactNode - Custom icon for open folders
- \`closeIcon\`: ReactNode - Custom icon for closed folders
- \`dir\`: 'rtl' | 'ltr' - Text direction

## Subcomponents
- \`Tree\`: Root component
- \`Folder\`: Folder component
- \`File\`: File component
- \`CollapseButton\`: Toggle all button
- \`TreeIndicator\`: Selection indicator

## Accessibility
- ARIA roles and attributes
- Keyboard navigation
- Focus management
- Screen reader support
- RTL support
- Color contrast
- Semantic structure

## Usage Guidelines
1. Structure data hierarchically
2. Provide unique IDs
3. Handle selection events
4. Consider mobile usage
5. Test keyboard navigation
6. Ensure proper contrast
7. Support RTL if needed
8. Handle large datasets

## Best Practices
- Keep tree depth reasonable
- Use meaningful names
- Provide visual feedback
- Handle edge cases
- Test across devices
- Consider performance
- Follow design system
- Document custom icons

## Customization
- Modify icons
- Adjust spacing
- Change colors
- Customize animations
- Modify indicators
- Adjust typography
- Change borders
- Customize hover states
`,
      },
    },
  },
  argTypes: {
    elements: {
      description: 'The tree structure data',
    },
    initialSelectedId: {
      description: 'Initially selected item ID',
    },
    initialExpandedItems: {
      description: 'Initially expanded folder IDs',
    },
    indicator: {
      description: 'Show selection indicator',
    },
    openIcon: {
      description: 'Custom icon for open folders',
    },
    closeIcon: {
      description: 'Custom icon for closed folders',
    },
    dir: {
      description: 'Text direction',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleElements: TreeViewElement[] = [
  {
    id: 'src',
    name: 'src',
    children: [
      {
        id: 'components',
        name: 'components',
        children: [
          {
            id: 'ui',
            name: 'ui',
            children: [
              {
                id: 'button.tsx',
                name: 'button.tsx',
              },
              {
                id: 'card.tsx',
                name: 'card.tsx',
              },
              {
                id: 'dialog.tsx',
                name: 'dialog.tsx',
              },
            ],
          },
          {
            id: 'layout',
            name: 'layout',
            children: [
              {
                id: 'header.tsx',
                name: 'header.tsx',
              },
              {
                id: 'footer.tsx',
                name: 'footer.tsx',
              },
            ],
          },
        ],
      },
      {
        id: 'pages',
        name: 'pages',
        children: [
          {
            id: 'index.tsx',
            name: 'index.tsx',
          },
          {
            id: 'about.tsx',
            name: 'about.tsx',
          },
        ],
      },
    ],
  },
  {
    id: 'public',
    name: 'public',
    children: [
      {
        id: 'images',
        name: 'images',
        children: [
          {
            id: 'logo.png',
            name: 'logo.png',
          },
        ],
      },
    ],
  },
];

const FileTreeDemo = () => {
  return (
    <div className="h-[400px] w-[300px] border rounded-md">
      <Tree elements={sampleElements} initialExpandedItems={['src']}>
        <Folder element="src" value="src">
          <Folder element="components" value="components">
            <Folder element="ui" value="ui">
              <File value="button.tsx">button.tsx</File>
              <File value="card.tsx">card.tsx</File>
              <File value="dialog.tsx">dialog.tsx</File>
            </Folder>
            <Folder element="layout" value="layout">
              <File value="header.tsx">header.tsx</File>
              <File value="footer.tsx">footer.tsx</File>
            </Folder>
          </Folder>
          <Folder element="pages" value="pages">
            <File value="index.tsx">index.tsx</File>
            <File value="about.tsx">about.tsx</File>
          </Folder>
        </Folder>
        <Folder element="public" value="public">
          <Folder element="images" value="images">
            <File value="logo.png">logo.png</File>
          </Folder>
        </Folder>
        <CollapseButton elements={sampleElements}>
          <Button variant="ghost" size="sm">
            Toggle All
          </Button>
        </CollapseButton>
      </Tree>
    </div>
  );
};

export const Default: Story = {
  render: () => <FileTreeDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic file tree with default styling and behavior. Demonstrates the core functionality of the component.',
      },
    },
  },
};

const FileTreeWithInitialSelection = () => {
  return (
    <div className="h-[400px] w-[300px] border rounded-md">
      <Tree elements={sampleElements} initialSelectedId="button.tsx" initialExpandedItems={['src', 'components', 'ui']}>
        <Folder element="src" value="src">
          <Folder element="components" value="components">
            <Folder element="ui" value="ui">
              <File value="button.tsx">button.tsx</File>
              <File value="card.tsx">card.tsx</File>
              <File value="dialog.tsx">dialog.tsx</File>
            </Folder>
            <Folder element="layout" value="layout">
              <File value="header.tsx">header.tsx</File>
              <File value="footer.tsx">footer.tsx</File>
            </Folder>
          </Folder>
          <Folder element="pages" value="pages">
            <File value="index.tsx">index.tsx</File>
            <File value="about.tsx">about.tsx</File>
          </Folder>
        </Folder>
        <Folder element="public" value="public">
          <Folder element="images" value="images">
            <File value="logo.png">logo.png</File>
          </Folder>
        </Folder>
      </Tree>
    </div>
  );
};

export const WithInitialSelection: Story = {
  render: () => <FileTreeWithInitialSelection />,
  parameters: {
    docs: {
      description: {
        story:
          'A file tree with pre-selected items and expanded folders. Shows how to set initial state for the component.',
      },
    },
  },
};

const FileTreeWithCustomIcons = () => {
  return (
    <div className="h-[400px] w-[300px] border rounded-md">
      <Tree elements={sampleElements} openIcon={<span>📂</span>} closeIcon={<span>📁</span>}>
        <Folder element="src" value="src">
          <Folder element="components" value="components">
            <Folder element="ui" value="ui">
              <File value="button.tsx" fileIcon={<span>📄</span>}>
                button.tsx
              </File>
              <File value="card.tsx" fileIcon={<span>📄</span>}>
                card.tsx
              </File>
              <File value="dialog.tsx" fileIcon={<span>📄</span>}>
                dialog.tsx
              </File>
            </Folder>
            <Folder element="layout" value="layout">
              <File value="header.tsx" fileIcon={<span>📄</span>}>
                header.tsx
              </File>
              <File value="footer.tsx" fileIcon={<span>📄</span>}>
                footer.tsx
              </File>
            </Folder>
          </Folder>
          <Folder element="pages" value="pages">
            <File value="index.tsx" fileIcon={<span>📄</span>}>
              index.tsx
            </File>
            <File value="about.tsx" fileIcon={<span>📄</span>}>
              about.tsx
            </File>
          </Folder>
        </Folder>
        <Folder element="public" value="public">
          <Folder element="images" value="images">
            <File value="logo.png" fileIcon={<span>🖼️</span>}>
              logo.png
            </File>
          </Folder>
        </Folder>
      </Tree>
    </div>
  );
};

export const WithCustomIcons: Story = {
  render: () => <FileTreeWithCustomIcons />,
  parameters: {
    docs: {
      description: {
        story:
          'A file tree with custom icons for files and folders. Demonstrates how to customize the visual appearance.',
      },
    },
  },
};

const FileTreeRTL = () => {
  return (
    <div className="h-[400px] w-[300px] border rounded-md">
      <Tree elements={sampleElements} dir="rtl">
        <Folder element="src" value="src">
          <Folder element="components" value="components">
            <Folder element="ui" value="ui">
              <File value="button.tsx">button.tsx</File>
              <File value="card.tsx">card.tsx</File>
              <File value="dialog.tsx">dialog.tsx</File>
            </Folder>
            <Folder element="layout" value="layout">
              <File value="header.tsx">header.tsx</File>
              <File value="footer.tsx">footer.tsx</File>
            </Folder>
          </Folder>
          <Folder element="pages" value="pages">
            <File value="index.tsx">index.tsx</File>
            <File value="about.tsx">about.tsx</File>
          </Folder>
        </Folder>
        <Folder element="public" value="public">
          <Folder element="images" value="images">
            <File value="logo.png">logo.png</File>
          </Folder>
        </Folder>
      </Tree>
    </div>
  );
};

export const RTL: Story = {
  render: () => <FileTreeRTL />,
  parameters: {
    docs: {
      description: {
        story: 'A right-to-left file tree. Shows RTL support and layout adaptation.',
      },
    },
  },
};
