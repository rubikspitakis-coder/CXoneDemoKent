#!/bin/sh
# Provision/sync the database schema at runtime (has DB network access)
echo "[start.sh] Running prisma db push..."
npx prisma db push --accept-data-loss
echo "[start.sh] Starting server..."
exec node server.js
