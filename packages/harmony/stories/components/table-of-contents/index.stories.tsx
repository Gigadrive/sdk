import { TableOfContents } from '@/components/ui/table-of-contents';
import type { Meta, StoryObj } from '@storybook/react';
import { Headline, List, Paragraph, Prose } from '../../../src/components/ui/typography';

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
      <div className="w-64 h-screen sticky top-4">
        <TableOfContents
          items={[
            { id: 'introduction', title: 'Introduction', level: 1 },
            { id: 'getting-started', title: 'Getting Started', level: 2 },
            { id: 'installation', title: 'Installation', level: 3 },
            { id: 'configuration', title: 'Configuration', level: 3 },
            { id: 'features', title: 'Features', level: 2 },
            { id: 'customization', title: 'Customization', level: 3 },
            { id: 'advanced-usage', title: 'Advanced Usage', level: 3 },
            { id: 'conclusion', title: 'Conclusion', level: 2 },
          ]}
        />
      </div>
      <Prose className="max-w-2xl">
        <Headline as="h1" id="introduction">
          Introduction
        </Headline>
        <Paragraph>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur.
        </Paragraph>
        <Paragraph>
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
          aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
        </Paragraph>

        <Headline as="h2" id="getting-started">
          Getting Started
        </Headline>
        <Paragraph>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni
          dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit
          amet, consectetur, adipisci velit.
        </Paragraph>

        <Headline as="h3" id="installation">
          Installation
        </Headline>
        <List>
          <li>Install the package using your preferred package manager</li>
          <li>Import the required components</li>
          <li>Configure your settings</li>
          <li>Start using the components in your application</li>
        </List>
        <Paragraph>
          Sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim
          ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea
          commodi consequatur.
        </Paragraph>
        <Paragraph>
          Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel
          illum qui dolorem eum fugiat quo voluptas nulla pariatur? At vero eos et accusamus et iusto odio dignissimos
          ducimus qui blanditiis praesentium voluptatum.
        </Paragraph>

        <Headline as="h3" id="configuration">
          Configuration
        </Headline>
        <List ordered>
          <li>Create a configuration file</li>
          <li>Set your preferences</li>
          <li>Apply the configuration</li>
          <li>Test your setup</li>
        </List>
        <Paragraph>
          Deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident,
          similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem
          rerum facilis est et expedita distinctio.
        </Paragraph>
        <Paragraph>
          Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat
          facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.
        </Paragraph>

        <Headline as="h2" id="features">
          Features
        </Headline>
        <Paragraph>
          Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates
          repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut
          reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.
        </Paragraph>

        <Headline as="h3" id="customization">
          Customization
        </Headline>
        <Paragraph>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante
          dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris.
          Fusce nec tellus sed augue semper porta. Mauris massa.
        </Paragraph>
        <Paragraph>
          Vestibulum lacinia arcu eget nulla. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per
          inceptos himenaeos. Curabitur sodales ligula in libero. Sed dignissim lacinia nunc. Curabitur tortor.
          Pellentesque nibh. Aenean quam.
        </Paragraph>
        <Headline as="h3" id="advanced-usage">
          Advanced Usage
        </Headline>
        <Paragraph>
          In scelerisque sem at dolor. Maecenas mattis. Sed convallis tristique sem. Proin ut ligula vel nunc egestas
          porttitor. Morbi lectus risus, iaculis vel, suscipit quis, luctus non, massa. Fusce ac turpis quis ligula
          lacinia aliquet. Mauris ipsum. Nulla metus metus, ullamcorper vel, tincidunt sed, euismod in, nibh. Quisque
          volutpat condimentum velit.
        </Paragraph>
        <Paragraph>
          Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nam nec ante. Sed
          lacinia, urna non tincidunt mattis, tortor neque adipiscing diam, a cursus ipsum ante quis turpis. Morbi
          lectus risus, iaculis vel, suscipit quis, luctus non, massa. Fusce ac turpis quis ligula lacinia aliquet.
        </Paragraph>
        <Paragraph>
          Mauris ipsum nulla metus metus, ullamcorper vel, tincidunt sed, euismod in, nibh. Quisque volutpat condimentum
          velit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nam nec
          ante.
        </Paragraph>

        <Headline as="h2" id="conclusion">
          Conclusion
        </Headline>
        <Paragraph>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam convallis, felis sagittis aliquam feugiat,
          lectus mi auctor libero, quis eleifend elit enim quis metus. Maecenas pellentesque mi arcu, vel facilisis
          massa mattis at. Sed eget finibus purus, eget auctor dui. Fusce a condimentum elit. In consectetur nibh eu
          magna accumsan tincidunt. Sed volutpat, risus a bibendum posuere, magna sem porta lorem, et ultrices neque
          neque nec augue. Vestibulum tempor libero tortor, in scelerisque augue bibendum ac. Quisque consectetur nulla
          ut massa consequat, id hendrerit mi tempor. Fusce consectetur dictum egestas. Suspendisse non risus maximus,
          dignissim sapien quis, placerat ante. Proin non mauris sed lectus blandit venenatis. Interdum et malesuada
          fames ac ante ipsum primis in faucibus. Pellentesque cursus risus vitae nulla scelerisque ornare. Aenean
          placerat eleifend velit eu tristique. Mauris tristique mauris fermentum dapibus posuere. Fusce posuere orci at
          quam vehicula pellentesque.
        </Paragraph>
        <Paragraph>
          Duis rutrum mi vitae magna tristique aliquam. Quisque vel suscipit turpis. Suspendisse orci nunc, hendrerit
          iaculis dui nec, finibus porta arcu. Donec viverra ultrices dolor, sed tincidunt magna sagittis id. Curabitur
          non facilisis mauris. Maecenas vestibulum et ex ac imperdiet. Nunc sit amet varius felis. Donec molestie lorem
          nec justo auctor, eu finibus elit ultrices.
        </Paragraph>
        <Paragraph>
          Integer placerat in odio non condimentum. Interdum et malesuada fames ac ante ipsum primis in faucibus.
          Praesent fermentum gravida hendrerit. Aenean condimentum, justo at efficitur gravida, urna nisi vulputate
          massa, et sodales nunc dolor sit amet metus. Sed nec aliquet neque, quis laoreet diam. Nam interdum lorem at
          elit ultricies, ac bibendum sem tempor. Maecenas ipsum quam, condimentum ut congue ac, feugiat ac justo. Duis
          ut purus suscipit, convallis tellus ut, sodales ligula. Donec pulvinar turpis at turpis vehicula luctus.
          Aliquam rhoncus, nisl scelerisque dignissim facilisis, ligula turpis venenatis dolor, sed semper neque mauris
          sit amet magna. Nulla eu luctus ex. Sed vel tempor metus.
        </Paragraph>
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
