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

TLS is a handshake fingerprint (cipher suites, extensions, and their ordering) produced by the browser's TLS stack. That fingerprint is tied to the browser binary and its TLS implementation, while the User Agent is only an HTTP header. If they don't match (e.g., UA says Chrome 145 but TLS looks like Chrome 141), it is a strong bot signal.

## 6. Careful definition of cookies

Antibot detector analysis compares the data from geolocation with probable user setup for a region. For example, an Spanish site, with Spanish market (such as idealista) and geolocated as being used from Spain, most probably will have Spanish locale defined in `Accept-Language` header.

To double check behaviors of a real human controlled web browser against CDP instrumentalized web browser, it is recommended to use the [httpbin tool](https://httpbin.org/anything). Browse from a normal browser session, then browse from the instrumentalized web browser and then compare the headers.

Code has been added to `CdpNetworkClient` class to take care of this.

## 7. Smart use of google accounts

Some sites such as idealista can use Google account based authentication. Creating secondary Google accounts can be used to create profile folders, and keep them in the NFS shared folder. For login, Google blocks access to CDP instrumentalized browser, so browser should be opened manually on a remote session with `--no-sandbox --user-data-dir=<profile-folder>` options, log in to google and close the browser. Then the scraper controlled by CDP can open the browser using the same profile folder and the target site can be used from a logged in user.

This way it is expected to have increased reputation and avoid being blocked due to fresh profile or anonymous login.

## 8. GUI signature

X11 session should be configured with detail in mind:
- Screen resolution set to a commonly used one, such as 1920x1080.
- Available fonts similar to common fonts in distributions.
- Configure the browser to be in fullscreen inside the X11 session.
