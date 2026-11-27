#!/usr/bin/env bash
set -euo pipefail

case "${1:-preview}" in
  preview) config="_config.yml,_config.vercel.yml,_config.preview.yml" ;;
  production) config="_config.yml,_config.vercel.yml" ;;
  *) printf 'Expected preview or production\n' >&2; exit 2 ;;
esac

bundle exec jekyll build --config "$config" --destination "$PWD/.vercel/output/static"
node scripts/vercel-routes.cjs "${1:-preview}"
