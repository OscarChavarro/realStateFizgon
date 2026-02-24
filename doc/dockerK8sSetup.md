# Docker + Kubernetes setup

This guide helps to deploy the full `RealStateFizgon` system in Kubernetes (K8S), using `kind` as reference baseline but keeping runtime operations in `kubectl` terms so it also fits `minikube` or other K8S distributions. It is aligned with:
- [Software architecture](architecture/property-scraper-architecture.png)
- [Manual setup](manualSetup.md)

Target K8S namespace: `realStateFizgon`.
Public DNS domain base: `<yourDomain>`.

## 1. Prerequisites

## 1.1 Install Docker

Install Docker Desktop (macOS) or Docker Engine (Linux).

## 1.2 Install kubectl

```bash
# On MacOS
brew install kubectl
# On Ubuntu
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/<architecture>/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```
where `architecture` is `amd64` or `arm64`.

## 1.3 Install kind

macOS (Homebrew):

```bash
brew update
brew install kind
```

Ubuntu Linux:

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.29.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
kind version
```

## 1.4 Install k9s

```bash
# On MacOS
brew install k9s

# On Ubuntu
curl -sS https://webinstall.dev/k9s | bash
```

## 1.5 Create cluster and namespace

Create your cluster with your preferred local K8S provider:

```bash
# Kind example
kind create cluster --name realstate-fizgon

# Minikube example
minikube start
```

Then continue with generic Kubernetes commands:

```bash
kubectl create namespace realStateFizgon
kubectl config set-context --current --namespace=realStateFizgon
```

## 1.6 DNS records for internet exposure

Create DNS records so every subdomain resolves to the public IP of your main K8S ingress entrypoint (`<yourDomain>`).

Recommended records:
- `rabbitmq.<yourDomain>` -> `<yourDomain>`
- `prometheus.<yourDomain>` -> `<yourDomain>`
- `grafana.<yourDomain>` -> `<yourDomain>`
- `notification.<yourDomain>` -> `<yourDomain>`
- `mongodb.<yourDomain>` -> `<yourDomain>`

`mongodb` and AMQP (`rabbitmq` on port `5672`) are TCP services, so clients must connect with explicit port:
- `mongodb.<yourDomain>:27017`
- `rabbitmq.<yourDomain>:5672`

Open cluster monitor:

```bash
k9s -n realStateFizgon
```

## 2. Prepare secrets.json for each microservice

Each service reads `secrets.json` from `/app/secrets.json`.
`Dockerfile.local` includes `secrets-example.json`, but production credentials must be injected as Kubernetes Secret.

1. Update local files:
- `propertyListingIdealistaScraper/secrets.json`
- `propertyDetailIdealistaScraper/secrets.json`
- `notificationMessageSender/secrets.json`

2. Create K8S secrets:

```bash
kubectl -n realStateFizgon create secret generic property-listing-secrets \
  --from-file=secrets.json=propertyListingIdealistaScraper/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n realStateFizgon create secret generic property-detail-secrets \
  --from-file=secrets.json=propertyDetailIdealistaScraper/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n realStateFizgon create secret generic notification-message-sender-secrets \
  --from-file=secrets.json=notificationMessageSender/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 3. Build and push Docker images

Replace `YOUR_DOCKERHUB_USER`:

```bash
docker build -t YOUR_DOCKERHUB_USER/property-listing-idealista-scraper:local -f propertyListingIdealistaScraper/Dockerfile.local propertyListingIdealistaScraper

docker build -t YOUR_DOCKERHUB_USER/property-detail-idealista-scraper:local -f propertyDetailIdealistaScraper/Dockerfile.local propertyDetailIdealistaScraper

docker build -t YOUR_DOCKERHUB_USER/notification-message-sender:local -f notificationMessageSender/Dockerfile.local notificationMessageSender

docker push YOUR_DOCKERHUB_USER/property-listing-idealista-scraper:local
docker push YOUR_DOCKERHUB_USER/property-detail-idealista-scraper:local
docker push YOUR_DOCKERHUB_USER/notification-message-sender:local
```

## 4. Deploy external services required by manual setup

## 4.1 RabbitMQ (with management plugin)

```bash
kubectl apply -f k8s/rabbitmq.yaml
```

Initialize queue/users as in `doc/manualSetup.md`:

```bash
RABBIT_POD=$(kubectl -n realStateFizgon get pod -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')

kubectl -n realStateFizgon exec -it "$RABBIT_POD" -- rabbitmqctl add_user propertylist_user '<some password1>'
kubectl -n realStateFizgon exec -it "$RABBIT_POD" -- rabbitmqctl add_user propertydetail_user '<some password2>'
kubectl -n realStateFizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_permissions -p dev propertylist_user ".*" ".*" ".*"
kubectl -n realStateFizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_permissions -p dev propertydetail_user ".*" ".*" ".*"
kubectl -n realStateFizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_user_tags propertylist_user management
kubectl -n realStateFizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_user_tags propertydetail_user management
```

Expose management UI locally:

```bash
kubectl -n realStateFizgon port-forward svc/rabbitmq 15672:15672
```

## 4.2 MongoDB (StatefulSet + persistent volume)

MongoDB is intentionally persistent (not volatile) in this setup.

```bash
kubectl apply -f k8s/mongodb.yaml
```

Create app DB user (matches `propertyDetailIdealistaScraper/secrets.json`):

```bash
MONGO_POD=$(kubectl -n realStateFizgon get pod -l app=mongodb -o jsonpath='{.items[0].metadata.name}')

kubectl -n realStateFizgon exec -it "$MONGO_POD" -- mongosh --eval 'use idealistaScraper; db.createUser({user:"propertydetail_user", pwd:"<some password>", roles:[{role:"readWrite", db:"idealistaScraper"}]});'
```

