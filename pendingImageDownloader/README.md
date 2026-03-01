# pendingImageDownloader

NestJS microservice that consumes messages from RabbitMQ queue `pending-image-urls-to-download` and downloads each image into `output/images/<propertyId>/`.

Message format:

```json
{
  "url": "https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/45/a9/15/1261873296.jpg",
  "propertyId": "97269387"
}
```

Filename rule:
- take the last four URL path tokens;
- join them with `_`.

Example:
- `.../45/a9/15/1261873296.jpg` -> `45_a9_15_1261873296.jpg`.

