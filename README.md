# Dynamic Kubernetes Secret Editor

A browser editor for Kubernetes Secrets. Paste or drop a Secret YAML, edit the decoded values, and copy or download the result. Nothing is uploaded. The published site is a static build; the Vite dev server is only for local work.

**Version 1.0.0**

## Features

- File upload, drag and drop, paste, and a built-in example
- UTF-8 Base64 decode and encode, including multiline values
- `stringData` is merged on import; export writes canonical `data`
- Values that are not valid UTF-8 stay read-only Base64
- Add, rename, and remove keys
- Name, namespace, and Secret type, with a hint when a known type is missing its usual keys
- Light and dark theme, responsive layout, and a live YAML preview
- Theme preference only is stored. Secret contents are not

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` writes a static site to `dist/`. You can open `dist/index.html` or run `npm run preview` to check that build. GitHub Pages serves the same `dist/` output. It does not run a Node server.

```bash
npm test
npm run lint
```

Tests fail when line, branch, function, or statement coverage drops below 80%.

The sample manifest is [`test-secret.yaml`](test-secret.yaml). The editor can also load it from **Load example**.

## Usage

1. Drop a Secret YAML, choose a file, paste one, or load the example.
2. Process the draft. Ctrl+Enter and Cmd+Enter do the same thing.
3. Edit decoded values. Masked fields can be shown per key.
4. Copy the preview or download `name-YYYY-MM-DD.yaml`.

On a narrow screen the preview stacks under the editor. On a wide screen it stays beside it.

## Versioning

This repository starts at 1.0.0. Update `package.json` and add a matching section to [CHANGELOG.md](CHANGELOG.md).

A GitHub Release is not published automatically. The release workflow stays manual until the Sonar review is finished. After that, tagging `v1.0.0` can publish the release again.

## Deployment

GitHub Actions builds `dist/` and deploys it to GitHub Pages from `main`. In the repository settings, set Pages to **GitHub Actions**. That deploy is separate from a versioned GitHub Release.

Other workflows lint, test, build, run `npm audit` at high severity, and analyze the code with CodeQL.

## Security

Read [SECURITY.md](SECURITY.md) before using real credentials. The safe default is a development Secret, on a machine you trust.

## License

[MIT](LICENSE) © Cagatay URESIN

- GitHub: [cagatayuresin](https://github.com/cagatayuresin)
- LinkedIn: [Cagatay URESIN](https://www.linkedin.com/in/cagatayuresin/)
- Site: [cagatayuresin.com](https://cagatayuresin.com)
