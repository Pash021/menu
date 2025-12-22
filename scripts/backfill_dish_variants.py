#!/usr/bin/env python3
import argparse

from app import app, db, Dish, build_dish_image_variants


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill responsive image variants (srcset) for dish images.")
    parser.add_argument("--limit", type=int, default=200, help="Max dishes to process (default: 200).")
    parser.add_argument("--dry-run", action="store_true", help="Print what would change, without writing.")
    args = parser.parse_args()

    limit = max(1, min(int(args.limit or 200), 10_000))

    with app.app_context():
        q = Dish.query.filter(Dish.image_filename.isnot(None)).order_by(Dish.id.asc()).limit(limit)
        dishes = q.all()
        updated = 0
        for dish in dishes:
            if not dish.image_filename:
                continue
            variants = getattr(dish, "image_variants_json", None)
            if isinstance(variants, dict) and variants:
                continue
            new_variants = build_dish_image_variants(dish.image_filename) or None
            if args.dry_run:
                if new_variants:
                    print(f"[dry-run] dish_id={dish.id} -> variants={list(new_variants.keys())}")
                continue
            dish.image_variants_json = new_variants
            updated += 1

        if not args.dry_run:
            db.session.commit()
        print(f"updated={updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

