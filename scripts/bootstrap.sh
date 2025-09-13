#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CERT_DIR="$ROOT_DIR/traefik/certs"
DOMAIN="devbox.local"
SANDBOX_DOMAIN="sandboxes.devbox.local"
HOSTS_LINE="127.0.0.1 studio.$DOMAIN api.$DOMAIN $SANDBOX_DOMAIN"

mkdir -p "$CERT_DIR"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Installing (see https://github.com/FiloSottile/mkcert)"
  case "$(uname -s)" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install mkcert nss || true
      else
        echo "Homebrew not found. Install mkcert manually."; exit 1
      fi
      ;;
    Linux)
      echo "Please install mkcert via your package manager (e.g., sudo apt install mkcert libnss3-tools).";
      ;;
    *)
      echo "Unsupported OS. Install mkcert manually."; exit 1
      ;;
  esac
fi

if ! mkcert -CAROOT >/dev/null 2>&1; then
  echo "Creating local CA..."
  mkcert -install
fi

pushd "$CERT_DIR" >/dev/null
CERT_NAME="devbox-local"

if [ ! -f "$CERT_NAME.pem" ] || [ ! -f "$CERT_NAME-key.pem" ]; then
  echo "Generating SAN cert for localhost and devbox domains..."
  mkcert -cert-file "$CERT_NAME.pem" -key-file "$CERT_NAME-key.pem" \
    localhost 127.0.0.1 ::1 \
    "studio.$DOMAIN" "api.$DOMAIN" "$SANDBOX_DOMAIN" "*.${SANDBOX_DOMAIN}" "*.${DOMAIN}" "$DOMAIN"
fi
popd >/dev/null

echo "\nTLS certificates ready in $CERT_DIR"

bash "$ROOT_DIR/scripts/add-hosts.sh" || true

echo "Bootstrap complete. Run: make up"
