#!/bin/bash

# TaskNebula Database Reset Script
# ⚠️  WARNING: This will delete all data in the database!

set -e

echo "⚠️  TaskNebula Database Reset"
echo "============================"
echo ""
echo "This will:"
echo "  1. Drop the existing database"
echo "  2. Create a new database"
echo "  3. Run all migrations"
echo ""
echo "⚠️  ALL DATA WILL BE LOST!"
echo ""

read -p "Are you sure you want to continue? (type 'yes' to confirm) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    echo "❌ Aborted"
    exit 1
fi

# Load DATABASE_URL from .env
if [ -f "packages/db/.env" ]; then
    export $(cat packages/db/.env | grep DATABASE_URL | xargs)
fi

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

if [ -z "$DB_NAME" ]; then
    echo "❌ Could not extract database name from DATABASE_URL"
    exit 1
fi

echo "🗄️  Database: $DB_NAME"
echo ""

# Check if using Docker
if docker-compose ps postgres &> /dev/null; then
    echo "🐳 Using Docker PostgreSQL..."
    
    # Drop and recreate database
    echo "🗑️  Dropping database..."
    docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    echo "📦 Creating database..."
    docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE $DB_NAME;"
else
    echo "💻 Using local PostgreSQL..."
    
    # Drop and recreate database
    echo "🗑️  Dropping database..."
    dropdb --if-exists $DB_NAME
    
    echo "📦 Creating database..."
    createdb $DB_NAME
fi

# Run migrations
echo ""
echo "🗄️  Running migrations..."
pnpm db:generate
pnpm db:migrate

echo ""
echo "✅ Database reset complete!"
echo ""
echo "🚀 You can now start the development server with 'pnpm dev'"

