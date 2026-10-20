Luma hosts these fonts locally so its interface does not depend on a separate Google Fonts connection.

- Plus Jakarta Sans: SIL Open Font License, included in `PLUS-JAKARTA-SANS-OFL.txt`.
- Material Symbols Outlined: Apache 2.0, included in `MATERIAL-SYMBOLS-LICENSE.txt`. Only the named symbols used by the application are shipped; their original variable axes are preserved.

`manifest.json` records the official source URLs, SHA-256 checksums, sizes and included icon names. Font filenames contain a content hash and can be cached immutably. The codepoint inventory comes from Google's official Material Design Icons repository.

After introducing a new icon, run `node scripts/update-fonts.mjs`, review the generated diff and run `node scripts/test-font-assets.cjs`. Updating assets needs internet access; the production build and the application do not fetch fonts from Google. Remove obsolete, unreferenced hashed font files when reviewing an update.
