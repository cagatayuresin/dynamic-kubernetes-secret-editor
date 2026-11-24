# Security

This editor runs entirely in the browser. Secret YAML is not uploaded and is not written to `localStorage`. The only saved preference is the color theme.

Older builds of this project stored `yamlContent` and `secretObject` in `localStorage`. Opening this version removes those keys.

## Use it carefully

- Prefer development and test secrets.
- Do not edit production secrets on a shared or untrusted computer.
- A person who can see the screen, or who can use the browser's developer tools, can read the values.
- Binary fields stay Base64. If a value is not valid UTF-8, the editor will not guess at a decoding.
- Export replaces `stringData` with Base64 `data`. Cluster fields such as `uid` and `resourceVersion` are left out of the download.

## What to do after editing

Close the tab when you are finished. Use the Reset control if you want to drop the in-memory Secret first. Private browsing is a reasonable extra step for sensitive values.
