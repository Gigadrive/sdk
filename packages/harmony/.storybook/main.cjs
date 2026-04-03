const path = require('node:path');

/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ['../stories/Introduction.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)', '../stories/**/*.mdx'],

  addons: [
    '@storybook/addon-links',
    '@storybook/addon-themes',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  docs: {},

  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

module.exports = config;
