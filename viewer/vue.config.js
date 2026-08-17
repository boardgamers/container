// The production deploy uploads ONLY dist/container-viewer.umd.min.js and
// dist/container-viewer.css — nothing else from dist/ is served. Any asset emitted
// as a separate file (dist/img/*.svg icons, dist/media/*.mp3 audio) would 404, so
// every static asset must be inlined into the bundles as a data URI.
const INLINE_ASSETS_LIMIT = 10 * 1024 * 1024;

module.exports = {
    devServer: {
        // For gitpod, it needs to be disabled
        disableHostCheck: true,
    },
    chainWebpack: (config) => {
        // vue-cli's svg rule uses plain file-loader (always emits files); replace it
        // with url-loader so the icons are inlined. Reuse the url-loader already
        // resolved for the images rule (it is not hoisted to our node_modules).
        const urlLoader = config.module.rule('images').use('url-loader').get('loader');
        config.module.rule('svg').uses.clear();
        config.module.rule('svg').use('url-loader').loader(urlLoader).options({ limit: INLINE_ASSETS_LIMIT });

        // Raise the inline threshold so audio (and any raster images) inline too
        // instead of falling back to file-loader above 4 KiB.
        for (const ruleName of ['images', 'media']) {
            config.module
                .rule(ruleName)
                .use('url-loader')
                .tap((options) => ({ ...options, limit: INLINE_ASSETS_LIMIT }));
        }
    },
};