## 4.3 Prometheus

Create basic auth file exactly as described in `doc/manualSetup.md`, then create K8S secret:

```bash
kubectl -n realStateFizgon create secret generic prometheus-web-config \
  --from-file=web.yml=./web.yml \
  --dry-run=client -o yaml | kubectl apply -f -
```

Deploy Prometheus:

```bash
kubectl apply -f k8s/prometheus.yaml
```

## 4.4 Grafana

```bash
kubectl apply -f k8s/grafana.yaml
```

Port-forward local access:

```bash
kubectl -n realStateFizgon port-forward svc/prometheus 9090:9090
kubectl -n realStateFizgon port-forward svc/grafana 3000:3000
```

## 5. Configure Ingress (HTTP + TCP) for public subdomains

Install ingress-nginx controller:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller
```

Enable TCP routing map for non-HTTP services (`RabbitMQ AMQP` and `MongoDB`):

```bash
kubectl apply -f k8s/ingress-nginx-tcp-services.yaml
kubectl -n ingress-nginx patch deployment ingress-nginx-controller --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--tcp-services-configmap=ingress-nginx/tcp-services"}]'
```

Expose TCP ports through ingress-nginx Service:

```bash
kubectl -n ingress-nginx patch service ingress-nginx-controller --type='json' -p='[
  {"op":"add","path":"/spec/ports/-","value":{"name":"amqp-5672","port":5672,"targetPort":5672,"protocol":"TCP"}},
  {"op":"add","path":"/spec/ports/-","value":{"name":"mongodb-27017","port":27017,"targetPort":27017,"protocol":"TCP"}}
]'
```

Apply HTTP host-based ingress rules:

```bash
# Set your DNS base domain
export DNS_REAL_STATE_FIZGON_DOMAIN="<yourDomain>"

# Render template + apply
envsubst < k8s/ingress-http.yaml | kubectl apply -f -
```

Check ingress resources:

```bash
kubectl -n ingress-nginx get svc ingress-nginx-controller
kubectl -n realStateFizgon get ingress
```

Important:
- In cloud Kubernetes, use a `LoadBalancer` service for ingress-nginx and point DNS records to that external IP.
- In bare-metal/local clusters, ingress is usually `NodePort`. Publish ports `80`, `443`, `5672`, and `27017` from the host/router/firewall to the node where ingress-nginx runs.
- HTTP host-based ingress applies to HTTP services only (`rabbitmq` management UI, `prometheus`, `grafana`, `notification` endpoints). `mongodb` and AMQP are exposed through TCP ports.
- `k8s/ingress-http.yaml` is a template and uses `${DNS_REAL_STATE_FIZGON_DOMAIN}`. If `envsubst` is missing, install `gettext` (`brew install gettext` on macOS, `sudo apt-get install gettext-base` on Ubuntu).

## 6. Deploy the three project microservices

Edit image names in these files first:
- `propertyListingIdealistaScraper/k8s/propertyListingIdealistaScraper.yaml`
- `propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml`
- `notificationMessageSender/k8s/notificationMessageSender.yaml`

Important:
- In `propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml`, replace NFS placeholders:
  - `NFS_SERVER_IP_OR_DNS`
  - `/exports/realStateFizgon-images`
- This mount persists downloaded images (`/app/output/images`) outside volatile pods.

Apply:

```bash
kubectl apply -f propertyListingIdealistaScraper/k8s/propertyListingIdealistaScraper.yaml
kubectl apply -f propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml
kubectl apply -f notificationMessageSender/k8s/notificationMessageSender.yaml
```

## 7. Rollout restart commands

Use after updating image tags or secrets:

```bash
kubectl -n realStateFizgon rollout restart deployment/property-listing-idealista-scraper
kubectl -n realStateFizgon rollout restart deployment/property-detail-idealista-scraper
kubectl -n realStateFizgon rollout restart deployment/notification-message-sender
kubectl -n realStateFizgon rollout restart deployment/rabbitmq
kubectl -n realStateFizgon rollout restart deployment/prometheus
kubectl -n realStateFizgon rollout restart deployment/grafana
kubectl -n realStateFizgon rollout restart statefulset/mongodb
kubectl -n ingress-nginx rollout restart deployment/ingress-nginx-controller
```

## 8. Validation checklist

```bash
kubectl -n realStateFizgon get pods
kubectl -n realStateFizgon get svc
kubectl -n realStateFizgon get pvc
kubectl -n realStateFizgon get ingress
kubectl -n ingress-nginx get svc ingress-nginx-controller
```

Tail logs:

```bash
kubectl -n realStateFizgon logs deploy/property-listing-idealista-scraper -f
kubectl -n realStateFizgon logs deploy/property-detail-idealista-scraper -f
kubectl -n realStateFizgon logs deploy/notification-message-sender -f
```

Validate metrics endpoint from inside cluster:

```bash
kubectl -n realStateFizgon run metrics-test --rm -it --image=curlimages/curl -- \
  curl -s http://notification-message-sender:9464/metrics | head
```

## 9. Notes on architecture mapping

- `propertyListingIdealistaScraper` publishes property URLs to RabbitMQ queue `property-listing-urls`.
- `propertyDetailIdealistaScraper` consumes those URLs, stores property data in MongoDB, and publishes notification payloads to `outgoing-notification-messages`.
- `notificationMessageSender` consumes outgoing notifications and sends WhatsApp messages.
- Prometheus scrapes service metrics; Grafana visualizes them.

This mirrors the flow defined in `doc/architecture/property-scraper-architecture.dot` and operational requirements from `doc/manualSetup.md`.
