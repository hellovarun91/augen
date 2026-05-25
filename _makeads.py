import json, urllib.request, re, subprocess, time
M="http://localhost:3000/api/mcp"; TOKEN=open("/tmp/augen_mcp_token.txt").read().strip()
_id=[0]
def call(name, args, timeout=300):
    _id[0]+=1
    body=json.dumps({"jsonrpc":"2.0","id":_id[0],"method":"tools/call","params":{"name":name,"arguments":args}}).encode()
    req=urllib.request.Request(M, body, {"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"})
    r=json.load(urllib.request.urlopen(req, timeout=timeout))
    res=r.get("result",{}); return ("[ERR] " if res.get("isError") else "")+"".join(c.get("text","") for c in res.get("content",[]))
def sql(q): subprocess.run(["sqlite3","data/augen.db",q], check=True)

print("create_project:", end=" ")
p=call("create_project",{"brand":"coursera","name":"Coursera Awareness (demo test)","objective":"awareness","audience":"Career-minded adults 25-45"})
pid=re.search(r"id: (cmp_[\w-]+)", p).group(1); print(pid)
fmts='["meta-feed-1x1","meta-feed-4x5","meta-story-9x16","youtube-bumper-16x9"]'
sql(f"UPDATE campaigns SET brief=json_set(brief,'$.formats',json('{fmts}')) WHERE id='{pid}';")
print("seed_ideas:", call("seed_ideas",{"project":pid,"count":1}))
# keep exactly one idea selected -> 1 idea x 4 formats = 4 ads
keep=subprocess.run(["sqlite3","data/augen.db",f"SELECT id FROM ideas WHERE campaign_id='{pid}' ORDER BY order_idx, rowid LIMIT 1;"],capture_output=True,text=True).stdout.strip()
sql(f"UPDATE ideas SET selected=0 WHERE campaign_id='{pid}' AND id!='{keep}'; UPDATE ideas SET selected=1 WHERE id='{keep}';")
print("generate_ads:", call("generate_ads",{"project":pid}, timeout=320))
print("\n4 ads:")
lc=call("list_creatives",{"project":pid})
for line in lc.split("\n"):
    m=re.search(r"(gen_[\w-]+)", line)
    if m and line.strip().startswith("•"): print("  http://localhost:3000/api/render/"+m.group(1)+"/png  —", line.strip()[:90])
print("\nproject: http://localhost:3000/campaigns/"+pid)
print("PID="+pid)
