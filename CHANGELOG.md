# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2025-06-23

### Fixed

- **Build System Migration**: Replaced Bun-based build system with standard Node.js/TypeScript toolchain
  - Resolves `'bun' is not recognized` error on systems without Bun installed
  - Build script now uses `tsc` (TypeScript compiler) instead of Bun
  - Maintains all functionality while improving compatibility
  - Added automatic executable permissions setting for cross-platform support

### Added

- Comprehensive build troubleshooting documentation in `docs/setup/build-troubleshooting.md`
- Enhanced README with build system information and troubleshooting steps
- Build verification steps and development workflow documentation

### Changed

- Package.json build script: `bun build` → `tsc && node -e "require('fs').chmodSync('build/main.js', '755')"`
- TypeScript configuration optimized for Node.js ES2020 modules
- Updated development documentation with new build commands

### Technical Details

- **Build Target**: ES2020 modules for Node.js compatibility
- **Dependencies**: Standard npm packages (no Bun requirement)
- **Output**: Build directory with source maps and proper permissions
- **Compatibility**: Node.js >= 16 (broader compatibility than Bun requirement)

## [1.0.5] - Previous Release

- Initial Bun-based implementation
- Core MCP server functionality
- Multi-vault support
- Complete tool set for Obsidian interaction
