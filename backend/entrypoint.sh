#!/bin/sh

set -e

echo "Waiting for PostgreSQL..."

while ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
  sleep 1
done

echo "PostgreSQL is ready."

python manage.py migrate

exec "$@"