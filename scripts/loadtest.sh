#!/usr/bin/env bash
# Lightweight load smoke against health + login + conversations list
set -euo pipefail
API="${API_URL:-http://127.0.0.1:4000}"
N="${CONCURRENCY:-20}"
LOOPS="${LOOPS:-5}"

echo "loadtest API=$API concurrency=$N loops=$LOOPS"

login=$(curl -sf -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Slug: demo' \
  -d '{"email":"owner@demo.alurichat.com","password":"DemoOwner123!","tenantSlug":"demo"}')
token=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print((d.get('data') or d).get('accessToken',''))" "$login")
test -n "$token"

export API TOKEN
python3 - <<'PY'
import os, time, urllib.request, concurrent.futures
api=os.environ["API"]; token=os.environ["TOKEN"]
n=int(os.environ.get("CONCURRENCY","20")); loops=int(os.environ.get("LOOPS","5"))
headers={"Authorization": f"Bearer {token}", "X-Tenant-Slug":"demo"}

def hit(i):
    t0=time.time()
    req=urllib.request.Request(f"{api}/api/v1/conversations?pageSize=20", headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        r.read(200)
    return time.time()-t0

times=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=n) as ex:
    futs=[ex.submit(hit,i) for i in range(n*loops)]
    for f in concurrent.futures.as_completed(futs):
        times.append(f.result())
times.sort()
print(f"ok={len(times)} p50={times[len(times)//2]:.3f}s p95={times[int(len(times)*0.95)-1]:.3f}s max={times[-1]:.3f}s")
PY
echo loadtest_ok
