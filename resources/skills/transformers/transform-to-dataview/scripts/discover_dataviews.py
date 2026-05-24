#!/usr/bin/env python3
"""
discover_dataviews.py — Scan multiple paths for dataview directories.

Scans well-known locations for dataview directories (those with 'dataview-' prefix
in their name and a valid config.json containing an 'expected_file_type.schema' field).

Usage:
    python discover_dataviews.py
    python discover_dataviews.py --paths /custom/path/to/views /another/path
    python discover_dataviews.py --json     # machine-readable JSON output
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional, Union


# Default search paths, in priority order (later paths fill in gaps)
DEFAULT_SEARCH_PATHS = [
    # Runtime views (user-installed)
    os.path.expanduser("~/.aynite/views"),
    # Source views (relative to this script's location in the repo)
    str(Path(__file__).resolve().parent.parent.parent.parent.parent / "src" / "renderer" / "views"),
    # Dist views (built version)
    str(Path(__file__).resolve().parent.parent.parent.parent.parent / "dist-views" / "views"),
]


def is_dataview_dir(dirpath: str) -> bool:
    """Check if a directory is a dataview by looking for 'dataview-' prefix."""
    name = os.path.basename(dirpath)
    return name.startswith("dataview-")


def read_config(dirpath: str) -> Optional[dict]:
    """Read and return the config.json for a dataview directory, or None."""
    config_path = os.path.join(dirpath, "config.json")
    if not os.path.isfile(config_path):
        return None
    try:
        with open(config_path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def is_dataview_config(config: dict) -> bool:
    """Check if a config dict represents a dataview (has expected_file_type.schema)."""
    return bool(config.get("expected_file_type", {}).get("schema"))


def extract_dataview_info(dirpath: str, config: dict) -> dict:
    """Extract standardized info about a dataview from its config."""
    expected = config.get("expected_file_type", {})
    name = config.get("name", os.path.basename(dirpath))
    return {
        "id": os.path.basename(dirpath),
        "name": name,
        "description": config.get("description", ""),
        "version": config.get("version", ""),
        "author": config.get("author", ""),
        "schema": expected.get("schema", {}),
        "expected_ext": expected.get("ext", "json"),
        "path": dirpath,
        "config_path": os.path.join(dirpath, "config.json"),
    }


def discover_dataviews(search_paths: Optional[list[str]] = None) -> list[dict]:
    """
    Discover all dataviews across the given search paths.

    Returns a list of dataview info dicts, deduplicated by directory name.
    Earlier paths take priority for deduplication.
    """
    if search_paths is None:
        search_paths = DEFAULT_SEARCH_PATHS

    seen = set()
    results = []

    for base_path in search_paths:
        if not os.path.isdir(base_path):
            continue

        for entry in sorted(os.listdir(base_path)):
            dirpath = os.path.join(base_path, entry)
            if not os.path.isdir(dirpath):
                continue
            if not is_dataview_dir(dirpath):
                continue
            if entry in seen:
                continue

            config = read_config(dirpath)
            if config is None or not is_dataview_config(config):
                continue

            seen.add(entry)
            results.append(extract_dataview_info(dirpath, config))

    return results


def print_dataview_table(views: list[dict]) -> None:
    """Print a human-readable table of dataviews."""
    if not views:
        print("No dataviews found.")
        return

    print(f"\nFound {len(views)} dataview(s):\n")
    print(f"{'ID':<24} {'Name':<22} {'Schema Keys':<40}")
    print("-" * 86)
    for v in views:
        schema = v["schema"]
        # Show top-level required keys from the schema
        if isinstance(schema, dict):
            if "required" in schema:
                keys = ", ".join(schema["required"])
            elif "anyOf" in schema:
                # For anyOf schemas, show alternatives
                keys = " | ".join(
                    ", ".join(sub.get("required", ["?"]))
                    for sub in schema.get("anyOf", [])
                )
            else:
                keys = "(see details)"
        else:
            keys = "(see details)"
        print(f"{v['id']:<24} {v['name']:<22} {keys:<40}")
    print()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Discover Aynite dataviews")
    parser.add_argument("--paths", nargs="*", help="Custom search paths")
    parser.add_argument("--json", action="store_true", help="Output in JSON format")
    args = parser.parse_args()

    views = discover_dataviews(args.paths if args.paths else None)

    if args.json:
        print(json.dumps(views, indent=2, ensure_ascii=False))
    else:
        print_dataview_table(views)


if __name__ == "__main__":
    main()
