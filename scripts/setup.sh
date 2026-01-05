#!/bin/bash

# TaskNebula Setup Script
# This script automates the initial setup process

set -e

echo "🌌 TaskNebula Setup Script"
echo "=========================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Error: Node.js 22+ is required. You have $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check pnpm
echo ""
echo "📦 Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing..."
    npm install -g pnpm
fi
echo "✅ pnpm version: $(pnpm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Setup environment files
echo ""
echo "🔧 Setting up environment files..."
if [ ! -f "apps/web/.env.local" ]; then
    cp apps/web/.env.example apps/web/.env.local
    echo "✅ Created apps/web/.env.local"
else
    echo "⚠️  apps/web/.env.local already exists, skipping..."
fi

if [ ! -f "packages/db/.env" ]; then
    cp packages/db/.env.example packages/db/.env
    echo "✅ Created packages/db/.env"
else
    echo "⚠️  packages/db/.env already exists, skipping..."
fi

# Check Docker
echo ""
echo "🐳 Checking Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
    
    # Ask if user wants to start PostgreSQL
    read -p "Do you want to start PostgreSQL with Docker? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🐳 Starting PostgreSQL..."
        docker-compose up -d postgres
        echo "✅ PostgreSQL started"
        
        # Wait for PostgreSQL to be ready
        echo "⏳ Waiting for PostgreSQL to be ready..."
        sleep 5
    fi
else
    echo "⚠️  Docker is not installed. You'll need to setup PostgreSQL manually."
fi

# Run database migrations
echo ""
read -p "Do you want to run database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Generating migrations..."
    pnpm db:generate
    
    echo "🗄️  Running migrations..."
    pnpm db:migrate
    
    echo "✅ Database migrations completed"
fi

# Setup complete
echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit apps/web/.env.local with your configuration"
echo "   2. Run 'pnpm dev' to start the development server"
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Documentation:"
echo "   - Quick Start: docs/QUICK_START.md"
echo "   - Architecture: docs/ARCHITECTURE.md"
echo "   - Contributing: CONTRIBUTING.md"
echo ""
echo "Happy coding! 🌌"

