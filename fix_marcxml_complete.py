#!/usr/bin/env python3
"""
Fix MARCXML to be fully conformant:
1. Add missing ind1/ind2 indicators
2. Escape XML special characters (&, <, >, etc.)
"""

import re
import html

def fix_marcxml(input_file, output_file):
    """Fix MARCXML indicators and XML entity escaping."""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # First, fix XML entity escaping in subfield content
    # Find all subfield tags and escape their content
    def escape_subfield_content(match):
        opening = match.group(1)  # <subfield code="X">
        content_text = match.group(2)  # The text content
        closing = match.group(3)  # </subfield>

        # Escape XML special characters in content
        escaped_content = (content_text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))

        # But don't double-escape already escaped entities
        escaped_content = escaped_content.replace('&amp;amp;', '&amp;')
        escaped_content = escaped_content.replace('&amp;lt;', '&lt;')
        escaped_content = escaped_content.replace('&amp;gt;', '&gt;')
        escaped_content = escaped_content.replace('&amp;quot;', '&quot;')
        escaped_content = escaped_content.replace('&amp;apos;', '&apos;')

        return f"{opening}{escaped_content}{closing}"

    # Pattern to match subfield tags and their content
    subfield_pattern = r'(<subfield code="[^"]+">)(.*?)(</subfield>)'
    content = re.sub(subfield_pattern, escape_subfield_content, content, flags=re.DOTALL)

    # Now fix missing indicators
    # Pattern 1: datafield with no indicators at all
    pattern1 = r'<datafield tag="(\d{3})">'
    replacement1 = r'<datafield tag="\1" ind1=" " ind2=" ">'
    content = re.sub(pattern1, replacement1, content)

    # Pattern 2: datafield with only ind1, missing ind2
    pattern2 = r'<datafield tag="(\d{3})" ind1="(.)">'
    replacement2 = r'<datafield tag="\1" ind1="\2" ind2=" ">'
    content = re.sub(pattern2, replacement2, content)

    # Pattern 3: datafield with only ind2, missing ind1
    pattern3 = r'<datafield tag="(\d{3})" ind2="(.)">'
    replacement3 = r'<datafield tag="\1" ind1=" " ind2="\2">'
    content = re.sub(pattern3, replacement3, content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Fixed MARCXML")
    print(f"  Input:  {input_file}")
    print(f"  Output: {output_file}")

if __name__ == '__main__':
    input_file = 'chomp_compendium_35_records_v2_subjects_calls.xml'
    output_file = 'chomp_compendium_35_records_v2_subjects_calls_FIXED.xml'

    try:
        fix_marcxml(input_file, output_file)
        print("\n✓ Validating XML...")
        import subprocess
        result = subprocess.run(['xmllint', '--noout', output_file],
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✓ XML is valid!")
        else:
            print(f"⚠ XML validation warnings:\n{result.stderr}")
    except FileNotFoundError:
        print(f"Error: Could not find {input_file}")
    except Exception as e:
        print(f"Error: {e}")
