# Real state scraper "Fizgon"

This project scrapes real state web pages following a set of predefined filters, identifies new properties and sends Whatsapp notifications, to help people locating a house to buy or rent.

## Product highlights

Intended audience:
- People searching for homes to buy or rent in Spain
- Realtors and real estate professionals who need structured data from public listings

Problem this product solves:
- The market is highly competitive. Finding attractive properties early is difficult, and competition from other buyers or renters is intense. This product helps users react faster by detecting new listings near real time, instead of relying only on Idealista's standard email alerts.

Product definition:
- A system that scrapes public real estate listings in Spain (initially Idealista), builds a database (including image data) for a filtered subset of the market, and sends real-time WhatsApp notifications for relevant opportunities.
- Given that public information is downloaded, this data can be used to analyze information about past market situation. After a property has been removed from original source, can be still queried from the local copy.
- Since images are downloaded, additional tools to leverage Artificial Inteligence (for example to analyze images) can be developed. Note this product is also a research testbed on architecture and interior design.

# Software architecture

This system comprises several micro services that interacts with each other as shown in the following diagrams:

![Property Scraper Architecture](doc/architecture/property-scraper-architecture.png)

- Blue arrows means that a micro service controls a web browser using the CDP protocol.
- Black arrows shows information flow.
- Green arrows shows observability metrics flow.
- Green background components are the micro services that makes up this project.

The architecture componentes are:

- [Page list scraper](propertyListingIdealistaScraper/README.md): scraper that controls a Google Chrome web browser to get the list of properties given a set of filters. The resulting URLs for properties are written to RabbitMq. DEPRECATED.
- [Page detail scraper](propertyDetailIdealistaScraper/README.md): consumes property URLs from RabbitMq and downloads property details from Idealista source using a second and separate instance of Google Chrome. Given the property information, the information is stored in the mongodb database, and notifications are sent via whatsapp. DEPRECATED.
- [Idealista scraper](idealistaPropertyScraper/README.md): scraper that controls a Google Chrome web browser to retrieve property listings based on a set of filters, extracts each property detail from Idealista, stores the collected information in the MongoDB database, and sends notifications via WhatsApp.
- [Notification message sender](notificationMessageSender/README.md): consumes messages from RabbitMq that are intended to be sent to a Whatsapp user or group.
- Whatsapp notification sender: Service to send notification to whatsapp. Works reading messages written to RabbitMq.

# Deployment

This project depends on several components, such as RabbitMQ, MongoDB, Prometheus, Grafana and other services that interact with micro services. The whole environment can be deployed in several different ways:
- [Manually in local host](./doc/manualSetup.md): recommended for learning only.
- Docker images in Kubernetes pods: recommended for deployment to production environment.
- [Proxy support (Nginx + ZeroTier)](./doc/proxySupport.md): guide for residential egress through a forward proxy.
- [Anti-scraper detection measures](./doc/antiScraperDetectionMeasures.md): currently implemented anti-detection strategy summary.

# Common installation on micro services

The usual steps are:
- Copy `secrets-example.json` to `secrets.json` and fill in credentials.
- Install dependencies with `npm install`
- Build the micro service with `npm run build`
- Execute the micro service with `npm run start`

Refer to specific micro service README.md for more details.
