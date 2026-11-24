# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version in `package.json` is the source of truth.

## [1.0.0] - 2026-11-24

### Added

- Browser-local Kubernetes Secret editor for decoding, editing, and exporting YAML
- UTF-8 safe Base64 handling, multiline values, and read-only binary fields
- `stringData` import that merges into canonical `data` on export
- Add, rename, and remove keys, with type hints for common Secret types
- Light and dark responsive layout
- Vitest coverage gate and GitHub Actions for lint, test, build, audit, CodeQL, Pages, and tagged releases
