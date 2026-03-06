# Anti-Scraper detection measures

This document summarizes anti-detection measures currently implemented in this system.

## 1. Residential-IP Routing Through Proxy Support

A key baseline is the difference between datacenter IPs and residential IPs: datacenter ranges are usually easier for target websites to classify as automated traffic, while residential IPs tend to look more like normal user traffic. For this reason, the platform supports proxy usage, so traffic can be routed through a network profile that reduces early blocking risk.

The scrapers support configurable proxy usage, including host/port settings from secrets, so browser traffic can be routed away from a datacenter egress when needed. This helps reduce immediate anti-bot flags that are commonly triggered by repetitive traffic coming directly from cloud or VPS IP ranges.
See the full setup guide in [Proxy support](./proxySupport.md).

## 2. Integrated Scraper Flow Instead of a Hard Split Listing/Detail Pipeline

The initial approach used two separate scrapers: one listing scraper traversed filtered search result pages, pushed property URLs to RabbitMQ, and a second detail scraper consumed those URLs later. In practice, this was detected quickly. The current direction is an integrated flow that navigates search results and then opens detail pages more carefully from that context, instead of jumping to URLs that are not currently listed in the active results view, because those abrupt jumps appear to increase detection speed.

This is the first version of this document and currently lists only these two measures. More anti-detection measures will be added in future iterations.

## 3. Geolocation (GPS sensor vs network provider location)

Instrumentalized web browser should provide a geographical location. If not, bot detection system takes it as suspicious. For this, target page should be authorized to get information from location API, and an specific location should be specified, particularly, an injected GPS location to be near the IP location, that is calculated from the internet service provider network data.

This is important to give the hint that the connection comes from a "residential IP". That means, your GPS location is on a residential neigborhood, near reported IP reported.

## 4. WebGL support

By default, both X11/Xvfb and chromium are configured to have the WebGL API disabled, since there is no GPU neither 3D drivers installed on an X11 headless setup.

Bot detectors usually query browser for WebGL support as a desktop/mobile machine detection mechanism. Note that a machine without 3D graphics support is usually a server in a datacenter.

WebGL API support should be enabled. For that, mesa system should be installed, and the following specific options needs to be added to chromium:

```
--enable-webgl
--ignore-gpu-blocklist
--use-gl=swiftshader
--use-angle=swiftshader
 ````

## 5. TLS signatures should be consistent with User Agent (UA)

User agent (UA) is an specific signature that identifies the operating system and the browser versions. This are usually changed to give anti-bot system a hint saying "this is a human used machine". For example, since most server side software packages uses Linux, and most humans uses Windows, MacOS and mobile operating systems, it is not a good idea to let Linux based browsers to send their default UA.

Other than specifying a UA, TLS signatures should be updated to be coherent with the UA.

In this project, TLS fingerprints are dictated by the real Chrome/Chromium binary. We cannot spoof the TLS stack without replacing the browser binary, so we normalize the configured UA to match the detected browser version at launch time. If `environment.json` defines a UA with a mismatching Chrome/Chromium version, the version token is replaced with the actual browser version. If the UA doesn't include a Chrome/Chromium token, we fall back to a normalized Chrome UA that matches the running binary and OS. This keeps TLS and UA coherent without introducing mismatched signatures.
