import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const python = process.env.PYTHON ?? "python";

function runPython(args, options = {}) {
  return execFileSync(python, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function replaceRequired(source, file, before, after) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) {
    throw new Error(`${file} does not contain the expected patch anchor.`);
  }
  return source.replace(before, after);
}

function readFilesUnder(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readFilesUnder(path));
    } else if (entry.isFile()) {
      files.push(readFileSync(path, "utf8"));
    }
  }
  return files;
}

const packageDir = runPython([
  "-c",
  "import graphify, pathlib; print(pathlib.Path(graphify.__file__).parent)",
]);

const cacheFile = join(packageDir, "cache.py");
const detectFile = join(packageDir, "detect.py");
const extractFile = join(packageDir, "extract.py");
const watchFile = join(packageDir, "watch.py");

let cacheSource = readFileSync(cacheFile, "utf8");
cacheSource = cacheSource.replace(
  "# Stat-based index: maps absolute path \u2192 {size, mtime_ns, hash}.",
  "# Stat-based index: maps repository-relative path \u2192 {size, mtime_ns, hash}.",
);
cacheSource = replaceRequired(
  cacheSource,
  cacheFile,
  `def _stat_index_file(root: Path) -> Path:
    _out = Path(_GRAPHIFY_OUT)
    base = _out if _out.is_absolute() else Path(root).resolve() / _out
    return base / "cache" / "stat-index.json"


def _ensure_stat_index(root: Path) -> None:
`,
  `def _stat_index_file(root: Path) -> Path:
    _out = Path(_GRAPHIFY_OUT)
    base = _out if _out.is_absolute() else Path(root).resolve() / _out
    return base / "cache" / "stat-index.json"


def _portable_stat_index(index: dict[str, dict], root: Path) -> tuple[dict[str, dict], bool]:
    """Convert legacy absolute stat-index keys to repo-relative keys."""
    portable: dict[str, dict] = {}
    changed = False
    for key, value in index.items():
        next_key = key
        key_path = Path(key)
        if key_path.is_absolute():
            try:
                next_key = key_path.resolve().relative_to(root).as_posix()
                changed = True
            except ValueError:
                pass
        portable[next_key] = value
    return portable, changed


def _ensure_stat_index(root: Path) -> None:
`,
);
cacheSource = replaceRequired(
  cacheSource,
  cacheFile,
  `        try:
            _stat_index = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            _stat_index = {}
`,
  `        try:
            _stat_index, _stat_index_dirty = _portable_stat_index(
                json.loads(p.read_text(encoding="utf-8")),
                _stat_index_root,
            )
        except (json.JSONDecodeError, OSError):
            _stat_index = {}
`,
);
cacheSource = replaceRequired(
  cacheSource,
  cacheFile,
  `def file_hash(path: Path, root: Path = Path(".")) -> str:
`,
  `def _stat_key(path: Path, root: Path) -> str:
    """Return a portable stat-index key for files under the graph root."""
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def file_hash(path: Path, root: Path = Path(".")) -> str:
`,
);
cacheSource = cacheSource
  .replace("    abs_key = str(p.resolve())", "    stat_key = _stat_key(p, root)")
  .replace("        entry = _stat_index.get(abs_key)", "        entry = _stat_index.get(stat_key)")
  .replace(
    '        _stat_index[abs_key] = {"size": st.st_size, "mtime_ns": st.st_mtime_ns, "hash": digest}',
    '        _stat_index[stat_key] = {"size": st.st_size, "mtime_ns": st.st_mtime_ns, "hash": digest}',
  );
writeFileSync(cacheFile, cacheSource);

