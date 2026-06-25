#!/bin/bash

echo "=== CORRIGIENDO COMPONENTES PARA USAR API ==="

# Lista de archivos a corregir
FILES=(
  "src/components/AsignarUsuarios.jsx"
  "src/components/Dashboard.jsx"
  "src/components/GestionUsuarios.jsx"
  "src/components/Home.jsx"
  "src/components/Login.jsx"
  "src/components/Register.jsx"
  "src/components/SilenciarNotificaciones.jsx"
  "src/components/StatsPage.jsx"
  "src/components/TareaDetail.jsx"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "Procesando: $FILE"
    
    # Reemplazar import de axios por API
    sed -i 's/import axios from "axios";/import API from "..\/api";/' "$FILE"
    sed -i "s/import axios from 'axios';/import API from '..\/api';/" "$FILE"
    
    # Reemplazar axios.get por API.get
    sed -i 's/axios\.get/API.get/g' "$FILE"
    
    # Reemplazar axios.post por API.post
    sed -i 's/axios\.post/API.post/g' "$FILE"
    
    # Reemplazar axios.put por API.put
    sed -i 's/axios\.put/API.put/g' "$FILE"
    
    # Reemplazar axios.delete por API.delete
    sed -i 's/axios\.delete/API.delete/g' "$FILE"
    
    # Eliminar la variable API si está definida como constante
    sed -i '/const API = import.meta.env.VITE_BACKEND_URL/d' "$FILE"
    
    echo "  ✅ Corregido"
  else
    echo "  ⚠️ Archivo no encontrado: $FILE"
  fi
done

echo ""
echo "=== VERIFICANDO CAMBIOS ==="
grep -r "API\." src/components/ | grep -v "api.js" | head -20

echo ""
echo "=== COMPONENTES CORREGIDOS ==="
