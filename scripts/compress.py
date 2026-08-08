#!/usr/bin/env python3
"""
Repository Compression Script
Compresses all codebase files and AI folders into a fixed zip file (overwritten on each run),
excluding build artifacts, node_modules, cache files, and zip archives.
"""

import sys
import os
import argparse
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

def format_size(bytes_val):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TB"

def is_excluded_file(filename):
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

def compress_repo(output_path, fmt="zip"):
    output_path = Path(output_path).resolve()
    print(f"📦 Starting compression for: {REPO_ROOT.name}")
    print(f"📍 Output file: {output_path.name}")
    print("--------------------------------------------------")

    included_files = []
    included_ai_folders = set()
    total_uncompressed_bytes = 0

    # Collect files to compress
    for root, dirs, files in os.walk(REPO_ROOT, topdown=True):
        rel_root = Path(root).relative_to(REPO_ROOT)
        
        # Filter directories in-place to prevent scanning excluded subtrees
        dirs_to_keep = []
        for d in dirs:
            rel_dir_path = (rel_root / d).as_posix()
            if is_excluded_dir(d, rel_dir_path):
                continue
            dirs_to_keep.append(d)
            
            # Check if this is an AI directory
            if d in KNOWN_AI_FOLDERS:
                included_ai_folders.add(rel_dir_path)
                
        dirs[:] = dirs_to_keep

        # Also check if current rel_root itself is inside an AI folder
        first_part = rel_root.parts[0] if rel_root.parts else ""
        if first_part in KNOWN_AI_FOLDERS:
            included_ai_folders.add(first_part)

        # Process files
        for f in files:
            file_path = (Path(root) / f).resolve()
            
            # Explicitly exclude the output file itself to prevent self-inclusion / recursion
            if file_path == output_path:
                continue

            if is_excluded_file(f):
                continue

            rel_file_path = file_path.relative_to(REPO_ROOT)
            file_size = file_path.stat().st_size
            
            included_files.append((file_path, rel_file_path))
            total_uncompressed_bytes += file_size

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

def main():
    parser = argparse.ArgumentParser(description="Compress repository excluding build artifacts & node_modules")
    
    parser.add_argument("-o", "--output", default=DEFAULT_ARCHIVE_NAME, help=f"Output archive filename (default: {DEFAULT_ARCHIVE_NAME})")
    parser.add_argument("-f", "--format", choices=["zip", "tar.gz"], default="zip", help="Archive format (zip or tar.gz)")
    
    args = parser.parse_args()
    
    if args.output.endswith(".tar.gz") or args.output.endswith(".tgz"):
        args.format = "tar.gz"
    
    compress_repo(args.output, fmt=args.format)

if __name__ == "__main__":
    main()
