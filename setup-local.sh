#!/bin/bash
# ===========================================
# NOVA-X IA - Installation Locale NVIDIA CUDA
# Pont local complet pour carte graphique
# ===========================================

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                  NOVA-X IA - LOCAL SETUP                         ║"
echo "║                  NVIDIA CUDA GPU                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Node.js dependencies
echo -e "${GREEN}[1/7]${NC} Installation des dépendances npm..."
npm install

# 2. Environment file
echo -e "${GREEN}[2/7]${NC} Configuration de l'environnement..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}✅ Fichier .env créé. Édite-le avec tes préférences.${NC}"
else
  echo -e "${GREEN}✅ Fichier .env existant${NC}"
fi

# 3. Build frontend
echo -e "${GREEN}[3/7]${NC} Build du frontend..."
npm run build

# 4. Python dependencies
echo ""
echo -e "${GREEN}[4/7]${NC} Dépendances Python (à installer manuellement):"
echo ""
echo "  # Coqui TTS (voix locale)"
echo "  pip install TTS"
echo ""
echo "  # Faster-Whisper (transcription GPU)"
echo "  pip install faster-whisper"
echo ""
echo "  # SadTalker (lip sync)"
echo "  git clone https://github.com/OpenTalker/SadTalker"
echo "  cd SadTalker && pip install -r requirements.txt && cd .."
echo ""

# 5. Check services
echo -e "${GREEN}[5/7]${NC} Vérification des services locaux..."
echo ""

# SD WebUI
if curl -s http://127.0.0.1:7860/sdapi/v1/sd-models > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Automatic1111 WebUI: En ligne (port 7860)${NC}"
else
  echo -e "${RED}❌ Automatic1111 WebUI: Hors ligne${NC}"
  echo "   → Lance: cd stable-diffusion-webui && python launch.py --api --listen --xformers"
fi

# Ollama
if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Ollama: En ligne (port 11434)${NC}"
else
  echo -e "${YELLOW}⚠️  Ollama: Hors ligne (optionnel si Groq configuré)${NC}"
  echo "   → Installe: https://ollama.ai"
fi

# 6. NVIDIA check
echo ""
echo -e "${GREEN}[6/7]${NC} Vérification du GPU NVIDIA..."
if command -v nvidia-smi &> /dev/null; then
  echo -e "${GREEN}✅ NVIDIA GPU détecté:${NC}"
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo "   (nvidia-smi disponible mais lecture GPU impossible)"
else
  echo -e "${YELLOW}⚠️  nvidia-smi non trouvé. Assure-toi que les drivers NVIDIA sont installés.${NC}"
fi

# 7. Start instructions
echo ""
echo -e "${GREEN}[7/7]${NC} Instructions de démarrage"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    DÉMARRAGE                                     ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║                                                                  ║"
echo "║  1. Lance SD WebUI:                                             ║"
echo "║     cd stable-diffusion-webui                                    ║"
echo "║     python launch.py --api --listen --xformers                   ║"
echo "║                                                                  ║"
echo "║  2. (Optionnel) Lance Ollama:                                   ║"
echo "║     ollama serve                                                 ║"
echo "║                                                                  ║"
echo "║  3. Lance NOVA-X IA:                                            ║"
echo "║     npm start                                                    ║"
echo "║                                                                  ║"
echo "║  4. Ouvre: http://localhost:3000                                ║"
echo "║                                                                  ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
