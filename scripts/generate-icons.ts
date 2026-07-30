import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const sizes = [192, 512];
const outDir = join(process.cwd(), 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const svgPath = join(process.cwd(), 'public', 'favicon.svg');

async function main(): Promise<void> {
  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size, { fit: 'contain', background: '#0b100e' })
      .png()
      .toFile(join(outDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Le contenu important reste dans la zone sûre centrale (80 %) des icônes maskable Android.
  const safeLogo = await sharp(svgPath)
    .resize(320, 352, { fit: 'contain', background: '#0b100e' })
    .png()
    .toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b100e' } })
    .composite([{ input: safeLogo, left: 96, top: 80 }])
    .png()
    .toFile(join(outDir, 'icon-maskable.png'));
  console.log('Generated icon-maskable.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
