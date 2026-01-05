# TaskNebula SSL Deployment Guide

Bu dokümantasyon TaskNebula projesinin SSL sertifikası ile nasıl çalıştırılacağını açıklar.

## 🚀 Hızlı Başlangıç

### 1. SSL Sertifikası Oluşturma

```bash
# SSL sertifikasını oluştur
./scripts/generate-ssl.sh
```

### 2. Uygulamayı Başlatma

```bash
# Docker Compose ile başlat
docker compose up -d
```

### 3. Erişim

- **HTTPS**: https://tasknebula.nowflow.io:8445
- **HTTP**: http://tasknebula.nowflow.io:8081 (HTTPS'e yönlendirilir)

## 📋 Konfigürasyon Detayları

### Port Yapılandırması

| Servis | İç Port | Dış Port | Açıklama |
|--------|---------|----------|----------|
| Nginx (HTTP) | 80 | 8081 | HTTP trafiği (HTTPS'e yönlendirir) |
| Nginx (HTTPS) | 443 | 8445 | HTTPS trafiği |
| PostgreSQL | 5432 | 5433 | Veritabanı |
| Redis | 6379 | 6380 | Cache |
| Web App | 3000 | - | Nginx üzerinden erişilir |

### Domain Konfigürasyonu

- **Domain**: tasknebula.nowflow.io
- **SSL Sertifikası**: Self-signed (development için)
- **Güvenlik**: TLS 1.2/1.3, güvenli cipher'lar

## 🔧 Nginx Konfigürasyonu

### SSL Ayarları

- **Sertifika**: `/etc/nginx/ssl/tasknebula.nowflow.io.crt`
- **Private Key**: `/etc/nginx/ssl/tasknebula.nowflow.io.key`
- **Protokoller**: TLSv1.2, TLSv1.3
- **HSTS**: Aktif (1 yıl)

### Güvenlik Headers

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000

## 🛠️ Yönetim Komutları

### Container'ları Görüntüleme

```bash
docker compose ps
```

### Logları İnceleme

```bash
# Tüm servisler
docker compose logs

# Belirli bir servis
docker compose logs nginx
docker compose logs web
docker compose logs postgres
```

### Servisleri Durdurma

```bash
docker compose down
```

### Servisleri Yeniden Başlatma

```bash
docker compose restart
```

## 🔍 Sağlık Kontrolü

### API Health Check

```bash
# HTTPS üzerinden
curl -k https://localhost:8445/api/health

# HTTP üzerinden (HTTPS'e yönlendirilir)
curl http://localhost:8081/api/health
```

### Beklenen Yanıt

```json
{
  "status": "healthy",
  "timestamp": "2025-12-10T15:04:42.617Z",
  "uptime": 13.885261756,
  "checks": {
    "database": "ok",
    "memory": "ok"
  }
}
```

## ⚠️ Önemli Notlar

1. **Self-Signed Sertifika**: Bu kurulum development/test amaçlıdır. Production için geçerli SSL sertifikası kullanın.

2. **Browser Uyarısı**: Self-signed sertifika nedeniyle tarayıcı güvenlik uyarısı gösterecektir. "Advanced" > "Proceed to site" ile devam edebilirsiniz.

3. **Port Çakışması**: Diğer projelerle port çakışmasını önlemek için farklı portlar kullanılmıştır.

4. **Domain Ayarı**: Yerel test için `/etc/hosts` dosyasına şu satır eklenmiştir:
   ```
   127.0.0.1 tasknebula.nowflow.io
   ```

5. **SSL Sertifikası**: `tasknebula.nowflow.io` domain'i için doğru şekilde oluşturulmuştur.

## 🔄 Güncelleme

Konfigürasyon değişikliklerinden sonra:

```bash
# Servisleri yeniden başlat
docker compose down
docker compose up -d
```

## 📞 Sorun Giderme

### SSL Sertifikası Yenileme

```bash
# Mevcut sertifikayı sil
rm -rf nginx/ssl/*

# Yeni sertifika oluştur
./scripts/generate-ssl.sh

# Nginx'i yeniden başlat
docker compose restart nginx
```

### Container Logları

```bash
# Hata ayıklama için detaylı loglar
docker compose logs -f nginx
docker compose logs -f web
```
