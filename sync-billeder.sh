#!/bin/sh
# Konverterer billeder/*.heic til public/reoler/*.jpg (bruges efter du har omdøbt/nummereret billederne).
# Navneformat: "NN - Beskrivelse.heic"  -> NN bestemmer rækkefølgen på Reoler-siden.
cd "$(dirname "$0")"
rm -f public/reoler/*.jpg
mkdir -p public/reoler
for f in billeder/*.heic billeder/*.HEIC billeder/*.jpg; do
  [ -e "$f" ] || continue
  n=$(basename "$f"); n="${n%.*}"
  sips -s format jpeg -Z 1400 "$f" --out "public/reoler/$n.jpg" >/dev/null && echo "✓ $n"
done
