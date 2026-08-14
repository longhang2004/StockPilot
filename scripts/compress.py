#!/usr/bin/env python3
"""
Repository Compression Script
Compresses all codebase files and AI folders into a fixed zip file (overwritten on each run),
excluding build artifacts, node_modules, cache files, environment files, and existing archives.
"""

import sys
import os
import argparse
import tempfile
import zipfile
import tarfile
import fnmatch
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ARCHIVE_NAME = "stockpilot_backup.zip"

EXCLUDED_FOLDERS = {
    "node_modules",
    ".pnpm-store",
    ".git",
    ".next",
    "dist",
    "build",
    "out",
    "coverage",
    ".turbo",
    ".cache",
    ".worktrees",
    "test-results",
    "playwright-report",
}

EXCLUDED_RELATIVE_PATHS = {
    "apps/api/src/generated",
}

EXCLUDED_FILE_PATTERNS = [
    ".DS_Store",
    "Thumbs.db",
    "*.log",
    "npm-debug.log*",
    "pnpm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    "*.zip",
    "*.tar.gz",
    "*.tgz",
    "*.rar",
    "*.7z",
    "*.tsbuildinfo",
]

# Environment files hold secrets and are git-ignored; they must never reach
# an archive. `.env.example` is the documented, secret-free template and is
# deliberately kept.
ENV_FILE_EXCEPTIONS = {".env.example"}


def is_env_file(filename):
    """True for `.env` and `.env.*` files, except the `.env.example` template."""
    if filename in ENV_FILE_EXCEPTIONS:
        return False
    return filename == ".env" or filename.startswith(".env.")


def is_excluded_file(filename):
    if is_env_file(filename):
        return True
    for pattern in EXCLUDED_FILE_PATTERNS:
        if fnmatch.fnmatch(filename.lower(), pattern.lower()):
            return True
    return False


def is_excluded_dir(dir_name, rel_path_str):
    if dir_name in EXCLUDED_FOLDERS:
        return True
    if rel_path_str in EXCLUDED_RELATIVE_PATHS:
        return True
    return False


def collect_files(repo_root, output_path):
    """Walk `repo_root` and return [(absolute_path, relative_path)] to archive."""
    repo_root = Path(repo_root).resolve()
    output_path = Path(output_path).resolve()
    included_files = []

    for root, dirs, files in os.walk(repo_root, topdown=True):
        rel_root = Path(root).relative_to(repo_root)

        # Filter directories in-place to prevent scanning excluded subtrees
        dirs_to_keep = []
        for d in dirs:
            rel_dir_path = (rel_root / d).as_posix()
            if is_excluded_dir(d, rel_dir_path):
                continue
            dirs_to_keep.append(d)
        dirs[:] = dirs_to_keep

        for f in files:
            file_path = (Path(root) / f).resolve()

            # Explicitly exclude the output file itself to prevent self-inclusion / recursion
            if file_path == output_path:
                continue

            if is_excluded_file(f):
                continue

            rel_file_path = file_path.relative_to(repo_root)
            included_files.append((file_path, rel_file_path))

    return included_files


def format_size(bytes_val):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TB"


