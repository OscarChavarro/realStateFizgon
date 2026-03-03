const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function findPackageRoot(fromFile) {
  let currentDir = fromFile ? path.dirname(fromFile) : process.cwd();

  while (true) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return process.cwd();
    }
    currentDir = parentDir;
  }
}

function registerSrcAlias(mode) {
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
    if (typeof request === 'string' && request.startsWith('src/')) {
      const packageRoot = findPackageRoot(parent && parent.filename ? parent.filename : undefined);
      const suffix = request.slice(4);
      const targetBaseDir = mode === 'dev' ? path.join(packageRoot, 'src') : path.join(packageRoot, 'dist');
      const mappedRequest = path.join(targetBaseDir, suffix);
      return originalResolveFilename.call(this, mappedRequest, parent, isMain, options);
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}

module.exports = {
  registerSrcAlias
};
