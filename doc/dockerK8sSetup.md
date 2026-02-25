# Docker + Kubernetes setup

This guide helps to deploy the full `realstate-fizgon` system in Kubernetes (K8S), using `kind` as reference baseline but keeping runtime operations in `kubectl` terms so it also fits `minikube` or other K8S distributions. It is aligned with:
- [Software architecture](architecture/property-scraper-architecture.png)
- [Manual setup](manualSetup.md)

Target K8S namespace: `realstate-fizgon`.
Public DNS domain base: `<yourDomain>`.

## 1. Optional Cleanup (kind + Docker)

Use this section when you want to fully reset a previous local installation and recover disk space.

Warning:
- These commands delete local kind clusters, local registry containers/images, stopped containers, dangling images, build cache, and unused volumes/networks.
- Do not run on shared Docker hosts.

```bash
# Delete kind cluster (if present)
kind delete cluster --name realstate-fizgon || true

# Remove local registry container used in this guide
docker rm -f realstate-local-registry 2>/dev/null || true

# Remove local project images from registry tags used in this guide
docker rmi host.docker.internal:5001/property-listing-idealista-scraper:local 2>/dev/null || true
docker rmi host.docker.internal:5001/property-detail-idealista-scraper:local 2>/dev/null || true
docker rmi host.docker.internal:5001/notification-message-sender:local 2>/dev/null || true

# Remove kind node image and registry image (optional)
docker rmi kindest/node 2>/dev/null || true
docker rmi registry:2 2>/dev/null || true

# Global Docker cleanup
docker container prune -f
docker image prune -af
docker volume prune -f
docker network prune -f
docker builder prune -af
docker system df
```

## 2. Prerequisites

## 2.1 Install Docker

Install Docker Desktop (macOS) or Docker Engine (Linux).

On MacOS need to install the `Docker desktop` app.

On Linux Ubuntu:

```bash
sudo apt update
sudo apt install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2.2 Install kubectl

```bash
# On MacOS
brew install kubectl
# On Ubuntu
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/<architecture>/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```
where `architecture` is `amd64` or `arm64`.

## 2.3 Install kind

macOS (Homebrew):

```bash
brew update
brew install kind
```

Ubuntu Linux:

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.29.0/kind-linux-<architecture>

chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
kind version
```

## 2.4 Install k9s

```bash
# On MacOS
brew install k9s

# On Ubuntu
curl -sS https://webinstall.dev/k9s | bash
```

## 2.5 Create cluster and namespace

Create your cluster with your preferred local K8S provider:

```bash
# Kind example
kind create cluster --config k8s/kind-http-registry.yaml

# Minikube example
minikube start
```

Then continue with generic Kubernetes commands:

```bash
kubectl create namespace realstate-fizgon
kubectl config set-context --current --namespace=realstate-fizgon
```

Important for kind:
- `k8s/kind-http-registry.yaml` configures containerd to pull from `host.docker.internal:5001` using HTTP.
- If your cluster already exists, recreate it so this configuration is applied.

## 2.6 Network setup (`host.docker.internal`)

This project uses `host.docker.internal:5001` as Docker registry endpoint for image pushes and pulls.

Important behavior:
- `host.docker.internal` is meant to represent the host machine where Docker/Kind runs.
- You can define `host.docker.internal` in `/etc/hosts` on the host if needed.
- It can map to `127.0.0.1` for host-local commands (`curl`, `docker push`) but not always for pulls done by Kubernetes nodes.
- In many setups, Kind node containers need a non-loopback host IP (for example, a Docker bridge/gateway IP visible in `ifconfig`).

Inspect host interfaces:

```bash
ifconfig
```

Common candidates are Docker bridge addresses like `172.18.0.1`.

Check what the Kind node resolves for `host.docker.internal`:

```bash
docker exec -it realstate-fizgon-control-plane getent hosts host.docker.internal
```

If needed, inspect default gateway from inside the Kind node:

```bash
docker exec -it realstate-fizgon-control-plane sh -c "ip route | awk '/default/ {print \\$3}'"
```

Validate registry reachability from the Kind node:

```bash
docker exec -it realstate-fizgon-control-plane curl -fsS http://host.docker.internal:5001/v2/_catalog
```

If this fails, map `host.docker.internal` to a reachable host IP (in host DNS/hosts and/or Docker network setup), recreate the kind cluster, and retry.

## 2.7 Build and push Docker images for current project

Start a local Docker registry (required for `host.docker.internal:5001/...` tags):

```bash
docker rm -f realstate-local-registry 2>/dev/null || true
docker run -d --restart=always -p 5001:5000 --name realstate-local-registry registry:2
curl -fsS http://host.docker.internal:5001/v2/_catalog
```

