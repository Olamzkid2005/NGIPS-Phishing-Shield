#!/usr/bin/env python3
"""
Model Registry for NGIPS Phishing Shield
Manages model version history: hash, timestamp, metrics, rollback.

Usage:
    python model_registry.py list                          # List all versions
    python model_registry.py info <hash>                   # Show version details
    python model_registry.py promote <hash>                # Promote to production
    python model_registry.py rollback                      # Rollback to previous
    python model_registry.py cleanup --keep 5              # Keep last N versions
"""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from glob import glob


def get_models_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))

def get_registry_path():
    return os.path.join(get_models_dir(), 'model_registry.json')


def load_registry():
    path = get_registry_path()
    if not os.path.exists(path):
        return {'versions': [], 'production': None}
    with open(path) as f:
        return json.load(f)

def save_registry(registry):
    with open(get_registry_path(), 'w') as f:
        json.dump(registry, f, indent=2)


def scan_models():
    models_dir = get_models_dir()
    versioned = glob(os.path.join(models_dir, '*_pipeline_*.pkl'))
    metadata = glob(os.path.join(models_dir, '*_metadata.json'))

    entries = []
    for meta_path in metadata:
        with open(meta_path) as f:
            data = json.load(f)
        model_hash = data.get('hash', 'unknown')
        name = data.get('model', os.path.basename(meta_path).replace('_metadata.json', ''))
        pkl_path = os.path.join(models_dir, f'{name}_pipeline.pkl')
        size_kb = os.path.getsize(pkl_path) / 1024 if os.path.exists(pkl_path) else 0
        entries.append({
            'name': name,
            'hash': model_hash,
            'timestamp': data.get('timestamp', ''),
            'metrics': data.get('metrics', {}),
            'size_kb': round(size_kb, 1),
            'hybrid': data.get('hybrid', False),
            'calibrated': data.get('calibrated', False),
        })

    return sorted(entries, key=lambda e: e['timestamp'], reverse=True)


def cmd_list(args):
    registry = load_registry()
    production = registry.get('production')
    entries = scan_models()

    print(f"\n{'='*60}")
    print(f"Model Registry - {len(entries)} versions")
    print(f"{'='*60}")

    for e in entries:
        is_prod = production == e['hash']
        marker = '>> PROD' if is_prod else '     '
        metrics = e.get('metrics', {})
        def fmt_metric(key):
            val = metrics.get(key)
            if val is None: return '?'
            return f'{val:>6.4f}'
        print(f"  {marker} {e['name']:25s} {e['hash'][:12]}  "
              f"acc={fmt_metric('accuracy')}  "
              f"f1={fmt_metric('f1')}  "
              f"auc={fmt_metric('roc_auc')}  "
              f"{e['timestamp'][:19]}  {e['size_kb']:>7.1f}KB")


def cmd_info(args):
    entries = scan_models()
    for e in entries:
        if e['hash'].startswith(args.hash):
            print(json.dumps(e, indent=2))
            return
    print(f"Version {args.hash} not found")


def cmd_promote(args):
    registry = load_registry()
    entries = scan_models()
    for e in entries:
        if e['hash'].startswith(args.hash):
            registry['production'] = e['hash']
            registry['promoted_at'] = datetime.now().isoformat()
            save_registry(registry)
            print(f"Promoted {e['name']} ({e['hash'][:12]}) to production")
            return
    print(f"Version {args.hash} not found")


def cmd_rollback(args):
    registry = load_registry()
    if not registry.get('production'):
        print("No production version to rollback from")
        return
    entries = scan_models()
    current_hash = registry['production']
    current_idx = None
    for i, e in enumerate(entries):
        if e['hash'] == current_hash:
            current_idx = i
            break
    if current_idx is not None and current_idx + 1 < len(entries):
        prev = entries[current_idx + 1]
        registry['production'] = prev['hash']
        registry['rolled_back_at'] = datetime.now().isoformat()
        save_registry(registry)
        print(f"Rolled back to {prev['name']} ({prev['hash'][:12]})")
    else:
        print("No previous version to rollback to")


def cmd_cleanup(args):
    entries = scan_models()
    keep = args.keep
    if len(entries) <= keep:
        print(f"Only {len(entries)} versions, nothing to clean up")
        return

    models_dir = get_models_dir()
    to_remove = entries[keep:]
    for e in to_remove:
        name = e['name']
        for ext in ['_pipeline.pkl', f'_pipeline_{e["hash"]}.pkl', '_metadata.json', '_vocab.json']:
            path = os.path.join(models_dir, f'{name}{ext}')
            if os.path.exists(path):
                os.remove(path)
                print(f"Removed: {os.path.basename(path)}")
    print(f"Cleaned up {len(to_remove)} old versions")


def main():
    parser = argparse.ArgumentParser(description='Model Registry Manager')
    sub = parser.add_subparsers(dest='command')

    p_list = sub.add_parser('list', help='List all model versions')
    p_info = sub.add_parser('info', help='Show version details')
    p_info.add_argument('hash', help='Model hash prefix')

    p_promote = sub.add_parser('promote', help='Promote version to production')
    p_promote.add_argument('hash', help='Model hash prefix')

    p_rollback = sub.add_parser('rollback', help='Rollback to previous production')
    p_cleanup = sub.add_parser('cleanup', help='Remove old versions')
    p_cleanup.add_argument('--keep', type=int, default=5, help='Number of versions to keep')

    args = parser.parse_args()
    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'info':
        cmd_info(args)
    elif args.command == 'promote':
        cmd_promote(args)
    elif args.command == 'rollback':
        cmd_rollback(args)
    elif args.command == 'cleanup':
        cmd_cleanup(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