let detectSource = readFileSync(detectFile, "utf8");
detectSource = replaceRequired(
  detectSource,
  detectFile,
  `def save_manifest(
`,
  `def _manifest_root(manifest_path: str) -> Path:
    """Infer the repository root for portable manifest keys."""
    manifest = Path(manifest_path).resolve()
    if manifest.name == "manifest.json" and manifest.parent.name == "graphify-out":
        return manifest.parent.parent
    return Path.cwd().resolve()


def _manifest_key(path: str | Path, root: Path) -> str:
    """Return a repo-relative manifest key when the file is under root."""
    p = Path(path)
    try:
        return p.resolve().relative_to(root.resolve()).as_posix()
    except (OSError, ValueError):
        return p.as_posix() if not p.is_absolute() else p.resolve().as_posix()


def _manifest_disk_path(path: str | Path, root: Path) -> Path:
    """Resolve manifest keys from either legacy absolute or portable relative form."""
    p = Path(path)
    return p if p.is_absolute() else root / p


def save_manifest(
`,
);
detectSource = replaceRequired(
  detectSource,
  detectFile,
  `    existing = load_manifest(manifest_path)

    def _normalise_entry(entry):
`,
  `    existing = load_manifest(manifest_path)
    manifest_root = _manifest_root(manifest_path)

    def _normalise_entry(entry):
`,
);
detectSource = replaceRequired(
  detectSource,
  detectFile,
  `        try:
            if Path(f).exists():
                manifest[f] = normalised
        except OSError:
            continue
`,
  `        try:
            if _manifest_disk_path(f, manifest_root).exists():
                manifest[_manifest_key(f, manifest_root)] = normalised
        except OSError:
            continue
`,
);
detectSource = replaceRequired(
  detectSource,
  detectFile,
  `        for f in file_list:
            try:
                p = Path(f)
                mtime = p.stat().st_mtime
                h = _md5_file(p)
            except OSError:
                continue  # file deleted between detect() and manifest write
            prev = _normalise_entry(existing.get(f, {})) or {}
`,
  `        for f in file_list:
            key = _manifest_key(f, manifest_root)
            try:
                p = Path(f)
                mtime = p.stat().st_mtime
                h = _md5_file(p)
            except OSError:
                continue  # file deleted between detect() and manifest write
            prev = _normalise_entry(existing.get(key, existing.get(f, {}))) or {}
`,
);
detectSource = detectSource.replace("            manifest[f] = entry", "            manifest[key] = entry");
detectSource = replaceRequired(
  detectSource,
  detectFile,
  `    full = detect(root, follow_symlinks=follow_symlinks, google_workspace=google_workspace, extra_excludes=extra_excludes)
    manifest = load_manifest(manifest_path)

    if not manifest:
`,
  `    full = detect(root, follow_symlinks=follow_symlinks, google_workspace=google_workspace, extra_excludes=extra_excludes)
    root = root.resolve()
    manifest = load_manifest(manifest_path)
    portable_manifest = {
        _manifest_key(f, root): entry
        for f, entry in manifest.items()
    }

    if not portable_manifest:
`,
);
detectSource = detectSource.replace(
  "            stored = manifest.get(f)",
  "            file_key = _manifest_key(f, root)\n            stored = portable_manifest.get(file_key)",
);
detectSource = replaceRequired(
  detectSource,
  detectFile,
  `    current_files = {f for flist in full["files"].values() for f in flist}
    deleted_files = [f for f in manifest if f not in current_files]
`,
  `    current_files = {_manifest_key(f, root) for flist in full["files"].values() for f in flist}
    deleted_files = [f for f in portable_manifest if f not in current_files]
`,
);
writeFileSync(detectFile, detectSource);

