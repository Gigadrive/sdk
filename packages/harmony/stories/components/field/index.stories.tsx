import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const meta = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Label + control + hint/error composite for the top-label form pattern. Input/Textarea render their own label when given a `label` prop; use Field to wrap controls that do not (Select, custom widgets).',
      },
    },
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Project name',
    htmlFor: 'project-name',
    hint: 'Used in your deployment URLs.',
  },
  render: (args) => (
    <div className="w-80">
      <Field {...args}>
        <Input id="project-name" placeholder="my-project" />
      </Field>
    </div>
  ),
};

export const WithError: Story = {
  args: {
    label: 'Email',
    htmlFor: 'email',
    error: 'Please enter a valid email address.',
    required: true,
  },
  render: (args) => (
    <div className="w-80">
      <Field {...args}>
        <Input id="email" defaultValue="not-an-email" />
      </Field>
    </div>
  ),
};

export const WrappingSelect: Story = {
  args: {
    label: 'Region',
    hint: 'Where your application runs.',
  },
  render: (args) => (
    <div className="w-80">
      <Field {...args}>
        <Select defaultValue="eu-central">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eu-central">eu-central (Frankfurt)</SelectItem>
            <SelectItem value="us-east">us-east (Virginia)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  ),
};
