export default {
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    format: 'esm',
    bundle: true,
    minify: true,
    target: ['es2017'],
};