let extractSource = readFileSync(extractFile, "utf8");
extractSource = extractSource.replace(
  /def _relative_to_root\(path: Path, root: Path\) -> Path:\n[\s\S]*?\n\n\ndef _file_stem\(path: Path\) -> str:\n/,
  "def _file_stem(path: Path) -> str:\n",
);
extractSource = replaceRequired(
  extractSource,
  extractFile,
  `def _file_stem(path: Path) -> str:
`,
  `def _relative_to_root(path: Path, root: Path) -> Path:
    """Return a repo-relative path when possible; otherwise preserve the input."""
    try:
        return path.resolve().relative_to(root.resolve())
    except ValueError:
        return path


def _project_root_id(root: Path) -> str:
    """Return a stable project id that does not depend on the checkout folder."""
    package_json = root / "package.json"
    if package_json.exists():
        try:
            name = json.loads(package_json.read_text(encoding="utf-8")).get("name")
            if isinstance(name, str) and name.strip():
                return _make_id(name)
        except Exception:
            pass
    return _make_id(root.name)


def _portable_extraction_result(result: dict, path: Path, root: Path) -> dict:
    """Remove machine-local absolute path fingerprints from one-file results.

    Aggregate graph construction already relativizes the final graph, but the
    per-file AST cache is written before that pass. Normalize cached payloads at
    the boundary so cache files can be committed or shared safely.
    """
    absolute_root_prefixes = {
        _make_id(str(root)),
        _make_id(str(root.absolute())),
        _make_id(str(root.resolve())),
    }
    local_project_prefixes = {
        _make_id(root.name),
    }
    portable_project_prefix = _project_root_id(root)
    rel_path = _relative_to_root(path, root).as_posix()
    old_file_id = _make_id(str(path))
    new_file_id = _make_id(rel_path)
    id_remap = {old_file_id: new_file_id} if old_file_id != new_file_id else {}

    def portable_id(value: Any) -> Any:
        if not isinstance(value, str):
            return value
        if value in id_remap:
            return id_remap[value]
        for root_prefix in absolute_root_prefixes:
            prefix = f"{root_prefix}_"
            if root_prefix and value.startswith(prefix):
                return value[len(prefix):]
        for root_prefix in local_project_prefixes:
            prefix = f"{root_prefix}_"
            if root_prefix and value == root_prefix:
                return portable_project_prefix
            if root_prefix and value.startswith(prefix):
                return f"{portable_project_prefix}_{value[len(prefix):]}"
        return value

    for item in (
        result.get("nodes", [])
        + result.get("edges", [])
        + result.get("raw_calls", [])
    ):
        sf = item.get("source_file")
        if sf:
            sf_path = Path(sf)
            if sf_path.is_absolute():
                try:
                    item["source_file"] = sf_path.resolve().relative_to(root.resolve()).as_posix()
                except ValueError:
                    pass
        for key in ("id", "source", "target", "caller_nid"):
            if key in item:
                item[key] = portable_id(item.get(key))

    return result


def _file_stem(path: Path) -> str:
`,
);
extractSource = extractSource
  .replace(
    "            return idx, cached",
    "            return idx, _portable_extraction_result(cached, path, cache_root)",
  )
  .replace(
    "    result = _safe_extract(extractor, path)",
    "    result = _portable_extraction_result(_safe_extract(extractor, path), path, cache_root)",
  )
  .replace(
    "        result = _safe_extract(extractor, path)",
    "        result = _portable_extraction_result(_safe_extract(extractor, path), path, effective_root)",
  )
  .replace(
    "                per_file[i] = cached",
    "                per_file[i] = _portable_extraction_result(cached, path, effective_root)",
  );
writeFileSync(extractFile, extractSource);

