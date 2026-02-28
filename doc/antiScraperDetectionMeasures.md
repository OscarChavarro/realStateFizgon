# Anti-Scraper detection measures

This document summarizes anti-detection measures currently implemented in this system.

## 1. Residential-IP Routing Through Proxy Support

A key baseline is the difference between datacenter IPs and residential IPs: datacenter ranges are usually easier for target websites to classify as automated traffic, while residential IPs tend to look more like normal user traffic. For this reason, the platform supports proxy usage, so traffic can be routed through a network profile that reduces early blocking risk.

The scrapers support configurable proxy usage, including host/port settings from secrets, so browser traffic can be routed away from a datacenter egress when needed. This helps reduce immediate anti-bot flags that are commonly triggered by repetitive traffic coming directly from cloud or VPS IP ranges.
See the full setup guide in [Proxy support](./proxySupport.md).

## 2. Integrated Scraper Flow Instead of a Hard Split Listing/Detail Pipeline

The initial approach used two separate scrapers: one listing scraper traversed filtered search result pages, pushed property URLs to RabbitMQ, and a second detail scraper consumed those URLs later. In practice, this was detected quickly. The current direction is an integrated flow that navigates search results and then opens detail pages more carefully from that context, instead of jumping to URLs that are not currently listed in the active results view, because those abrupt jumps appear to increase detection speed.

This is the first version of this document and currently lists only these two measures. More anti-detection measures will be added in future iterations.
