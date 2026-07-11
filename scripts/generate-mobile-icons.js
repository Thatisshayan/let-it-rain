const sharp = require("sharp");
const path = require("path");

// Usage: node scripts/generate-mobile-icons.js [path/to/source-square-image]
const SRC =
  process.argv[2] ||
  path.join(__dirname, "..", "mobile", "assets-source", "letitrain-icon-source.jpg");
const OUT_DIR = path.join(__dirname, "..", "mobile", "assets");

// The source image has a rounded-corner "mockup" frame baked into its pixels
// (black corners outside a white rounded square). iOS/Android apply their own
// icon masks on top of whatever square we provide, so we crop inward past
// that baked-in frame to get a full-bleed square before resizing — otherwise
// the two roundings could misalign and leave visible black corner slivers.
const CROP_MARGIN_RATIO = 0.115;

async function fullBleedSquare() {
  const meta = await sharp(SRC).metadata();
  const margin = Math.round(meta.width * CROP_MARGIN_RATIO);
  const size = meta.width - margin * 2;
  return sharp(SRC).extract({ left: margin, top: margin, width: size, height: size });
}

async function main() {
  await (await fullBleedSquare())
    .resize(1024, 1024, { fit: "cover" })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(path.join(OUT_DIR, "icon.png"));

  await (await fullBleedSquare())
    .resize(1024, 1024, { fit: "cover" })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(path.join(OUT_DIR, "android-icon-foreground.png"));

  // Android adaptive icon background layer — plain white to match the icon's own
  // background, avoiding a seam between the foreground artwork and this layer.
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: "#ffffff" },
  })
    .png()
    .toFile(path.join(OUT_DIR, "android-icon-background.png"));

  // Android 13+ monochrome/themed icon — best-effort: a white-silhouette alpha
  // mask derived from luminance (dark linework -> opaque, light/white -> transparent).
  const lumBuffer = await (await fullBleedSquare())
    .resize(1024, 1024, { fit: "cover" })
    .greyscale()
    .negate()
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = lumBuffer;
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const v = data[i];
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = v;
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(path.join(OUT_DIR, "android-icon-monochrome.png"));

  // Favicon (web output — low priority, app targets iOS/Android).
  await (await fullBleedSquare())
    .resize(196, 196, { fit: "cover" })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(path.join(OUT_DIR, "favicon.png"));

  console.log("Generated icon assets in", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
