import inject from '@rollup/plugin-inject';
import vue from '@vitejs/plugin-vue2';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
const engine = resolve(root, '../engine');
const localization = resolve(root, 'src/localization');
const require = createRequire(import.meta.url);
const browserAssert = require.resolve('assert/');

// These are external only for a UMD library build. Rollup cannot split UMD chunks,
// so each locale is emitted as a small native ES module and imported lazily by the
// classic-script entry. App and test builds use Vite's ordinary JSON transforms.
const locales = readdirSync(localization)
    .filter((file) => file.endsWith('.json') && file !== 'en.json')
    .map((file) => file.slice(0, -'.json'.length));
const localePath = (locale: string) => resolve(localization, `${locale}.json`);
const localeForId = (id: string) => locales.find((locale) => id.split('?')[0] === localePath(locale));

export default defineConfig(({ mode }) => {
    const library = mode === 'library' || mode === 'library-readable';
    const minify = mode !== 'library-readable';
    const suffix = minify ? '.min' : '';

    return {
        plugins: [
            vue(),
            {
                ...inject({ process: 'process/browser', include: /node_modules\/.*\.js(?:\?.*)?$/ }),
                apply: 'build',
                enforce: 'post',
            },
            {
                name: 'container-locale-sidecars',
                apply: 'build',
                renderDynamicImport({ targetModuleId }) {
                    if (!library || !targetModuleId || !localeForId(targetModuleId)) return;
                    // Classic scripts loaded across origins cannot resolve relative import().
                    return { left: 'import(new URL(', right: ', __containerViewerUrl).href)' };
                },
                generateBundle() {
                    if (!library) return;
                    for (const locale of locales) {
                        // JSON modules already have a default export. Keeping the original
                        // bytes avoids escaping differences in non-Latin catalogues.
                        this.emitFile({
                            type: 'asset',
                            fileName: `container-viewer.umd${suffix}.locale-${locale}.js`,
                            source: `export default ${readFileSync(localePath(locale), 'utf8')};`,
                        });
                    }
                },
            },
        ],
        resolve: {
            alias: [
                { find: /^@\/(.*)/, replacement: `${resolve(root, 'src')}/$1` },
                // Compile the workspace engine source, not its separately built CommonJS
                // output. Subpaths need their own rule so they remain source imports too.
                { find: /^container-engine$/, replacement: resolve(engine, 'index.ts') },
                { find: /^container-engine\/(.*)/, replacement: `${engine}/$1` },
                // Vite externalizes Node's assert by default. The real browser package
                // preserves engine assertions without changing engine source.
                { find: /^assert$/, replacement: browserAssert },
            ],
        },
        define: {
            ...(library ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {}),
            // The local demo retains its old opt-in environment variable.
            'process.env.VUE_APP_loadGame': JSON.stringify(process.env.VUE_APP_loadGame) ?? 'undefined',
        },
        server: {
            host: '0.0.0.0',
            port: 8080,
        },
        build: {
            outDir: 'dist',
            emptyOutDir: mode !== 'library-readable',
            copyPublicDir: !library,
            sourcemap: false,
            assetsInlineLimit: 10 * 1024 * 1024,
            minify,
            cssMinify: true,
            lib: library
                ? {
                      entry: resolve(root, 'src/wrapper.ts'),
                      name: 'container-viewer',
                      formats: ['umd'],
                      cssFileName: 'container-viewer',
                      fileName: () => `container-viewer.umd${suffix}.js`,
                  }
                : undefined,
            rollupOptions: {
                external: library ? (id) => id === 'vue' || localeForId(id) !== undefined : undefined,
                output: library
                    ? {
                          exports: 'named',
                          intro: 'const __containerViewerUrl = typeof document !== "undefined" ? (document.currentScript?.src || document.baseURI) : "";',
                          globals: { vue: 'Vue' },
                          paths: (id) => {
                              const locale = localeForId(id);
                              return locale ? `./container-viewer.umd${suffix}.locale-${locale}.js` : id;
                          },
                      }
                    : undefined,
            },
        },
        test: {
            environment: 'jsdom',
            globals: true,
            include: ['tests/unit/**/*.spec.ts'],
            setupFiles: ['tests/unit/setup.ts'],
            restoreMocks: true,
        },
    };
});
