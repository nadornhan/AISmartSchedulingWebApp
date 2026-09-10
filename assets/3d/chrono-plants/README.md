# CHRONO Plant Collection — design drafts

Original low-poly assets generated for visual approval before web integration.
Each species contains Blender source and GLB exports for `seedling`, `growing`,
and `mature` stages. These files are not referenced by the application yet.

Generate the collection:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background `
  --python tools/blender/generate_chrono_plant_collection.py
```

Render approval sheets:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background `
  --python tools/blender/render_chrono_plant_collection.py `
  -- "$env:TEMP\chrono-plant-collection-preview"
```

No third-party models or textures are included.

Approved GLBs are copied into `frontend/web/public/models/plants`. Generate
matching transparent 2D UI thumbnails from those same models with:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background --python tools/blender/render_plant_thumbnails.py
```

## Legendary CHRONO tree

The `chrono` family is a final-tier original asset with a larger silhouette,
split ancient trunk, time core, orbital clock halos, energy constellations, and
floating time crystals. Generate and render it separately with:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background --python tools/blender/generate_chrono_legendary_tree.py

& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background --python tools/blender/render_chrono_legendary_tree.py `
  -- "$env:TEMP\chrono-legendary-tree-preview"
```
