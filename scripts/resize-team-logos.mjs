import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDir = path.resolve('tmp/team-logo-inputs');
const outputDir = path.resolve('output/team-logos-1024');
const logos = [
  ['01-avinash.jpg', 'avinash-avengers-1024.png'],
  ['02-pavan-super-kings.png', 'pavan-super-kings-1024.png'],
  ['03-royal-munoths.jpeg', 'royal-munoths-1024.png'],
  ['04-misma-masters.jpeg', 'misma-masters-1024.png'],
  ['05-svamitva-warriors.jpeg', 'svamitva-warriors-1024.png'],
  ['06-parekh-superkings.jpeg', 'parekh-superkings-1024.png'],
  ['07-dressline-riders.jpeg', 'dressline-riders-1024.png'],
];

await mkdir(outputDir, { recursive: true });

for (const [sourceName, outputName] of logos) {
  const source = path.join(sourceDir, sourceName);
  const { data } = await sharp(source)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = {
    r: data[0],
    g: data[1],
    b: data[2],
    alpha: data[3] / 255,
  };
  const destination = path.join(outputDir, outputName);
  await sharp(source)
    .resize({
      width: 1024,
      height: 1024,
      fit: 'contain',
      position: 'centre',
      background,
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destination);
  console.log(destination);
}
