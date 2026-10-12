import { build, context } from 'esbuild';

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/game.js',
  minify: !process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--watch'),
  target: 'es2020',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log('watching src/ ...');
} else {
  await build(opts);
}
