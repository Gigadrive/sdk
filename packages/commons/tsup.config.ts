import { tsupDefaults } from '@local/tsup';

export default {
  ...tsupDefaults,
  format: ['cjs', 'esm'],
  entry: {
    index: 'src/index.ts',
    format: 'src/format.ts',
    all: 'src/all.ts',
    'deep-merge': 'src/deep-merge.ts',
    'enum-default': 'src/enum-default.ts',
    random: 'src/random.ts',
    sleep: 'src/sleep.ts',
    url: 'src/url/index.ts',
    encrypt: 'src/encrypt.ts',
    sha256: 'src/sha256.ts',
    'buffered-readable-stream': 'src/buffered-readable-stream.ts',
  },
};
