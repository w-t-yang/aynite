#!/usr/bin/env python3
"""
validate_schema.py — Validate a JSON file against a dataview's schema.

Usage:
    python validate_schema.py <dataview-id> <json-file>
    python validate_schema.py dataview-chart my_data.json
    python validate_schema.py dataview-graph graph.json --verbose
"""

import json
import os
import sys
from typing import Any, Optional

import discover_dataviews as dd


def validate_value(value: Any, schema: dict, path: str = "$") -> list[str]:
    """
    Validate a Python value against a JSON schema fragment.
    Returns a list of error messages (empty = valid).
    """
    errors = []

    if not schema:
        return errors  # No schema to validate against

    schema_type = schema.get("type")

    # Handle anyOf: value must match at least one alternative
    if "anyOf" in schema:
        alt_results = []
        for alt in schema["anyOf"]:
            alt_errors = validate_value(value, alt, path)
            alt_results.append(alt_errors)
        # Value is valid if ANY alternative passes
        if all(len(alt_errs) > 0 for alt_errs in alt_results):
            # None passed — show the best attempt
            best = min(alt_results, key=len)
            errors.extend(best)
        return errors

    # Type check
    if schema_type and not type_matches(value, schema_type):
        errors.append(f"{path}: expected type '{schema_type}', got '{type(value).__name__}'")
        return errors  # Stop checking if type is wrong

    # Object validation
    if schema_type == "object" and isinstance(value, dict):
        # Check required fields
        required = schema.get("required", [])
        for field in required:
            if field not in value:
                errors.append(f"{path}: missing required field '{field}'")

        # Check properties
        props = schema.get("properties", {})
        for field, prop_schema in props.items():
            if field in value:
                field_errors = validate_value(value[field], prop_schema, f"{path}.{field}")
                errors.extend(field_errors)

        # Check pattern properties
        pattern_props = schema.get("patternProperties", {})
        if pattern_props and isinstance(value, dict):
            import re
            for key in value:
                for pattern, p_schema in pattern_props.items():
                    if re.match(pattern, key):
                        p_errors = validate_value(value[key], p_schema, f"{path}.{key}")
                        errors.extend(p_errors)

        # Check minItems
        min_items = schema.get("minItems")
        if min_items is not None and isinstance(value, (list, str)):
            if len(value) < min_items:
                errors.append(f"{path}: requires at least {min_items} item(s), found {len(value)}")

    # Array validation
    elif schema_type == "array" and isinstance(value, list):
        items_schema = schema.get("items", {})
        if items_schema:
            for i, item in enumerate(value):
                item_errors = validate_value(item, items_schema, f"{path}[{i}]")
                errors.extend(item_errors)

        min_items = schema.get("minItems")
        if min_items is not None and len(value) < min_items:
            errors.append(f"{path}: requires at least {min_items} item(s), found {len(value)}")

    # String validation
    elif schema_type == "string" and isinstance(value, str):
        enum_vals = schema.get("enum", [])
        if enum_vals and value not in enum_vals:
            options = ", ".join(enum_vals)
            errors.append(f"{path}: '{value}' is not valid. Allowed: [{options}]")

    return errors


def type_matches(value: Any, expected_type: str) -> bool:
    """Check if a Python value matches a JSON Schema type."""
    type_map = {
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
        "array": list,
        "object": dict,
        "null": type(None),
    }
    py_type = type_map.get(expected_type)
    if py_type is None:
        return True  # Unknown type, skip
    return isinstance(value, py_type)


def validate_file(dataview_id: str, json_path: str) -> list[str]:
    """Validate a JSON file against a dataview's schema."""
    # Find the dataview
    views = dd.discover_dataviews()
    view = next((v for v in views if v["id"] == dataview_id), None)
    if view is None:
        return [f"Unknown dataview: '{dataview_id}'"]

    # Read the JSON file
    try:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"Invalid JSON: {e}"]
    except OSError as e:
        return [f"Cannot read file: {e}"]

    # Validate against schema
    schema = view.get("schema", {})
    if not schema:
        return [f"No schema defined for dataview '{view['name']}'"]

    return validate_value(data, schema)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Validate JSON against dataview schema")
    parser.add_argument("dataview_id", help="Dataview ID (e.g., dataview-chart)")
    parser.add_argument("json_file", help="Path to JSON file to validate")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all errors")
    args = parser.parse_args()

    errors = validate_file(args.dataview_id, args.json_file)

    if not errors:
        print(f"✅ Valid: '{args.json_file}' matches the '{args.dataview_id}' schema.")
        sys.exit(0)
    else:
        print(f"❌ Validation failed for '{args.json_file}' against '{args.dataview_id}':")
        print()
        for err in errors:
            print(f"   • {err}")
        print()
        sys.exit(1)


if __name__ == "__main__":
    main()
