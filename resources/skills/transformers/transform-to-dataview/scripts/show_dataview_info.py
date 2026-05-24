#!/usr/bin/env python3
"""
show_dataview_info.py — Display detailed schema info for a specific dataview.

Usage:
    python show_dataview_info.py <dataview-id>
    python show_dataview_info.py dataview-chart
    python show_dataview_info.py dataview-chart --json    # machine-readable
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional

import discover_dataviews as dd


def format_schema(schema: dict, indent: int = 2) -> str:
    """Format a JSON schema into a human-readable string."""
    lines = []

    if not schema:
        return "  (no schema defined)"

    schema_type = schema.get("type", "any")

    if "anyOf" in schema:
        lines.append(f"  Type: one of {len(schema['anyOf'])} alternatives")
        for i, sub in enumerate(schema["anyOf"]):
            lines.append(f"\n  --- Alternative {i + 1} ---")
            lines.append(format_schema(sub, indent + 2))
        return "\n".join(lines)

    if schema_type == "object":
        # Required fields
        required = schema.get("required", [])
        if required:
            lines.append(f"  Required fields: {', '.join(required)}")
        else:
            lines.append("  Required fields: (none)")

        # Properties
        props = schema.get("properties", {})
        if props:
            lines.append(f"\n  Properties:")
            for prop_name, prop_schema in props.items():
                req_mark = " (required)" if prop_name in required else ""
                prop_type = prop_schema.get("type", "any")
                if prop_type == "array":
                    items = prop_schema.get("items", {})
                    item_type = items.get("type", "any")
                    if "required" in items:
                        item_req = ", ".join(items["required"])
                        lines.append(f"    - {prop_name}: array of {item_type} [{item_req}]{req_mark}")
                    else:
                        lines.append(f"    - {prop_name}: array of {item_type}{req_mark}")
                elif prop_type == "object":
                    sub_req = prop_schema.get("required", [])
                    sub_props = prop_schema.get("properties", {})
                    sub_keys = ", ".join(sub_props.keys()) if sub_props else "(dynamic)"
                    lines.append(f"    - {prop_name}: object {{{sub_keys}}}{req_mark}")
                elif prop_type == "string":
                    enum_vals = prop_schema.get("enum", [])
                    if enum_vals:
                        lines.append(f"    - {prop_name}: string [{', '.join(enum_vals)}]{req_mark}")
                    else:
                        lines.append(f"    - {prop_name}: string{req_mark}")
                else:
                    lines.append(f"    - {prop_name}: {prop_type}{req_mark}")

        # Pattern properties
        pattern_props = schema.get("patternProperties", {})
        if pattern_props:
            lines.append(f"\n  Pattern Properties:")
            for pattern, p_schema in pattern_props.items():
                p_type = p_schema.get("type", "any")
                lines.append(f"    - /{pattern}/: {p_type}")

        # Additional constraints
        min_items = schema.get("minItems")
        if min_items is not None:
            lines.append(f"\n  Constraints: minItems={min_items}")

    return "\n".join(lines)


def print_info(view: dict, verbose: bool = False) -> None:
    """Print detailed info about a dataview."""
    print(f"\n{'='*60}")
    print(f"  {view['name']}")
    print(f"  ID: {view['id']}")
    print(f"{'='*60}")
    print(f"  Description: {view['description']}")
    print(f"  Version: {view['version']}")
    if view.get("author"):
        print(f"  Author: {view['author']}")
    print(f"  File extension: .{view['expected_ext']}")
    print(f"  Config path: {view['config_path']}")
    print(f"\n  {'─'*56}")
    print(f"  SCHEMA:")
    print(f"  {'─'*56}")
    print(format_schema(view.get("schema", {})))
    print(f"\n  {'─'*56}")
    print(f"  Example structure:")
    print(f"  {'─'*56}")
    print(format_example(view))


def format_example(view: dict) -> str:
    """Generate a minimal example JSON snippet for the dataview."""
    schema = view.get("schema", {})
    example = build_example_from_schema(schema)
    return json.dumps(example, indent=2)


def build_example_from_schema(schema: dict) -> dict:
    """Build a minimal example dict from a JSON schema."""
    if "anyOf" in schema:
        # Use the first alternative
        return build_example_from_schema(schema["anyOf"][0])

    result = {}

    # Add required fields with placeholder values
    for field in schema.get("required", []):
        props = schema.get("properties", {})
        if field in props:
            result[field] = build_example_value(props[field])
        else:
            result[field] = f"<{field}>"

    # Add optional fields with examples
    for field, prop in schema.get("properties", {}).items():
        if field not in result:
            result[field] = build_example_value(prop)

    return result


def build_example_value(prop: dict):
    """Generate a placeholder value based on property schema."""
    prop_type = prop.get("type", "string")

    if prop_type == "string":
        enum_vals = prop.get("enum", [])
        return enum_vals[0] if enum_vals else "<string>"

    if prop_type == "number":
        return 0

    if prop_type == "array":
        items = prop.get("items", {})
        item_type = items.get("type", "string")
        if item_type == "object":
            item_example = build_example_from_schema(items)
            return [item_example]
        if item_type == "string":
            return ["<string>"]
        return [0]

    if prop_type == "object":
        result = {}
        for f in prop.get("required", []):
            sub_props = prop.get("properties", {})
            if f in sub_props:
                result[f] = build_example_value(sub_props[f])
            else:
                result[f] = f"<{f}>"
        return result

    return None


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Show dataview schema info")
    parser.add_argument("dataview_id", help="Dataview ID (e.g., dataview-chart)")
    parser.add_argument("--json", action="store_true", help="Output in JSON format")
    args = parser.parse_args()

    views = dd.discover_dataviews()
    view = next((v for v in views if v["id"] == args.dataview_id), None)

    if view is None:
        # Try fuzzy match
        matches = [v for v in views if args.dataview_id in v["id"] or args.dataview_id in v["name"].lower()]
        if matches:
            print(f"Dataview '{args.dataview_id}' not found. Did you mean:")
            for m in matches:
                print(f"  {m['id']} ({m['name']})")
        else:
            print(f"Dataview '{args.dataview_id}' not found.")
            print(f"Available dataviews: {', '.join(v['id'] for v in views)}")
        sys.exit(1)

    if args.json:
        print(json.dumps(view, indent=2, ensure_ascii=False))
    else:
        print_info(view)


if __name__ == "__main__":
    main()
