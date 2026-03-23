#!/usr/bin/env bash
# Creates the anchor database with the PostGIS extension.
# Mounted at /docker-entrypoint-initdb.d/ — runs once on first postgres initialisation.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE anchor;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "anchor" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
EOSQL
