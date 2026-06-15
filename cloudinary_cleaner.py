#!/usr/bin/env python3
"""
Cloudinary Storage Cleaner - Delete all assets from your Cloudinary account
"""

import cloudinary
import cloudinary.api
import cloudinary.uploader
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# ============================================================
# CONFIGURATION
# ============================================================

CLOUDINARY_CONFIG = {
    'cloud_name': "davprpyfe",
    'api_key': '723695679563147',
    'api_secret': '7NzK5dEaVwwhUTobvOuekvSXiGk'
}

FOLDERS_TO_CLEAR = None   # e.g. ['folder1', 'folder2'] or None for all
KEEP_TYPES = None          # e.g. ['image'] to keep images, None to delete all
BATCH_SIZE = 100
MAX_WORKERS = 5
DRY_RUN = False

# ============================================================
# IMPLEMENTATION
# ============================================================

RESOURCE_TYPES = ['image', 'video', 'raw']


def configure_cloudinary():
    cloudinary.config(
        cloud_name=CLOUDINARY_CONFIG['cloud_name'],
        api_key=CLOUDINARY_CONFIG['api_key'],
        api_secret=CLOUDINARY_CONFIG['api_secret'],
        secure=True
    )
    print(f"✅ Connected to Cloudinary account: {CLOUDINARY_CONFIG['cloud_name']}")


def get_resources_by_type(resource_type, folder=None):
    """Fetch all resources of a given type, handling pagination."""
    resources = []
    next_cursor = None

    while True:
        try:
            params = {
                'max_results': 500,
                'type': 'upload',
                'resource_type': resource_type,  # FIX: separate call per type
            }
            if folder:
                params['prefix'] = folder
            if next_cursor:
                params['next_cursor'] = next_cursor

            result = cloudinary.api.resources(**params)
            batch = result.get('resources', [])
            resources.extend(batch)
            next_cursor = result.get('next_cursor')

            print(f"   [{resource_type}] Fetched {len(resources)} so far...")

            if not next_cursor:
                break

        except cloudinary.exceptions.AuthorizationRequired:
            print("❌ Authorization failed — check your API credentials.")
            raise
        except Exception as e:
            print(f"❌ Error fetching {resource_type} resources: {e}")
            break

    return resources


def get_all_resources():
    """Fetch all resources across all supported resource types."""
    all_resources = []
    folders = FOLDERS_TO_CLEAR if FOLDERS_TO_CLEAR else [None]

    for resource_type in RESOURCE_TYPES:
        if KEEP_TYPES and resource_type in KEEP_TYPES:
            print(f"⏭️  Skipping {resource_type} (kept by config)")
            continue

        for folder in folders:
            label = f"folder '{folder}'" if folder else "all folders"
            print(f"\n📁 Fetching {resource_type}s from {label}...")
            resources = get_resources_by_type(resource_type, folder)
            all_resources.extend(resources)

    return all_resources


def delete_resource(public_id, resource_type='image'):
    """Delete a single resource and invalidate its CDN cache."""
    try:
        result = cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type,
            invalidate=True
        )
        if result.get('result') == 'ok':
            return True, public_id
        else:
            return False, f"{public_id}: unexpected result → {result}"
    except Exception as e:
        return False, f"{public_id}: {str(e)}"


def clear_all_files(dry_run=False):
    print("\n" + "=" * 60)
    print("🗑️  CLOUDINARY STORAGE CLEANER")
    print("=" * 60)

    if dry_run:
        print("⚠️  DRY RUN MODE — no files will be deleted\n")
    else:
        print("⚠️  WARNING: This will permanently delete files from Cloudinary!")
        confirm = input("\nType 'DELETE ALL' to confirm: ")
        if confirm.strip() != "DELETE ALL":
            print("❌ Operation cancelled.")
            return

    configure_cloudinary()

    # Gather all resources
    to_delete = get_all_resources()

    print(f"\n📊 Summary:")
    print(f"   Resources to delete: {len(to_delete):,}")

    if not to_delete:
        print("✅ Nothing to delete.")
        return

    if dry_run:
        print("\n📋 DRY RUN — files that would be deleted:")
        for i, r in enumerate(to_delete[:20]):
            print(f"   {i+1}. {r['public_id']} ({r.get('resource_type')})")
        if len(to_delete) > 20:
            print(f"   ... and {len(to_delete) - 20} more")
        return

    # Delete in concurrent batches
    print(f"\n🚀 Starting deletion of {len(to_delete)} file(s)...")
    deleted_count = 0
    failed_count = 0
    failed_items = []

    for i in range(0, len(to_delete), BATCH_SIZE):
        batch = to_delete[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(to_delete) - 1) // BATCH_SIZE + 1
        print(f"\n   Batch {batch_num}/{total_batches} ({len(batch)} files)...")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(
                    delete_resource,
                    r['public_id'],
                    r.get('resource_type', 'image')
                ): r
                for r in batch
            }

            for future in as_completed(futures):
                success, result = future.result()
                if success:
                    deleted_count += 1
                else:
                    failed_count += 1
                    failed_items.append(result)

                processed = deleted_count + failed_count
                if processed % 50 == 0:
                    print(f"      Progress: {deleted_count} deleted, {failed_count} failed")

        time.sleep(0.5)  # Avoid rate-limiting between batches

    # Final summary
    print("\n" + "=" * 60)
    print("📊 FINAL SUMMARY")
    print("=" * 60)
    print(f"✅ Successfully deleted: {deleted_count}")
    print(f"❌ Failed:              {failed_count}")

    if failed_items:
        print("\n⚠️  Failed items (first 10):")
        for item in failed_items[:10]:
            print(f"   - {item}")

    verify = input("\n🔍 Verify remaining files? (y/n): ")
    if verify.lower() == 'y':
        remaining = get_all_resources()
        print(f"\n📊 Remaining files: {len(remaining)}")
        for r in remaining[:5]:
            print(f"   - {r['public_id']} ({r.get('resource_type')})")

    print("\n✅ Cleanup complete!")


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Clear Cloudinary storage')
    parser.add_argument('--dry-run', action='store_true', help='Preview without deleting')
    parser.add_argument('--folders', nargs='+', help='Specific folders to clear')
    parser.add_argument('--keep-types', nargs='+',
                        choices=['image', 'video', 'raw'],
                        help='Resource types to keep')

    args = parser.parse_args()

    if args.keep_types:
        KEEP_TYPES = args.keep_types
        print(f"📌 Keeping types: {KEEP_TYPES}")

    if args.folders:
        FOLDERS_TO_CLEAR = args.folders
        print(f"📁 Targeting folders: {FOLDERS_TO_CLEAR}")

    clear_all_files(dry_run=args.dry_run)
