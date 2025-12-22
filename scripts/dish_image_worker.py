#!/usr/bin/env python3
import argparse
import time

from app import app, process_pending_dish_image_jobs


def main() -> int:
    parser = argparse.ArgumentParser(description="Process queued dish image jobs (background removal).")
    parser.add_argument("--once", action="store_true", help="Process one batch and exit.")
    parser.add_argument("--limit", type=int, default=3, help="Max queued jobs per batch (default: 3).")
    parser.add_argument("--interval", type=float, default=2.0, help="Sleep seconds between batches (default: 2.0).")
    args = parser.parse_args()

    with app.app_context():
        if args.once:
            processed = process_pending_dish_image_jobs(limit=args.limit)
            print(f"processed={processed}")
            return 0

        while True:
            processed = process_pending_dish_image_jobs(limit=args.limit)
            if processed:
                time.sleep(0.35)
            else:
                time.sleep(max(0.5, float(args.interval)))


if __name__ == "__main__":
    raise SystemExit(main())