```bash
docker build -t host.docker.internal:5001/property-listing-idealista-scraper:local -f propertyListingIdealistaScraper/Dockerfile.local propertyListingIdealistaScraper

docker build -t host.docker.internal:5001/property-detail-idealista-scraper:local -f propertyDetailIdealistaScraper/Dockerfile.local propertyDetailIdealistaScraper

docker build -t host.docker.internal:5001/notification-message-sender:local -f notificationMessageSender/Dockerfile.local notificationMessageSender

docker push host.docker.internal:5001/property-listing-idealista-scraper:local
docker push host.docker.internal:5001/property-detail-idealista-scraper:local
docker push host.docker.internal:5001/notification-message-sender:local
```

## 2.8 DNS records for internet exposure

Create DNS records so every subdomain resolves to the public IP of your main K8S ingress entrypoint (`<yourDomain>`).

Recommended records:
- `rabbitmq.<yourDomain>` -> `<yourDomain>`
- `prometheus.<yourDomain>` -> `<yourDomain>`
- `grafana.<yourDomain>` -> `<yourDomain>`
- `mongodb.<yourDomain>` -> `<yourDomain>`
- `notification.<yourDomain>` -> `<yourDomain>`
- `idealistalist.<yourDomain>` -> `<yourDomain>`
- `idealistadetail.<yourDomain>` -> `<yourDomain>`

`mongodb` and AMQP (`rabbitmq` on port `5672`) are TCP services, so clients must connect with explicit port:
- `mongodb.<yourDomain>:27017`
- `rabbitmq.<yourDomain>:5672`

## 3. Prepare secrets.json for each microservice

Each service reads `secrets.json` from `/app/secrets.json`.
`Dockerfile.local` includes `secrets-example.json`, but production credentials must be injected as Kubernetes Secret.

1. Update local files:
- `propertyListingIdealistaScraper/secrets.json`
- `propertyDetailIdealistaScraper/secrets.json`
- `notificationMessageSender/secrets.json`

2. Create K8S secrets:

