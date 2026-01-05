# TaskNebula Installation Guide

## Prerequisites

- **Docker** 20.10 or later
- **Docker Compose** v2.0 or later
- **2GB RAM** minimum (4GB recommended)
- **10GB disk space**

## Quick Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/neuraparse/tasknebula.git
cd tasknebula
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env  # or any text editor
```

**Required settings:**

```env
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-super-secret-key-at-least-32-characters

# Your domain or localhost
NEXTAUTH_URL=http://localhost:3000
```

### Step 3: Start Application

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Step 4: Access Application

Open **http://localhost:3000** in your browser.

---

## OAuth Configuration (Optional)

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Homepage URL: `http://localhost:3000`
4. Set Callback URL: `http://localhost:3000/api/auth/callback/github`
5. Add to `.env`:
   ```env
   AUTH_GITHUB_ID=your-client-id
   AUTH_GITHUB_SECRET=your-client-secret
   ```

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Set Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Add to `.env`:
   ```env
   AUTH_GOOGLE_ID=your-client-id
   AUTH_GOOGLE_SECRET=your-client-secret
   ```

---

## AI Features (Optional)

Add your OpenAI API key to enable AI features:

```env
OPENAI_API_KEY=sk-your-openai-api-key
```

---

## Production Deployment

### Using Custom Domain

1. Update `.env`:
   ```env
   NEXTAUTH_URL=https://your-domain.com
   ```

2. Setup reverse proxy (nginx/traefik) to handle HTTPS

### Using Docker Swarm

```bash
docker stack deploy -c docker-compose.prod.yml tasknebula
```

### Using Kubernetes

Kubernetes manifests coming soon. Contact us for enterprise deployment.

---

## Updating

```bash
# Pull latest image
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Database Connection Error

```bash
# Check if postgres is running
docker-compose -f docker-compose.prod.yml ps

# View postgres logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### Application Not Starting

```bash
# View web app logs
docker-compose -f docker-compose.prod.yml logs web

# Restart all services
docker-compose -f docker-compose.prod.yml restart
```

### Reset Database

⚠️ **Warning**: This will delete all data!

```bash
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

---

## Support

- 📧 Email: hello@neuraparse.com
- 🐛 Issues: https://github.com/neuraparse/tasknebula/issues
- 💬 Discord: https://discord.gg/neuraparse

