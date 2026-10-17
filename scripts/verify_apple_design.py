#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path

AASM_001 = "AASM-001 (Materials & Depth)"
MOTION_002 = "MOTION-002 (Gesture Springs & Physics)"
TYPO_003 = "TYPO-003 (Typography & Optical Tracking)"
MOTION_004 = "MOTION-004 (Motion Economy & Latency)"

def scan_codebase(root_dir):
    violations = {
        AASM_001: [],
        MOTION_002: [],
        TYPO_003: [],
        MOTION_004: []
    }

    target_dirs = [root_dir]
    if root_dir in ["src", "src/", "src\\"] and os.path.exists("app"):
        target_dirs.append("app")

    files = []
    seen_files = set()
    for tdir in target_dirs:
        for p in Path(tdir).rglob("*"):
            if p.is_file() and p.suffix in [".tsx", ".ts", ".css", ".jsx", ".js"]:
                if any(part in p.parts for part in ["node_modules", ".next", ".git", "dist", ".agent", ".agents"]):
                    continue
                canonical = p.resolve()
                if canonical not in seen_files:
                    seen_files.add(canonical)
                    files.append(p)

    has_reduced_transparency = False
    has_reduced_motion = False

    for file_path in files:
        rel_path = file_path.as_posix()
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        lines = content.splitlines()

        if "prefers-reduced-transparency" in content:
            has_reduced_transparency = True
        if "prefers-reduced-motion" in content:
            has_reduced_motion = True

        for idx, line in enumerate(lines, start=1):
            # AASM-001 checks
            # Ghost card: border + shadow-card / shadow-raised / shadow-* on container cards
            if ("border" in line and "shadow-" in line and ("rounded-md" in line or "rounded-lg" in line or "rounded" in line)):
                if not any(k in line for k in ["tokens.css", "check-", "test"]) and "button.tsx" not in rel_path:
                    violations[AASM_001].append({
                        "file": rel_path,
                        "line": idx,
                        "rule": "AASM-001-GHOST-CARD",
                        "code": line.strip(),
                        "desc": "Ghost Card detected: Simultaneous 1px border and box-shadow elevation"
                    })

            # Card-level backdrop-filter / glassmorphism (allowed on chrome: modal/dialog overlays and navigation rails)
            if ("backdrop-blur" in line or "backdrop-filter" in line) and "none" not in line:
                if not any(chrome in rel_path for chrome in ["modal", "rail", "header", "dialog", "globals.css"]):
                    violations[AASM_001].append({
                        "file": rel_path,
                        "line": idx,
                        "rule": "AASM-001-GLASSMORPHISM",
                        "code": line.strip(),
                        "desc": "Card-level glassmorphism/blur decoration on non-chrome surface"
                    })

            # Missing backdrop-blur on sticky chrome
            if "sticky" in line and ("header" in line or "rail" in line or "nav" in line):
                if "backdrop" not in line and "backdrop" not in content:
                    violations[AASM_001].append({
                        "file": rel_path,
                        "line": idx,
                        "rule": "AASM-001-OPAQUE-CHROME",
                        "code": line.strip(),
                        "desc": "Sticky navigation rail is opaque solid background instead of translucent material with backdrop-filter"
                    })

            # Check floating blur halos (box-shadow without offset or 0-offset glow)
            if re.search(r"rgba?\([^)]+\)\s*0\s*0\s*\d+px", line) or re.search(r"0\s+0\s+\d+px\s+rgba?", line):
                violations[AASM_001].append({
                    "file": rel_path,
                    "line": idx,
                    "rule": "AASM-001-BLUR-HALO",
                    "code": line.strip(),
                    "desc": "Zero-offset colored glow halo detected"
                })

            # MOTION-002 checks
            # CSS duration transitions on gestures / interactive components (carousel, dialog)
            if re.search(r"transition-(transform|all|opacity).*(duration-fast|duration-base|duration-slow|\d+ms)", line):
                if any(comp in rel_path for comp in ["carousel", "dialog"]):
                    violations[MOTION_002].append({
                        "file": rel_path,
                        "line": idx,
                        "rule": "MOTION-002-FIXED-CSS-DURATION",
                        "code": line.strip(),
                        "desc": "Fixed CSS transition duration used instead of interruptible spring physics"
                    })

            # Carousel transform transition with CSS duration
            if "translateX(" in line and "style=" in line and "carousel" in rel_path:
                violations[MOTION_002].append({
                    "file": rel_path,
                    "line": idx,
                    "rule": "MOTION-002-DISCRETE-TRANSFORM",
                    "code": line.strip(),
                    "desc": "Carousel slide translation driven by discrete CSS translateX instead of 1:1 pointer gesture tracking with spring physics"
                })

            # Dialog transition with fixed CSS duration
            if ("DialogContent" in content or "dialog" in rel_path) and "duration-slow" in line:
                violations[MOTION_002].append({
                    "file": rel_path,
                    "line": idx,
                    "rule": "MOTION-002-MODAL-TRANSITION-LOCKOUT",
                    "code": line.strip(),
                    "desc": "Modal overlay / dialog content animated via fixed CSS duration rather than spring presentation tracking"
                })

            # TYPO-003 checks
            # Uppercase without tracking
            if "uppercase" in line and not any(trk in line for trk in ["tracking-", "letter-spacing"]):
                violations[TYPO_003].append({
                    "file": rel_path,
                    "line": idx,
                    "rule": "TYPO-003-UNTRACKED-UPPERCASE",
                    "code": line.strip(),
                    "desc": "Uppercase text without explicit expanded letter-spacing/tracking"
                })

            # Arbitrary tracking or tracking exceeding -0.04em floor
            tracking_match = re.search(r"tracking-\[([^\]]+)\]", line)
            if tracking_match:
                val = tracking_match.group(1)
                violations[TYPO_003].append({
                    "file": rel_path,
                    "line": idx,
                    "rule": "TYPO-003-ARBITRARY-TRACKING",
                    "code": line.strip(),
                    "desc": f"Arbitrary tracking token {val} outside design system scale"
                })

            # Large headings lacking negative optical tracking
            if any(h in line for h in ["text-h1", "text-display", "font-serif text-h1"]) and not any(t in line for t in ["tracking-", "tracking_"]):
                if not any(k in rel_path for k in ["tokens.css", "globals.css"]):
                    violations[TYPO_003].append({
                        "file": rel_path,
                        "line": idx,
                        "rule": "TYPO-003-MISSING-OPTICAL-TRACKING",
                        "code": line.strip(),
                        "desc": "Large display / H1 serif heading rendered without optical negative tracking"
                    })

            # MOTION-004 checks
            # Non-allowlisted CSS transitions (transition-colors, border, etc.)
            if re.search(r"transition-(colors|border|background|shadow|width|height)", line):
                violations[MOTION_004].append({
                    "file": rel_path,
                    "line": idx,
                    "rule": "MOTION-004-NON-COMPOSITED-TRANSITION",
                    "code": line.strip(),
                    "desc": "Non-composited CSS transition property (violates transform/opacity motion economy)"
                })

            # Missing pointerdown/active latency in interactive elements
            if "<button" in line and "onClick=" in line and not any(act in line for act in ["active:", ":active", "onPointerDown"]):
                if "btn" not in line and "buttonVariants" not in line and "Icon" not in line:
                    violations[MOTION_004].append({
                        "file": rel_path,
                        "line": idx,
                        "rule": "MOTION-004-INPUT-LATENCY-UNBOUND-PRESS",
                        "code": line.strip(),
                        "desc": "Interactive button element lacks instantaneous :active/pointerdown visual state"
                    })

    # System-level checks
    if not has_reduced_transparency:
        violations[AASM_001].append({
            "file": "app/globals.css",
            "line": 1,
            "rule": "AASM-001-NO-REDUCED-TRANSPARENCY",
            "code": "@media (prefers-reduced-transparency: reduce)",
            "desc": "No global or component fallback declared for @media (prefers-reduced-transparency: reduce)"
        })

    return violations

def main():
    root_dir = sys.argv[1] if len(sys.argv) > 1 else "app"
    print(f"=== Apple Design & Craft Floor Forensic Audit ===")
    print(f"Scanning target: {root_dir}\n")

    violations = scan_codebase(root_dir)
    total_violations = sum(len(v) for v in violations.values())

    for category, items in violations.items():
        print(f"## {category} - {len(items)} violation(s)")
        if not items:
            print("  (No violations found)\n")
            continue
        for item in items:
            print(f"  [{item['rule']}] {item['file']}:{item['line']}")
            print(f"    Description: {item['desc']}")
            print(f"    Code snippet: {item['code']}")
        print()

    print(f"==================================================")
    print(f"Total Forensic Violations Inventoried: {total_violations}")
    print(f"==================================================")

    if total_violations > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