```bash
kubectl -n realstate-fizgon create secret generic property-listing-secrets \
  --from-file=secrets.json=propertyListingIdealistaScraper/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n realstate-fizgon create secret generic property-detail-secrets \
  --from-file=secrets.json=propertyDetailIdealistaScraper/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n realstate-fizgon create secret generic notification-message-sender-secrets \
  --from-file=secrets.json=notificationMessageSender/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 4. Deploy external services required by setup

## 4.1 RabbitMQ (with management plugin)

```bash
kubectl apply -f k8s/rabbitmq.yaml
```

Initialize queue/users as in `doc/manualSetup.md`:

```bash
RABBIT_POD=$(kubectl -n realstate-fizgon get pod -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')

kubectl -n realstate-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl add_user propertylist_user '<some password1>'
kubectl -n realstate-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl add_user propertydetail_user '<some password2>'
kubectl -n realstate-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_permissions -p dev propertylist_user ".*" ".*" ".*"
kubectl -n realstate-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_permissions -p dev propertydetail_user ".*" ".*" ".*"
kubectl -n realstate-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_user_tags propertylist_user management
kubectl -n realstate-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_user_tags propertydetail_user management
```

Expose management UI locally:

```bash
kubectl -n realstate-fizgon port-forward svc/rabbitmq 15672:15672
```

## 4.2 MongoDB (StatefulSet + persistent volume)

MongoDB is intentionally persistent (not volatile) in this setup.

```bash
kubectl apply -f k8s/mongodb.yaml
```

Create app DB user (matches `propertyDetailIdealistaScraper/secrets.json`):

```bash
MONGO_POD=$(kubectl -n realstate-fizgon get pod -l app=mongodb -o jsonpath='{.items[0].metadata.name}')

kubectl -n realstate-fizgon exec -it "$MONGO_POD" -- mongosh --eval 'use idealistaScraper; db.createUser({user:"propertydetail_user", pwd:"<some password>", roles:[{role:"readWrite", db:"idealistaScraper"}]});'
```

## 4.3 Prometheus

First create `web.yml` (Prometheus web auth config), then create the K8S secret.

Quick test file (replace password later):

```bash
cat > ./web.yml <<'EOF'
basic_auth_users:
  grafana: $2y$05$5fQj4gQ2Y3gW2w5j8xH9Oe9ptfM8k7RCjYdW0h4O0kYwdyq7A6f6G
EOF
```

Production approach (generate your own bcrypt hash), aligned with `doc/manualSetup.md`:

```bash
python3 -m pip install --user bcrypt
python3 - <<'PY'
import getpass, bcrypt
password = getpass.getpass("Prometheus password for grafana: ").encode("utf-8")
print(bcrypt.hashpw(password, bcrypt.gensalt()).decode("utf-8"))
PY
```

Then write the printed hash into `./web.yml`:

```bash
cat > ./web.yml <<'EOF'
basic_auth_users:
  grafana: <PASTE_BCRYPT_HASH_HERE>
EOF
chmod 600 ./web.yml
```

Create K8S secret:

```bash
kubectl -n realstate-fizgon create secret generic prometheus-web-config \
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
kubectl -n realstate-fizgon port-forward svc/prometheus 9090:9090
kubectl -n realstate-fizgon port-forward svc/grafana 3000:3000
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
kubectl -n realstate-fizgon get ingress
```

Important:
- In cloud Kubernetes, use a `LoadBalancer` service for ingress-nginx and point DNS records to that external IP.
- In bare-metal/local clusters, ingress is usually `NodePort`. Publish ports `80`, `443`, `5672`, and `27017` from the host/router/firewall to the node where ingress-nginx runs.
- HTTP host-based ingress applies to HTTP services only (`rabbitmq` management UI, `prometheus`, `grafana`, `notification` endpoints). `mongodb` and AMQP are exposed through TCP ports.
- `k8s/ingress-http.yaml` is a template and uses `${DNS_REAL_STATE_FIZGON_DOMAIN}`. If `envsubst` is missing, install `gettext` (`brew install gettext` on macOS, `sudo apt-get install gettext-base` on Ubuntu).

## 6. Deploy the three project microservices

Important:
- In `propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml`, replace NFS placeholders:
  - `NFS_SERVER_IP_OR_DNS`
  - `/exports/realstate-fizgon-images`
- This mount persists downloaded images (`/app/output/images`) outside volatile pods.
- `propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml` uses `storageClassName: ""` for both PV and PVC, so pre-bound static volumes work correctly without storage class mismatch.

Apply:

```bash
kubectl apply -f propertyListingIdealistaScraper/k8s/propertyListingIdealistaScraper.yaml
kubectl apply -f propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml
kubectl apply -f notificationMessageSender/k8s/notificationMessageSender.yaml
```

For restarting pods:
```bash
kubectl rollout restart deployment/property-listing-idealista-scraper
kubectl rollout restart deployment/property-detail-idealista-scraper
kubectl rollout restart deployment/notification-message-sender
```

## 7. Rollout restart commands

Use after updating image tags or secrets:

```bash
kubectl -n realstate-fizgon rollout restart deployment/property-listing-idealista-scraper
kubectl -n realstate-fizgon rollout restart deployment/property-detail-idealista-scraper
kubectl -n realstate-fizgon rollout restart deployment/notification-message-sender
kubectl -n realstate-fizgon rollout restart deployment/rabbitmq
kubectl -n realstate-fizgon rollout restart deployment/prometheus
kubectl -n realstate-fizgon rollout restart deployment/grafana
kubectl -n realstate-fizgon rollout restart statefulset/mongodb
kubectl -n ingress-nginx rollout restart deployment/ingress-nginx-controller
```

## 8. Validation checklist

```bash
kubectl -n realstate-fizgon get pods
kubectl -n realstate-fizgon get svc
kubectl -n realstate-fizgon get pvc
kubectl -n realstate-fizgon get ingress
kubectl -n ingress-nginx get svc ingress-nginx-controller
```

Tail logs:

```bash
kubectl -n realstate-fizgon logs deploy/property-listing-idealista-scraper -f
kubectl -n realstate-fizgon logs deploy/property-detail-idealista-scraper -f
kubectl -n realstate-fizgon logs deploy/notification-message-sender -f
```

Validate metrics endpoint from inside cluster:

```bash
kubectl -n realstate-fizgon run metrics-test --rm -it --image=curlimages/curl -- \
  curl -s http://notification-message-sender:9464/metrics | head
```

## 9. Notes on architecture mapping

- `propertyListingIdealistaScraper` publishes property URLs to RabbitMQ queue `property-listing-urls`.
- `propertyDetailIdealistaScraper` consumes those URLs, stores property data in MongoDB, and publishes notification payloads to `outgoing-notification-messages`.
- `notificationMessageSender` consumes outgoing notifications and sends WhatsApp messages.
- Prometheus scrapes service metrics; Grafana visualizes them.

This mirrors the flow defined in `doc/architecture/property-scraper-architecture.dot` and operational requirements from `doc/manualSetup.md`.
