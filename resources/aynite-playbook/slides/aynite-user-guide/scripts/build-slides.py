"""Build reveal.js slide deck from template and individual slide snippets."""

import os
import sys
import re

def build_slides(template_path, slides_dir, output_path):
    # Read template
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    
    # Read all slide snippets in order
    slide_files = sorted(
        [f for f in os.listdir(slides_dir) if f.endswith('.html')],
        key=lambda x: int(re.search(r'(\d+)', x).group(1)) if re.search(r'(\d+)', x) else 0
    )
    
    slides_html = []
    for sf in slide_files:
        with open(os.path.join(slides_dir, sf), 'r', encoding='utf-8') as f:
            slides_html.append(f.read())
    
    # Assemble
    result = template.replace('<!-- SLIDES_PLACEHOLDER -->', '\n'.join(slides_html), 1)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f"✅ Built {output_path} from {len(slide_files)} slides")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python scripts/build-slides.py <template> <slides-dir> <output>")
        sys.exit(1)
    build_slides(sys.argv[1], sys.argv[2], sys.argv[3])
