# CHRONO Maple

An original low-poly tree family created specifically for CHRONO's personal forest.

## Assets

- `seedling.glb` — a young green sprout with a small CHRONO energy ring.
- `growing.glb` — a branching green maple with a visible energy path.
- `mature.glb` — an autumn maple with a larger crown and luminous time markers.

The `.glb` files are generated from `tools/blender/generate_chrono_maple.py`. The
generated `.blend` source files are intentionally retained so the team can refine
the art direction without reverse-engineering the runtime models.

## Regenerating

From the repository root on Windows:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background `
  --python tools/blender/generate_chrono_maple.py
```

These are original project assets and do not contain third-party models or textures.

For visual QA after editing the generator, render all three stages with:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background `
  --python tools/blender/render_chrono_maple_preview.py `
  -- "$env:TEMP\chrono-maple-preview"
```
