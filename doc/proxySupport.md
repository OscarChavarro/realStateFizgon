# Proxy Support Guide

This document explains one practical approach to run the scrapers behind a residential egress IP by using a forward proxy.

## 1. Nginx-based forward proxy (with CONNECT support)

You can implement a forward proxy in Nginx with a configuration like:

```nginx
server {
    listen 3128;
    listen [::]:3128;
    server_name _;

    allow 192.168.0.0/16;
    deny all;

    auth_basic "Proxy";
    auth_basic_user_file /etc/nginx/proxy.htpasswd;

    proxy_connect;
    proxy_connect_allow 443 80;

    location / {
        proxy_pass http://$host$request_uri;
    }
}
```

Important:
- This is not supported by stock Nginx packages out of the box.
- You need an Nginx build that includes `ngx_http_proxy_connect_module`.
- Module source: `https://github.com/chobits/ngx_http_proxy_connect_module.git`

## 2. Build/install exercise for Nginx + proxy_connect

This is an exercise-oriented flow to validate the concept end-to-end.

1. Build or install an Nginx variant with `ngx_http_proxy_connect_module`.
2. Configure a dedicated proxy server block on port `3128`.
3. Restrict source networks with private CIDRs (for example `192.168.0.0/16`) and optionally enable basic auth.
4. Reload Nginx and confirm it is listening on `3128`.

Minimal checks:

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo ss -ltnp | grep 3128
```

## 3. Test with curl

Use `curl` to verify both HTTP and HTTPS forwarding:

```bash
# HTTP through proxy
curl -v -x http://<proxy-host>:3128 http://example.com -I

# HTTPS through proxy (requires CONNECT support)
curl -v -x http://<proxy-host>:3128 https://example.com -I
```

If basic auth is enabled:

```bash
curl -v -x http://<proxy-host>:3128 -U "<user>:<password>" https://example.com -I
```

Expected:
- HTTP request succeeds.
- HTTPS request also succeeds (CONNECT tunnel works).

If HTTPS fails while HTTP works, CONNECT handling is usually missing or blocked.

## 4. Residential single-IP strategy with ZeroTier

You can place the proxy in a residential network and expose it only inside a private VPN (ZeroTier).

Typical setup:
- A residential host runs Nginx forward proxy.
- Your VPS (where Kubernetes/scrapers run) joins the same ZeroTier network.
- Scrapers use the residential proxy ZeroTier IP as `proxy.host`.

Why this helps:
- Browser egress traffic leaves from the residential ISP IP, not from the VPS datacenter IP.
- This can reduce bot detection in sites that aggressively score datacenter IPs (for example real-estate portals).

Operational notes:
- Keep strict ACLs (`allow`/`deny`) so only your private VPN ranges can access the proxy.
- Monitor proxy logs and scraper logs to confirm active usage.
- Test latency and reliability; residential links can fluctuate more than datacenter links.

## 5. Integrating with this repository

In scraper `secrets.json`, configure:

```json
"proxy": {
  "enable": true,
  "host": "<proxy-zerotier-ip-or-hostname>",
  "port": "3128",
  "user": "",
  "password": ""
}
```

Current code validates proxy connectivity before browser launch and logs:
- when proxy is disabled (direct connection),
- when proxy is active and in use,
- when proxy is unreachable (with retry wait for pod debugging).

## 6. Commercial residential proxy services

Popular providers include Oxylabs, Decodo (formerly Smartproxy), IPRoyal, NetNut, Bright Data, and others.

### Cost concern: traffic-based billing

Most commercial residential proxy plans are charged by traffic (GB/month or pay-as-you-go).  
For low traffic this can be acceptable, but at scale the bill can grow quickly.

Examples observed in 2026 (public pages, subject to change):
- Oxylabs Residential Proxy pricing page shows plans around a few USD per GB (self-service tiers and PAYG references):  
  `https://oxylabs.io/pricing/residential-proxy-pool`
- Decodo Residential pricing page shows discounted tiers down to lower USD/GB at larger bundles and higher PAYG rates:  
  `https://decodo.com/proxies/residential-proxies/pricing`
- IPRoyal Residential pricing page shows subscription and pay-as-you-go GB pricing (higher at low volume, lower in larger bundles):  
  `https://iproyal.com/pricing/residential-proxies/`
- NetNut Residential pricing page also publishes USD/GB plan breakdowns by bundle size:  
  `https://netnut.io/residential-proxies/`

Because vendors run frequent promotions, rates can vary significantly month to month. Always verify live pricing before making cost assumptions.

### Why Nginx + ZeroTier can still be useful

The simple Nginx+ZeroTier setup described above can reproduce several practical benefits of commercial services:
- Residential egress IP (traffic exits through home ISP instead of datacenter IP).
- Access control (ACLs + optional basic auth).
- Private transport over an internal VPN.
- Low fixed cost when traffic is small.

Main limitation:
- You typically get one residential IP (or a very small set), not a large rotating pool.

This makes the setup ideal for testing and for low-volume scraping workflows, while commercial providers are usually better for large-scale rotation, geo diversity, and enterprise-level uptime guarantees.
