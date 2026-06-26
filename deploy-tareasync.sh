#!/bin/bash

echo "=========================================="
echo "  DEPLOY EN https://tareasync.vercel.app"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Actualizar vercel.json
echo -e "\n${YELLOW}[1/5] Actualizando vercel.json...${NC}"
cat > vercel.json << 'VJSON'
{
  "version": 2,
  "builds": [
    {
      "src": "frontend-react/api/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "frontend-react/dist/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/ping-db",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/auth/(.*)",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/tickets",
      "dest": "frontend-react/api/index.js",
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    },
    {
      "src": "/tickets/(.*)",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/admin/(.*)",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/calendar/(.*)",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/api/(.*)",
      "dest": "frontend-react/api/index.js"
    },
    {
      "src": "/",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/login",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/register",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/dashboard",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/stats",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/recuperar",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/reset/(.*)",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/tareas/(.*)",
      "dest": "frontend-react/dist/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "frontend-react/dist/$1"
    }
  ]
}
VJSON

# 2. Instalar backend
echo -e "\n${YELLOW}[2/5] Instalando backend...${NC}"
cd backend
npm install --legacy-peer-deps

# 3. Construir frontend
echo -e "\n${YELLOW}[3/5] Construyendo frontend...${NC}"
cd ../frontend-react
npm run build

# 4. Guardar en Git
echo -e "\n${YELLOW}[4/5] Guardando en Git...${NC}"
cd ..
git add .
git commit -m "deploy: $(date +%Y%m%d_%H%M%S)"
git push origin main

# 5. Desplegar en Vercel
echo -e "\n${YELLOW}[5/5] Desplegando en Vercel...${NC}"
vercel --prod --force

echo -e "\n${GREEN}=========================================="
echo "  ✅ DEPLOY COMPLETADO"
echo "==========================================${NC}"
echo ""
echo "URL: https://tareasync.vercel.app"
echo ""
echo "Verificar:"
echo "  curl https://tareasync.vercel.app/health"
echo "  curl https://tareasync.vercel.app/auth/login -X POST -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"Test123456\"}'"
