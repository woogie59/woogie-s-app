#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../../../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# Transpile production handler while replacing only its SDK import with mock DI.
python3 - "$root" "$tmp" <<'PY'
import sys
root,tmp=sys.argv[1:]
s=open(root+'/supabase/functions/ot-booking-notify/index.ts').read().replace('import { createClient } from "https://esm.sh/@supabase/supabase-js@2";','const createClient = (...a:any[]) => (globalThis as any).mockDb;')
open(tmp+'/source.ts','w').write(s)
PY
"$root/node_modules/.bin/esbuild" "$tmp/source.ts" --format=esm --outfile="$tmp/ot-notify-handler-test.mjs"
cp "$root/supabase/functions/ot-booking-notify/tests/harness.mjs" "$tmp/ot-notify-harness.mjs"
node "$tmp/ot-notify-harness.mjs"
