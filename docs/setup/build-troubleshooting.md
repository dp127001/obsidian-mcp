# Build Troubleshooting & Setup Guide

## Overview

This document covers build system setup, common build issues, and their resolutions for the enhanced-obsidian-mcp project.

## Build System Architecture

The project uses a **Node.js/TypeScript** build system with the following components:

- **TypeScript Compiler (tsc)**: Compiles TypeScript source to JavaScript
- **ES2020 Modules**: Modern module system for Node.js compatibility
- **Source Maps**: Generated for debugging support
- **Automatic Permissions**: Sets executable permissions on built files

## Current Build Configuration

### Package.json Scripts
```json
{
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('build/main.js', '755')\"",
    "start": "node build/main.js",
    "dev": "tsx src/main.ts",
    "prepublishOnly": "npm run build",
    "inspect": "npx @modelcontextprotocol/inspector node ./build/main.js"
  }
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "build",
    "rootDir": "src",
    "sourceMap": true,
    "allowJs": true,
    "declaration": false,
    "resolveJsonModule": true
  }
}
```

## Build Process

### Standard Build
```bash
npm run build
```

**What happens:**
1. TypeScript compiler (`tsc`) transpiles all source files from `src/` to `build/`
2. ES2020 modules are generated for Node.js compatibility
3. Source maps are created for debugging
4. File permissions are set on the main executable

### Development Build
```bash
npm run dev
```
- Uses `tsx` for direct TypeScript execution without compilation
- Faster iteration during development
- No build artifacts generated

## Common Build Issues & Solutions

### Issue 1: 'bun' is not recognized ❌

**Problem:**
```
'bun' is not recognized as an internal or external command
```

**Root Cause:** Previous build system required Bun runtime which wasn't installed.

**✅ RESOLVED:** Build system converted to standard Node.js/TypeScript toolchain.

**Current Solution:** Project now uses `tsc` (TypeScript compiler) instead of Bun.

### Issue 2: TypeScript Compilation Errors

**Problem:**
```
error TS2307: Cannot find module '@modelcontextprotocol/sdk'
```

**Solution:**
```bash
npm install
npm run build
```

**Prevention:** Ensure all dependencies are installed before building.

### Issue 3: Permission Errors on Unix Systems

**Problem:**
```
Permission denied: build/main.js
```

**Solution:** Build script automatically sets executable permissions:
```javascript
require('fs').chmodSync('build/main.js', '755')
```

### Issue 4: Module Resolution Issues

**Problem:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot resolve module
```

**Solution:** Verified ES2020 module configuration in tsconfig.json:
- `"module": "ES2020"`
- `"moduleResolution": "node"`
- `"esModuleInterop": true`

## Build Verification Steps

### 1. Verify Dependencies
```bash
npm list
```

### 2. Clean Build
```bash
rm -rf build node_modules
npm install
npm run build
```

### 3. Test Executable
```bash
node build/main.js --help
```

### 4. Verify Build Output Structure
```
build/
├── main.js              # Main executable
├── main.js.map          # Source map
├── server.js            # Server implementation
├── server.js.map        # Source map
├── types.js             # Type definitions
├── resources/           # Resource handlers
├── tools/               # Tool implementations
└── utils/               # Utility functions
```

## Development Workflow

### Initial Setup
```bash
git clone <repository-url>
cd enhanced-obsidian-mcp
npm install
npm run build
```

### Development Cycle
```bash
# Make changes to src/
npm run dev              # Test changes directly
npm run build            # Build for distribution
npm start               # Test built version
```

### Quality Assurance
```bash
npm run build           # Verify build succeeds
npm test               # Run test suite (if available)
node build/main.js --help  # Verify executable works
```

## Build System Migration History

### v1.0.6 - Current (June 2025)
- **Build System:** Node.js/TypeScript with tsc
- **Target:** ES2020 modules
- **Dependencies:** Standard npm packages
- **Status:** ✅ Fully functional

### Previous - Deprecated
- **Build System:** Bun-based compilation
- **Issues:** Required Bun runtime installation
- **Status:** ❌ Replaced due to dependency issues

## Troubleshooting Commands

### Check Build Environment
```bash
node --version          # Should be >= 16
npm --version          # Check npm installation
tsc --version          # Check TypeScript compiler
```

### Clean Rebuild
```bash
rm -rf build
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

### Debug Build Issues
```bash
tsc --noEmit           # Check for TypeScript errors
npm run build --verbose # Verbose build output
```

### Verify Runtime
```bash
node build/main.js /path/to/test/vault  # Test with actual vault
```

## Support

If build issues persist:

1. Check Node.js version compatibility (>= 16)
2. Verify all dependencies are installed
3. Review TypeScript compilation errors
4. Check file permissions on build directory
5. Validate vault path configuration

## Related Documentation

- [Setup Guide](./setup-guide.md) - Complete installation instructions
- [API Documentation](../api/) - Tool and server API reference
- [Tool Examples](../tool-examples.md) - Usage examples
