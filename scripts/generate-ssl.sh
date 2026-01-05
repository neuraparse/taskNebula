#!/bin/bash

# SSL Certificate Generation Script for TaskNebula
# This script generates a self-signed SSL certificate for development/testing

DOMAIN="tasknebula.nowflow.io"
SSL_DIR="./nginx/ssl"
CERT_FILE="$SSL_DIR/$DOMAIN.crt"
KEY_FILE="$SSL_DIR/$DOMAIN.key"

echo "🔐 Generating SSL certificate for $DOMAIN..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate private key
echo "📝 Generating private key..."
openssl genrsa -out "$KEY_FILE" 2048

# Generate certificate signing request
echo "📝 Generating certificate signing request..."
openssl req -new -key "$KEY_FILE" -out "$SSL_DIR/$DOMAIN.csr" -subj "/C=TR/ST=Istanbul/L=Istanbul/O=TaskNebula/OU=Development/CN=$DOMAIN"

# Generate self-signed certificate
echo "📝 Generating self-signed certificate..."
openssl x509 -req -in "$SSL_DIR/$DOMAIN.csr" -signkey "$KEY_FILE" -out "$CERT_FILE" -days 365 -extensions v3_req -extfile <(
cat <<EOF
[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
EOF
)

# Set proper permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

# Clean up CSR file
rm "$SSL_DIR/$DOMAIN.csr"

echo "✅ SSL certificate generated successfully!"
echo "📁 Certificate: $CERT_FILE"
echo "🔑 Private Key: $KEY_FILE"
echo ""
echo "⚠️  Note: This is a self-signed certificate for development purposes."
echo "   Your browser will show a security warning. You can safely proceed."
echo ""
echo "🚀 You can now start the application with: docker-compose up -d"