def compress_repo(output_path, fmt="zip"):
    output_path = Path(output_path).resolve()
    print(f"📦 Starting compression for: {REPO_ROOT.name}")
    print(f"📍 Output file: {output_path.name}")
    print("--------------------------------------------------")

    included_files = collect_files(REPO_ROOT, output_path)
    included_ai_folders = set()
    total_uncompressed_bytes = 0

    for rel_p in (rel_p for _, rel_p in included_files):
        first_part = rel_p.parts[0] if rel_p.parts else ""
        if first_part in KNOWN_AI_FOLDERS:
            included_ai_folders.add(first_part)
        total_uncompressed_bytes += (Path(REPO_ROOT) / rel_p).stat().st_size

    # Create archive (overwriting existing file cleanly)
    if fmt == "zip":
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
            for full_p, rel_p in included_files:
                zipf.write(full_p, arcname=str(rel_p))
    elif fmt == "tar.gz":
        with tarfile.open(output_path, "w:gz") as tarf:
            for full_p, rel_p in included_files:
                tarf.add(full_p, arcname=str(rel_p))
    else:
        raise ValueError(f"Unsupported format: {fmt}")

    compressed_bytes = output_path.stat().st_size
    ratio = (1 - (compressed_bytes / total_uncompressed_bytes)) * 100 if total_uncompressed_bytes > 0 else 0

    print("✅ Compression complete!")
    print("--------------------------------------------------")
    print(f"📊 Summary:")
    print(f"   • Total files archived : {len(included_files):,}")
    print(f"   • Uncompressed size    : {format_size(total_uncompressed_bytes)}")
    print(f"   • Compressed size      : {format_size(compressed_bytes)}")
    print(f"   • Space saved          : {ratio:.1f}%")
    print()
    print("🤖 AI Folders Included:")
    if included_ai_folders:
        for ai_folder in sorted(included_ai_folders):
            print(f"   • {ai_folder}/")
    else:
        print("   (None found)")

    print()
    print("🚫 Folders Excluded:")
    for ex_folder in sorted(EXCLUDED_FOLDERS):
        print(f"   • {ex_folder}/")

    print("--------------------------------------------------")
    print(f"🎉 Archive updated at: {output_path.name}")


def self_test():
    """Lightweight automated verification of the archive safety rules.

    Builds a temporary fixture tree, archives it with the same collect/write
    code paths, and asserts that environment files and archives are excluded
    while `.env.example` and ordinary files are included. Exits non-zero on
    any violation so CI can run `python3 scripts/compress.py --self-test`.
    """
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src").mkdir()
        fixtures = {
            "src/app.ts": "export {};\n",
            ".env": "DATABASE_URL=secret\n",
            ".env.production": "DATABASE_URL=secret-prod\n",
            "apps/.env.local": "TOKEN=secret-local\n",
            ".env.example": "DATABASE_URL=\n",
            "archive.zip": "not a real zip",
            "notes.txt": "hello\n",
        }
        for rel, content in fixtures.items():
            path = root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

        output = root / "backup.zip"
        included = collect_files(root, output)
        names = {str(rel_p) for _, rel_p in included}

        check(
            ".env" not in names and ".env.production" not in names and "apps/.env.local" not in names,
            f"environment files leaked into the archive: {sorted(names & {'.env', '.env.production', 'apps/.env.local'})}",
        )
        check(".env.example" in names, ".env.example was excluded but must be included")
        check("archive.zip" not in names, "existing archives must never be included")
        check("src/app.ts" in names and "notes.txt" in names, "ordinary files must be included")

        # Round-trip through the real write path (zip) and confirm the same set.
        compress_repo(output, fmt="zip")
        with zipfile.ZipFile(output) as zipf:
            archived = set(zipf.namelist())
        check(
            not (archived & {".env", ".env.production", "apps/.env.local"}),
            f"environment files present in written archive: {archived & {'.env', '.env.production', 'apps/.env.local'}}",
        )
        check(".env.example" in archived, ".env.example missing from written archive")

    if failures:
        print("❌ Self-test FAILED:")
        for message in failures:
            print(f"   - {message}")
        return 1
    print("✅ Self-test passed: env files excluded, .env.example and ordinary files included, archives excluded.")
    return 0


KNOWN_AI_FOLDERS = {
    ".agents",
    ".claude",
    ".cursor",
    ".codegraph",
    ".reasonix",
    "skills",
    ".gemini",
    ".antigravity",
}


def main():
    parser = argparse.ArgumentParser(description="Compress repository excluding build artifacts & node_modules")
    parser.add_argument("--self-test", action="store_true", help="Run the archive-safety self-test and exit")
    parser.add_argument("-o", "--output", default=DEFAULT_ARCHIVE_NAME, help=f"Output archive filename (default: {DEFAULT_ARCHIVE_NAME})")
    parser.add_argument("-f", "--format", choices=["zip", "tar.gz"], default="zip", help="Archive format (zip or tar.gz)")

    args = parser.parse_args()

    if args.self_test:
        sys.exit(self_test())

    if args.output.endswith(".tar.gz") or args.output.endswith(".tgz"):
        args.format = "tar.gz"

    compress_repo(args.output, fmt=args.format)


if __name__ == "__main__":
    main()
