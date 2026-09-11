import { readFile } from 'node:fs/promises';

const fontCssUrl = new URL('../dist/font.css', import.meta.url);
const fontCss = await readFile(fontCssUrl, 'utf8');

if (/\blocal\s*\(/iu.test(fontCss)) {
  throw new Error('dist/font.css must not contain local() font sources');
}