let watchSource = readFileSync(watchFile, "utf8");
watchSource = watchSource.replace(
  /def _graph_item_json_key\(item: dict\) -> str:\n[\s\S]*?\n\n\ndef _canonical_graph_for_compare\(graph_data: dict\) -> dict:\n/,
  "def _canonical_graph_for_compare(graph_data: dict) -> dict:\n",
);
watchSource = replaceRequired(
  watchSource,
  watchFile,
  `def _canonical_graph_for_compare(graph_data: dict) -> dict:
`,
  `def _graph_item_json_key(item: dict) -> str:
    return json.dumps(item, sort_keys=True, ensure_ascii=False, default=str)


def _graph_edge_order_key(item: dict) -> tuple:
    true_src = item.get("_src", item.get("source"))
    true_tgt = item.get("_tgt", item.get("target"))
    return (
        true_src,
        true_tgt,
        item.get("relation"),
        item.get("source_file"),
        item.get("source_location"),
        item.get("label"),
        _graph_item_json_key(item),
    )


def _order_graph_like_existing(candidate: dict, existing: dict) -> dict:
    """Keep graph.json reviewable by preserving existing node/link order.

    Graphify's extraction order can vary by filesystem and cache state. When a
    graph must be rewritten, keep previously-known items in their old positions
    and append genuinely new items deterministically so small source changes do
    not look like whole-graph churn in git diffs.
    """
    ordered = dict(candidate)
    existing_node_order = {
        item.get("id"): index
        for index, item in enumerate(existing.get("nodes", []))
        if isinstance(item, dict) and item.get("id") is not None
    }
    if isinstance(candidate.get("nodes"), list):
        ordered["nodes"] = sorted(
            candidate["nodes"],
            key=lambda item: (
                existing_node_order.get(item.get("id"), len(existing_node_order)),
                _graph_item_json_key(item),
            ),
        )

    for key in ("links", "edges"):
        if not isinstance(candidate.get(key), list):
            continue
        existing_edge_order = {
            _graph_edge_order_key(item): index
            for index, item in enumerate(existing.get(key, []))
            if isinstance(item, dict)
        }
        ordered[key] = sorted(
            candidate[key],
            key=lambda item: (
                existing_edge_order.get(_graph_edge_order_key(item), len(existing_edge_order)),
                _graph_edge_order_key(item),
            ),
        )

    if isinstance(candidate.get("hyperedges"), list):
        existing_hyperedge_order = {
            _graph_item_json_key(item): index
            for index, item in enumerate(existing.get("hyperedges", []))
            if isinstance(item, dict)
        }
        ordered["hyperedges"] = sorted(
            candidate["hyperedges"],
            key=lambda item: (
                existing_hyperedge_order.get(_graph_item_json_key(item), len(existing_hyperedge_order)),
                _graph_item_json_key(item),
            ),
        )
    return ordered


def _canonical_graph_for_compare(graph_data: dict) -> dict:
`,
);
watchSource = replaceRequired(
  watchSource,
  watchFile,
  `def _relativize_source_files(payload: dict, root: Path) -> None:
`,
  `def _root_marker(watch_path: Path, watch_root: Path) -> str:
    """Return a reusable scan-root marker without machine-local absolute paths."""
    if not watch_path.is_absolute():
        return watch_path.as_posix() or "."
    try:
        rel = watch_root.relative_to(Path.cwd().resolve())
        return rel.as_posix() or "."
    except ValueError:
        return "."


def _relativize_source_files(payload: dict, root: Path) -> None:
`,
);
watchSource = watchSource.replace(
  '(out / ".graphify_root").write_text(str(watch_root), encoding="utf-8")',
  '(out / ".graphify_root").write_text(_root_marker(watch_path, watch_root), encoding="utf-8")',
);
watchSource = watchSource.replace(
  `        candidate_graph_data = json.loads(graph_tmp.read_text(encoding="utf-8"))
        same_graph = False
`,
  `        candidate_graph_data = json.loads(graph_tmp.read_text(encoding="utf-8"))
        if existing_graph_data:
            candidate_graph_data = _order_graph_like_existing(candidate_graph_data, existing_graph_data)
            graph_tmp.write_text(_json_text(candidate_graph_data), encoding="utf-8")
        same_graph = False
`,
);
writeFileSync(watchFile, watchSource);

runPython(["-m", "py_compile", cacheFile, detectFile, extractFile, watchFile]);

const tempRoot = mkdtempSync(join(tmpdir(), "graphify-path-test."));
try {
  const srcDir = join(tempRoot, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    join(srcDir, "http.py"),
    [
      "from .const import NAME",
      "",
      "class Fixture:",
      "    def method(self):",
      "        return NAME",
      "",
    ].join("\n"),
  );

  runPython(
    [
      "-c",
      [
        "import json, os",
        "from pathlib import Path",
        "from graphify.detect import save_manifest",
        "from graphify.extract import extract",
        "from graphify.watch import _root_marker",
        "root = Path(os.environ['TEST_ROOT'])",
        "result = extract([root / 'src' / 'http.py'], cache_root=root, parallel=False)",
        "out = root / 'graphify-out' / 'graph.json'",
        "out.parent.mkdir(parents=True, exist_ok=True)",
        "out.write_text(json.dumps(result), encoding='utf-8')",
        "save_manifest({'code': [str(root / 'src' / 'http.py')]}, manifest_path=str(root / 'graphify-out' / 'manifest.json'), kind='ast')",
        "assert _root_marker(root, root) == '.'",
      ].join("; "),
    ],
    { env: { ...process.env, TEST_ROOT: tempRoot } },
  );

  const output = readFilesUnder(join(tempRoot, "graphify-out")).join("\n");
  const leakPattern = /\/Users\/|\/tmp|private\/var|graphify-path-test|users_|tmp_graphify|private_tmp/;
  if (leakPattern.test(output)) {
    throw new Error("Graphify path portability check found machine-local path tokens.");
  }
} catch (error) {
  throw error;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`Patched Graphify portable path handling in ${packageDir}`);
