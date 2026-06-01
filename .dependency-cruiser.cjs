const { readdirSync } = require("node:fs");
const { join } = require("node:path");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listLayerPackages() {
  const packages = [];
  for (const layer of ["catalog", "runtime", "shell"]) {
    const layerPath = join(__dirname, "src/features", layer);
    for (const entry of readdirSync(layerPath, { withFileTypes: true })) {
      if (entry.isDirectory()) packages.push(`${layer}/${entry.name}`);
    }
  }

  const modesPath = join(__dirname, "src/features/modes");
  for (const entry of readdirSync(modesPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name !== "shared") {
      packages.push(`modes/${entry.name}`);
      continue;
    }
    const sharedPath = join(modesPath, "shared");
    for (const sharedEntry of readdirSync(sharedPath, { withFileTypes: true })) {
      if (sharedEntry.isDirectory()) packages.push(`modes/shared/${sharedEntry.name}`);
    }
  }

  return packages.sort();
}

const featurePackageRoots = listLayerPackages();

const crossPackagePrivateRules = featurePackageRoots.flatMap((packageRoot) => {
  const escapedPackageRoot = escapeRegExp(packageRoot);
  const packageName = packageRoot.replace(/\//g, "-");
  const outsidePackagePath = `^src/(app|shared|engine|features/(?!${escapedPackageRoot}/))`;
  const privatePackagePath = `^src/features/${escapedPackageRoot}/(components|hooks|stores|state|lib|api|encounter)/`;

  return [
    {
      name: `no-cross-package-private-imports-${packageName}`,
      severity: "error",
      comment:
        "Feature package internals are private to their owning package. Cross-package callers must use a public entrypoint.",
      from: { path: outsidePackagePath },
      to: { path: privatePackagePath },
    },
  ];
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Modules should remain acyclic so ownership and initialization order stay understandable.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "shared-must-not-import-features",
      severity: "error",
      comment: "Shared code is a lower layer and cannot depend on feature implementations.",
      from: { path: "^src/shared/" },
      to: { path: "^src/features/" },
    },
    {
      name: "shared-must-not-import-app",
      severity: "error",
      comment: "Shared code must not depend on app composition code.",
      from: { path: "^src/shared/" },
      to: { path: "^src/app/" },
    },
    {
      name: "engine-must-not-import-tauri-adapters",
      severity: "error",
      comment: "Engine code talks to capability interfaces, not concrete Tauri adapters.",
      from: { path: "^src/engine/" },
      to: { path: "^src/shared/api/" },
    },
    {
      name: "engine-must-not-import-tauri-runtime",
      severity: "error",
      comment: "Tauri runtime calls belong in shared API adapters and Rust commands.",
      from: { path: "^src/engine/" },
      to: { path: "^node_modules/@tauri-apps/api/" },
    },
    {
      name: "engine-must-not-import-react",
      severity: "error",
      comment: "Engine code is product logic and must stay UI-framework independent.",
      from: { path: "^src/engine/" },
      to: { path: "^node_modules/(react|react-dom)/" },
    },
    {
      name: "engine-must-not-import-zustand",
      severity: "error",
      comment: "Engine code must not depend on concrete UI stores.",
      from: { path: "^src/engine/" },
      to: { path: "^node_modules/zustand/" },
    },
    {
      name: "catalog-must-not-import-higher-feature-layers",
      severity: "error",
      comment:
        "Catalog packages are the resource/data layer and cannot depend on runtime systems, modes, or shell tools.",
      from: { path: "^src/features/catalog/" },
      to: { path: "^src/features/(runtime|modes|shell)/" },
    },
    {
      name: "runtime-must-not-import-higher-feature-layers",
      severity: "error",
      comment: "Runtime packages can depend on catalog resources, but not modes or shell tools.",
      from: { path: "^src/features/runtime/" },
      to: { path: "^src/features/(modes|shell)/" },
    },
    {
      name: "modes-must-not-import-shell",
      severity: "error",
      comment: "Mode packages must not depend on app shell tools.",
      from: { path: "^src/features/modes/" },
      to: { path: "^src/features/shell/" },
    },
    {
      name: "chat-mode-must-not-import-roleplay-or-game",
      severity: "error",
      comment: "Top-level modes are separate product paths.",
      from: { path: "^(src/engine/modes/chat/|src/features/modes/conversation/)" },
      to: { path: "^(src/engine/modes/(roleplay|game)/|src/features/modes/(roleplay|game)/)" },
    },
    {
      name: "roleplay-mode-must-not-import-chat-or-game",
      severity: "error",
      comment: "Top-level modes are separate product paths.",
      from: { path: "^(src/engine/modes/roleplay/|src/features/modes/roleplay/)" },
      to: { path: "^(src/engine/modes/(chat|game)/|src/features/modes/(conversation|game)/)" },
    },
    {
      name: "game-mode-must-not-import-chat-or-roleplay",
      severity: "error",
      comment: "Top-level modes are separate product paths.",
      from: { path: "^(src/engine/modes/game/|src/features/modes/game/)" },
      to: { path: "^(src/engine/modes/(chat|roleplay)/|src/features/modes/(conversation|roleplay)/)" },
    },
    {
      name: "shared-mode-ui-must-not-import-concrete-modes",
      severity: "error",
      comment:
        "Shared mode UI is a lower mode layer and cannot import concrete conversation, roleplay, or game packages.",
      from: { path: "^src/features/modes/shared/" },
      to: { path: "^src/features/modes/(conversation|roleplay|game)/" },
    },
    ...crossPackagePrivateRules,
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    exclude: {
      path: "(^dist/|^node_modules/|\\.d\\.ts$)",
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
    },
  },
};
