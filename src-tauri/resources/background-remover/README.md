Bundled background remover runtime placeholder.

Packaged builds can place a prepared `backgroundremover` executable or portable Python
runtime here without relying on system Python or PATH. Marinara checks these layouts
before env vars, the app data `.venv`, and PATH:

- `windows-x64/backgroundremover.exe`
- `windows/backgroundremover.exe`
- `linux-x64/backgroundremover`
- `linux/backgroundremover`
- `macos-arm64/backgroundremover`
- `macos/backgroundremover`
- `common/backgroundremover`

Portable Python runtimes can use the same layout with `python`/`python.exe`; Marinara
will run it as `python -m backgroundremover.cmd.cli`.
