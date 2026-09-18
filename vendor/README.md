# html-to-image 1.11.13

Source: https://github.com/bubkoo/html-to-image/tree/v1.11.13
UMD distribution vendored from the npm package. MIT license alongside this file.

Two local changes to the upstream bundle:

1. `cloneCSSStyle` preserves computed font sizes exactly, instead of rounding down
   and subtracting 0.1px. A page-turn texture must match the live text.
2. After `decorate(nativeNode, clonedNode, options)`, an optional
   `options.onClone(nativeNode, clonedNode)` callback runs. `paper-turn.js` uses it
   to retain the measured reading viewport and scroll offset without changing
   the live document or altering its grid/flex layout.

Avoid `preferredFontFormat`: the upstream format-filter regular expression can
discard a sole font source across repeated rules. Fonts are local TTF files;
`getFontEmbedCSS` embeds all faces once, with no format filtering. Inline SVG
paths carry their `fill` attributes because this version does not copy computed
styles onto descendants of an SVG root.
