#!/bin/bash
# Regenerates public/og.png (1200x630), the social share card.
# Run from anywhere: bash tools/make-og.sh (needs ImageMagick).
set -euo pipefail
cd "$(dirname "$0")/.."

BG="#181825"; FG="#cdd6f4"; DIM="#a6adc8"; DARK="#11111b"
TITLE_L1="JavaScript para"
TITLE_L2="Subir de Nivel"
SUB="De usarlo a entenderlo · Libro técnico gratuito"
URL="davidxap.github.io/javascript-para-subir-de-nivel"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

magick -size 190x190 gradient:'#89b4fa-#cba6f7' \
  \( -size 190x190 xc:none -fill white -draw "roundrectangle 0,0,189,189,36,36" \) \
  -alpha off -compose CopyOpacity -composite "$TMP/badge.png"

magick -size 1200x630 xc:"$BG" "$TMP/badge.png" -gravity NorthWest -geometry +90+190 -composite \
  -fill "$DARK" -font /usr/share/fonts/TTF/JetBrainsMono-Bold.ttf -pointsize 92 -draw "text 132,290 'JS'" \
  -fill "$FG" -font /usr/share/fonts/TTF/DejaVuSans-Bold.ttf -pointsize 58 \
  -draw "text 340,250 'JavaScript para'" -draw "text 340,320 'Subir de Nivel'" \
  -fill "$DIM" -font /usr/share/fonts/TTF/DejaVuSans.ttf -pointsize 33 -draw "text 342,388 '$SUB'" \
  -fill "#89b4fa" -font /usr/share/fonts/TTF/JetBrainsMono-Regular.ttf -pointsize 26 -draw "text 342,442 '$URL'" \
  public/og.png

identify public/og.png
