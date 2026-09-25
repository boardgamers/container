import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import ts from 'typescript';
const root = new URL('../src/', import.meta.url);
const runtime = await readFile(new URL('localization/runtime.js', root), 'utf8');
const journal = await readFile(new URL('journal-pieces.ts', root), 'utf8');
const marks = await readFile(new URL('color-blind.ts', root), 'utf8');
const js = ts.transpileModule(marks.replace(/^import .*$/gm, '') + journal.replace(/^import .*$/gm, ''), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
}).outputText;
const catalogs = Object.fromEntries(
    await Promise.all(
        ['en', 'fr', 'hi', 'ko', 'nl'].map(async (locale) => [
            locale,
            JSON.parse(await readFile(new URL(`localization/${locale}.json`, root), 'utf8')),
        ])
    )
);
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.setContent('<div id="app"></div>');
    const result = await page.evaluate(
        async ({ runtime, js, catalogs }) => {
            const { mountLocalization } = await import(
                'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(runtime)))
            );
            const { journalPieces } = await import(
                'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(js)))
            );
            const node = document.getElementById('app');
            const name = '<span style="background-color: blue">Build</span>';
            const other = '<span style="background-color: red">Fish</span>';
            const piece = '<span style="border:1px solid black">orange</span> container';
            const source = `${name} buys a ${piece} from ${other} for $3, new price is $5`;
            node.innerHTML = journalPieces(source, true);
            const l = mountLocalization(node, catalogs, 'fr');
            const results = {};
            for (const lang of ['fr', 'hi', 'ko', 'nl', 'en', 'hi']) {
                l.setLocale(lang);
                await new Promise((resolve) => setTimeout(resolve, 10));
                results[lang] = {
                    text: node.textContent,
                    icons: node.querySelectorAll('svg[role="img"]').length,
                    names: [...node.querySelectorAll('[style*="background-color"]')].map((el) => el.textContent),
                };
            }
            node.innerHTML = journalPieces(`${name} buys a warehouse for $4`);
            l.setLocale('fr');
            await new Promise((resolve) => setTimeout(resolve, 10));
            results.warehouse = { text: node.textContent, icons: node.querySelectorAll('svg[role="img"]').length };
            node.innerHTML = journalPieces(`The bank seizes a ${piece} from ${name}'s factory`);
            l.setLocale('ko');
            await new Promise((resolve) => setTimeout(resolve, 10));
            results.seizure = { text: node.textContent, icons: node.querySelectorAll('svg[role="img"]').length };
            l.destroy();
            return results;
        },
        { runtime, js, catalogs }
    );
    assert.match(result.fr.text, /achète.*à Fish pour 3 \$, puis fixe le prix à 5 \$/);
    assert.match(result.hi.text, /Build ने Fish से 3 \$ में.*खरीदा; नई कीमत: 5 \$/);
    assert.match(result.ko.text, /Build: Fish에게서 \$3에.*구매, 새 가격 \$5/);
    assert.match(result.nl.text, /Build koopt.*van Fish voor \$3; nieuwe prijs: \$5/);
    assert.match(result.warehouse.text, /Build achète.*pour 4 \$/);
    assert.equal(result.warehouse.icons, 1);
    assert.match(result.seizure.text, /은행이 Build의 공장에서.*압류/);
    assert.equal(result.seizure.icons, 1);
    for (const item of ['fr', 'hi', 'ko', 'nl', 'en'].map((lang) => result[lang])) {
        assert.equal(item.icons, 1);
        assert.deepEqual(item.names, ['Build', 'Fish']);
        assert.doesNotMatch(item.text, /⟪|\{p\d/);
    }
    console.log(
        'Journal translations preserve pictograms and names, reorder Hindi/Korean, and survive locale switching.'
    );
} finally {
    await browser.close();
}
