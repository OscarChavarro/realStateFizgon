# RabbitMq management

## RabbitMq installation

On MacOS, this set of projects requires to install and configure a RabbitMq server. It can be
done by:

```bash
brew update
brew install rabbitmq
rabbitmq-plugins enable rabbitmq_management
brew services start rabbitmq
```

And browse to http://localhost:15672/ . Default user `guest` and default password `guest` are encouraged to be changed! In the web UI this can be done on the `Admin` tab. Also with the following commands:

```bash
rabbitmqctl add_user <ADMIN_USER> '<PASSWORD>'
rabbitmqctl set_permissions -p / <ADMIN_USER> ".*" ".*" ".*"
rabbitmqctl set_user_tags <ADMIN_USER> administrator
rabbitmqctl list_users
rabbitmqctl set_permissions -p dev <ADMIN_USER> ".*" ".*" ".*"      
rabbitmqctl list_permissions -p /
rabbitmqctl delete_user guest
```

## RabbitMq initial configuration

```bash
rabbitmqctl add_vhost dev
rabbitmqctl add_user propertylist_user '<some password1>'
rabbitmqctl add_user propertydetail_user '<some password2>'

rabbitmqctl set_permissions -p dev propertylist_user ".*" ".*" ".*"
rabbitmqctl set_permissions -p dev propertydetail_user ".*" ".*" ".*"

rabbitmqadmin -V dev declare exchange name=events.x type=topic durable=true
rabbitmqadmin -H localhost -P 15672 -u <ADMIN_USER> -p '<PASSWORD>' -V dev declare exchange name=events.x type=topic durable=true
rabbitmqadmin -H localhost -P 15672 -u <ADMIN_USER> -p '<PASSWORD>' -V dev declare queue name=serviceB.q durable=true
rabbitmqctl set_user_tags propertylist_user management
rabbitmqctl set_user_tags propertydetail_user management

# Binding
rabbitmqadmin -H localhost -P 15672 -u <ADMIN_USER> -p '<PASSWORD>' -V dev \
  declare binding source=events.x destination_type=queue destination=serviceB.q routing_key="property.list.updated"
rabbitmqadmin -H localhost -P 15672 -u <ADMIN_USER> -p '<PASSWORD>' -V dev \
  declare binding source=events.x destination_type=queue destination=serviceB.q routing_key="property.#"
```

## RabbitMq manual test on CLI for validating micro service user credentials

Now it can be tested manually if messages can be produced and consumed:

```bash
# Verify that users for micro services have proper permissions .* .* .*
rabbitmqctl list_permissions -p dev | egrep 'propertylist_user|propertydetail_user'

# Write a message
rabbitmqadmin -H localhost -P 15672 -u propertylist_user -p '<some password1>' -V dev \
  publish exchange=events.x routing_key="property.list.updated" payload='{"hello":"world"}' properties='{"content_type":"application/json"}'

# Consume a message
rabbitmqadmin -H localhost -P 15672 -u propertydetail_user -p '<some password2>' -V dev \
  get queue=serviceB.q requeue=false

# Should show something like this the first time, and "No items" when retried:
# +-----------------------+----------+---------------+-------------------+---------------# +------------------+-------------+
# |      routing_key      | exchange | message_count |      payload      | payload_bytes | payload_encoding | redelivered |
# +-----------------------+----------+---------------+-------------------+---------------+------------------+-------------+
# | property.list.updated | events.x | 0             | {"hello":"world"} | 17            | string           | False       |
# +-----------------------+----------+---------------+-------------------+---------------+------------------+-------------+
```

After this manual test works, put the credentials in the `secrets.json` file for each micro service.

# MongoDB management

The `propertyDetailScraper` micro service uses a MongoDB to store the scraped property  information. To install this database locally on MacOS do:

```bash
brew tap mongodb/brew
brew install mongodb-community mongosh
sudo brew services start mongodb-community
```

Edit MongoDB configuration to accept external/local connections as needed, update bind IP in:

```bash
/opt/homebrew/etc/mongod.conf
```

Use:

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0
```

Then restart MongoDB and verify is working:

```bash
brew services restart mongodb-community
```

Verify MongoDB is running:

```bash
brew services list | grep mongodb-community
mongosh --eval "db.runCommand({ ping: 1 })"
```

Create the database `idealistaScraper` and an application user:

```bash
mongosh
```

Then execute in the shell:

```javascript
use idealistaScraper
db.createUser({user: "propertydetail_user", pwd: "<some password>", roles: [{ role: "readWrite", db: "idealistaScraper" }]})
db.getUsers()
```

Connect from terminal with authentication:

```bash
mongosh --host localhost --port 27017 \
  --username propertydetail_user \
  --password <some password> \
  --authenticationDatabase admin idealistaScraper
```

# Prometheus management

To install:

```bash
brew update
brew install prometheus
brew services start prometheus
```

Navigate to `http://localhost:9090`.

In order to enable basic authentication for Prometheus, start generating a hash from a given password:

```bash
cat > gen-pass.py <<'PY'
import getpass, bcrypt
password = getpass.getpass("Password: ").encode("utf-8")
print(bcrypt.hashpw(password, bcrypt.gensalt()).decode("utf-8"))
PY

python3 -m pip install --user bcrypt
HASH="$(python3 gen-pass.py)"
rm -f gen-pass.py
echo "$HASH"
```

Note that hash is in the `$HASH` environment variable, so use the same terminal to create a `web.yml` file:

```bash
mkdir -p ~/prometheus-sec
cat > ~/prometheus-sec/web.yml <<EOF
basic_auth_users:
  grafana: $HASH
EOF
chmod 600 ~/prometheus-sec/web.yml
```

Copy the created file to `/opt/homebrew/etc/prometheus-web.yml` and add the line `/opt/homebrew/etc/prometheus.args ` to `/opt/homebrew/etc/prometheus.args`. Then restart prometheus:

```bash
brew services restart prometheus
```

Now navigating to `http://localhost:9090` should require a user and a password. Take note of this credentials
and use them for `secrets.json` files in all micro services.

# Grafana management

This project uses Prometheus and Grafana for observability. To install in local environment, follow:

```bash
brew update
brew install grafana
brew services start grafana
```

Navigate to `http://localhost:3000` and change admin password.
