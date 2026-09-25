# CropGuide evaluation for image resize modes

Date: 2026-09-25

## Decision

Do not integrate CropGuide for #17. It is a useful vocabulary and behavior reference for conventional cropping and resize, but it would introduce a hosted product and still leave the distinctive Fit padding work to Quicksilver. Build Fit, Fill, and Stretch locally with the existing Photon dependency and browser canvas composition.

## What CropGuide provides

CropGuide is a dashboard-configured client-side image editor. Its documented browser installation either loads `https://cdn.cropguide.io/l.js` with a dashboard access key or installs `@cropguide/browser`; the integration also requires CSP allowances for CropGuide's script and app endpoint plus `blob:` image and worker sources. CropGuide says it uses blob URLs for image sizing and separate threads. It intercepts page image inputs by default, with configurable selector targeting. [Installation](https://cropguide.io/docs/installation/) [Configuration](https://cropguide.io/docs/configuration/)

Its configuration supports crop aspect ratios, crop presets, format conversion, masks, compression, and headless processing. The documented resize example preserves the image inside a 512 × 512 bound (`fit: "contain"`) and can prohibit upscaling. CropGuide's `fill` option is a flat background used for transparent images; it is not a crop-to-fill mode. [Configuration](https://cropguide.io/docs/configuration/)

The JavaScript API and the relevant resize/background features are Pro or Unlimited features. As listed on 2026-09-25, Pro is €29/month per website (€290/year) and includes 10 fields, unlimited edits, JS API, compression, flat fill background, conversion, crop presets, resize, masks, and headless processing. Unlimited is €99/month (€990/year), with unlimited fields and branding options. [Pricing](https://cropguide.io/pricing/)

## Fit against #17

| #17 behavior | CropGuide | Local implementation path |
| --- | --- | --- |
| Fit: retain every source pixel in the requested frame | Its documented `contain` resize is adjacent, but its supplied `fill` is only a transparent-image background. | Resize foreground proportionally, then compose it in the target canvas. |
| White / Black padding | Documented only as a flat fill for transparency. | Canvas fill, or Photon padding with `Rgba`. |
| Average-color padding | Not documented. | Calculate the mean of non-transparent source RGBA pixels, then fill the target canvas. |
| Ambilight padding, default | Not documented. | Draw a cover-sized source copy behind the foreground and apply a subtle Gaussian blur; tune blur and intensity with visual testing. |
| Fill: center crop without distortion | Crop and aspect-ratio tools are relevant, but its `fill` setting means something else. | Scale to cover, then center-crop to target dimensions. |
| Stretch: exact dimensions with distortion warning | Resize is relevant but does not supply Quicksilver's required mode wording or warning. | Directly resize to target dimensions and retain the warning in the UI. |

The current image conversion already constructs a `PhotonImage` from source pixels and uses `photon.resize(..., Lanczos3)` for exact output dimensions. [Image conversion](../../src/image/convert.ts) Photon exposes `resize`, coordinate crop, side-specific and uniform RGBA padding, raw pixels, and in-place Gaussian blur. [Installed Photon declarations](../../node_modules/@silvia-odwyer/photon/photon_rs.d.ts) Those primitives cover resize/crop/padding and allow average-color calculation; canvas composition supplies the two-layer Ambilight result. The current unlocked-dimensions UI already correctly describes this exact-size behavior as stretching/compressing rather than cropping or fitting. [Image workspace](../../src/components/ImageWorkspace.tsx)

## Recommendation

Keep processing local. CropGuide would add an account and access key, a remote script or new package, CSP changes, dashboard configuration, and a recurring paid tier, while requiring custom work for Ambilight and average-color padding anyway. Implement the three small, explicit modes in Quicksilver instead:

- **Fit** by proportional resize plus selected padding; default to subtly blurred Ambilight.
- **Fill** by proportional cover resize plus centered crop.
- **Stretch** by direct resize, preserving its distortion warning.

This keeps all image data in the existing browser-side conversion path and makes the behavior match #17 precisely.
