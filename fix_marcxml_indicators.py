#!/usr/bin/env python3
"""
Fix MARCXML indicators to conform to MARC21 standard.
All <datafield> tags must have both ind1 and ind2 attributes.
"""

import re
import sys

def fix_marcxml_indicators(input_file, output_file):
    """Fix missing indicators in MARCXML datafield tags."""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern 1: datafield with no indicators at all
    # Example: <datafield tag="300">
    pattern1 = r'<datafield tag="(\d{3})">'
    replacement1 = r'<datafield tag="\1" ind1=" " ind2=" ">'
    content = re.sub(pattern1, replacement1, content)

    # Pattern 2: datafield with only ind1, missing ind2
    # Example: <datafield tag="100" ind1="1">
    pattern2 = r'<datafield tag="(\d{3})" ind1="(.)">'
    replacement2 = r'<datafield tag="\1" ind1="\2" ind2=" ">'
    content = re.sub(pattern2, replacement2, content)

    # Pattern 3: datafield with only ind2, missing ind1 (unlikely but cover it)
    # Example: <datafield tag="100" ind2="1">
    pattern3 = r'<datafield tag="(\d{3})" ind2="(.)">'
    replacement3 = r'<datafield tag="\1" ind1=" " ind2="\2">'
    content = re.sub(pattern3, replacement3, content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Fixed MARCXML indicators")
    print(f"  Input:  {input_file}")
    print(f"  Output: {output_file}")

    # Count fixes
    fixes = content.count('ind1=" " ind2=" "')
    print(f"  Fixed {fixes} datafield tags")

if __name__ == '__main__':
    input_file = 'chomp_compendium_35_records_v2_subjects_calls.xml'
    output_file = 'chomp_compendium_35_records_v2_subjects_calls_FIXED.xml'

    try:
        fix_marcxml_indicators(input_file, output_file)
    except FileNotFoundError:
        print(f"Error: Could not find {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
